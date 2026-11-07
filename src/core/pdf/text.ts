// US-034 AC-7: the text runs of a PDF's pages with their positions, read
// through the core reader (`reader.ts`). Pure: no Obsidian, Node, or I/O
// imports. A small content-stream interpreter for the PDFs Typst writes.
//
// What it does to the stream (SCAR-001):
// - Graphics state: `q`/`Q` save and restore the matrix (CTM); `cm`
//   multiplies it. Text state: `BT` resets the text matrix, `Tm` sets it,
//   `Td`/`TD`/`T*` move to a new line, `Tf` sets font and size, `Tc`, `Tw`,
//   `Tz`, `TL` are kept; `TJ`/`Tj`/`'`/`"` show text.
// - A run is one show operator: its glyphs (2 bytes each for a composite
//   font, else 1), each with its character from the font's `ToUnicode` map
//   and its advance from the font's widths (`/W` and `/DW` of the
//   descendant font, else `/Widths` and `/FirstChar`), and the `TJ`
//   adjustments between them, in thousandths of an em as written.
// - Its start and end are the text-space origin before and after the run,
//   through the text matrix and the CTM, in PDF points (y up).
// - Marked content `/Artifact` whose properties name `/Header` or
//   `/Footer` (Typst's running header and folio) marks its runs `furniture`.
import {contentTokens, type PdfFile, type PdfToken} from './reader';

/** One glyph or one `TJ` adjustment of a run. */
export type RunItem = {ch: string; adv: number} | {kern: number};

/** One show operator's text, placed on the page. */
export interface TextRun {
  /** Start and end of the run's baseline in PDF points. */
  x0: number;
  x1: number;
  y: number;
  /** The font size as drawn (points). */
  size: number;
  items: RunItem[];
  /** Inside a header or footer artifact. */
  furniture: boolean;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` then `n` (PDF row-vector convention: a point goes through m first). */
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [
  x * m[0] + y * m[2] + m[4],
  x * m[1] + y * m[3] + m[5],
];

/** What the interpreter needs of a font. */
interface FontInfo {
  composite: boolean;
  unicode: Map<number, string>;
  width(glyph: number): number;
}

/** The widths of a `/W` array's text: `c [w …]` and `c1 c2 w` entries. */
function readW(text: string, into: Map<number, number>): void {
  const toks = text.match(/\[|\]|-?[\d.]+/g) ?? [];
  for (let i = 0; i < toks.length;) {
    const first = Number(toks[i++]);
    if (toks[i] === '[') {
      i++;
      let g = first;
      while (i < toks.length && toks[i] !== ']')
        into.set(g++, Number(toks[i++]));
      i++;
    } else {
      const last = Number(toks[i++]);
      const w = Number(toks[i++]);
      for (let g = first; g <= last; g++) into.set(g, w);
    }
  }
}

/** The text of a direct or indirect array after `/Key`; '' without one. */
function arrayOf(file: PdfFile, dict: string, key: string): string {
  const ref = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  if (ref !== null) return file.object(Number(ref[1]));
  const at = dict.search(new RegExp(`/${key}\\s*\\[`));
  if (at < 0) return '';
  let depth = 0;
  for (let i = dict.indexOf('[', at); i < dict.length; i++) {
    if (dict[i] === '[') depth++;
    else if (dict[i] === ']' && --depth === 0)
      return dict.slice(dict.indexOf('[', at), i + 1);
  }
  return '';
}

function fontInfo(file: PdfFile, n: number): FontInfo {
  const dict = file.object(n);
  const unicode = file.toUnicode(n);
  const widths = new Map<number, number>();
  const descendant = /\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/.exec(dict);
  if (descendant !== null) {
    const d = file.object(Number(descendant[1]));
    const dw = Number(/\/DW\s+([\d.]+)/.exec(d)?.[1] ?? 1000);
    readW(arrayOf(file, d, 'W').replace(/^\s*\[|\]\s*$/g, ''), widths);
    return {composite: true, unicode, width: (g) => widths.get(g) ?? dw};
  }
  const first = Number(/\/FirstChar\s+(\d+)/.exec(dict)?.[1] ?? 0);
  const list = (arrayOf(file, dict, 'Widths').match(/-?[\d.]+/g) ?? []).map(
    Number,
  );
  return {
    composite: false,
    unicode,
    width: (g) => list[g - first] ?? 0,
  };
}

/** The page objects in order, following nested `/Kids`. */
export function pageObjects(file: PdfFile): number[] {
  const root = /\/Root\s+(\d+)\s+0\s+R/.exec(file.text);
  const catalog = root === null ? null : file.object(Number(root[1]));
  const top = catalog === null ? null : /\/Pages\s+(\d+)\s+0\s+R/.exec(catalog);
  const start =
    top !== null
      ? Number(top[1])
      : Number(
          /(\d+)\s+0\s+obj\s*<<[^>]*\/Type\s*\/Pages\b/.exec(file.text)?.[1],
        );
  if (!Number.isInteger(start)) throw new Error('PDF page tree not found');
  const out: number[] = [];
  const walk = (n: number, depth: number): void => {
    if (depth > 32) throw new Error('PDF page tree too deep');
    const dict = file.object(n);
    if (/\/Type\s*\/Pages\b/.test(dict)) {
      for (const m of arrayOf(file, dict, 'Kids').matchAll(/(\d+)\s+0\s+R/g))
        walk(Number(m[1]), depth + 1);
    } else out.push(n);
  };
  walk(start, 0);
  return out;
}

/** The page's font resources by name (`f0` → font object). */
function pageFonts(file: PdfFile, page: string): Map<string, number> {
  const res = /\/Resources\s+(\d+)\s+0\s+R/.exec(page);
  const resources = res === null ? page : file.object(Number(res[1]));
  const ref = /\/Font\s+(\d+)\s+0\s+R/.exec(resources);
  const block =
    ref !== null
      ? file.object(Number(ref[1]))
      : (/\/Font\s*<<([^>]*)>>/.exec(resources)?.[1] ?? '');
  const out = new Map<string, number>();
  for (const m of block.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+0\s+R/g))
    out.set(m[1] as string, Number(m[2]));
  return out;
}

/** The page's content streams joined (`/Contents n 0 R` or an array). */
function pageContent(file: PdfFile, page: string): string {
  const list = arrayOf(file, page, 'Contents');
  if (list !== '' && list.trimStart().startsWith('[')) {
    return [...list.matchAll(/(\d+)\s+0\s+R/g)]
      .map((m) => file.stream(Number(m[1])))
      .join('\n');
  }
  const one = /\/Contents\s+(\d+)\s+0\s+R/.exec(page);
  return one === null ? '' : file.stream(Number(one[1]));
}

/**
 * US-034 AC-7: the runs of every page, in page order. `fonts` caches the
 * fonts across pages (read once per font object).
 */
export function pageRuns(file: PdfFile): TextRun[][] {
  const fonts = new Map<number, FontInfo>();
  const fontOf = (n: number): FontInfo => {
    let f = fonts.get(n);
    if (f === undefined) {
      f = fontInfo(file, n);
      fonts.set(n, f);
    }
    return f;
  };
  return pageObjects(file).map((id) => {
    const page = file.object(id);
    const names = pageFonts(file, page);
    return runsOf(pageContent(file, page), (name) => {
      const n = names.get(name);
      return n === undefined ? null : fontOf(n);
    });
  });
}

/** The runs of one content stream. */
function runsOf(
  stream: string,
  fontNamed: (name: string) => FontInfo | null,
): TextRun[] {
  const runs: TextRun[] = [];
  let ctm: Matrix = IDENTITY;
  const saved: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let font: FontInfo | null = null;
  let size = 0;
  let tc = 0;
  let tw = 0;
  let tz = 1;
  let tl = 0;
  // marked content: true for a header or footer artifact (and inside it)
  const marks: boolean[] = [];
  const operands: (PdfToken | PdfToken[])[] = [];
  let array: PdfToken[] | null = null;
  const num = (i: number): number => {
    const t = operands[operands.length - i];
    return t !== undefined && !Array.isArray(t) && t.t === 'op'
      ? Number(t.v)
      : Number.NaN;
  };
  const show = (parts: PdfToken[]): void => {
    if (font === null) return;
    const f = font;
    const items: RunItem[] = [];
    const scale = size * tz;
    const trm = multiply(tm, ctm);
    const [x0, y0] = apply(trm, 0, 0);
    let tx = 0;
    for (const part of parts) {
      if (part.t === 'str') {
        const bytes = part.bytes;
        const step = f.composite ? 2 : 1;
        for (let i = 0; i + step - 1 < bytes.length; i += step) {
          const g = f.composite
            ? ((bytes[i] as number) << 8) | (bytes[i + 1] as number)
            : (bytes[i] as number);
          const ch = f.unicode.get(g) ?? '�';
          const adv = f.width(g);
          items.push({ch, adv});
          const word = !f.composite && g === 32 ? tw : 0;
          tx += ((adv / 1000) * size + tc + word) * tz;
        }
      } else if (part.t === 'op') {
        const k = Number(part.v);
        if (Number.isFinite(k)) {
          items.push({kern: k});
          tx -= (k / 1000) * scale;
        }
      }
    }
    const [x1] = apply(trm, tx, 0);
    // The size as drawn: the length of the text matrix's first column.
    const drawn = Math.hypot(trm[0], trm[1]) * size;
    runs.push({
      x0: Math.min(x0, x1),
      x1: Math.max(x0, x1),
      y: y0,
      size: drawn,
      items,
      furniture: marks.some(Boolean),
    });
    tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + tx * tm[0], tm[5] + tx * tm[1]];
  };
  const newLine = (dx: number, dy: number): void => {
    tlm = multiply([1, 0, 0, 1, dx, dy], tlm);
    tm = tlm;
  };
  for (const token of contentTokens(stream)) {
    if (token.t === '[') {
      array = [];
      continue;
    }
    if (token.t === ']') {
      operands.push(array ?? []);
      array = null;
      continue;
    }
    if (array !== null) {
      array.push(token);
      continue;
    }
    if (token.t !== 'op' || Number.isFinite(Number(token.v))) {
      operands.push(token);
      continue;
    }
    switch (token.v) {
      case 'q':
        saved.push(ctm);
        break;
      case 'Q':
        ctm = saved.pop() ?? IDENTITY;
        break;
      case 'cm':
        ctm = multiply([num(6), num(5), num(4), num(3), num(2), num(1)], ctm);
        break;
      case 'BT':
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case 'Tf': {
        const name = operands[operands.length - 2];
        font =
          name !== undefined && !Array.isArray(name) && name.t === 'name'
            ? fontNamed(name.v)
            : null;
        size = num(1);
        break;
      }
      case 'Tm':
        tlm = [num(6), num(5), num(4), num(3), num(2), num(1)];
        tm = tlm;
        break;
      case 'Td':
        newLine(num(2), num(1));
        break;
      case 'TD':
        tl = -num(1);
        newLine(num(2), num(1));
        break;
      case 'T*':
        newLine(0, -tl);
        break;
      case 'TL':
        tl = num(1);
        break;
      case 'Tc':
        tc = num(1);
        break;
      case 'Tw':
        tw = num(1);
        break;
      case 'Tz':
        tz = num(1) / 100;
        break;
      case 'TJ': {
        const parts = operands[operands.length - 1];
        if (Array.isArray(parts)) show(parts);
        break;
      }
      case 'Tj':
      case "'":
      case '"': {
        if (token.v !== 'Tj') newLine(0, -tl);
        const s = operands[operands.length - 1];
        if (s !== undefined && !Array.isArray(s)) show([s]);
        break;
      }
      case 'BDC':
      case 'BMC': {
        const names = operands
          .filter((o): o is PdfToken => !Array.isArray(o) && o.t === 'name')
          .map((o) => (o as {v: string}).v);
        marks.push(
          names[0] === 'Artifact' &&
            (names.includes('Header') || names.includes('Footer')),
        );
        break;
      }
      case 'EMC':
        marks.pop();
        break;
      default:
        break;
    }
    operands.length = 0;
  }
  return runs;
}
