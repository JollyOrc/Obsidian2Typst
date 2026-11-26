// Test support for US-044: what a page of a Typst PDF paints — filled and stroked
// paths with their colour and bounds, and the fill colour of every text show
// operator, in the order `pageRuns` reads them. A test reader (SCAR-028): its
// own check is in tests/integration/us-044-filled-band-pdf.test.ts ("the paint
// reader on a known page").
//
// What it reads (SCAR-001): `q`/`Q` save and restore the matrix and both
// colours; `cm` multiplies the matrix; `sc`/`scn`/`rg`/`g` set the fill colour
// and `SC`/`SCN`/`RG`/`G` the stroke colour (1 number grey, 3 RGB; a colour
// space set with `cs`/`CS` is not interpreted — Typst writes sRGB and grey
// values); `m`, `l`, `c`, `re`, `h` build a path; `f`, `f*`, `F`, `B`, `B*`,
// `b`, `b*` fill it, `S`, `s` stroke it (with `w`), `n` drops it; `BT`, `Tm`,
// `Td`, `TD`, `T*` place text; `Tj`, `TJ`, `'`, `"` show it. Positions are mm
// from the page's top-left corner (y down). Colours are `#rrggbb`, lower case.
import {
  contentTokens,
  type PdfFile,
  type PdfToken,
} from '../../src/core/pdf/reader';
import {pageObjects} from '../../src/core/pdf/text';

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
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
const MM = 25.4 / 72;

/** A painted path: its bounds (mm, y down), colour, and for a stroke its width (pt). */
export interface Painted {
  kind: 'fill' | 'stroke';
  colour: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Stroke width in pt (0 for a fill). */
  width: number;
  /** How many points the path has (a straight rule has 2). */
  points: number;
}

/** A text show operator: its fill colour and its origin (mm, y down). */
export interface Shown {
  colour: string;
  x: number;
  y: number;
}

export interface PagePaint {
  paths: Painted[];
  shows: Shown[];
}

const hex = (values: number[]): string => {
  const c =
    values.length === 1
      ? [values[0]!, values[0]!, values[0]!]
      : values.length === 3
        ? values
        : [Number.NaN, Number.NaN, Number.NaN];
  return `#${c
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

function contentOf(file: PdfFile, page: number): string {
  const dict = file.object(page);
  const array = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  if (array !== null)
    return [...(array[1] ?? '').matchAll(/(\d+)\s+0\s+R/g)]
      .map((m) => file.stream(Number(m[1])))
      .join('\n');
  const one = /\/Contents\s+(\d+)\s+0\s+R/.exec(dict);
  return one === null ? '' : file.stream(Number(one[1]));
}

/** The paint of every page, in page order. `height` is the page height in mm. */
export function pagePaint(file: PdfFile, height: number): PagePaint[] {
  return pageObjects(file).map((page) =>
    paintOf(contentOf(file, page), height),
  );
}

function paintOf(stream: string, height: number): PagePaint {
  const paths: Painted[] = [];
  const shows: Shown[] = [];
  let ctm: Matrix = IDENTITY;
  let fill = '#000000';
  let stroke = '#000000';
  let width = 1;
  const saved: {ctm: Matrix; fill: string; stroke: string; width: number}[] =
    [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let tl = 0;
  let path: [number, number][] = [];
  const operands: PdfToken[] = [];
  let depth = 0;
  const nums = (): number[] =>
    operands
      .filter((t): t is {t: 'op'; v: string} => t.t === 'op')
      .map((t) => Number(t.v))
      .filter((n) => Number.isFinite(n));
  const num = (i: number): number => {
    const all = nums();
    return all[all.length - i] ?? Number.NaN;
  };
  const point = (x: number, y: number): void => {
    path.push(apply(ctm, x, y));
  };
  const paint = (kind: 'fill' | 'stroke'): void => {
    if (path.length > 0) {
      const xs = path.map((p) => p[0]);
      const ys = path.map((p) => p[1]);
      paths.push({
        kind,
        colour: kind === 'fill' ? fill : stroke,
        x0: Math.min(...xs) * MM,
        x1: Math.max(...xs) * MM,
        y0: height - Math.max(...ys) * MM,
        y1: height - Math.min(...ys) * MM,
        width: kind === 'fill' ? 0 : width * Math.hypot(ctm[0], ctm[1]),
        points: path.length,
      });
    }
  };
  const show = (): void => {
    const [x, y] = apply(multiply(tm, ctm), 0, 0);
    shows.push({colour: fill, x: x * MM, y: height - y * MM});
  };
  for (const token of contentTokens(stream)) {
    if (token.t === '[') {
      depth++;
      continue;
    }
    if (token.t === ']') {
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (token.t !== 'op' || Number.isFinite(Number(token.v))) {
      operands.push(token);
      continue;
    }
    switch (token.v) {
      case 'q':
        saved.push({ctm, fill, stroke, width});
        break;
      case 'Q': {
        const s = saved.pop();
        if (s !== undefined) ({ctm, fill, stroke, width} = s);
        break;
      }
      case 'cm':
        ctm = multiply([num(6), num(5), num(4), num(3), num(2), num(1)], ctm);
        break;
      case 'w':
        width = num(1);
        break;
      case 'g':
      case 'rg':
      case 'sc':
      case 'scn':
        fill = hex(nums());
        break;
      case 'G':
      case 'RG':
      case 'SC':
      case 'SCN':
        stroke = hex(nums());
        break;
      case 'm':
      case 'l':
        point(num(2), num(1));
        break;
      case 'c':
        point(num(6), num(5));
        point(num(4), num(3));
        point(num(2), num(1));
        break;
      case 're': {
        const [x, y, w, h] = [num(4), num(3), num(2), num(1)];
        point(x, y);
        point(x + w, y);
        point(x + w, y + h);
        point(x, y + h);
        break;
      }
      case 'f':
      case 'f*':
      case 'F':
        paint('fill');
        path = [];
        break;
      case 'B':
      case 'B*':
      case 'b':
      case 'b*':
        paint('fill');
        paint('stroke');
        path = [];
        break;
      case 'S':
      case 's':
        paint('stroke');
        path = [];
        break;
      case 'n':
        path = [];
        break;
      case 'BT':
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case 'Tm':
        tlm = [num(6), num(5), num(4), num(3), num(2), num(1)];
        tm = tlm;
        break;
      case 'TL':
        tl = num(1);
        break;
      case 'Td':
        tlm = multiply([1, 0, 0, 1, num(2), num(1)], tlm);
        tm = tlm;
        break;
      case 'TD':
        tl = -num(1);
        tlm = multiply([1, 0, 0, 1, num(2), num(1)], tlm);
        tm = tlm;
        break;
      case 'T*':
        tlm = multiply([1, 0, 0, 1, 0, -tl], tlm);
        tm = tlm;
        break;
      case "'":
      case '"':
        tlm = multiply([1, 0, 0, 1, 0, -tl], tlm);
        tm = tlm;
        show();
        break;
      case 'Tj':
      case 'TJ':
        show();
        break;
      default:
        break;
    }
    operands.length = 0;
  }
  return {paths, shows};
}
