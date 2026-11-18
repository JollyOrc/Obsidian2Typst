// US-041 AC-1 to AC-5 and AC-7 — the ◆ marks of the statblock band in the PDF.
// The reader compiles `api.statblockTypst`'s answer (prelude + data) in a block of
// a known width on a page with a 4 mm margin, so the band's inner width is known
// (the block's width less 2 x 2 mm of inset) and the band's left edge is at
// 6 mm. The glyphs of the band are read from the PDF's text runs with their
// positions (`pageRuns`, SCAR-028: each reading is also checked on a known
// layout below), never from the helper's own facts (SCAR-015, SCAR-023).
// Names are invented (SCAR-035). Source of truth:
// docs/user-stories/US-041-statblock-band-marks.md.
// Red until US-041 is implemented (G2, 2026-11-16). Each compile takes about
// 0.1 s alone; the 120 s limit leaves room for the first WASM start under a
// full parallel run (SCAR-030). Measured at Typst 0.14.2, Libertinus Serif
// 11.5 pt, 53.75 mm (SCAR-032): a mark is 2.7 mm wide, a gap 1.01 mm.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CompileFormatEnum} from '@myriaddreamin/typst.ts/dist/esm/compiler.mjs';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {afterAll, describe, expect, it} from 'vitest';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns, type TextRun} from '../../src/core/pdf/text';
import {BOOK_FONTS} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';
import {withoutClock} from '../support/pdf-clock';

const LIMIT = 120_000;
const PT = 72 / 25.4;
const MARGIN = 4;
const INSET = 2;
/** The band's inner width in the A5 book: 55 % of 105 mm = 57.75 mm, less 2 x 2 mm. */
const W = 53.75;
const MODULE = '../../src/plugin/entries/typst-api';

let snippet: TypstSnippet | undefined;
let count = 0;
afterAll(() => {
  snippet = undefined;
  disposeEntriesCompiler();
});

async function pdfOf(source: string): Promise<Uint8Array> {
  if (snippet === undefined) {
    snippet = new TypstSnippet();
    snippet.setCompilerInitOptions({
      getModule: () =>
        readFileSync(
          join(
            process.cwd(),
            'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
          ),
        ),
      beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
    });
  }
  const path = `/us041-${count++}.typ`;
  await snippet.addSource(path, source);
  const compiler = (await snippet.getCompiler()) as unknown as {
    compile(o: {
      mainFilePath: string;
      format: unknown;
      diagnostics: string;
    }): Promise<{result?: Uint8Array; diagnostics?: unknown[]}>;
  };
  const out = await compiler.compile({
    mainFilePath: path,
    format: CompileFormatEnum.pdf,
    diagnostics: 'full',
  });
  if (out.result === undefined)
    throw new Error(`no PDF: ${JSON.stringify(out.diagnostics)}`);
  return out.result;
}

/** One glyph of a run, placed: from the run's start, advances and kerns. */
interface Glyph {
  ch: string;
  /** Left and right edge and baseline, mm from the page's left edge and top. */
  x0: number;
  x1: number;
  y: number;
}
const PAGE_H = 100;
function glyphsOf(run: TextRun): Glyph[] {
  const out: Glyph[] = [];
  let x = run.x0;
  for (const item of run.items) {
    if ('kern' in item) {
      x -= (item.kern / 1000) * run.size;
    } else {
      const w = (item.adv / 1000) * run.size;
      out.push({
        ch: item.ch,
        x0: x / PT,
        x1: (x + w) / PT,
        y: PAGE_H - run.y / PT,
      });
      x += w;
    }
  }
  return out;
}

interface Look {
  size?: number;
  font?: string;
}
interface Band {
  /** Every ◆ of the band, left to right. */
  marks: Glyph[];
  /** The name's lines, top to bottom: text, left and right edge, baseline. */
  lines: {text: string; x0: number; x1: number; y: number}[];
  /** Every glyph of the page above the first attack line: the band. */
  glyphs: Glyph[];
  /** The baseline of the first line below the band, mm from the page's top. */
  belowY: number;
}

/** Compiles the band of `name` in a statblock whose band is `inner` mm wide. */
async function band(
  name: string,
  inner = W,
  look: Look = {},
  data: Record<string, unknown> = {attacks: ['Kick: 2d6']},
): Promise<Band> {
  const {createStatblockTypstApi} = (await import(
    /* @vite-ignore */ MODULE as string
  )) as {
    createStatblockTypstApi(deps: unknown): {
      statblockTypst(
        d: Record<string, unknown>,
        o?: {heading?: string},
      ): Promise<
        {ok: true; prelude: string; data: string} | {ok: false; message: string}
      >;
    };
  };
  const entries = {
    ...ENTRIES,
    statblock: {
      ...ENTRIES.statblock,
      ...(look.size === undefined ? {} : {sizes: {band: look.size}}),
      ...(look.font === undefined ? {} : {fonts: {band: look.font}}),
    },
  };
  const api = createStatblockTypstApi({
    settings: async () => ({entries}),
    readIconBytes: async () => null,
    fonts: async () => [],
  });
  const a = await api.statblockTypst(data, {heading: name});
  if (!a.ok) throw new Error(a.message);
  const block = inner + 2 * INSET;
  const source = `#set page(width: ${block + 2 * MARGIN}mm, height: ${PAGE_H}mm, margin: ${MARGIN}mm)\n${a.prelude}\n#block(width: ${block}mm, o2t-sb-box(${a.data}))\n`;
  const runs = pageRuns(openPdf(await pdfOf(source)))[0] ?? [];
  const all = runs.flatMap(glyphsOf);
  // the band is everything above the first line below it: the track's label
  // `STATE` of the example preset, else the first attack line `Kick`
  const textOfRun = (r: TextRun): string =>
    r.items.map((i) => ('ch' in i ? i.ch : '')).join('');
  const below =
    runs.find((r) => textOfRun(r) === 'STATE') ??
    runs.find((r) => textOfRun(r).startsWith('Kick'));
  if (below === undefined) throw new Error('no line below the band found');
  const above = runs.filter((r) => r.y > below.y + 1);
  const glyphs = above.flatMap(glyphsOf);
  const names = glyphs.filter((g) => g.ch !== '◆');
  const ys = [...new Set(names.map((g) => g.y.toFixed(1)))].sort(
    (a, b) => Number(a) - Number(b),
  );
  const lines = ys.map((y) => {
    const row = names
      .filter((g) => g.y.toFixed(1) === y)
      .sort((a, b) => a.x0 - b.x0);
    // the gaps next to a mark are spaces of the same run: not part of the name
    while (row.length > 0 && row[0]!.ch === ' ') row.shift();
    while (row.length > 0 && row[row.length - 1]!.ch === ' ') row.pop();
    return {
      text: row
        .map((g) => g.ch)
        .join('')
        .trim(),
      x0: row[0]!.x0,
      x1: row[row.length - 1]!.x1,
      y: row.reduce((sum, g) => sum + g.y, 0) / row.length,
    };
  });
  expect(all.length, 'the page has text').toBeGreaterThan(0);
  return {
    marks: glyphs.filter((g) => g.ch === '◆').sort((a, b) => a.x0 - b.x0),
    lines,
    glyphs,
    belowY: PAGE_H - below.y / PT,
  };
}

const LEFT = MARGIN + INSET;
const near = (actual: number, expected: number, tol = 0.1, what = '') =>
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} vs ${expected}`,
  ).toBeLessThanOrEqual(tol);
/** The centre of a line (or of a name) between the band's edges, mm. */
const centre = (b: {x0: number; x1: number}) => (b.x0 + b.x1) / 2;

describe('US-041 AC-1: a name that fits on one line is drawn as before', () => {
  it(
    "Fen Hare: one line, both marks on the name's line, one gap away, centred",
    async () => {
      const b = await band('Fen Hare');
      expect(b.lines.map((l) => l.text)).toEqual(['Fen Hare']);
      expect(b.marks).toHaveLength(2);
      const [l, r] = b.marks as [Glyph, Glyph];
      const line = b.lines[0]!;
      near(l.y, line.y, 0.02, 'left mark on the line');
      near(r.y, line.y, 0.02, 'right mark on the line');
      // a mark is 2.7 mm, the gap one space (1.01 mm), at 11.5 pt in Libertinus
      near(l.x1 - l.x0, 2.7, 0.1, 'mark width');
      near(line.x0 - l.x1, 1.01, 0.1, 'gap left');
      near(r.x0 - line.x1, 1.01, 0.1, 'gap right');
      // centred in the band: 15.6 mm from each edge (53.75 - 22.5) / 2
      near(l.x0 - LEFT, 15.6, 0.15, 'left edge of the left mark');
      near(LEFT + W - r.x1, 15.6, 0.15, 'right edge of the right mark');
    },
    LIMIT,
  );

  it(
    'Pneumonoultramicroscopic (53.0 mm with its marks, 0.75 mm to spare): one line',
    async () => {
      const b = await band('Pneumonoultramicroscopic');
      expect(b.lines).toHaveLength(1);
      expect(b.marks).toHaveLength(2);
      near(b.marks[0]!.y, b.lines[0]!.y, 0.02);
      near(b.marks[1]!.y, b.lines[0]!.y, 0.02);
      // still inline: each mark one gap from the name, 0.37 mm from the band's edge
      const line = b.lines[0]!;
      near(line.x0 - b.marks[0]!.x1, 1.01, 0.1, 'gap left');
      near(b.marks[1]!.x0 - line.x1, 1.01, 0.1, 'gap right');
      near(b.marks[0]!.x0 - LEFT, 0.37, 0.15, 'edge left');
    },
    LIMIT,
  );
});

describe('US-041 AC-2: a name that wraps has a mark at each end, level with its middle', () => {
  const WRAPPED: [string, string[]][] = [
    [
      'Old Marsh Dragon of the Grey Reaches',
      ['Old Marsh Dragon of the', 'Grey Reaches'],
    ],
    [
      'Giant Swamp Chieftain of the Reeds',
      ['Giant Swamp Chieftain of', 'the Reeds'],
    ],
  ];
  it.each(WRAPPED)(
    "%s: two lines, marks at the band's ends, at the height between the lines",
    async (name, lines) => {
      const b = await band(name);
      expect(b.lines.map((l) => l.text)).toEqual(lines);
      expect(b.marks).toHaveLength(2);
      const [l, r] = b.marks as [Glyph, Glyph];
      near(l.x0, LEFT, 0.1, "left mark at the band's left edge");
      near(r.x1, LEFT + W, 0.1, "right mark at the band's right edge");
      const mid = (b.lines[0]!.y + b.lines[1]!.y) / 2;
      near(l.y, mid, 0.1, 'left mark level with the middle');
      near(r.y, mid, 0.1, 'right mark level with the middle');
      // the name is set in 46.33 mm between the marks and their gaps, each line centred
      for (const line of b.lines) {
        near(centre(line), LEFT + W / 2, 0.1, `line "${line.text}" centred`);
        expect(line.x0, line.text).toBeGreaterThanOrEqual(
          LEFT + 2.7 + 1.01 - 0.1,
        );
        expect(line.x1, line.text).toBeLessThanOrEqual(
          LEFT + W - 2.7 - 1.01 + 0.1,
        );
      }
    },
    LIMIT,
  );

  it(
    'a name of three lines: the marks are level with the middle of the second line',
    async () => {
      const b = await band(
        'The Old Marsh Dragon of the Grey Reaches and the Giant Swamp Chieftain',
      );
      expect(b.lines.length).toBeGreaterThanOrEqual(3);
      expect(b.marks).toHaveLength(2);
      const first = b.lines[0]!.y;
      const last = b.lines[b.lines.length - 1]!.y;
      for (const m of b.marks)
        near(m.y, (first + last) / 2, 0.1, 'level with the middle');
      near(b.marks[0]!.x0, LEFT, 0.1);
      near(b.marks[1]!.x1, LEFT + W, 0.1);
    },
    LIMIT,
  );

  it(
    "the band is as high as the name's lines: the line below moves down by one line",
    async () => {
      const one = await band('Fen Hare');
      const two = await band('Old Marsh Dragon of the Grey Reaches');
      const step = two.lines[1]!.y - two.lines[0]!.y;
      expect(step).toBeGreaterThan(3);
      expect(step).toBeLessThan(7);
      near(two.belowY - one.belowY, step, 0.1, 'one more line');
    },
    LIMIT,
  );
});

describe('US-041 AC-3: a word that cannot fit beside the marks removes both marks', () => {
  it(
    'Pneumonoultramicroscopically (51.7 mm: fits 53.75, not 46.33): one line, no mark',
    async () => {
      const b = await band('Pneumonoultramicroscopically');
      expect(b.marks).toEqual([]);
      expect(b.lines.map((l) => l.text)).toEqual([
        'Pneumonoultramicroscopically',
      ]);
      near(centre(b.lines[0]!), LEFT + W / 2, 0.1, 'centred');
    },
    LIMIT,
  );

  it(
    'a name whose longest word is too wide but whose other words wrap: no mark, the name wraps in the band',
    async () => {
      const b = await band('Pneumonoultramicroscopically Grey Reaches');
      expect(b.marks).toEqual([]);
      expect(b.lines.length).toBeGreaterThanOrEqual(2);
      expect(b.lines[0]!.text).toBe('Pneumonoultramicroscopically');
      for (const line of b.lines)
        near(centre(line), LEFT + W / 2, 0.1, line.text);
    },
    LIMIT,
  );
});

describe('US-041 AC-4: a word wider than the band runs over as today, without marks', () => {
  it(
    'Hippopotomonstrosesquippedaliophobia (67.4 mm in 53.75 mm): not broken, no mark, centred',
    async () => {
      const b = await band('Hippopotomonstrosesquippedaliophobia');
      expect(b.marks).toEqual([]);
      expect(b.lines.map((l) => l.text)).toEqual([
        'Hippopotomonstrosesquippedaliophobia',
      ]);
      expect(b.lines[0]!.x1 - b.lines[0]!.x0).toBeGreaterThan(W);
      near(centre(b.lines[0]!), LEFT + W / 2, 0.1, 'centred');
    },
    LIMIT,
  );
});

describe('US-041 AC-5: the rule at another band size and another band font', () => {
  const LOOKS: [string, Look][] = [
    ['11.5 pt (default)', {}],
    ['8 pt', {size: 8}],
    ['16 pt', {size: 16}],
    ['DejaVu Sans Mono at 11.5 pt', {font: 'DejaVu Sans Mono'}],
  ];
  it.each(LOOKS)(
    '%s: one line unchanged, a long name wrapped with marks at the ends, a word too wide without marks',
    async (_name, look) => {
      // calibration: the look's mark, gap and one letter, read from a wide band
      const wide = await band('Fen Hare', 150, look);
      const m = wide.marks[0]!.x1 - wide.marks[0]!.x0;
      const g = wide.lines[0]!.x0 - wide.marks[0]!.x1;
      expect(m, 'the font has the mark').toBeGreaterThan(0.5);
      const wideM = await band('mmmmmmmmmm', 150, look);
      const perM = (wideM.lines[0]!.x1 - wideM.lines[0]!.x0) / 10;
      const wName = W - 2 * (m + g);

      // (a) one line: Fen Hare is narrower than the band with its marks in all looks
      const one = await band('Fen Hare', W, look);
      expect(one.marks).toHaveLength(2);
      expect(one.lines).toHaveLength(1);
      near(one.marks[0]!.y, one.lines[0]!.y, 0.02);

      // (b) wrapped: a long name of known words, marks at the band's ends, level with the middle
      const long = await band(
        'Old Marsh Dragon of the Grey Reaches and the Giant Swamp Chieftain',
        W,
        look,
      );
      expect(long.lines.length).toBeGreaterThanOrEqual(2);
      expect(long.marks).toHaveLength(2);
      near(long.marks[0]!.x0, LEFT, 0.1, 'left mark at the left edge');
      near(long.marks[1]!.x1, LEFT + W, 0.1, 'right mark at the right edge');
      const mid = (long.lines[0]!.y + long.lines[long.lines.length - 1]!.y) / 2;
      for (const mk of long.marks)
        near(mk.y, mid, 0.1, 'level with the middle');
      for (const line of long.lines)
        expect(line.x1 - line.x0, line.text).toBeLessThanOrEqual(wName + 0.1);

      // (c) a word between the two widths (so too wide beside the marks, not for the band)
      const k = Math.round((wName + W) / 2 / perM);
      const word = 'm'.repeat(k);
      const wordW = k * perM;
      expect(
        wordW,
        `the probe word fits the band but not beside the marks (${wordW} mm, ${wName} to ${W})`,
      ).toBeGreaterThan(wName + 0.3);
      expect(wordW).toBeLessThan(W - 0.3);
      const tight = await band(word, W, look);
      expect(tight.marks).toEqual([]);
      expect(tight.lines).toHaveLength(1);
      near(centre(tight.lines[0]!), LEFT + W / 2, 0.1, 'centred');
    },
    LIMIT,
  );
});

describe("US-041 AC-7: the band's height and what depends on it (a chapter)", () => {
  const BLOCK = ['might: 4', 'attacks:', '  - "Kick: 2d6"'];
  const chapter = (name: string) =>
    [entry(`### ${name}`, BLOCK), ''].join('\n');
  const heightOf = async (name: string) => {
    const c = await compileEntries(chapter(name));
    expect(c.diagnostics).toEqual([]);
    expect(c.wraps).toHaveLength(1);
    return c.wraps[0]!.statblock;
  };
  it(
    'a name whose marks wrapped alone before takes one band line now: the statblock is as high as one with a short name',
    async () => {
      const short = await heightOf('Fen Hare');
      const tight = await heightOf('Pneumonoultramicroscopically');
      expect(Math.abs(tight - short)).toBeLessThanOrEqual(0.05);
    },
    LIMIT,
  );

  it(
    'a wrapped name makes the statblock one band line higher',
    async () => {
      const short = await heightOf('Fen Hare');
      const two = await heightOf('Old Marsh Dragon of the Grey Reaches');
      expect(two - short).toBeGreaterThan(3);
      expect(two - short).toBeLessThan(7);
    },
    LIMIT,
  );

  it(
    "the same chapter compiles to the same bytes twice (the wrap reads the statblock's height, SCAR-021)",
    async () => {
      // Amended 2026-11-18 (#182): the PDF holds the clock (the dates and the
      // ID derived from them); the two compiles are 1.1 s apart, so they fall
      // on two sides of a second every run, not by chance, and must be equal
      // apart from those fields.
      const a = await compileEntries(chapter('Pneumonoultramicroscopically'));
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const b = await compileEntries(chapter('Pneumonoultramicroscopically'));
      expect(Buffer.from(b.pdf).equals(Buffer.from(a.pdf))).toBe(false);
      expect(withoutClock(b.pdf)).toBe(withoutClock(a.pdf));
    },
    LIMIT,
  );
});
