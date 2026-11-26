// US-044 AC-2 to AC-5, AC-7, AC-8 — the filled name band in the PDF. The band is
// compiled from `api.statblockTypst`'s answer (prelude + data) in a block of a
// known width on a page with a 4 mm margin (as US-041's test), or through the
// book (AC-7, the wrap). Colours, fills, rules and the frame are read from the
// PDF's paint (`tests/support/pdf-paint.ts`, checked below on a known page,
// SCAR-028), never from the helper's own facts (SCAR-015, SCAR-023).
// Names are invented (SCAR-035). Source of truth:
// docs/user-stories/US-044-filled-statblock-band.md.
// Red until US-044 is implemented (G2, 2026-11-26). Measured at Typst 0.14.2,
// the fixture's fonts, built-in sizes (SCAR-032). Each compile is ~0.1 s alone;
// the limit leaves room for a loaded full run (SCAR-030, #182).
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CompileFormatEnum} from '@myriaddreamin/typst.ts/dist/esm/compiler.mjs';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {afterAll, describe, expect, it} from 'vitest';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns, type TextRun} from '../../src/core/pdf/text';
import {BOOK_FONTS, filler} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';
import {withoutClock} from '../support/pdf-clock';
import {pagePaint, type PagePaint, type Painted} from '../support/pdf-paint';

const LIMIT = 120_000;
const PT = 72 / 25.4;
const MARGIN = 4;
const PAGE_H = 100;
/** The statblock in the A5 book: 55 % of 105 mm. */
const BLOCK = 57.75;
const MODULE = '../../src/plugin/entries/typst-api';
const UMBER = '#8a4a2a';
const PARCHMENT = '#f3eee3';
const FRAME_PT = 0.75;
const HALF_FRAME = FRAME_PT / 2 / PT;

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
  const path = `/us044-${count++}.typ`;
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

interface Look {
  bandFill?: string;
  bandColor?: string;
  size?: number;
  colorMode?: string;
}

/** The answer's prelude and data for `name` with the look `look`. */
async function answer(
  name: string,
  look: Look = {},
): Promise<{prelude: string; data: string}> {
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
  const statblock: Record<string, unknown> = {...ENTRIES.statblock};
  if (look.bandFill !== undefined) statblock['bandFill'] = look.bandFill;
  if (look.bandColor !== undefined) statblock['bandColor'] = look.bandColor;
  if (look.size !== undefined) statblock['sizes'] = {band: look.size};
  const api = createStatblockTypstApi({
    settings: async () => ({
      entries: {...ENTRIES, statblock},
      ...(look.colorMode === undefined ? {} : {colorMode: look.colorMode}),
    }),
    readIconBytes: async () => null,
    fonts: async () => [],
  });
  const a = await api.statblockTypst(
    {vigour: 6, might: 4, wits: 2, speed: 5, attacks: ['Kick: 2d6']},
    {heading: name},
  );
  if (!a.ok) throw new Error(a.message);
  return a;
}

const page = (body: string, prelude: string): string =>
  `#set page(width: ${BLOCK + 2 * MARGIN}mm, height: ${PAGE_H}mm, margin: ${MARGIN}mm)\n${prelude}\n${body}\n`;

interface Drawn {
  pdf: Uint8Array;
  paint: PagePaint;
  runs: TextRun[];
  /** The statblock's frame (the closed stroke of the frame's width). */
  frame: Painted;
  /** Fills inside the frame. */
  fills: Painted[];
  /** Straight rules (two-point strokes) inside the frame. */
  rules: Painted[];
  /** Band runs (above the first line below the band) with their colours. */
  band: {text: string; colour: string; y: number}[];
  /** Baseline of the first line below the band (mm from the top). */
  belowY: number;
}

const textOf = (r: TextRun): string =>
  r.items.map((i) => ('ch' in i ? i.ch : '')).join('');

/** Compiles the statblock of `name` and reads its paint. */
async function drawn(name: string, look: Look = {}): Promise<Drawn> {
  const a = await answer(name, look);
  const pdf = await pdfOf(
    page(`#block(width: ${BLOCK}mm, o2t-sb-box(${a.data}))`, a.prelude),
  );
  return read(pdf);
}

function read(pdf: Uint8Array): Drawn {
  const paint = pagePaint(openPdf(pdf), PAGE_H)[0]!;
  const runs = pageRuns(openPdf(pdf))[0] ?? [];
  expect(paint.shows.length, 'one show per run').toBe(runs.length);
  const frames = paint.paths.filter(
    (p) =>
      p.kind === 'stroke' &&
      p.points >= 4 &&
      Math.abs(p.width - FRAME_PT) < 0.01,
  );
  expect(frames.length, 'one frame').toBe(1);
  const frame = frames[0]!;
  const inside = (p: Painted) =>
    p.x0 >= frame.x0 - 0.01 &&
    p.x1 <= frame.x1 + 0.01 &&
    p.y0 >= frame.y0 - 0.01 &&
    p.y1 <= frame.y1 + 0.01;
  // the first line below the band: the box row's label (the data has boxes;
  // fixed at G4: without it the box row was read as band), else as US-041
  const below =
    runs.find((r) => textOf(r) === 'VIGOUR') ??
    runs.find((r) => textOf(r) === 'STATE') ??
    runs.find((r) => textOf(r).startsWith('Kick'));
  if (below === undefined) throw new Error('no line below the band found');
  const belowY = PAGE_H - below.y / PT;
  const band = runs
    .map((r, i) => ({
      text: textOf(r),
      colour: paint.shows[i]!.colour,
      y: PAGE_H - r.y / PT,
    }))
    .filter((r) => r.y < belowY - 1 && r.text.trim() !== '');
  return {
    pdf,
    paint,
    runs,
    frame,
    fills: paint.paths.filter((p) => p.kind === 'fill' && inside(p)),
    rules: paint.paths.filter(
      (p) => p.kind === 'stroke' && p.points === 2 && inside(p),
    ),
    band,
    belowY,
  };
}

const near = (actual: number, expected: number, tol: number, what: string) =>
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual.toFixed(3)} vs ${expected.toFixed(3)} (± ${tol})`,
  ).toBeLessThanOrEqual(tol);

const ONE = 'Fen Hare';
const TWO = 'Old Marsh Dragon of the Grey Reaches';
const FILLED: Look = {bandFill: '#8A4A2A', bandColor: '#F3EEE3'};
const bandFills = (d: Drawn, colour: string) =>
  d.fills.filter((f) => f.colour === colour);

describe('SCAR-028 the paint reader on a known page', () => {
  it(
    'reads a rectangle, a rule and a text colour where they were placed',
    async () => {
      const pdf = await pdfOf(
        [
          `#set page(width: 60mm, height: ${PAGE_H}mm, margin: 0mm)`,
          '#place(top + left, dx: 10mm, dy: 5mm, rect(width: 20mm, height: 10mm, fill: rgb("#123456"), stroke: none))',
          '#place(top + left, dx: 5mm, dy: 30mm, line(length: 30mm, stroke: 0.4pt + rgb("#abcdef")))',
          '#place(top + left, dx: 10mm, dy: 40mm, text(fill: rgb("#fedcba"), size: 10pt)[Ab])',
          '#place(top + left, dx: 10mm, dy: 50mm, text(size: 10pt)[Cd])',
        ].join('\n'),
      );
      const paint = pagePaint(openPdf(pdf), PAGE_H)[0]!;
      const fill = paint.paths.find((p) => p.kind === 'fill')!;
      expect(fill.colour).toBe('#123456');
      near(fill.x0, 10, 0.01, 'rect x0');
      near(fill.x1, 30, 0.01, 'rect x1');
      near(fill.y0, 5, 0.01, 'rect top');
      near(fill.y1, 15, 0.01, 'rect bottom');
      const rule = paint.paths.find((p) => p.kind === 'stroke')!;
      expect(rule.colour).toBe('#abcdef');
      expect(rule.points).toBe(2);
      near(rule.width, 0.4, 0.001, 'rule width');
      near(rule.y0, 30, 0.01, 'rule y');
      const runs = pageRuns(openPdf(pdf))[0]!;
      expect(paint.shows.length).toBe(runs.length);
      const colours = runs.map((r, i) => [textOf(r), paint.shows[i]!.colour]);
      expect(colours).toEqual([
        ['Ab', '#fedcba'],
        ['Cd', '#000000'],
      ]);
      // the show's origin is the run's start (pageRuns): same place
      runs.forEach((r, i) => {
        near(paint.shows[i]!.x, r.x0 / PT, 0.01, 'show x');
        near(paint.shows[i]!.y, PAGE_H - r.y / PT, 0.01, 'show y');
      });
    },
    LIMIT,
  );
});

describe('US-044 AC-2 the filled band', () => {
  it(
    'US-044 AC-2: one umber fill under the name; the name and both marks in parchment',
    async () => {
      const d = await drawn(ONE, FILLED);
      expect(bandFills(d, UMBER)).toHaveLength(1);
      const text = d.band.map((r) => r.text).join('');
      expect(text.replace(/\s+/g, ' ').trim()).toBe(`◆ ${ONE} ◆`);
      for (const r of d.band) expect(r.colour, r.text).toBe(PARCHMENT);
      // the rest keeps its colours: no run below the band is in the band's text colour
      const rest = d.runs
        .map((r, i) => ({
          y: PAGE_H - r.y / PT,
          colour: d.paint.shows[i]!.colour,
        }))
        .filter((r) => r.y >= d.belowY - 0.01);
      expect(rest.length).toBeGreaterThan(0);
      for (const r of rest) expect(r.colour).not.toBe(PARCHMENT);
    },
    LIMIT,
  );

  it(
    'US-044 AC-2: the fill reaches the inside of the frame on the left, top and right; 1.6 mm below the last line',
    async () => {
      for (const name of [ONE, TWO]) {
        const d = await drawn(name, FILLED);
        const f = bandFills(d, UMBER)[0]!;
        near(f.x0 - d.frame.x0, HALF_FRAME, 0.02, `${name}: left`);
        near(d.frame.x1 - f.x1, HALF_FRAME, 0.02, `${name}: right`);
        near(f.y0 - d.frame.y0, HALF_FRAME, 0.02, `${name}: top`);
        const last = Math.max(...d.band.map((r) => r.y));
        near(f.y1 - last, 1.6, 0.05, `${name}: below the last line`);
      }
    },
    LIMIT,
  );

  it(
    'US-044 AC-2 (SCAR-019): without bandColor the text is the accent (the frame colour)',
    async () => {
      const d = await drawn(ONE, {bandFill: '#8A4A2A'});
      expect(bandFills(d, UMBER)).toHaveLength(1);
      for (const r of d.band) expect(r.colour, r.text).toBe(d.frame.colour);
    },
    LIMIT,
  );
});

describe('US-044 AC-3 no rule under a filled band; the height', () => {
  it(
    'US-044 AC-3: the rule under the band is gone, every other rule stays',
    async () => {
      for (const name of [ONE, TWO]) {
        const plain = await drawn(name);
        const filled = await drawn(name, FILLED);
        expect(filled.rules.length, name).toBe(plain.rules.length - 1);
        const f = bandFills(filled, UMBER)[0]!;
        const between = filled.rules.filter(
          (r) => r.y0 > f.y1 - 0.01 && r.y0 < filled.belowY,
        );
        expect(between, `${name}: no rule between band and next part`).toEqual(
          [],
        );
      }
    },
    LIMIT,
  );

  // SCAR-019: at the default band size and at two others; one and two lines.
  for (const size of [11.5, 8, 16]) {
    it(
      `US-044 AC-3: at ${size} pt the statblock is 0.40 mm taller than without fill`,
      async () => {
        for (const name of [ONE, TWO]) {
          const plain = await drawn(name, {size});
          const filled = await drawn(name, {...FILLED, size});
          near(
            filled.frame.y1 -
              filled.frame.y0 -
              (plain.frame.y1 - plain.frame.y0),
            0.4,
            0.05,
            `${name} at ${size} pt`,
          );
        }
      },
      LIMIT,
    );
  }
});

describe('US-044 AC-4 a name that wraps', () => {
  it(
    'US-044 AC-4: two lines in one fill; the marks inside it, in the band colour',
    async () => {
      const d = await drawn(TWO, FILLED);
      const fills = bandFills(d, UMBER);
      expect(fills).toHaveLength(1);
      const f = fills[0]!;
      const ys = [...new Set(d.band.map((r) => r.y.toFixed(1)))];
      expect(ys.length, 'the name takes two or more lines').toBeGreaterThan(1);
      for (const r of d.band) {
        expect(r.y, r.text).toBeGreaterThan(f.y0);
        expect(r.y, r.text).toBeLessThan(f.y1);
        expect(r.colour, r.text).toBe(PARCHMENT);
      }
      const marks = d.band.filter((r) => r.text.trim() === '◆');
      expect(marks.length, 'two marks beside the wrapped name').toBe(2);
    },
    LIMIT,
  );
});

describe('US-044 AC-5 greyscale', () => {
  it(
    'US-044 AC-5: filled: #4d4d4d with white text',
    async () => {
      const d = await drawn(ONE, {...FILLED, colorMode: 'grayscale'});
      expect(bandFills(d, '#4d4d4d')).toHaveLength(1);
      expect(bandFills(d, UMBER)).toHaveLength(0);
      for (const r of d.band) expect(r.colour, r.text).toBe('#ffffff');
    },
    LIMIT,
  );
  it(
    'US-044 AC-5: unset: no fill above the first rule, the band text #4d4d4d',
    async () => {
      const d = await drawn(ONE, {colorMode: 'grayscale'});
      const firstRule = Math.min(...d.rules.map((r) => r.y0));
      expect(d.fills.filter((f) => f.y0 < firstRule)).toEqual([]);
      for (const r of d.band) expect(r.colour, r.text).toBe('#4d4d4d');
    },
    LIMIT,
  );
});

describe('US-044 AC-8 without bandFill the PDF is the 0.17.0 PDF', () => {
  // Pinned at G2 (2026-11-26) from 0.17.0: sha-256 of the PDF with its clock
  // fields set aside (#183), for these inputs and the fixture's fonts.
  const cases: [string, string, Look][] = [
    ['one line', ONE, {}],
    ['two lines', TWO, {}],
    ['greyscale', ONE, {colorMode: 'grayscale'}],
    ['bandFill none', ONE, {bandFill: 'none', bandColor: '#F3EEE3'}],
  ];
  for (const [what, name, look] of cases) {
    it(
      `US-044 AC-8: ${what}`,
      async () => {
        const d = await drawn(name, look);
        const sha = createHash('sha256')
          .update(withoutClock(d.pdf), 'latin1')
          .digest('hex');
        expect(sha).toBe(
          PDF_SHA_0_17_0[what === 'bandFill none' ? 'one line' : what],
        );
      },
      LIMIT,
    );
  }
});

describe('US-044 AC-7 on cards and beside text', () => {
  it(
    'US-044 AC-7: the look passed through as Game Card Creator does (`..look`, its own band size) keeps the fill',
    async () => {
      const a = await answer(ONE, FILLED);
      // Game Card Creator's equal-title band (its US-012): the data with only the
      // band, the look spread and the band size replaced (measured at G2 with its
      // own prelude: the fill arrives, the equal heights hold, +1.6 mm per card).
      const body = [
        `#let d = ${a.data}`,
        `#block(width: ${BLOCK}mm, o2t-sb-box((band: d.band, look: (..d.look, sizes: (..d.look.sizes, band: 8pt)), boxes: none, track: none, attributes: none, traits: none, attacks: (), skills: none, tags: none)))`,
      ].join('\n');
      const pdf = await pdfOf(page(body, a.prelude));
      const paint = pagePaint(openPdf(pdf), PAGE_H)[0]!;
      expect(
        paint.paths.filter((p) => p.kind === 'fill' && p.colour === UMBER),
      ).toHaveLength(1);
      expect(paint.shows.map((s) => s.colour)).toContain(PARCHMENT);
    },
    LIMIT,
  );

  it(
    'US-044 AC-7 (SCAR-021): beside text, two compiles give the same PDF and the wrap measures the drawn height',
    async () => {
      const over = {
        entries: {
          ...ENTRIES,
          statblock: {...ENTRIES.statblock, ...FILLED},
        },
      };
      const source = entry(
        '### Fen Hare',
        ['vigour: 11', 'might: 4', 'wits: 2', 'attacks:', '  - "Kick: 2d6"'],
        [filler(40)],
      );
      const one = await compileEntries(source, {over});
      await new Promise((r) => setTimeout(r, 1100));
      const two = await compileEntries(source, {over});
      expect(withoutClock(two.pdf)).toBe(withoutClock(one.pdf));
      expect(one.wraps.length).toBeGreaterThan(0);
      const w = one.wraps[0]!;
      const heightMm = one.pages[w.page - 1]!.height / PT;
      const paint = pagePaint(openPdf(one.pdf), heightMm)[w.page - 1]!;
      expect(
        paint.paths.filter((p) => p.kind === 'fill' && p.colour === UMBER),
      ).toHaveLength(1);
      const frame = paint.paths.find(
        (p) =>
          p.kind === 'stroke' &&
          p.points >= 4 &&
          Math.abs(p.width - FRAME_PT) < 0.01,
      )!;
      near(frame.y1 - frame.y0, w.statblock, 0.05, 'wrap fact vs drawn frame');
    },
    LIMIT,
  );
});

const PDF_SHA_0_17_0: Record<string, string> = {
  'one line':
    'c9ca5b908b3b8fea8e296b4a82fee0512c5fa99215f49a27d580bf74d6276c8d',
  'two lines':
    '9127c2c1f48cb269780121f5ed2701632c85ed8d0a8f3b2974b8402fb36b56dc',
  greyscale: 'f1131b7cb25c25add396ed4f1f2609eb8317aaaea459eab5ffb08d95934c73f6',
};
