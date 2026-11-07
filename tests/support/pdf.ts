// Test support for US-011: a small reader of the page structure of a PDF made
// by Typst. Page dictionaries are plain text, page contents are Flate streams
// whose text is written with glyph numbers that the font's ToUnicode map turns
// back into characters. Used to check content, not only page counts (SCAR-015):
// what each page holds, its size, the text on it and the number printed in its
// footer. US-034 AC-9: the content-stream reader (tokens, strings, CMaps,
// the object index, streams) is core code, `src/core/pdf/reader.ts`, where
// its transforms are documented; this file keeps the test-side readers.
import {
  contentTokens,
  hexBytes,
  literalBytes,
  openPdf,
  type PdfFile,
} from '../../src/core/pdf/reader';

export interface PdfPage {
  /** Width and height in points. */
  width: number;
  height: number;
  /** The page uses an image (an XObject in its resources). */
  hasImage: boolean;
  /**
   * US-028 AC-6: the images drawn on the page, in the order of the stream,
   * with their drawn size in points: the matrix of the `cm` written right
   * before each `Do` (Typst writes `w 0 0 h x y cm` then `/xN Do`; checked on
   * known documents, SCAR-028). A cropped image reports its drawn size.
   * US-028 AC-13: `x` and `y` are the matrix's translation, the image's
   * lower left corner in PDF points from the page's lower left corner.
   */
  images: {width: number; height: number; x: number; y: number}[];
  /** The page shows any text, also a page number. */
  hasText: boolean;
  /** The text of the page without its footer, runs joined by a space. */
  text: string;
  /** The text of the footer: the printed page number; '' without a footer. */
  footer: string;
  /** The number of the PDF page label (what a viewer lists); informational. */
  label: number;
  /**
   * Distance in points from the left page edge to the start of the first text
   * line of the body (the cm of the first run plus its text matrix); null
   * without text.
   */
  firstLineX: number | null;
  /**
   * The first clip rectangle of the page in points from the left and the top
   * edge (Typst clips a cover image to its box); null without one. US-009
   * AC-11 measures the cover box with it.
   */
  clip: {left: number; top: number; width: number; height: number} | null;
  /**
   * US-016 AC-15: the RGB fill colours the page content sets (`r g b scn`, as
   * Typst writes them, measured 2026-10-18), as `#rrggbb` in lower case, in
   * the order they are set, repeats kept. Text colours are included.
   */
  fills: string[];
  /**
   * US-019 AC-5: the text of the running header (Typst marks it as an
   * `/Artifact << … /Subtype /Header … >>` part before the body, measured
   * 2026-10-19); '' without one. Not part of `text`.
   */
  header: string;
  /** US-019 AC-4, AC-5: the base font name of the header's first run (subset prefix removed); null without. */
  headerFont: string | null;
  /** US-019 AC-4, AC-5: the size in points of the header's first run; null without. */
  headerSize: number | null;
  /** US-019 AC-4: the base font name and size of the first body run; null without. */
  bodyFont: string | null;
  bodySize: number | null;
  /** US-019 AC-4: distance in points from the left page edge to the footer's first run; null without a footer. */
  footerX: number | null;
  /** US-019 AC-3: false when the page label of the page has no style (`numbering: none`). */
  labelShown: boolean;
}

/** The base font names of the page's font resources, by resource name. */
function baseFonts(file: PdfFile, dict: string): Map<string, string> {
  const out = new Map<string, string>();
  const block = /\/Font <<([^>]*)>>/.exec(dict);
  for (const m of (block?.[1] ?? '').matchAll(/\/(f\d+) (\d+) 0 R/g)) {
    const name = /\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/>]+)/.exec(
      file.object(Number(m[2])),
    );
    if (name !== null) out.set(m[1] as string, name[1] as string);
  }
  return out;
}

/** The font resource and size of the first `Tf` in `part`. */
function firstFont(
  part: string,
  fonts: Map<string, string>,
): {font: string | null; size: number | null} {
  const m = /\/(f\d+) ([\d.]+) Tf/.exec(part);
  return m === null
    ? {font: null, size: null}
    : {font: fonts.get(m[1] as string) ?? null, size: Number(m[2])};
}

/** US-016 AC-15: the `#rrggbb` of every three-number `scn` in `body`. */
function fillsOf(body: string): string[] {
  const hex = (v: string): string =>
    Math.round(Number(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return [...body.matchAll(/(?:^|\s)([\d.]+) ([\d.]+) ([\d.]+) scn\b/g)].map(
    (m) =>
      `#${hex(m[1] as string)}${hex(m[2] as string)}${hex(m[3] as string)}`,
  );
}

/** The `[start, end)` ranges of the `/Header` artifacts of a content stream. */
function headerParts(stream: string): [number, number][] {
  const out: [number, number][] = [];
  let from = stream.indexOf('/Subtype /Header');
  while (from >= 0) {
    const start = stream.lastIndexOf('/Artifact', from);
    const end = artifactEnd(stream, from);
    if (end < 0) {
      out.push([start, stream.length]);
      break;
    }
    out.push([start, end]);
    from = stream.indexOf('/Subtype /Header', end);
  }
  return out;
}

/**
 * The index just after the `EMC` that closes the marked-content sequence
 * whose `BDC` follows `from`; -1 when it is not closed.
 */
function artifactEnd(stream: string, from: number): number {
  const open = stream.indexOf('BDC', from);
  if (open < 0) return -1;
  const ops = /\b(BDC|BMC|EMC)\b/g;
  ops.lastIndex = open + 3;
  let depth = 1;
  for (let m = ops.exec(stream); m !== null; m = ops.exec(stream)) {
    depth += m[1] === 'EMC' ? -1 : 1;
    if (depth === 0) return m.index + 3;
  }
  return -1;
}

/** The text of the `TJ` and `Tj` strings of a content stream part, runs joined by a space. */
function textOf(part: string, fonts: Map<string, Map<number, string>>): string {
  const runs: string[] = [];
  let font = new Map<number, string>();
  let name = '';
  let strings: number[][] = [];
  let array: number[][] | null = null;
  const decode = (all: number[][]): string => {
    let run = '';
    for (const bytes of all) {
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        const glyph = ((bytes[i] as number) << 8) | (bytes[i + 1] as number);
        run += font.get(glyph) ?? '\uFFFD';
      }
    }
    return run;
  };
  for (const token of contentTokens(part)) {
    if (token.t === 'name') {
      name = token.v;
    } else if (token.t === 'str') {
      if (array !== null) array.push(token.bytes);
      else strings = [token.bytes];
    } else if (token.t === '[') {
      array = [];
    } else if (token.t === ']') {
      strings = array ?? [];
      array = null;
    } else if (token.v === 'Tf') {
      font = fonts.get(name) ?? new Map();
    } else if (token.v === 'TJ' || token.v === 'Tj') {
      const run = decode(strings);
      if (run !== '') runs.push(run);
      strings = [];
    }
  }
  return runs.join(' ');
}

/**
 * The x position of the first text run: the `cm` that moves the origin, plus
 * the `Tm` inside the text object (US-009 AC-5 measures margins with it).
 */
function firstLineX(body: string): number | null {
  const m =
    /1 0 0 -1 ([\d.-]+) [\d.-]+ cm[\s\S]*?BT[\s\S]*?1 0 0 -1 ([\d.-]+) [\d.-]+ Tm/.exec(
      body,
    );
  return m === null ? null : Number(m[1]) + Number(m[2]);
}

/** The first rectangle that the page content sets as the clip path. */
function firstClip(body: string, pageHeight: number): PdfPage['clip'] {
  const m =
    /([\d.-]+) ([\d.-]+) m\s+([\d.-]+) ([\d.-]+) l\s+([\d.-]+) ([\d.-]+) l\s+([\d.-]+) ([\d.-]+) l\s+h\s+W\s+n/.exec(
      body,
    );
  if (m === null) return null;
  const xs = [1, 3, 5, 7].map((i) => Number(m[i]));
  const ys = [2, 4, 6, 8].map((i) => Number(m[i]));
  const left = Math.min(...xs);
  return {
    left,
    top: pageHeight - Math.max(...ys),
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/** A number of a PDF content stream. */
const NUM = '(-?[\\d.]+)';
const DRAWN = new RegExp(
  `${NUM} ${NUM} ${NUM} ${NUM} ${NUM} ${NUM} cm\\s+/[\\w.]+ Do`,
  'g',
);

/**
 * US-028 AC-6, AC-13: the drawn sizes and places of the images of a content
 * stream: for each `Do` right after a `cm`, the lengths of that matrix's
 * columns and its translation.
 */
function imagesOf(
  stream: string,
): {width: number; height: number; x: number; y: number}[] {
  return [...stream.matchAll(DRAWN)].map((m) => {
    const [a, b, c, d, e, f] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(
      Number,
    ) as [number, number, number, number, number, number];
    return {width: Math.hypot(a, b), height: Math.hypot(c, d), x: e, y: f};
  });
}

/** The pages of `bytes` in order. Throws when the structure is not found. */
export function readPdfPages(bytes: Uint8Array): PdfPage[] {
  const file = openPdf(bytes);
  const pdf = file.text;
  const tree = /\/Type \/Pages[^>]*\/Kids \[([^\]]*)\]/.exec(pdf);
  if (tree === null) throw new Error('PDF page tree not found');
  const kids = [...(tree[1] as string).matchAll(/(\d+) 0 R/g)].map((m) =>
    Number(m[1]),
  );

  // The page labels (an indirect object of the catalog), not the Nums of the
  // structure tree's parent tree. A label entry starts a run: the number of its
  // first page is `/St` (default 1).
  const labelsRef = /\/PageLabels (\d+) 0 R/.exec(pdf);
  const nums =
    labelsRef === null
      ? null
      : /\/Nums \[([^\]]*)\]/.exec(file.object(Number(labelsRef[1])));
  const runs: {start: number; first: number; shown: boolean}[] = [];
  if (nums !== null) {
    for (const m of (nums[1] as string).matchAll(/(\d+) (\d+) 0 R/g)) {
      const dict = file.object(Number(m[2]));
      runs.push({
        start: Number(m[1]),
        first: Number(/\/St (\d+)/.exec(dict)?.[1] ?? 1),
        shown: /\/S \//.test(dict),
      });
    }
  }
  const shownOf = (index: number): boolean =>
    runs.filter((r) => r.start <= index).pop()?.shown ?? true;
  const labelOf = (index: number): number => {
    const run = runs.filter((r) => r.start <= index).pop();
    return run === undefined ? index + 1 : run.first + index - run.start;
  };

  return kids.map((id, index) => {
    const dict = file.object(id);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(dict);
    if (box === null) throw new Error(`PDF page ${index + 1} has no MediaBox`);
    const fonts = new Map<string, Map<number, string>>();
    const fontBlock = /\/Font <<([^>]*)>>/.exec(dict);
    for (const m of (fontBlock?.[1] ?? '').matchAll(/\/(f\d+) (\d+) 0 R/g)) {
      fonts.set(m[1] as string, file.toUnicode(Number(m[2])));
    }
    const contents = /\/Contents (\d+) 0 R/.exec(dict);
    const stream = contents === null ? '' : file.stream(Number(contents[1]));
    const at = stream.indexOf('/Subtype /Footer');
    const upper = at < 0 ? stream : stream.slice(0, at);
    const footer = at < 0 ? '' : stream.slice(at);
    // US-019: the header is every `/Header` artifact (Typst writes one per
    // styled run), each from its `BDC` to the `EMC` that closes it; the rest
    // is the body. US-033 AC-11 (G4 #130): measured up to the first tagged
    // span before, which also took a table's repeated header row (an
    // untagged `/Artifact` standing between them) for the running header.
    const parts = headerParts(upper);
    const headerPart = parts
      .map(([from, to]) => upper.slice(from, to))
      .join(' ');
    let body = '';
    let next = 0;
    for (const [from, to] of parts) {
      body += upper.slice(next, from);
      next = to;
    }
    body += upper.slice(next);
    const text = textOf(body, fonts);
    const names = baseFonts(file, dict);
    const head = firstFont(headerPart, names);
    const main = firstFont(body, names);
    const footerCm = /1 0 0 -1 ([\d.-]+) [\d.-]+ cm/.exec(footer);
    const printed = textOf(footer, fonts);
    return {
      firstLineX: firstLineX(body),
      clip: firstClip(body, Number(box[2])),
      fills: fillsOf(body),
      width: Number(box[1]),
      height: Number(box[2]),
      hasImage: dict.includes('/XObject'),
      images: imagesOf(stream),
      hasText: text !== '' || printed !== '',
      text,
      footer: printed,
      label: labelOf(index),
      header: textOf(headerPart, fonts),
      headerFont: head.font,
      headerSize: head.size,
      bodyFont: main.font,
      bodySize: main.size,
      footerX: footerCm === null ? null : Number(footerCm[1]),
      labelShown: shownOf(index),
    };
  });
}

/** Points to millimetres, rounded to 0.1 mm. */
export const mm = (points: number): number =>
  Math.round((points / 72) * 25.4 * 10) / 10;

/** A PDF text string (`(…)` literal or `<…>` hex), UTF-16BE when it has a BOM. */
function pdfString(token: string): string {
  const bytes = token.startsWith('<')
    ? hexBytes(token.slice(1, -1))
    : literalBytes(token);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode(
        ((bytes[i] as number) << 8) | (bytes[i + 1] as number),
      );
    }
    return out;
  }
  return String.fromCharCode(...bytes);
}

/** The ids of the page objects in order (the kids of the page tree). */
function pageIds(pdf: string): number[] {
  const tree = /\/Type \/Pages[^>]*\/Kids \[([^\]]*)\]/.exec(pdf);
  if (tree === null) throw new Error('PDF page tree not found');
  return [...(tree[1] as string).matchAll(/(\d+) 0 R/g)].map((m) =>
    Number(m[1]),
  );
}

/**
 * The 0-based page index that the destination of `dict` names: `/Dest n 0 R`
 * to an array, an inline array, or a name `/Dest (h-two)` looked up in the
 * catalog's `/Names << /Dests << /Names [(name) n 0 R …] >> >>` (Typst writes
 * a name for a link to a label, measured 2026-10-19).
 */
function destPage(file: PdfFile, dict: string, pages: number[]): number | null {
  const named = /\/Dest (\((?:\\.|[^\\)])*\))/.exec(dict);
  if (named !== null) {
    const names = /\/Dests\s*<<\s*\/Names \[([^\]]*)\]/.exec(file.text);
    const wanted = pdfString(named[1] as string);
    for (const m of (names?.[1] ?? '').matchAll(
      /(\((?:\\.|[^\\)])*\))\s*(\d+) 0 R/g,
    )) {
      if (pdfString(m[1] as string) === wanted) {
        return destPage(file, `/Dest ${m[2]} 0 R`, pages);
      }
    }
    return null;
  }
  const ref = /\/Dest (\d+) 0 R/.exec(dict);
  const array =
    ref === null
      ? /\/Dest \[(\d+) 0 R/.exec(dict)
      : /^\s*\[(\d+) 0 R/.exec(file.object(Number(ref[1])));
  if (array === null) return null;
  const index = pages.indexOf(Number(array[1]));
  return index < 0 ? null : index;
}

/** US-017 AC-11, AC-14: one entry of the PDF outline (the bookmarks). */
export interface PdfBookmark {
  /** The title as the viewer shows it, numbering included (`2.1 Sub`). */
  title: string;
  /** 1 for a top-level entry, 2 for its children, and so on. */
  depth: number;
  /** The 0-based index of the page the entry jumps to; null without one. */
  page: number | null;
}

/**
 * US-017 AC-11, AC-14: the bookmarks of `bytes` in document order (depth
 * first). Measured 2026-10-19 with Typst 0.14.2: `/Outlines` with `/First`,
 * `/Next`, `/Title (…)` and `/Dest n 0 R` to `[page /XYZ x y 0]`; an empty
 * list when the PDF has no outline.
 */
export function readPdfBookmarks(bytes: Uint8Array): PdfBookmark[] {
  const file = openPdf(bytes);
  const pdf = file.text;
  const pages = pageIds(pdf);
  const root = /\/Type \/Outlines[^>]*?\/First (\d+) 0 R/.exec(pdf);
  if (root === null) return [];
  const out: PdfBookmark[] = [];
  const walk = (first: number, depth: number): void => {
    for (let id: number | null = first; id !== null;) {
      const dict = file.object(id);
      const title = /\/Title (\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>)/.exec(dict);
      out.push({
        title: title === null ? '' : pdfString(title[1] as string),
        depth,
        page: destPage(file, dict, pages),
      });
      const child = /\/First (\d+) 0 R/.exec(dict);
      if (child !== null) walk(Number(child[1]), depth + 1);
      const next = /\/Next (\d+) 0 R/.exec(dict);
      id = next === null ? null : Number(next[1]);
    }
  };
  walk(Number(root[1]), 1);
  return out;
}

/** US-017 AC-11: one link annotation of the PDF. */
export interface PdfLink {
  /** The 0-based index of the page that holds the link. */
  page: number;
  /** The 0-based index of the page an internal link jumps to; else null. */
  target: number | null;
  /** The address of an external link; else null. */
  uri: string | null;
}

/**
 * US-017 AC-11: the link annotations of every page, in page order and in
 * the order of each page's `/Annots`. Measured 2026-10-19: an internal link
 * has `/Dest n 0 R` or a named `/Dest (label)`, an external one
 * `/A << /S /URI /URI (…) >>`; a footnote adds a link to its note and back.
 */
export function readPdfLinks(bytes: Uint8Array): PdfLink[] {
  const file = openPdf(bytes);
  const pages = pageIds(file.text);
  return pages.flatMap((id, page) => {
    const annots = /\/Annots \[([^\]]*)\]/.exec(file.object(id));
    if (annots === null) return [];
    return [...(annots[1] as string).matchAll(/(\d+) 0 R/g)].flatMap((m) => {
      const dict = file.object(Number(m[1]));
      if (!/\/Subtype \/Link/.test(dict)) return [];
      const uri = /\/URI (\((?:\\.|[^\\)])*\))/.exec(dict);
      return [
        {
          page,
          target: destPage(file, dict, pages),
          uri: uri === null ? null : pdfString(uri[1] as string),
        },
      ];
    });
  });
}
