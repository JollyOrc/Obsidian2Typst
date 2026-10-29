// US-024: the generator of the public sample vault `tests/fixtures/sample/`.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md and
// docs/tickets/TICKET-069-sample-vault-generator.md.
//
// Self-contained on purpose: it imports only Node built-ins, so it runs as
// `node tests/fixtures/generate.ts` and calls no plugin function (AC-3). It
// builds the note from a fixed seed and counts every construct while writing
// it; the tests compare those counts with the parser, the converter and the
// compiler (a second source each).
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {deflateSync} from 'node:zlib';

/** US-024 AC-1: the seed of every random choice. */
const SEED = 20261027;

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod ' +
  'tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam ' +
  'quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
  'consequat duis aute irure in reprehenderit voluptate velit esse cillum ' +
  'fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt ' +
  'culpa qui officia deserunt mollit anim id est laborum curabitur pretium ' +
  'tincidunt lacus nunc pulvinar sapien ligula tristique senectus netus ' +
  'malesuada fames ac turpis egestas pellentesque habitant morbi vestibulum ' +
  'tortor quam feugiat vitae ultricies eget mauris blandit aliquet nibh ' +
  'praesent semper porta vivamus suscipit viverra maecenas accumsan lacinia ' +
  'nullam varius nisl ornare donec rutrum congue leo eros cras ultrices ' +
  'phasellus placerat iaculis massa sagittis purus gravida dictum fusce ' +
  'faucibus interdum posuere lobortis scelerisque fermentum dui quisque ' +
  'sollicitudin aenean euismod elementum hendrerit vulputate mi bibendum'
).split(' ');

/**
 * US-026 AC-11: the headings of the colophon and the back notes, from the
 * word list; the sample preset maps them to `colophon` and `back-notes`.
 */
const BOOK_PARTS = {colophon: 'Senectus Netus', backNotes: 'Pretium Fames'};

/** Words that are never a title word, for links that resolve nowhere. */
const ABSENT = ['zephyrum', 'quokka', 'brontes', 'kalyx', 'vortex', 'nimbus'];

/** US-024 AC-2: the non-ASCII characters of the real file's census. */
const SPECIAL = {
  apostrophe: '’',
  ellipsis: '…',
  openQuote: '“',
  closeQuote: '”',
  eCircumflex: 'ê',
  noBreakSpace: ' ',
  degree: '°',
  emDash: '—',
  oUmlaut: 'ö',
  eAcute: 'é',
  enDash: '–',
};

type Counts = Record<string, number>;

/**
 * US-024 AC-1: mulberry32, a small seeded generator; the same seed gives the
 * same sequence on every run and platform (32-bit integer arithmetic only).
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds 1 (or `n`) to `counts[key]`. */
const add = (counts: Counts, key: string, n = 1): void => {
  counts[key] = (counts[key] ?? 0) + n;
};

/**
 * US-024 AC-2: the number of slots out of `n` that get one of `total` items,
 * spread evenly: slot `k` gets an item when the running share steps up.
 */
const spread = (k: number, n: number, total: number): boolean =>
  Math.floor(((k + 1) * total) / n) > Math.floor((k * total) / n);

/** The GitHub-style slug of US-004 AC-8b rule 2, for ASCII titles. */
const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/ +/g, '-');

const capital = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

// ---- images ----------------------------------------------------------------

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * US-024 AC-6: an opaque RGB PNG (colour type 2, no alpha, so the PDF has no
 * soft mask) of a colour, and by default a size, derived from `index`, so
 * every file has different bytes; `width` and `height` set the size (the
 * cover). Deflated at level 9 for byte-identical runs.
 */
function png(
  index: number,
  width = 40 + (index % 17) * 3,
  height = 28 + (index % 11) * 2,
): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array((1 + width * 3) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x++) {
      const band = (x + y + index) % 24 < 12;
      raw.set(
        band
          ? [(60 + index * 7) % 256, (120 + index * 3) % 256, 180]
          : [230, 220, (90 + index * 11) % 256],
        row + 1 + x * 3,
      );
    }
  }
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, {level: 9})),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** A valid baseline JPEG of 30 x 20 pixels (the bytes of the test helper). */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAAUAB4DASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAQF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AkAkaQAAAAAD/2Q==',
  'base64',
);

/**
 * US-024 AC-6: the fixed JPEG with a comment segment (`FF FE`) right after
 * the start marker that holds `index`, so every file has different bytes and
 * still decodes.
 */
function jpeg(index: number): Uint8Array {
  const text = new TextEncoder().encode(`sample image ${index}`);
  const segment = new Uint8Array(4 + text.length);
  segment.set([0xff, 0xfe, 0, text.length + 2]);
  segment.set(text, 4);
  return concat([JPEG.subarray(0, 2), segment, JPEG.subarray(2)]);
}

/** US-024 AC-2: a minimal PDF file that no note uses. */
const PDF = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n' +
    'trailer << /Root 1 0 R >>\n%%EOF\n',
);

// ---- the note --------------------------------------------------------------

/** A heading of the plan. */
interface Heading {
  level: number;
  title: string;
  /** Not a link target: the heading of a known sentence (AC-6). */
  quiet: boolean;
}

/** US-024 AC-2c: an internal link as the generator wrote it. */
interface LinkRecord {
  /** The level of the heading it resolves to (the first, when ambiguous). */
  level: number | null;
  inGlossary: boolean;
}

/**
 * US-024 AC-1, AC-2, AC-2b, AC-2c, AC-3: writes `Book.md` and counts every
 * construct while writing it. One instance per run; `text()` gives the note.
 */
class Book {
  private readonly lines: string[] = [];
  readonly kinds: Counts = {};
  readonly depths: Counts = {};
  readonly lists = {bullet: 0, ordered: 0, maxNest: 0};
  tables = 0;
  maxCols = 0;
  readonly aligns: Counts = {};
  readonly html: Counts = {};
  readonly hrefs: Counts = {};
  readonly images: Counts = {};
  readonly features: Counts = {};
  readonly anchors = {
    byText: 0,
    bySlug: 0,
    byNumberStripped: 0,
    ambiguous: 0,
    unresolved: 0,
  };
  readonly links: LinkRecord[] = [];
  readonly imageFiles = new Set<string>();
  imagesWithCaption = 0;
  imagesWithout = 0;
  comments = 0;
  firstCommentLine = 0;
  inGlossary = false;

  private readonly random: () => number;

  // A plain field, not a parameter property: Node's type stripping refuses
  // parameter properties, and the generator runs under plain `node`.
  constructor(random: () => number) {
    this.random = random;
  }

  /** A word of the filler list. */
  word(): string {
    return WORDS[Math.floor(this.random() * WORDS.length)] as string;
  }

  /** `n` filler words, the first capitalised when `capitalise`. */
  words(n: number, capitalise = false): string {
    const out = Array.from({length: n}, () => this.word());
    if (capitalise) out[0] = capital(out[0] as string);
    return out.join(' ');
  }

  /** A filler sentence of 8 to 14 words with a full stop. */
  sentence(): string {
    return `${this.words(8 + Math.floor(this.random() * 7), true)}.`;
  }

  /** The current line number (1-based) of the next line written. */
  get nextLine(): number {
    return this.lines.length + 1;
  }

  /** Writes lines as they are, then one blank line. */
  block(...lines: string[]): void {
    this.lines.push(...lines, '');
  }

  /** US-024 AC-2: a heading of `level`. */
  heading(level: number, title: string): void {
    add(this.kinds, 'heading');
    add(this.depths, `h${level}`);
    this.block(`${'#'.repeat(level)} ${title}`);
  }

  /** US-024 AC-2: a paragraph at the root (counts its paragraph). */
  paragraph(...lines: string[]): void {
    add(this.kinds, 'paragraph');
    this.block(...lines);
  }

  /** US-024 AC-2: a markdown image; `caption` empty for none. */
  image(file: string, caption: string): string {
    add(this.kinds, 'image');
    add(this.hrefs, 'image:local');
    add(this.images, (/\.(\w+)$/.exec(file)?.[1] ?? '?').toLowerCase());
    this.imageFiles.add(file);
    if (caption === '') this.imagesWithout++;
    else this.imagesWithCaption++;
    return `![${caption}](${file})`;
  }

  /** US-024 AC-2: an internal anchor link, recorded for AC-2c. */
  anchor(text: string, href: string, record: LinkRecord): string {
    add(this.kinds, 'link');
    add(this.hrefs, 'link:inline:anchor');
    this.links.push({...record, inGlossary: this.inGlossary});
    return `[${text}](${href})`;
  }

  /** US-024 AC-2b: a wikilink, recorded for AC-2c when it resolves. */
  wikilink(inner: string, level: number | null): string {
    add(this.kinds, 'wikilink');
    add(this.features, 'wikilink');
    if (level !== null) {
      this.links.push({level, inGlossary: this.inGlossary});
    }
    return `[[${inner}]]`;
  }

  /** US-024 AC-2b: an embed `![[…]]`. */
  embed(target: string, image: boolean): string {
    add(this.kinds, 'embed');
    add(this.features, image ? 'embed:image' : 'embed:note');
    if (image) this.imageFiles.add(target);
    return `![[${target}]]`;
  }

  /** US-024 AC-2: an external link `[text](https://…)`. */
  web(text: string, url: string): string {
    add(this.kinds, 'link');
    add(this.hrefs, 'link:inline:web');
    return `[${text}](${url})`;
  }

  /** US-024 AC-2: a bare address that the parser turns into a link. */
  bare(url: string): string {
    add(this.kinds, 'link');
    add(this.hrefs, 'link:linkify:web');
    return url;
  }

  /** US-024 AC-2: counts `n` inline nodes of `kind`. */
  inline(kind: string, n = 1): void {
    add(this.kinds, kind, n);
  }

  /** US-024 AC-2: `<u>text</u>`. */
  underline(text: string): string {
    add(this.kinds, 'html-inline', 2);
    add(this.html, 'html-inline:u', 2);
    return `<u>${text}</u>`;
  }

  /** US-024 AC-2: `<span>text</span>`. */
  span(text: string): string {
    add(this.kinds, 'html-inline', 2);
    add(this.html, 'html-inline:span', 2);
    return `<span>${text}</span>`;
  }

  /** US-024 AC-2: `<br>`. */
  br(): string {
    add(this.kinds, 'html-inline');
    add(this.html, 'html-inline:br');
    return '<br>';
  }

  /** US-024 AC-2: `**text**`. */
  strong(text: string): string {
    add(this.kinds, 'strong');
    return `**${text}**`;
  }

  /** US-024 AC-2: `*text*`. */
  emph(text: string): string {
    add(this.kinds, 'emph');
    return `*${text}*`;
  }

  /** US-024 AC-2: `^[text]`. */
  footnote(text: string): string {
    add(this.kinds, 'inline-footnote');
    return `^[${text}]`;
  }

  /**
   * US-024 AC-2: a list at the root; `items` are the item texts, each one
   * paragraph; `nested` (item index → texts) adds a list inside that item.
   */
  list(
    ordered: boolean,
    items: string[],
    nested: Map<number, string[]> = new Map(),
    prefix = '',
    taskMarks: (boolean | null)[] = [],
  ): string[] {
    const out: string[] = [];
    const count = (n: number, nest: number, numbered: boolean): void => {
      add(this.kinds, 'list');
      if (numbered) this.lists.ordered++;
      else this.lists.bullet++;
      this.lists.maxNest = Math.max(this.lists.maxNest, nest);
      add(this.kinds, 'item', n);
      add(this.kinds, 'paragraph', n);
    };
    count(items.length, 1, ordered);
    items.forEach((text, i) => {
      const mark = ordered ? `${i + 1}.` : '-';
      const task = taskMarks[i];
      const box =
        task === undefined || task === null ? '' : task ? '[x] ' : '[ ] ';
      if (box !== '') add(this.features, 'task');
      out.push(`${prefix}${mark} ${box}${text}`);
      const inner = nested.get(i);
      if (inner !== undefined) {
        // a nested list is always a bullet list of done tasks
        count(inner.length, 2, false);
        const pad = ' '.repeat(mark.length + 1);
        for (const t of inner) {
          add(this.features, 'task');
          out.push(`${prefix}${pad}- [x] ${t}`);
        }
      }
    });
    return out;
  }

  /**
   * US-024 AC-2: a table with a header row and `rows` body rows of `cols`
   * cells; `center` aligns every column to the centre. `cell(r, c)` gives
   * the text of a body cell.
   */
  table(
    cols: number,
    rows: number,
    center: boolean,
    cell: (r: number, c: number) => string,
    prefix = '',
  ): string[] {
    this.tables++;
    this.maxCols = Math.max(this.maxCols, cols);
    add(this.aligns, center ? 'center' : 'null', cols);
    add(this.kinds, 'table');
    add(this.kinds, 'row', rows + 1);
    add(this.kinds, 'cell', cols * (rows + 1));
    const line = (cells: string[]): string =>
      `${prefix}| ${cells.join(' | ')} |`;
    const out = [
      // lowercase: two capitalised header cells side by side would read as a
      // title in the PDF text (AC-6 finds headings by their text)
      line(Array.from({length: cols}, () => this.word())),
      `${prefix}|${Array(cols)
        .fill(center ? ':-:' : ' - ')
        .join('|')}|`,
    ];
    for (let r = 0; r < rows; r++) {
      out.push(line(Array.from({length: cols}, (_, c) => cell(r, c))));
    }
    return out;
  }

  /** US-024 AC-2: a block comment of one or two lines. */
  comment(twoLines: boolean): void {
    add(this.kinds, 'comment');
    this.comments++;
    if (this.firstCommentLine === 0) this.firstCommentLine = this.nextLine;
    const body = this.words(4, true);
    this.block(
      ...(twoLines
        ? [`<!-- ${body}: ${this.words(3)}`, `${this.words(5)} -->`]
        : [`<!-- ${body} -->`]),
    );
  }

  /** The note as written, with a final newline. */
  text(): string {
    return `${this.lines.join('\n').replace(/\n+$/, '')}\n`;
  }
}

/** US-024 AC-2c: the counts of `numberedLinks` for levels 1 to 6 (US-018 AC-2). */
function numberedLinks(links: LinkRecord[]): Counts {
  const out: Counts = {};
  for (let level = 1; level <= 6; level++) {
    out[String(level)] = links.filter(
      (l) => l.level !== null && (l.inGlossary || l.level <= level),
    ).length;
  }
  return out;
}

/** Text with every class of first and last character the census lists. */
const EDGE_CASES = [
  'see (', // ends with `(`
  'mid: ', // ends with `: ` (a blank)
];

/**
 * US-024 AC-1, AC-2, AC-2b, AC-2c, AC-3: the plan of the sample note. Returns
 * the note and everything the manifest reports about it.
 */
function writeBook(random: () => number) {
  const book = new Book(random);
  const used = new Map<string, Heading>();
  const usedSlugs = new Set<string>();

  /** A unique title of `n` capitalised words. */
  const title = (n: number): string => {
    for (;;) {
      const t = Array.from({length: n}, () => capital(book.word())).join(' ');
      const key = t.toLowerCase();
      if (!used.has(key) && !usedSlugs.has(slugOf(t)) && key !== 'glossary') {
        usedSlugs.add(slugOf(t));
        return t;
      }
    }
  };

  // -- the heading plan: 7 body chapters, then the glossary ------------------
  const BODY_H2 = 26;
  const H3 = 100;
  const H4 = 220;
  const H5 = 192;
  const H6 = 80;
  const TERMS = 42;
  const plan: Heading[] = [];
  const reg = (level: number, t: string, quiet = false): void => {
    const h = {level, title: t, quiet};
    plan.push(h);
    if (!used.has(t.toLowerCase())) used.set(t.toLowerCase(), h);
  };
  let h3Seen = 0;
  let h4Seen = 0;
  let h5Seen = 0;
  for (let c = 0; c < 7; c++) {
    reg(1, title(c % 2 === 0 ? 1 : 2));
    const h2Here =
      Math.floor(((c + 1) * BODY_H2) / 7) - Math.floor((c * BODY_H2) / 7);
    for (let i = 0; i < h2Here; i++) {
      const k2 = plan.filter((h) => h.level === 2).length;
      reg(2, title(2));
      const h3Here =
        Math.floor(((k2 + 1) * H3) / BODY_H2) - Math.floor((k2 * H3) / BODY_H2);
      for (let j = 0; j < h3Here; j++) {
        reg(3, title(2), h3Seen % 20 === 7 && h3Seen < 100);
        const h4Here =
          Math.floor(((h3Seen + 1) * H4) / H3) - Math.floor((h3Seen * H4) / H3);
        h3Seen++;
        for (let a = 0; a < h4Here; a++) {
          reg(4, title(2 + (a % 2)));
          const h5Here =
            Math.floor(((h4Seen + 1) * H5) / H4) -
            Math.floor((h4Seen * H5) / H4);
          h4Seen++;
          for (let b = 0; b < h5Here; b++) {
            reg(5, title(1 + ((b + a) % 3)));
            const h6Here =
              Math.floor(((h5Seen + 1) * H6) / H5) -
              Math.floor((h5Seen * H6) / H5);
            h5Seen++;
            for (let d = 0; d < h6Here; d++) reg(6, title(2));
          }
        }
      }
    }
  }
  // Repeated titles (AC-2c, US-002 AC-3): 50 titles, each on 5 headings of
  // levels 4 to 6; then one natural title of the generated label shape.
  const deep = plan.filter((h) => h.level >= 4);
  const repeatedTitles: string[] = [];
  for (let r = 0; r < 50; r++) repeatedTitles.push(title(2));
  // Every other deep heading (index 0, 2, 4, …), then the odd ones from 3 on;
  // index 1 is the natural twin below.
  const slots = [
    ...Array.from({length: Math.ceil(deep.length / 2)}, (_, i) => i * 2),
    ...Array.from(
      {length: Math.floor(deep.length / 2) - 1},
      (_, i) => 3 + i * 2,
    ),
  ].slice(0, 250);
  if (slots.length < 250) throw new Error('too few deep headings');
  for (let i = 0; i < 250; i++) {
    const h = deep[slots[i] as number] as Heading;
    used.delete(h.title.toLowerCase());
    h.title = repeatedTitles[i % 50] as string;
  }
  const naturalTwin = deep[1] as Heading;
  used.delete(naturalTwin.title.toLowerCase());
  naturalTwin.title = `${repeatedTitles[0]} 2`;
  for (const h of plan) {
    if (!used.has(h.title.toLowerCase())) used.set(h.title.toLowerCase(), h);
  }
  const terms = Array.from({length: TERMS}, () =>
    title(1 + (book.word().length % 2)),
  );
  // AC-6 finds a known sentence by the page of its heading's text, so that
  // text must not occur inside another title (a longer heading, a term, the
  // text of a link to it); such a heading gets a fresh title.
  for (const h of plan.filter((x) => x.quiet)) {
    const inOther = (t: string): boolean =>
      [...plan.map((x) => x.title), ...terms].some(
        (other) => other !== t && other.includes(t),
      );
    while (inOther(h.title)) {
      used.delete(h.title.toLowerCase());
      h.title = title(3);
      used.set(h.title.toLowerCase(), h);
    }
  }
  const firstOf = (t: string): Heading =>
    plan.find((h) => h.title === t) as Heading;

  // -- link targets ---------------------------------------------------------
  const repeatedSet = new Set(repeatedTitles);
  const uniqueTargets = plan.filter(
    (h) => !h.quiet && !repeatedSet.has(h.title) && h !== naturalTwin,
  );
  const multi = uniqueTargets.filter((h) => h.title.includes(' '));
  let pick = 0;
  /** The next target of `level` at most `max`, cycling through the plan. */
  const target = (pool: Heading[], max: number): Heading => {
    for (let i = 0; i < pool.length; i++) {
      const h = pool[(pick + i * 7) % pool.length] as Heading;
      if (h.level <= max) {
        pick = (pick + i * 7 + 1) % pool.length;
        return h;
      }
    }
    throw new Error('no target');
  };
  const sentences: {heading: string; text: string}[] = [];

  /** US-024 AC-2c: an anchor link of `rule` with its record. */
  const linkTo = (
    rule: 'text' | 'slug' | 'number' | 'ambiguous' | 'unresolved',
    max = 6,
  ): string => {
    if (rule === 'unresolved') {
      book.anchors.unresolved++;
      const w = ABSENT[book.anchors.unresolved % ABSENT.length] as string;
      return book.anchor(
        capital(w),
        book.anchors.unresolved % 2 === 0
          ? `#${w}`
          : `#4.${book.anchors.unresolved}-${w}-${book.word()}`,
        {level: null, inGlossary: false},
      );
    }
    if (rule === 'ambiguous') {
      book.anchors.byText++;
      book.anchors.ambiguous++;
      const t = repeatedTitles[book.anchors.ambiguous % 50] as string;
      return book.anchor(t, `#${t.replace(/ /g, '%20')}`, {
        level: firstOf(t).level,
        inGlossary: false,
      });
    }
    const pool = rule === 'text' ? uniqueTargets : multi;
    const h = target(pool, max);
    if (rule === 'text') {
      book.anchors.byText++;
      return book.anchor(h.title, `#${h.title.replace(/ /g, '%20')}`, {
        level: h.level,
        inGlossary: false,
      });
    }
    if (rule === 'slug') {
      book.anchors.bySlug++;
      return book.anchor(h.title, `#${slugOf(h.title)}`, {
        level: h.level,
        inGlossary: false,
      });
    }
    book.anchors.byNumberStripped++;
    const n = `${1 + (book.anchors.byNumberStripped % 7)}.${1 + (book.anchors.byNumberStripped % 5)}`;
    return book.anchor(h.title, `#${n}-${slugOf(h.title)}`, {
      level: h.level,
      inGlossary: false,
    });
  };
  const RULES = ['text', 'slug', 'number', 'slug', 'text', 'number'] as const;
  let ruleTurn = 0;
  /** The next anchor link of the rotation (levels at most `max`). */
  const nextLink = (max = 6): string => {
    ruleTurn++;
    if (ruleTurn % 11 === 0) return linkTo('ambiguous');
    if (ruleTurn % 13 === 0) return linkTo('unresolved');
    return linkTo(
      RULES[ruleTurn % RULES.length] as (typeof RULES)[number],
      max,
    );
  };

  // -- images ---------------------------------------------------------------
  const imageFiles: {path: string; bytes: Uint8Array}[] = [];
  let imageNo = 0;
  /** A new image file: png, or jpg / jpeg on the listed turns. */
  const newImage = (): string => {
    imageNo++;
    const ext = imageNo === 33 ? 'jpeg' : imageNo % 9 === 4 ? 'jpg' : 'png';
    const folder = imageNo % 6 === 5 ? 'assets/plates' : 'assets';
    const path = `${folder}/figure-${String(imageNo).padStart(2, '0')}.${ext}`;
    imageFiles.push({
      path,
      bytes: ext === 'png' ? png(imageNo) : jpeg(imageNo),
    });
    return path;
  };
  const cover = 'assets/cover.png';
  // The cover in the shape of an A5 page (148 x 210 px, about 1 % off the
  // page with bleed), so a cover page shows it without a crop warning.
  imageFiles.push({path: cover, bytes: png(0, 148, 210)});
  const embedded = 'assets/map.png';
  imageFiles.push({path: embedded, bytes: png(999)});

  // -- the body ---------------------------------------------------------------
  book.paragraph(book.image(cover, ''));
  const body = plan;
  const N = body.length;
  const sameSectionLink = new Map<number, Heading>();
  let footnoteDone = false;
  let codeDone = false;
  let hardBreakDone = false;
  let calloutTurn = 0;
  const BUILT_IN = [
    'abstract',
    'info',
    'todo',
    'tip',
    'success',
    'question',
    'warning',
    'failure',
    'danger',
    'bug',
    'example',
    'quote',
  ];
  let itemTurn = 0;
  let listNo = 0;

  /** A list item text with the extras of AC-2 on their turns. */
  const itemText = (): string => {
    itemTurn++;
    let t = `${book.words(5 + (itemTurn % 6), true)}`;
    // a text run that starts with `(` (AC-2 text start classes)
    if (itemTurn % 61 === 7) t = `(${book.words(2)}) ${t}`;
    if (itemTurn % 7 === 0) t += ` ${nextLink()}`;
    if (itemTurn % 14 === 3) t += ` ${book.strong(book.words(2))}`;
    if (itemTurn % 40 === 5) t += ` ${book.emph(book.words(2))}`;
    if (itemTurn % 50 === 9)
      t += ` ${book.underline(book.words(2))} ${book.span(book.word())}`;
    if (itemTurn % 90 === 11) {
      book.inline('inline-footnote');
      t += ` ^[${book.words(4, true)}.]`;
    }
    return `${t}${itemTurn % 5 === 0 ? '.' : ''}`;
  };

  let cellTurn = 0;
  /** A table cell with the extras of AC-2 on their turns. */
  const cellText = (): string => {
    cellTurn++;
    switch (cellTurn % 23) {
      case 1:
        return `#${cellTurn % 9} ${book.word()}`;
      case 2:
        return `${book.word()}/${book.br()}${book.word()}`;
      case 3:
        return `${cellTurn % 7} ${book.word()}`;
      case 4:
        return `"${book.words(2)}"`;
      case 5:
        return `${book.word()},${book.br()}${cellTurn % 5}+${book.br()}${book.word()}`;
      case 6:
        return cellTurn % 3 === 0
          ? `${book.word()} ${nextLink()}`
          : book.emph(book.word());
      case 7:
        // runs that end and start with `:` (AC-2 text classes)
        return `${book.word()}:${book.br()}:${book.word()}`;
      default:
        return book.words(1 + (cellTurn % 3));
    }
  };

  for (let k = 0; k < N; k++) {
    const h = body[k] as Heading;
    book.heading(h.level, h.title);
    const quiet = h.quiet && sentences.length < 5;
    // First paragraph: a known sentence (AC-6) or a link back to its own
    // heading for the same-page relation of AC-7 (levels 1 and 2).
    if (quiet) {
      const s = `${book.words(9, true)} ${book.words(4)}.`;
      sentences.push({heading: h.title, text: s});
      book.paragraph(`${s} ${book.sentence()}`);
    } else if (h.level <= 2 && !repeatedSet.has(h.title)) {
      sameSectionLink.set(k, h);
      book.anchors.byText++;
      book.paragraph(
        `${book.sentence()} ${book.anchor(h.title, `#${h.title.replace(/ /g, '%20')}`, {level: h.level, inGlossary: false})} ${book.sentence()} ${book.sentence()}`,
      );
    } else {
      const extra = k % 3 === 0 ? ` ${nextLink(k % 2 === 0 ? 3 : 6)}` : '';
      book.paragraph(
        `${book.sentence()} ${book.sentence()}${extra} ${book.sentence()}`,
      );
    }
    // A second paragraph with the inline extras of AC-2 on their turns.
    const parts = [book.sentence(), book.sentence()];
    if (k % 4 === 1)
      parts.push(`${book.strong(book.words(2, true))} ${book.sentence()}`);
    if (k % 6 === 2) parts.push(`${book.emph(book.words(2))} ${book.word()}.`);
    if (k % 5 === 3)
      parts.push(`${book.words(3, true)} ${nextLink()}, ${book.words(3)}.`);
    if (k % 7 === 4)
      parts.push(`${book.words(2, true)} ${nextLink()}. ${book.sentence()}`);
    if (k % 9 === 5)
      parts.push(`${book.words(2, true)} ${nextLink()}: ${book.words(3)}!`);
    if (k % 11 === 6)
      parts.push(
        `${book.words(2, true)} ${EDGE_CASES[0]}${nextLink()}) ${book.words(2)}?`,
      );
    if (k % 13 === 7)
      parts.push(
        `${book.words(2, true)} ${nextLink()}-${book.word()} and ${nextLink()}+${k % 9}.`,
      );
    if (k % 17 === 8)
      parts.push(
        `${book.words(2, true)} ${nextLink()}${SPECIAL.apostrophe}s ${book.word()}.`,
      );
    if (k % 19 === 9) {
      book.inline('inline-footnote');
      parts.push(
        `${book.words(3, true)}.^[${book.words(3, true)} ${nextLink()} ${book.word()}.]`,
      );
    }
    if (k % 23 === 10)
      parts.push(
        `${book.words(2, true)} ${book.strong(nextLink())} ${book.word()}.`,
      );
    if (k % 29 === 11) {
      book.inline('strong');
      add(book.kinds, 'link');
      add(book.hrefs, 'link:inline:anchor');
      const t = target(multi, 6);
      book.anchors.bySlug++;
      book.links.push({level: t.level, inGlossary: false});
      parts.push(
        `${book.words(2, true)} [**${t.title}**](#${slugOf(t.title)}) ${book.word()}.`,
      );
    }
    if (k % 31 === 12) {
      add(book.kinds, 'link');
      add(book.hrefs, 'link:inline:anchor');
      add(book.kinds, 'html-inline', 2);
      add(book.html, 'html-inline:u', 2);
      const t = target(multi, 6);
      book.anchors.bySlug++;
      book.links.push({level: t.level, inGlossary: false});
      parts.push(
        `${book.words(2, true)} [<u>${t.title}</u>](#${slugOf(t.title)}) ${book.word()}.`,
      );
    }
    if (k % 37 === 13)
      parts.push(
        `${book.words(3, true)} ${book.span(book.words(2))} ${book.word()}.`,
      );
    if (k % 41 === 14)
      parts.push(
        `${book.words(3, true)} ${book.web(book.words(2), `https://example.org/${book.word()}`)}.`,
      );
    if (k % 43 === 15)
      parts.push(
        `${book.words(3, true)} ${book.bare(`https://example.com/${book.word()}`)} ${book.word()}.`,
      );
    if (k % 47 === 16)
      parts.push(
        `${book.words(2, true)} ${SPECIAL.openQuote}${book.words(3)}${SPECIAL.closeQuote} ${book.word()} f${SPECIAL.eCircumflex}te caf${SPECIAL.eAcute}, 20${SPECIAL.noBreakSpace}${SPECIAL.degree}C ${SPECIAL.emDash} 1${SPECIAL.enDash}3 K${SPECIAL.oUmlaut}nig${SPECIAL.ellipsis}`,
      );
    if (k % 53 === 17)
      parts.push(
        `${SPECIAL.openQuote}${book.words(2, true)}${SPECIAL.closeQuote} ${book.words(3)} (${book.words(2)})`,
      );
    if (k % 3 === 2) {
      // a soft break inside the paragraph
      book.paragraph(parts.join(' '), `${book.sentence()} ${book.sentence()}`);
    } else {
      book.paragraph(parts.join(' '));
    }
    // Blocks on their turns.
    if (spread(k, N, 66)) {
      const path = newImage();
      const caption =
        imageNo % 4 === 1 && book.imagesWithCaption < 18
          ? book.words(3, true)
          : '';
      book.paragraph(book.image(path, caption));
    }
    if (k === 40 || k === 41 || k === 200) {
      // two images used a second time (the real file has repeats)
      const again = imageFiles[imageFiles.length - 1]?.path as string;
      if (again !== cover && again !== embedded)
        book.paragraph(book.image(again, ''));
    }
    if (spread(k, N, 272)) {
      const cols = [1, 4, 5, 2, 3, 8, 4, 2, 3, 4][k % 10] as number;
      const rows = [3, 4, 2, 3, 5, 3][k % 6] as number;
      book.block(...book.table(cols, rows, k % 4 === 0, () => cellText()));
    }
    if (spread(k, N, 140)) {
      const ordered = k % 9 === 0;
      const n = [3, 4, 3, 4, 2, 5, 4][k % 7] as number;
      const nested = new Map<number, string[]>();
      listNo++;
      if (listNo % 20 === 3) {
        nested.set(1, [itemText(), itemText(), itemText()]);
      }
      book.block(
        ...book.list(
          ordered,
          Array.from({length: n}, () => itemText()),
          nested,
        ),
      );
      book.paragraph(book.sentence());
    }
    if (spread(k, N, 44)) book.comment(k % 2 === 0);
    if (spread(k, N, 15)) {
      // a plain quote with the extras of AC-2 on their turns
      add(book.kinds, 'blockquote');
      add(book.kinds, 'paragraph');
      const q = [
        `> ${book.sentence()} ${book.strong(book.words(2))} ${book.sentence()}`,
      ];
      if (k % 2 === 0)
        q.push(
          `> ${book.words(3, true)} ${nextLink()} ${book.emph(book.word())}.`,
        );
      if (!footnoteDone) {
        book.inline('footnote-ref');
        q.push(`> ${book.words(4, true)}.[^1]`);
      }
      book.block(...q);
      if (!footnoteDone) {
        footnoteDone = true;
        add(book.kinds, 'footnote-def');
        add(book.kinds, 'paragraph');
        book.block(
          `[^1]: ${book.words(4, true)} ${nextLink()} ${book.words(3)}.`,
        );
      }
    }
    if (!codeDone && k === 120) {
      codeDone = true;
      add(book.kinds, 'code');
      book.block('```', book.words(5), book.words(4), '```');
    }
    if (!hardBreakDone && k === 60) {
      hardBreakDone = true;
      add(book.kinds, 'paragraph');
      book.inline('break');
      book.block(`${book.sentence()}  `, book.sentence());
    }
    if (k === 30) {
      // the other kinds of address once each (AC-2)
      add(book.kinds, 'link', 2);
      add(book.hrefs, 'link:inline:mail');
      add(book.hrefs, 'link:inline:other');
      const t = target(multi, 6);
      book.links.push({level: t.level, inGlossary: false});
      book.paragraph(
        `${book.words(3, true)} [${book.words(2)}](mailto:someone@example.org) ${book.word()} [${book.words(2)}](../Texts/3.1%20${t.title.replace(/ /g, '%20')}.md).`,
      );
    }
    // Callouts (AC-2b) under the first headings of level 2 and 3.
    if (h.level === 3 && calloutTurn < BUILT_IN.length) {
      const type = BUILT_IN[calloutTurn++] as string;
      add(book.kinds, 'blockquote');
      add(book.kinds, 'paragraph');
      add(book.features, `callout:${type}`);
      book.block(`> [!${type}] ${book.words(2, true)}`, `> ${book.sentence()}`);
    }
    if (k === 5) writeNoteCallout(book, target, plan);
    if (k === 9) {
      add(book.kinds, 'blockquote');
      add(book.kinds, 'paragraph');
      add(book.features, 'callout:mystery');
      book.block(`> [!mystery] ${book.words(2, true)}`, `> ${book.sentence()}`);
    }
    if (k === 12) writeWikilinks(book, target, multi, embedded);
    if (k === 14) {
      book.block(
        ...book.list(
          false,
          [book.words(4, true), book.words(3, true)],
          new Map([[0, [book.words(3, true)]]]),
          '',
          [false, true],
        ),
      );
      book.paragraph(book.sentence());
    }
    // The next-page relation of AC-7: the end of a level-2 section links to
    // the next heading of level 1 or 2.
    const next = body.slice(k + 1).find((x) => x.level <= 2);
    if (
      next !== undefined &&
      (body[k + 1]?.level ?? 0) <= 2 &&
      !repeatedSet.has(next.title) &&
      next.level <= 2
    ) {
      book.anchors.byText++;
      book.paragraph(
        `${book.sentence()} ${book.anchor(next.title, `#${next.title.replace(/ /g, '%20')}`, {level: next.level, inGlossary: false})} ${book.word()}.`,
      );
    }
  }
  void sameSectionLink;
  void EDGE_CASES;

  // -- the glossary -------------------------------------------------------------
  book.heading(1, 'Glossary');
  book.inGlossary = true;
  const linkedTerm = terms[3] as string;
  terms.forEach((term, i) => {
    book.heading(2, term);
    const extra: string[] = [];
    if (i % 3 === 0) extra.push(`${book.words(2)} ${nextLink(3)}`);
    if (i % 4 === 1) extra.push(`${book.words(2)} ${nextLink(2)}`);
    if (i === 6)
      extra.push(
        `see ${book.wikilink(`#${(multi[2] as Heading).title}`, (multi[2] as Heading).level)}`,
      );
    if (i % 5 === 2 && i !== 3 + 5) {
      const other = terms[(i + 7) % TERMS] as string;
      book.anchors.byText++;
      extra.push(
        `and ${book.anchor(other, `#${other.replace(/ /g, '%20')}`, {level: 2, inGlossary: true})}`,
      );
    }
    book.paragraph(
      `${book.sentence()} ${extra.join(', ')}${extra.length ? '.' : ''} ${book.sentence()}`
        .replace(/ +/g, ' ')
        .replace(' .', '.'),
    );
    if (i === 10) {
      add(book.kinds, 'blockquote');
      add(book.kinds, 'paragraph');
      add(book.features, 'callout:tip');
      book.block(
        `> [!tip] ${book.words(2, true)}`,
        ...book.list(false, [book.words(3, true)], new Map(), '> ', [true]),
      );
    }
  });
  book.inGlossary = false;

  // Links to the linked term from the body would come before the glossary;
  // they are written into a closing section so the count is exact.
  return {
    book,
    plan,
    terms,
    linkedTerm,
    sentences,
    repeatedTitles,
    imageFiles,
    firstOf,
  };
}

/**
 * US-024 AC-2b: the `note` callout with a task list, a table, an image embed
 * and a nested `rule-box` callout with a wikilink in bold.
 */
function writeNoteCallout(
  book: Book,
  target: (pool: Heading[], max: number) => Heading,
  plan: Heading[],
): void {
  const t = target(
    plan.filter((h) => !h.quiet && h.level <= 3 && h.title.includes(' ')),
    3,
  );
  add(book.kinds, 'blockquote', 2);
  add(book.kinds, 'paragraph', 2);
  add(book.features, 'callout:note');
  add(book.features, 'callout:rule-box');
  book.block(
    `> [!note] ${book.words(2, true)}`,
    ...book.list(
      false,
      [book.words(3, true), book.words(3, true)],
      new Map(),
      '> ',
      [false, true],
    ),
    '>',
    ...book.table(2, 1, true, () => book.word(), '> '),
    '>',
    `> ${(add(book.kinds, 'paragraph'), book.embed('assets/map.png', true))}`,
    '>',
    `> > [!rule-box] ${book.words(2, true)}`,
    `> > ${book.words(2, true)} ${book.strong(book.wikilink(`#${t.title}`, t.level))} ${book.word()}.`,
  );
}

/** US-024 AC-2b: the wikilink forms and the note embed. */
function writeWikilinks(
  book: Book,
  target: (pool: Heading[], max: number) => Heading,
  multi: Heading[],
  embedded: string,
): void {
  const a = target(multi, 6);
  const b = target(multi, 6);
  const c = target(multi, 6);
  book.inline('inline-footnote');
  book.paragraph(
    `${book.words(2, true)} ${book.wikilink(`#${a.title}`, a.level)}, ${book.wikilink(`Book#${b.title}|${book.words(2)}`, b.level)}, ${book.strong(book.wikilink('Other', null))} ${book.word()} ${book.wikilink('Missing', null)}.^[${book.words(2, true)} ${book.wikilink(`#${c.title}`, c.level)}.]`,
  );
  add(book.kinds, 'paragraph');
  book.block(book.embed('Other', false));
  void embedded;
}

/**
 * US-024 AC-1: writes the whole sample vault below `outDir` (created when
 * missing; an existing folder is replaced, it holds generated files only).
 */
export function generateSample(outDir: string): void {
  const random = seeded(SEED);
  const out = writeBook(random);
  const {book, terms, linkedTerm, sentences, repeatedTitles, imageFiles} = out;
  // The links to the linked term (AC-2c): a closing body note before the
  // glossary is not possible after writing, so they go into a last section.
  // (Written below, after the glossary, as a level-1 appendix.)
  book.inGlossary = false;
  book.heading(1, 'Appendix');
  for (let i = 0; i < 4; i++) {
    book.anchors.byText++;
    book.paragraph(
      `${book.sentence()} ${book.anchor(linkedTerm, `#${linkedTerm.replace(/ /g, '%20')}`, {level: 2, inGlossary: false})} ${book.word()}.`,
    );
  }
  // US-026 AC-11: a colophon and back notes, written after every other block
  // so that the text above stays as it was. `presets/Sample.md` maps their
  // headings; they are not the built-in `Colophon`, `Back notes`, so without
  // that preset they stay two chapters at the end of the body.
  book.heading(1, BOOK_PARTS.colophon);
  book.paragraph(book.sentence());
  book.paragraph(book.sentence());
  book.heading(1, BOOK_PARTS.backNotes);
  book.paragraph(`${book.sentence()} ${book.sentence()}`);
  const text = book.text();
  const nonAscii: Counts = {};
  for (const ch of text) if (ch.charCodeAt(0) > 127) add(nonAscii, ch);
  const headings: Record<string, string[]> = {};
  for (const line of text.split('\n')) {
    const m = /^(#{1,6}) (.*)$/.exec(line);
    if (m !== null)
      (headings[String((m[1] as string).length)] ??= []).push(m[2] as string);
  }
  const titleCount = new Map<string, number>();
  for (const list of Object.values(headings)) {
    for (const t of list) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
  }
  const repeated = [...titleCount.values()].filter((n) => n > 1);
  void repeatedTitles;
  // US-026 AC-11: each part heading is one heading of the note (any case:
  // heading rules ignore case), so the preset's rule marks only that one.
  for (const title of Object.values(BOOK_PARTS)) {
    const same = [...titleCount.entries()]
      .filter(([t]) => t.toLowerCase() === title.toLowerCase())
      .reduce((sum, [, n]) => sum + n, 0);
    if (same !== 1) throw new Error(`"${title}" is ${same} headings`);
  }

  const files = new Map<string, Uint8Array | string>();
  files.set('Book.md', text);
  files.set(
    'Other.md',
    '# Other note\n\nA short second note of the sample vault. It has no boxed note and no image.\n',
  );
  files.set(
    'presets/Sample.md',
    [
      '---',
      'callouts:',
      '  rule-box:',
      '    fill: "#eeeeee"',
      '    border:',
      '      color: "#555555"',
      '      width: 0.75',
      '    title:',
      '      color: "#333333"',
      'headingRules:',
      `  ${BOOK_PARTS.colophon}: colophon`,
      `  ${BOOK_PARTS.backNotes}: back-notes`,
      '---',
      '',
      'The preset of the sample vault: it styles the user callout type `rule-box`',
      'and marks the colophon and the back notes of `Book.md`.',
      '',
    ].join('\n'),
  );
  for (const {path, bytes} of imageFiles) files.set(path, bytes);
  files.set('assets/notes.pdf', PDF);

  const usedImages = [...book.imageFiles].sort();
  const sorted = (o: Counts): Counts =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const manifest = {
    anchors: book.anchors,
    bookParts: BOOK_PARTS,
    census: {
      aligns: sorted(book.aligns),
      bytes: Buffer.byteLength(text),
      depths: sorted(book.depths),
      hrefs: sorted(book.hrefs),
      html: sorted(book.html),
      images: sorted(book.images),
      kinds: sorted(book.kinds),
      lines: text.split('\n').length,
      lists: book.lists,
      maxCols: book.maxCols,
      nonAscii: sorted(nonAscii),
      tables: book.tables,
    },
    comments: {count: book.comments, firstLine: book.firstCommentLine},
    features: sorted(book.features),
    files: [...files.keys()].sort(),
    glossary: {heading: 'Glossary', terms},
    headings,
    images: {
      files: usedImages,
      total: book.imagesWithCaption + book.imagesWithout,
      withCaption: book.imagesWithCaption,
      withoutCaption: book.imagesWithout,
    },
    linkedTerm: {links: 4, term: linkedTerm},
    longRows: 0,
    numberedLinks: numberedLinks(book.links),
    repeatedTitles: {
      extra: repeated.reduce((sum, n) => sum + n - 1, 0),
      titles: repeated.length,
    },
    seed: SEED,
    sentences,
  };
  rmSync(outDir, {recursive: true, force: true});
  for (const [path, data] of files) {
    mkdirSync(dirname(join(outDir, path)), {recursive: true});
    writeFileSync(join(outDir, path), data);
  }
  writeFileSync(
    join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

// Run as a program: `node tests/fixtures/generate.ts [outDir]`; without an
// argument it writes the committed vault next to this file.
if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  generateSample(
    process.argv[2] ??
      join(dirname(new URL(import.meta.url).pathname), 'sample'),
  );
}
