// US-036 AC-3, AC-6, AC-8, AC-9, AC-10 — the sheet page in the book across
// text areas: A5 (one column, 5 rows, the measured count), a wide area (two
// across), a narrow one (boxes under 2.0 mm, the warning), facing pages off
// (the next page), two entries chapters (a sheet page each), and the
// warnings made from the facts.
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// Added at G4 of #135 (2026-11-07).
import {afterAll, describe, expect, it} from 'vitest';
import {sheetWarnings, type SheetFact} from '../../src/core/entries/report';
import {resolvePageSetup} from '../../src/core/layout/page-setup';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';

afterAll(disposeEntriesCompiler);

/** A page of `w` × `h` mm with 10 mm margins. */
function page(w: number, h: number, facingPages = true) {
  const r = resolvePageSetup({
    trimWidth: w,
    trimHeight: h,
    margins: {top: 10, bottom: 10, inside: 10, outside: 10},
    facingPages,
  } as never);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

const chapter = (name: string, creature: string): string =>
  [
    `# ${name}`,
    '',
    entry(
      `### ${creature}`,
      ['might: 4', 'layout: page-text'],
      ['A lede that is long enough to count.'],
    ),
  ].join('\n');

const sheetBook = (source: string, over: Record<string, unknown> = {}) =>
  compileEntries(source, {
    over: {
      headingRules: {Menagerie: 'entries', Relics: 'entries'},
      entries: {...ENTRIES, encounterSheet: true},
      ...over,
    },
  });

describe('US-036 AC-6, AC-8 the book page', () => {
  it('US-036 AC-8: A5 — one column, 5 rows (the measured count), boxes at least 2.0 mm', async () => {
    const c = await sheetBook(chapter('Menagerie', 'Fen Hare'));
    expect(c.sheets).toEqual([
      expect.objectContaining({form: 'book', rows: 5, columns: 1}),
    ]);
    expect(c.sheets[0]?.boxMm ?? 0).toBeGreaterThanOrEqual(2.0);
    expect(c.pages.filter((p) => p.text.includes('NAME'))).toHaveLength(1);
  });

  it('US-036 AC-6: a wide text area gives two across', async () => {
    const c = await sheetBook(chapter('Menagerie', 'Fen Hare'), {
      page: page(210, 297),
    });
    expect(c.sheets[0]?.columns).toBe(2);
    expect(c.pages.filter((p) => p.text.includes('NAME'))).toHaveLength(1);
  });

  it('US-036 AC-3 (decision 2): a 40 mm text area shrinks the boxes under 2.0 mm and warns once', async () => {
    const c = await sheetBook(chapter('Menagerie', 'Fen Hare'), {
      page: page(60, 200, false),
    });
    const fact = c.sheets[0] as SheetFact;
    expect(fact.columns).toBe(1);
    expect(fact.boxMm).toBeCloseTo(1.87, 1);
    expect(
      sheetWarnings(c.sheets as SheetFact[]).map(
        (w) => `${w.code} ${w.message}`,
      ),
    ).toEqual(['ENCOUNTER_SHEET_SMALL_BOXES "book": 1.9 mm (min 2.0)']);
  });

  it('US-036 AC-9: facing pages off — the sheet is the next page', async () => {
    const c = await sheetBook(chapter('Menagerie', 'Fen Hare'), {
      page: page(148, 210, false),
    });
    const fen = c.pages.findIndex((p) => p.text.includes('Fen Hare'));
    const sheet = c.pages.findIndex((p) => p.text.includes('NAME'));
    expect(sheet).toBe(fen + 1);
  });

  it('US-036 AC-9: two entries chapters — a sheet page each', async () => {
    const c = await sheetBook(
      `${chapter('Menagerie', 'Fen Hare')}\n\n${chapter('Relics', 'Moss Lantern')}`,
    );
    expect(c.sheets.map((s) => s.form)).toEqual(['book', 'book']);
    expect(c.pages.filter((p) => p.text.includes('NAME'))).toHaveLength(2);
  });
});
