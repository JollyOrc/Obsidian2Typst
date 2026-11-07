// US-036 AC-1, AC-2, AC-3 (warning), AC-5 (names) — the encounter sheet's
// settings and messages, ENCOUNTER_SHEET_EMPTY, the small-boxes warning made
// from the sheet's facts, and the A4 file's names next to the book's.
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// Red until US-036 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {exportNames} from '../../src/core/compile';
import {type Warning} from '../../src/core/emit/context';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {ENTRIES, entry, runEntries, warningsOf} from '../support/entries';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const REPORT = '../../src/core/entries/report';
/** What the sheet records about itself (`<o2t-sheet>`). */
interface SheetFact {
  form: 'A4' | 'book';
  rows: number;
  columns: number;
  boxMm: number;
}
interface ReportModule {
  sheetWarnings(sheets: readonly SheetFact[]): Warning[];
}

describe('US-036 AC-1 settings', () => {
  it('US-036 AC-1: the two switches, the box count 15/30/45, and the text fields', () => {
    expect(
      errorOf(
        'entries:',
        '  encounterSheet: true',
        '  encounterSheetFile: true',
        '  encounterSheetBoxes: 45',
        '  encounterSheetText: {title: Begegnung, name: NAME, attack: ANGRIFF, dice: WÜRFEL, rule: "", credit: ""}',
      ),
    ).toBeNull();
    expect(errorOf('entries:', '  encounterSheetBoxes: 20')).toBe(
      'entries.encounterSheetBoxes must be 15, 30 or 45 (line 4)',
    );
    expect(errorOf('entries:', '  encounterSheet: yes')).toBe(
      'entries.encounterSheet must be true or false (line 4)',
    );
    expect(errorOf('entries:', '  encounterSheetFile: 1')).toBe(
      'entries.encounterSheetFile must be true or false (line 4)',
    );
    expect(errorOf('entries:', '  encounterSheetText: {title: [x]}')).toBe(
      'entries.encounterSheetText.title must be text (line 4)',
    );
  });
});

describe('US-036 AC-2 a sheet needs a track or a box key', () => {
  it('US-036 AC-2: switched on without track and boxes → ENCOUNTER_SHEET_EMPTY once, no sheet', async () => {
    const bare = {
      ...ENTRIES,
      statblock: {stats: ENTRIES.statblock.stats},
      encounterSheet: true,
      encounterSheetFile: true,
    };
    const source = [
      '# Menagerie',
      '',
      entry(
        '### Fen Hare',
        ['might: 4'],
        ['A lede that is long enough to count.'],
      ),
    ].join('\n');
    const {typ, warnings} = await runEntries(source, {
      headingRules: {Menagerie: 'entries'},
      entries: bare,
    });
    expect(warningsOf(warnings, ['ENCOUNTER_SHEET_EMPTY'])).toHaveLength(1);
    expect(typ).not.toContain('Encounter Sheet');
    const withTrack = await runEntries(source, {
      headingRules: {Menagerie: 'entries'},
      entries: {...ENTRIES, encounterSheet: true},
    });
    expect(warningsOf(withTrack.warnings, ['ENCOUNTER_SHEET_EMPTY'])).toEqual(
      [],
    );
    expect(withTrack.typ).toContain('Encounter Sheet');
  });
});

describe('US-036 AC-3 (decision 2) boxes under 2.0 mm', () => {
  it('US-036 AC-3: a sheet whose boxes are under 2.0 mm warns once per form, size to 0.1 mm', async () => {
    const path: string = REPORT;
    const {sheetWarnings} = (await import(
      /* @vite-ignore */ path
    )) as ReportModule;
    const ws = sheetWarnings([
      {form: 'book', rows: 6, columns: 1, boxMm: 1.71},
      {form: 'A4', rows: 16, columns: 2, boxMm: 2.6},
    ]);
    expect(ws.map((w) => `${w.code} ${w.message}`)).toEqual([
      'ENCOUNTER_SHEET_SMALL_BOXES "book": 1.7 mm (min 2.0)',
    ]);
    expect(
      sheetWarnings([{form: 'book', rows: 5, columns: 1, boxMm: 2.0}]),
    ).toEqual([]);
  });
});

describe("US-036 AC-5 the A4 file's names", () => {
  it("US-036 AC-5: <name> - Encounter Sheet.pdf and .typ next to the book's files", () => {
    const names = exportNames('Rules') as unknown as Record<string, string>;
    expect(names['sheetPdf']).toBe('Rules - Encounter Sheet.pdf');
    expect(names['sheetTyp']).toBe('Rules - Encounter Sheet.typ');
    const t = exportNames('Template') as unknown as Record<string, string>;
    expect(t['sheetPdf']).toBe('template-note - Encounter Sheet.pdf');
  });

  it('US-036 AC-5 (US-007 AC-1b): the five names are pairwise different, also ignoring case', () => {
    for (const noteName of [
      'Rules',
      'template',
      'Rules - Encounter Sheet',
      'RULES - encounter sheet',
    ]) {
      const n = exportNames(noteName) as unknown as Record<string, string>;
      const all = [
        n['typ'],
        n['pdf'],
        n['template'],
        n['sheetTyp'],
        n['sheetPdf'],
      ].map((x) => String(x).toLowerCase());
      expect(new Set(all).size, noteName).toBe(5);
    }
  });
});
