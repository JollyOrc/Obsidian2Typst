// US-036 AC-3, AC-5 (SCAR-022, SCAR-030) — the A4 sheet through the
// plugin's compiler (the worker core, the bundled fonts): it compiles, the
// worker reads its `<o2t-sheet>` fact without an entries chapter, and the
// compile time is measured (one A4 page).
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// Added at G4 of #136 (2026-11-07).
import {afterAll, describe, expect, it} from 'vitest';
import {encounterSheetTyp} from '../../src/core/entries/sheet';
import {BOOK_FONTS, bookCompiler, disposeBookCompiler} from '../support/book';
import {ENTRIES} from '../support/entries';
import {ICONS} from '../support/entries-pdf';

afterAll(disposeBookCompiler);

describe('US-036 AC-5 the A4 sheet in the plugin’s compiler', () => {
  it('US-036 AC-5, AC-3: compiles in the worker, its fact is read, under 10 s', async () => {
    const {typ} = encounterSheetTyp({...ENTRIES, encounterSheetFile: true});
    if (typ === null) throw new Error('no sheet');
    const files = Object.fromEntries(
      Object.entries(ICONS).map(([p, s]) => [p, new TextEncoder().encode(s)]),
    );
    const t0 = performance.now();
    const result = await bookCompiler().compile({
      file: 'Rules - Encounter Sheet.typ',
      source: typ,
      files,
      fonts: BOOK_FONTS,
    });
    const ms = performance.now() - t0;
    if (!result.ok) throw new Error(result.error);
    expect(result.sheets).toEqual([
      // M23 (2026-11-07): three attack slots, no round line: 14 rows.
      {form: 'A4', rows: 14, columns: 2, boxMm: expect.closeTo(2.62, 1)},
    ]);
    // SCAR-030: measured, not assumed; the bound is generous on purpose.
    console.info(`US-036 AC-5: A4 sheet compile ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(10_000);
  });
});
