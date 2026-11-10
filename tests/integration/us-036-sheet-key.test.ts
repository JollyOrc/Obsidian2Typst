// US-036 AC-7a (amendment for #157) — the key line of the encounter sheet:
// an icon never leaves its label, the gap shrinks from 4 mm to 1.5 mm before
// the key wraps, and the 4 mm icon is centred on the label's x-height. The
// sheet records its key in `<o2t-sheet>` (`key: {gapMm, lines, shiftMm}`);
// the tests read it through the plugin's compiler (the worker core, the
// bundled fonts), in the book page at the story's widths and in the A4 file.
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// Red until #157 is implemented (G2, 2026-11-10).
import {afterAll, describe, expect, it} from 'vitest';
import {ENTRY_MARKS_DEF} from '../../src/core/emit/entry';
import {
  SHEET_HELPER_DEF,
  bookSheetCall,
  encounterSheetTyp,
  sheetData,
} from '../../src/core/entries/sheet';
import {BOOK_FONTS, bookCompiler, disposeBookCompiler} from '../support/book';
import {ENTRIES} from '../support/entries';
import {ICONS} from '../support/entries-pdf';

afterAll(disposeBookCompiler);

/** The story's label sets (AC-7a examples; invented labels). */
const LABELS = {
  five: ['Fine', 'Hurt', 'Down', 'Fading', 'Gone'],
  six: ['Fine', 'Hurt', 'Down', 'Fading', 'Broken', 'Gone'],
  sixLong: ['Healthy', 'Wounded', 'Staggered', 'Unconscious', 'Dying', 'Dead'],
  eight: ['Fine', 'Hurt', 'Down', 'Fading', 'Broken', 'Dying', 'Lost', 'Gone'],
} as const;

const PATHS = Object.keys(ICONS);
const FILES = Object.fromEntries(
  Object.entries(ICONS).map(([p, s]) => [p, new TextEncoder().encode(s)]),
);

/** ENTRIES with a track of `labels`, the test icons in turn. */
const withTrack = (labels: readonly string[]) => ({
  ...ENTRIES,
  statblock: {
    ...ENTRIES.statblock,
    track: labels.map((label, i) => ({
      label,
      icon: PATHS[i % PATHS.length] as string,
    })),
  },
});

interface KeyFact {
  gapMm: number;
  lines: number;
  shiftMm: number;
}

/** The `key` of the one `<o2t-sheet>` fact of a compile of `source`. */
async function keyOf(source: string): Promise<KeyFact> {
  const result = await bookCompiler().compile({
    file: 'sheet.typ',
    source,
    files: FILES,
    fonts: BOOK_FONTS,
  });
  if (!result.ok) throw new Error(result.error);
  const sheets = (result.sheets ?? []) as {key?: KeyFact}[];
  expect(sheets).toHaveLength(1);
  const key = sheets[0]?.key;
  if (key === undefined) throw new Error('the sheet records no key');
  return key;
}

/** The book page's sheet for a text area `tw` mm wide (one column). */
async function bookKey(
  labels: readonly string[],
  tw: number,
): Promise<KeyFact> {
  const data = sheetData(withTrack(labels) as never, undefined, (p) => p);
  if (data === null) throw new Error('no sheet');
  return keyOf(
    [
      `#set page(width: ${tw + 20}mm, height: 200mm, margin: 10mm)`,
      ENTRY_MARKS_DEF,
      SHEET_HELPER_DEF,
      bookSheetCall(data, tw, 180, ''),
      '',
    ].join('\n'),
  );
}

// SCAR-030: a compile of one sheet page each; measured at G4.
describe('US-036 AC-7a the key line', {timeout: 60_000}, () => {
  it('US-036 AC-7a: five cells at 105 mm — one line, gap 4 mm (as before)', async () => {
    const key = await bookKey(LABELS.five, 105);
    expect(key.lines).toBe(1);
    expect(key.gapMm).toBeCloseTo(4, 2);
  });

  it('US-036 AC-7a: six cells at 95 mm — one line, gap 4 mm (before: Gone split from its icon)', async () => {
    const key = await bookKey(LABELS.six, 95);
    expect(key.lines).toBe(1);
    expect(key.gapMm).toBeCloseTo(4, 2);
  });

  it('US-036 AC-7a: six long labels at 105 mm — one line, the gap shrunk to 3.43 mm', async () => {
    const key = await bookKey(LABELS.sixLong, 105);
    expect(key.lines).toBe(1);
    expect(key.gapMm).toBeCloseTo(3.43, 1);
  });

  it('US-036 AC-7a: eight cells at 105 mm — one line, the gap shrunk to 1.69 mm', async () => {
    const key = await bookKey(LABELS.eight, 105);
    expect(key.lines).toBe(1);
    expect(key.gapMm).toBeCloseTo(1.69, 1);
  });

  it('US-036 AC-7a: eight cells at 95 mm — two lines at the smallest gap, 1.5 mm', async () => {
    const key = await bookKey(LABELS.eight, 95);
    expect(key.lines).toBe(2);
    expect(key.gapMm).toBeCloseTo(1.5, 2);
  });

  it('US-036 AC-7a: the icon is centred on the x-height — 1.47 mm below the baseline at 7 pt', async () => {
    const key = await bookKey(LABELS.five, 105);
    expect(key.shiftMm).toBeCloseTo(1.47, 1);
  });

  it('US-036 AC-7a: the A4 file (186 mm) — one line, gap 4 mm, for every example set', async () => {
    let checked = 0;
    for (const labels of Object.values(LABELS)) {
      const {typ} = encounterSheetTyp({
        ...withTrack(labels),
        encounterSheetFile: true,
      });
      if (typ === null) throw new Error('no sheet');
      const key = await keyOf(typ);
      expect(key.lines, labels.join(' ')).toBe(1);
      expect(key.gapMm, labels.join(' ')).toBeCloseTo(4, 2);
      checked++;
    }
    expect(checked).toBe(Object.keys(LABELS).length);
  });
});
