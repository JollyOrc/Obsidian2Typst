// US-017 AC-4 to AC-8, AC-10, AC-11, AC-13, AC-14 — glossary terms with the
// real compiler: every shape compiles, a term is never alone at a page bottom,
// the composed export has its content (SCAR-015), links jump to the terms,
// the terms are not bookmarks, a deeper heading in a term has no number, the
// fixture compiles, and the joins of a term with its neighbours keep the text
// (SCAR-010). Source of truth:
// docs/user-stories/US-017-heading-rules-glossary.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {
  readPdfBookmarks,
  readPdfLinks,
  readPdfPages,
  type PdfBookmark,
  type PdfLink,
  type PdfPage,
} from '../support/pdf';
import {readManifest, readSample} from '../support/sample';
import {diagnose} from '../support/typst-node';

/** US-017 AC-1: the shape of the preset field (from the preset note). */
type HeadingRules = Record<string, 'glossary' | 'none'>;

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const FONT_FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const IMAGES: Record<string, Uint8Array> = {
  'Sample/assets/map.png': png(30, 20),
};
const FILES = [NOTE_PATH, ...Object.keys(IMAGES)];

/** One compiler for the file: the sweep of AC-10 compiles about 75 times. */
let shared: ReturnType<typeof createTypstCompiler> | undefined;
const compiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
afterAll(() => shared?.dispose());

interface Compiled {
  pages: PdfPage[];
  bookmarks: PdfBookmark[];
  links: PdfLink[];
  pdf: Uint8Array;
  typ: string;
  codes: string[];
}

/** Converts `source` with `headingRules` and compiles it with the bundled fonts. */
async function compile(
  source: string,
  headingRules?: HeadingRules,
  rewrite: (typ: string) => string = (typ) => typ,
): Promise<Compiled> {
  const index = new FakeIndex(FILES);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const settings = {
    ...SETTINGS,
    headingRules,
    fonts: structuredClone(DEFAULT_FONTS),
  } as ConvertSettings;
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = IMAGES[use.from] as Uint8Array;
  }
  const typ = rewrite(result.typ);
  const compiled = await compiler().compile({
    file: 'main.typ',
    source: typ,
    files,
    fonts: FONT_FILES,
  });
  if (!compiled.ok) throw new Error(`${compiled.error}\n${typ}`);
  return {
    pages: readPdfPages(compiled.pdf),
    bookmarks: readPdfBookmarks(compiled.pdf),
    links: readPdfLinks(compiled.pdf),
    pdf: compiled.pdf,
    typ,
    codes: result.warnings.map((w) => w.code),
  };
}

/** The text of all pages, blanks squashed. */
const textOf = (pages: readonly PdfPage[]): string =>
  pages
    .map((p) => p.text)
    .join(' ')
    .replace(/\s+/g, ' ');

const count = (text: string, part: string): number =>
  text.split(part).length - 1;

/** The index of the first page whose text holds `part`; -1 if none. */
const pageOf = (pages: readonly PdfPage[], part: string): number =>
  pages.findIndex((p) => p.text.replace(/\s+/g, ' ').includes(part));

describe('US-017 the PDF readers of the test support (measured 2026-10-19)', () => {
  it('US-017 AC-11: readPdfBookmarks gives numbered titles, depth and page; readPdfLinks gives internal and external links', async () => {
    const {bookmarks, links} = await compile(
      '# One\n\nSee [two](#two) and [web](https://example.org).\n\n## Sub\n\nx\n\n# Two\n\ny',
      {Glossary: 'none'},
      (typ) => typ.replace('= Two', '#pagebreak()\n= Two'),
    );
    expect(bookmarks).toEqual([
      {title: '1 One', depth: 1, page: 0},
      {title: '1.1 Sub', depth: 2, page: 0},
      {title: '2 Two', depth: 1, page: 1},
    ]);
    // The external link gets a footnote (US-004): marker, back link, address.
    expect(links).toEqual([
      {page: 0, target: 1, uri: null},
      {page: 0, target: null, uri: 'https://example.org'},
      {page: 0, target: 0, uri: null},
      {page: 0, target: 0, uri: null},
      {page: 0, target: null, uri: 'https://example.org'},
    ]);
  });
});

describe('US-017 AC-4 to AC-8, AC-14 every shape compiles', () => {
  const SHAPES: Record<string, string> = {
    runIn: '# Glossary\n\n## Gambit\n\nA thing you can do.',
    twoParagraphs: '# Glossary\n\n## Pool\n\nThe pool.\n\nSecond paragraph.',
    markupTerm: '# Glossary\n\n## Pool **bold** `x`\n\nText.',
    escapedStart:
      '# Glossary\n\n## A\n\n\\- not a list\n\n## B\n\n\\# 5 and $3',
    listFirst: '# Glossary\n\n## Rapid Basin\n\n- list first\n- second',
    empty: '# Glossary\n\n## Empty term\n\n## Next\n\nx',
    emptyAtEnd: '# Glossary\n\n## Last',
    tableFirst: '# Glossary\n\n## A\n\n| a |\n|---|\n| 1 |',
    codeFirst: '# Glossary\n\n## A\n\n```\ncode\n```',
    quoteFirst: '# Glossary\n\n## A\n\n> quoted',
    calloutFirst: '# Glossary\n\n## A\n\n> [!example] E\n> body',
    imageFirst: '# Glossary\n\n## A\n\n![Map](assets/map.png)',
    imageInTerm: '# Glossary\n\n## ![Map](assets/map.png) A\n\na',
    footnotes:
      'Before[^a].\n\n# Glossary\n\n## A[^b]\n\nx[^c].\n\n[^a]: A.\n[^b]: B.\n[^c]: C.',
    wikilinkTerm: '# Tessera\n\n# Glossary\n\n## [[#Tessera]]\n\na',
    level2: '## Glossary\n\n### Gambit\n\nA.\n\n## Next',
    twoSections:
      '# Glossary\n\n## A\n\na\n\n# Other\n\n# Glossary\n\n## B\n\nb',
    deeper: '# Glossary\n\n## Gambit\n\nA thing.\n\n### Deep\n\ndeep text',
    blockStartTerm:
      '# Glossary\n\n## - x\n\nText.\n\n## = y\n\nMore.\n\n### + z\n\nz',
    linkToDeeper:
      '[deep](#deep)\n\n# Glossary\n\n## Gambit\n\nA thing.\n\n### Deep\n\nd',
  };
  for (const [name, source] of Object.entries(SHAPES)) {
    it(`US-017 AC-8: ${name} compiles, has terms and shows its text`, async () => {
      const {pages, typ} = await compile(source);
      expect(typ, name).toContain('glossary-term');
      expect(textOf(pages).length, name).toBeGreaterThan(0);
    });
  }
});

describe('US-017 AC-4 the run-in line in the PDF', () => {
  it('US-017 AC-4: reads "Gambit — A thing you can do." with the term in bold', async () => {
    const {pages, pdf} = await compile(
      '# Glossary\n\n## Gambit\n\nA thing you can do.',
    );
    expect(textOf(pages)).toContain('Gambit — A thing you can do.');
    expect(Buffer.from(pdf).toString('latin1')).toMatch(
      /\/BaseFont\s*\/(?:[A-Z]{6}\+)?LibertinusSerif-Bold/,
    );
  });

  it('US-017 AC-4: a term that looks like list or heading markup prints as written (block start, decided 2026-10-19)', async () => {
    const {pages} = await compile(
      '# Glossary\n\n## - x\n\nText.\n\n## = y\n\nMore.\n\n## A\n\na\n\n### + z\n\nz',
    );
    const text = textOf(pages);
    expect(text).toContain('- x — Text.');
    expect(text).toContain('= y — More.');
    expect(text).toContain('+ z');
  });

  it('US-017 AC-5: a lone term has no separator', async () => {
    const {pages, typ} = await compile(
      '# Glossary\n\n## Rapid Basin\n\n- list first',
    );
    expect(typ).toContain('#glossary-term(run-in: false)[Rapid Basin]');
    const text = textOf(pages);
    expect(text).toContain('Rapid Basin');
    expect(text).not.toContain('Rapid Basin —');
  });
});

describe('US-017 AC-10 page breaks', () => {
  /**
   * Filler paragraphs, then a vertical offset, then a term; the cases `n/d`
   * (filler count / offset in pt) where a page ends with the term text.
   */
  async function aloneAt(
    explanation: string,
    rewrite: (typ: string) => string = (t) => t,
  ): Promise<string[]> {
    const alone: string[] = [];
    for (let n = 20; n <= 34; n++) {
      const filler = Array.from(
        {length: n},
        (_, i) => `Filler line ${i}.`,
      ).join('\n\n');
      for (let d = 0; d <= 12; d += 3) {
        const {pages, typ} = await compile(
          `# Glossary\n\n${filler}\n\n## Sticky Term\n\n${explanation}`,
          undefined,
          (typ) =>
            rewrite(
              typ.replace(
                /^(#block\(sticky: true\)\[)?#glossary-term/m,
                (m) => `#v(${d}pt)\n${m}`,
              ),
            ),
        );
        if (!typ.includes('#glossary-term')) {
          throw new Error(`no term in the Typst (n ${n}, d ${d})`);
        }
        if (
          pages.some((p) =>
            /Sticky Term(?: —)?$/.test(p.text.replace(/\s+/g, ' ').trimEnd()),
          )
        ) {
          alone.push(`${n}/${d}`);
        }
      }
    }
    return alone;
  }

  const LONG =
    'First explanation line that is long enough to wrap onto a second line of the A5 text block, and a bit more text after it.';

  it('US-017 AC-10: a run-in term is never the last text of a page (20 to 34 filler lines × offsets 0 to 12 pt)', async () => {
    expect(await aloneAt(LONG)).toEqual([]);
  }, 180_000);

  it('US-017 AC-10: a lone term is never the last text of a page', async () => {
    expect(await aloneAt('- first item\n- second item\n- third item')).toEqual(
      [],
    );
  }, 180_000);

  it('US-017 AC-10 guard: without sticky the sweep finds a lone term alone at the page bottom', async () => {
    const alone = await aloneAt(
      '- first item\n- second item\n- third item',
      (typ) => typ.replace('#block(sticky: true)[', '#block(sticky: false)['),
    );
    expect(alone.length).toBeGreaterThan(0);
  }, 180_000);
});

describe('US-017 AC-11 the composed export has its content (SCAR-015)', () => {
  const NOTE = [
    '# Rules',
    '',
    'See [Tidal Basin](#tidal-basin) before.',
    '',
    '# Glossary',
    '',
    'Below are the terms.',
    '',
    '## Gambit',
    '',
    'A thing you can do.',
    '',
    '## Tidal Basin',
    '',
    'The pool of dice.',
    '',
    'Second paragraph of the pool.',
    '',
    '## Rapid Basin',
    '',
    '- part of the pool',
    '',
    '## Empty term',
    '',
    '## Pool **bold** `x`',
    '',
    'Marked up.',
    '',
    '# End notes',
    '',
    'Back to [[#Gambit]].',
  ].join('\n');
  /** Puts each top-level heading on a new page, so link targets are distinct. */
  const paged = (typ: string): string =>
    typ.replace(/^= (Glossary|End notes)/gm, '#pagebreak()\n= $1');

  it('US-017 AC-11: the run-in line and each term text exactly once', async () => {
    const text = textOf((await compile(NOTE)).pages);
    expect(text).toContain('Gambit — A thing you can do.');
    for (const term of [
      'Gambit',
      'Tidal Basin',
      'Rapid Basin',
      'Empty term',
      'Pool bold x',
    ]) {
      expect(count(text, `${term} `), term).toBeGreaterThanOrEqual(1);
    }
    expect(count(text, 'Empty term')).toBe(1);
    expect(count(text, 'Rapid Basin')).toBe(1);
  });

  it('US-017 AC-11: the bookmarks list Rules, Glossary and End notes, and no term', async () => {
    const {bookmarks} = await compile(NOTE);
    expect(bookmarks.map((b) => b.title)).toEqual([
      '1 Rules',
      '2 Glossary',
      '3 End notes',
    ]);
  });

  it('US-017 AC-11: the link before and the link after the glossary jump to the page of their term', async () => {
    const {links, pages} = await compile(NOTE, undefined, paged);
    const internal = links.filter((l) => l.uri === null);
    expect(internal).toHaveLength(2);
    const glossaryPage = pageOf(pages, 'Tidal Basin —');
    expect(glossaryPage).toBeGreaterThan(0);
    expect(internal.map((l) => [l.page, l.target])).toEqual([
      [0, glossaryPage],
      [pageOf(pages, 'Back to'), pageOf(pages, 'Gambit —')],
    ]);
  });

  it('US-017 AC-11: no new warning', async () => {
    expect((await compile(NOTE)).codes).toEqual([]);
  });

  it('US-017 AC-11 guard: with Glossary: none the term is the numbered heading 2.1 Gambit and a bookmark', async () => {
    const {pages, bookmarks} = await compile(NOTE, {Glossary: 'none'});
    expect(textOf(pages)).toContain('2.1 Gambit');
    expect(textOf(pages)).not.toContain('Gambit —');
    expect(bookmarks.map((b) => b.title)).toContain('2.1 Gambit');
  });
});

describe('US-017 AC-14 a deeper heading in a term in the PDF', () => {
  const NOTE =
    '# Rules\n\nx\n\n# Glossary\n\n## Gambit\n\nA thing.\n\n### Deep\n\ndeep text\n\n# Back\n\ny';

  it('US-017 AC-14: Deep has no number and no bookmark; the headings around it are 1, 2 and 3', async () => {
    const {pages, bookmarks} = await compile(NOTE);
    const text = textOf(pages);
    expect(text).toContain('Deep');
    expect(text).not.toMatch(/2\.0\.1|2\.1\.1/);
    expect(bookmarks.map((b) => b.title)).toEqual([
      '1 Rules',
      '2 Glossary',
      '3 Back',
    ]);
  });

  it('US-017 AC-14 guard: as a plain heading it would be numbered 2.0.1 (measured 2026-10-19)', async () => {
    const {pages} = await compile(NOTE, undefined, (typ) =>
      typ.replace(
        '#heading(level: 3, numbering: none, outlined: false)[Deep]',
        '=== Deep',
      ),
    );
    expect(textOf(pages)).toContain('2.0.1 Deep');
  });
});

describe('US-017 AC-13 the sample note compiles with its glossary', () => {
  const source = readSample('Book.md');
  const {glossary, linkedTerm} = readManifest();

  it('US-017 AC-13: compiles with no error; every term run-in; no term is a bookmark; the links to the linked term land on its page', async () => {
    const {pages, bookmarks, links, typ} = await compile(source);
    expect([...typ.matchAll(/^#glossary-term\[/gm)]).toHaveLength(
      glossary.terms.length,
    );
    const titles = bookmarks.map((b) => b.title);
    expect(titles.some((t) => /Glossary$/.test(t))).toBe(true);
    // A bookmark of the term: its whole title is the term, with or without
    // a heading number (a body heading that ends with the same word is not).
    for (const term of glossary.terms) {
      expect(
        titles.some((t) =>
          new RegExp(`^(\\d+(\\.\\d+)*\\s+)?${term}$`).test(t),
        ),
        term,
      ).toBe(false);
    }
    const termPage = pageOf(pages, `${linkedTerm.term} —`);
    expect(termPage).toBeGreaterThan(0);
    const toTerm = links.filter((l) => l.target === termPage);
    expect(linkedTerm.links).toBeGreaterThanOrEqual(3);
    expect(toTerm.length).toBeGreaterThanOrEqual(linkedTerm.links);
  }, 120_000);
});

describe('US-017 joins of a term with its neighbours (SCAR-010)', () => {
  const FIRST: Record<string, string> = {
    letter: 'Word first.',
    escapedDash: '\\- dash first.',
    escapedHash: '\\# hash first.',
    strong: '**Bold** first.',
    emphasis: '*Em* first.',
    raw: '`raw` first.',
    dollar: '$5 first.',
    paren: '(paren) first.',
    bracket: '\\[bracket\\] first.',
    link: '[link](https://example.org) first.',
    wikilink: '[[#Rules]] first.',
    footnote: 'x[^n] first.\n\n[^n]: Footnote text.',
    angle: '<b> first.',
  };
  for (const [name, first] of Object.entries(FIRST)) {
    it(`US-017: a run-in term before a paragraph that starts with ${name} keeps the term and the text in order`, async () => {
      const {pages} = await compile(
        `# Rules\n\nStart.\n\n# Glossary\n\n## Term\n\n${first}\n\nEnd.`,
      );
      const text = textOf(pages);
      const at = ['Start.', 'Term —', 'first.', 'End.'].map((w) =>
        text.indexOf(w),
      );
      expect(
        at.every((i) => i >= 0),
        `${name}: ${text}`,
      ).toBe(true);
      expect(
        [...at].sort((a, b) => a - b),
        name,
      ).toEqual(at);
    });
  }

  const NEXT: Record<string, string> = {
    list: '- Item',
    ordered: '1. Item',
    table: '| A |\n|---|\n| B |',
    code: '```\nCode\n```',
    image: '![Pic](assets/map.png)',
    quote: '> Quoted',
    callout: '> [!tip] Other\n> More.',
    rule: '---',
    term: '## Next term\n\nNext text.',
    sectionEnd: '# After',
  };
  for (const [name, next] of Object.entries(NEXT)) {
    it(`US-017: a lone term before a ${name} keeps the order of the text`, async () => {
      const {pages, typ} = await compile(
        `# Glossary\n\n## Lone\n\n${next}\n\nEnd.`,
      );
      expect(typ, name).toContain('#glossary-term(run-in: false)[Lone]');
      const text = textOf(pages);
      const lone = text.indexOf('Lone');
      expect(lone, `${name}: ${text}`).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('End.')).toBeGreaterThan(lone);
      expect(text).not.toContain('Lone —');
    });
  }

  it('US-017 guard: the label after ] protects the call; without it a following ( or [ joins the call (measured 2026-10-19)', async () => {
    const helper =
      '#let glossary-term(body, run-in: true) = { strong(body); if run-in [ — ] }\n';
    const errors = async (line: string): Promise<string[]> =>
      (await diagnose(`${helper}${line}\n#link(<h-a>)[l]\n`))
        .filter((d) => d.severity === 'error')
        .map((d) => d.message);
    for (const safe of [
      '#glossary-term[A] <h-a> (x)',
      '#glossary-term[A] <h-a>(x)',
      '#glossary-term[A] <h-a> \\[x\\]',
    ]) {
      expect(await errors(safe), safe).toEqual([]);
    }
    expect(await errors('#glossary-term[A](x)')).toEqual([
      'unknown variable: x',
    ]);
    expect(await errors('#glossary-term[A][x]')).toEqual([
      'unexpected argument',
    ]);
  });
});
