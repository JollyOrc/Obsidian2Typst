// US-036 AC-3 to AC-9 — the encounter sheet in the PDF: the A4 file (one A4
// page, two across, the row's parts, key, title, credit, the measured row
// count), and the page in the book after the quick reference (one column on
// A5, in the contents). Counts and sizes come from the sheet's `<o2t-sheet>`
// fact (form, rows, columns, smallest box) and each row's `<o2t-sheet-row>`.
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// Red until US-036 is implemented (G2, 2026-11-06).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {afterAll, describe, expect, it} from 'vitest';
import {type Warning} from '../../src/core/emit/context';
import {BOOK_FONTS, compileSource} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {
  ICONS,
  compileEntries,
  disposeEntriesCompiler,
} from '../support/entries-pdf';
import {readPdfPages} from '../support/pdf';

afterAll(disposeEntriesCompiler);

const SHEET = '../../src/core/entries/sheet';
interface SheetModule {
  /** US-036 AC-5: the A4 file's Typst source for the `entries` settings; null when there is no sheet. */
  encounterSheetTyp(
    entries: unknown,
    options?: {colorMode?: string},
  ): {typ: string | null; warnings: Warning[]};
}
interface SheetFact {
  form: 'A4' | 'book';
  rows: number;
  columns: number;
  boxMm: number;
}
interface RowFact {
  boxes: number;
  cells: string[];
  stats: string[];
  attacks: number;
}

const ICON_FILES = Object.fromEntries(
  Object.entries(ICONS).map(([p, s]) => [p, new TextEncoder().encode(s)]),
);
const TEXT = {
  title: 'Encounter Sheet',
  round: 'Round',
  name: 'NAME',
  attack: 'ATTACK',
  dice: 'DICE',
  rule: 'Slash a cell when it is left.',
  credit: 'Icons by A. Nobody.',
};
const SHEET_ENTRIES = {
  ...ENTRIES,
  encounterSheetFile: true,
  encounterSheetText: TEXT,
};

/** Compiles the A4 file and reads its pages and facts. */
async function compileA4(entries: unknown, colorMode?: string) {
  const path: string = SHEET;
  const {encounterSheetTyp} = (await import(
    /* @vite-ignore */ path
  )) as SheetModule;
  const {typ} = encounterSheetTyp(entries, {colorMode});
  if (typ === null) throw new Error('no sheet');
  const pdf = await compileSource(typ, ICON_FILES);
  const s = new TypstSnippet();
  s.setCompilerInitOptions({
    getModule: () =>
      readFileSync(
        join(
          process.cwd(),
          'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
        ),
      ),
    beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
  });
  for (const [n, d] of Object.entries(ICON_FILES))
    await s.mapShadow(`/${n}`, d);
  await s.addSource('/sheet.typ', typ);
  const c = (await s.getCompiler()) as unknown as {
    runWithWorld<T>(
      o: {mainFilePath: string},
      cb: (w: {
        compile(o: {diagnostics: 'unix'}): Promise<unknown>;
        query(o: {selector: string; field: string}): Promise<unknown>;
      }) => Promise<T>,
    ): Promise<T>;
  };
  const [sheets, rows] = await c.runWithWorld(
    {mainFilePath: '/sheet.typ'},
    async (w) => {
      await w.compile({diagnostics: 'unix'});
      return [
        await w.query({selector: '<o2t-sheet>', field: 'value'}),
        await w.query({selector: '<o2t-sheet-row>', field: 'value'}),
      ];
    },
  );
  const parse = <T>(raw: unknown): T[] =>
    (typeof raw === 'string' ? JSON.parse(raw) : raw) as T[];
  return {
    pages: readPdfPages(pdf),
    sheets: parse<SheetFact>(sheets),
    rows: parse<RowFact>(rows),
  };
}

describe('US-036 AC-5 the A4 file', () => {
  it('US-036 AC-5 and AC-8: one A4 portrait page, two across, 16 rows (the measured count)', async () => {
    const {pages, sheets} = await compileA4(SHEET_ENTRIES);
    expect(pages).toHaveLength(1);
    expect(Math.round(pages[0]?.width ?? 0)).toBe(595);
    expect(Math.round(pages[0]?.height ?? 0)).toBe(842);
    expect(sheets).toEqual([
      expect.objectContaining({form: 'A4', rows: 16, columns: 2}),
    ]);
    expect(sheets[0]?.boxMm ?? 0).toBeGreaterThanOrEqual(2.0);
  });

  it('US-036 AC-3: every row has 30 boxes, every track cell, the stats boxes and two attack slots', async () => {
    const {rows} = await compileA4(SHEET_ENTRIES);
    expect(rows).toHaveLength(16);
    for (const r of rows) {
      expect(r).toEqual({
        boxes: 30,
        cells: ['Fine', 'Hurt', 'Down', 'Fading', 'Gone'],
        stats: ['MIGHT', 'WITS', 'SPEED'],
        attacks: 2,
      });
    }
  });

  it('US-036 AC-1 (SCAR-019): encounterSheetBoxes 15 and 45', async () => {
    for (const n of [15, 45]) {
      const {rows} = await compileA4({
        ...SHEET_ENTRIES,
        encounterSheetBoxes: n,
      });
      expect(rows.length, String(n)).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.boxes)), String(n)).toEqual(
        new Set([n]),
      );
    }
  });

  it('US-036 AC-7: title, round, the key with every cell label, the rule and the credit', async () => {
    const {pages} = await compileA4(SHEET_ENTRIES);
    const text = pages[0]?.text ?? '';
    for (const t of [
      'Encounter Sheet',
      'Round',
      'Fine',
      'Hurt',
      'Down',
      'Fading',
      'Gone',
      'Slash a cell when it is left.',
      'Icons by A. Nobody.',
      'NAME',
      'ATTACK',
      'DICE',
    ]) {
      expect(text, t).toContain(t);
    }
  });

  it('US-036 AC-1: empty rule and credit are left out; translated labels are used', async () => {
    const {pages} = await compileA4({
      ...SHEET_ENTRIES,
      encounterSheetText: {
        ...TEXT,
        title: 'Begegnung',
        name: 'NAME',
        rule: '',
        credit: '',
      },
    });
    const text = pages[0]?.text ?? '';
    expect(text).toContain('Begegnung');
    expect(text).not.toContain('Slash a cell');
    expect(text).not.toContain('Icons by');
  });

  it('US-036 AC-4 and AC-9: every row is blank — no creature data; grayscale draws gray', async () => {
    const {pages} = await compileA4(SHEET_ENTRIES, 'grayscale');
    expect(pages[0]?.text ?? '').not.toMatch(/\d+d\d+/);
    expect(pages[0]?.fills ?? []).toContain('#4d4d4d');
  });
});

describe('US-036 AC-6 the page in the book', () => {
  const book = (over: Record<string, unknown> = {}) =>
    compileEntries(
      [
        '# Menagerie',
        '',
        '## Beasts',
        '',
        'Intro.',
        '',
        entry(
          '### Fen Hare',
          ['might: 4', 'layout: page-text'],
          ['A lede that is long enough to count.'],
        ),
      ].join('\n'),
      {
        over: {
          headingRules: {Menagerie: 'entries'},
          entries: {
            ...ENTRIES,
            quickReference: true,
            encounterSheet: true,
            encounterSheetText: TEXT,
          },
          ...over,
        },
      },
    );

  it('US-036 AC-6 (decision 1): after the quick reference, on one page, in the bookmarks at section level', async () => {
    const c = await book();
    const qr = c.pages.findIndex((p) => p.text.includes('Quick Reference'));
    const sheet = c.pages.findIndex((p) => p.text.includes('Encounter Sheet'));
    expect(qr).toBeGreaterThanOrEqual(0);
    expect(sheet).toBeGreaterThan(qr);
    expect(c.pages.filter((p) => p.text.includes('NAME')).length).toBe(1);
    const mark = c.bookmarks.find((b) => b.title.includes('Encounter Sheet'));
    const beasts = c.bookmarks.find((b) => b.title.includes('Beasts'));
    expect(mark?.depth).toBe(beasts?.depth);
  });

  it('US-036 AC-6: off by default — no sheet page', async () => {
    const c = await book({entries: {...ENTRIES, quickReference: true}});
    expect(c.pages.some((p) => p.text.includes('Encounter Sheet'))).toBe(false);
    expect(c.places).toHaveLength(1);
  });
});
