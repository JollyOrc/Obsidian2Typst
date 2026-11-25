// US-043 AC-5, AC-7, AC-8, AC-9 (PDF), AC-12 — the drawn rows, compiled with
// the plugin's compiler and bundled fonts: what each row records about
// itself (`<o2t-encounter-row>`), what the PDF's text holds, the layout two
// across on A4 and one across on A5, a room per page, grayscale, the
// writing space, Typst-special names, and a 300-row list against a time
// limit (SCAR-015, SCAR-030, SCAR-046, SCAR-048). The row heights and rows
// per page are measured here and written into the story at G2.
// Source of truth: docs/user-stories/US-043-prefilled-encounter-rows.md.
// Red until US-043 is implemented (G2, 2026-11-25).
import {afterAll, describe, expect, it} from 'vitest';
import {resolvePageSetup} from '../../src/core/layout/page-setup';
import {ENTRIES} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';
import {
  BOG_WIGHT_DATA,
  FEN_HARE_DATA,
  MIRE_HOLLOW,
  US043_CODES,
  encounter,
  row,
} from '../support/encounter';
import {warningsOf} from '../support/entries';

afterAll(disposeEntriesCompiler);

/** SCAR-030: one compile with fonts, measured under a full run, with margin. */
const LIMIT = 120_000;

/** A page of `w` × `h` mm; US-036's A4 margins; a page break before H2. */
function page(w: number, h: number) {
  const r = resolvePageSetup({
    trimWidth: w,
    trimHeight: h,
    margins: {top: 12, bottom: 10, inside: 12, outside: 12},
    facingPages: false,
  } as never);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}
const A4 = page(210, 297);
const A5 = page(148, 210);

// Corrected at #185 (test, not code): US-025's rule is the setting
// `breakBefore`, not a field of the page geometry.
const sheets = (source: string, over: Record<string, unknown> = {}) =>
  compileEntries(source, {
    over: {page: A4, breakBefore: {h2: 'page'}, ...over},
  });

/** True when two rectangles overlap (touching edges do not count). */
const overlaps = (
  a: {x: number; y: number; w: number; h: number},
  b: {x: number; y: number; w: number; h: number},
): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('US-043 AC-5, AC-12 the rows in the PDF', {timeout: LIMIT}, () => {
  it('US-043 AC-5: the contract example: labels, notes, stats, boxes, cells, attacks', async () => {
    const out = await sheets(MIRE_HOLLOW);
    expect(out.diagnostics).toEqual([]);
    expect(out.encounterRows.map((r) => r.label)).toEqual([
      'Fen Hare 1',
      'Fen Hare 2',
      'Bog Wight 1',
      'Bog Wight 2',
      'Bog Wight 3',
      'Bog Wight 4',
      'Lost Pilgrim',
    ]);
    const [hare, , wight] = out.encounterRows;
    expect(hare?.note).toBe('nibbling reeds');
    expect(hare?.stats).toEqual(['4', '1', '5']);
    expect(hare?.traits).toEqual(['Move 5']);
    expect(hare?.boxes).toBe(11);
    expect(hare?.cells).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
    expect(hare?.attacks).toEqual([['Kick', '2d6']]);
    expect(wight?.note).toBe('1d4 (up to 4)');
    expect(wight?.cells).toEqual(['Fine', 'Down', 'Gone']);
    expect(wight?.attacks).toEqual([
      ['Claw', '3d8'],
      ['Wail', 'Wits check, 2 successes'],
    ]);
    const pilgrim = out.encounterRows[6]!;
    expect(pilgrim.blank).toBe(true);
    expect(pilgrim.slots).toBe(3);
    expect(warningsOf(out.result.warnings, US043_CODES)).toEqual([]);
  });

  it('US-043 AC-12 (SCAR-015): the page text holds every label, the title, the notes label and the attacks', async () => {
    const out = await sheets(MIRE_HOLLOW);
    const text = out.pages.map((p) => p.text).join(' ');
    for (const needle of [
      'Night watch',
      'Fen Hare 1',
      'Bog Wight 4',
      'Lost Pilgrim',
      'nibbling reeds',
      '1d4 (up to 4)',
      'Kick',
      '2d6',
      'Wits check, 2 successes',
      'NOTES',
      'MIGHT',
    ]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).not.toContain('count:');
    expect(text).not.toContain('NO CONDITIONS');
  });

  it('US-043 AC-12 (SCAR-015 guard): the same note without the block has none of these texts', async () => {
    const out = await sheets(
      ['## Mire Hollow', '', 'The reeds rustle.'].join('\n'),
    );
    const text = out.pages.map((p) => p.text).join(' ');
    expect(text).not.toContain('Fen Hare');
    expect(out.encounterRows).toEqual([]);
  });

  it('US-043 AC-9: names with Typst-special characters print as written', async () => {
    const out = await sheets(
      // Corrected at #185: the writer quotes such names (a bare `#` starts a YAML comment).
      [
        '## R',
        encounter([row('"#Fen *Hare* [x] $5"', '1', '"_odd_ @note"')]),
      ].join('\n'),
    );
    expect(out.diagnostics).toEqual([]);
    expect(out.encounterRows[0]?.label).toBe('#Fen *Hare* [x] $5');
    expect(out.pages.map((p) => p.text).join(' ')).toContain(
      '#Fen *Hare* [x] $5',
    );
  });
});

describe('US-043 AC-8 layout', {timeout: LIMIT}, () => {
  it('US-043 AC-8: A4 (186 mm text width): two across, 91 mm rows; the measured heights are recorded', async () => {
    const out = await sheets(MIRE_HOLLOW);
    expect(out.encounters).toHaveLength(1);
    const block = out.encounters[0]!;
    expect(block.columns).toBe(2);
    expect(block.rowMm).toBeCloseTo(91, 0);
    expect(block.heightsMm).toHaveLength(7);
    for (const h of block.heightsMm) expect(h).toBeGreaterThan(10);
  });

  it('US-043 AC-8: A5 (124 mm text width): one across at the text width', async () => {
    const out = await sheets(MIRE_HOLLOW, {page: A5});
    const block = out.encounters[0]!;
    expect(block.columns).toBe(1);
    expect(block.rowMm).toBeCloseTo(124, 0);
  });

  it('US-043 AC-8: the list breaks between rows, never inside one; every row starts and ends on one page', async () => {
    const out = await sheets(
      [
        '## R',
        encounter([row('Fen Hare', '40', undefined, FEN_HARE_DATA)]),
      ].join('\n'),
    );
    const block = out.encounters[0]!;
    expect(block.rows).toBe(40);
    expect(new Set(block.pages).size).toBeGreaterThan(1);
    expect([...block.pages].sort((a, b) => a - b)).toEqual(block.pages);
  });

  it('US-043 AC-9 (ES-15): with a break before H2, each room starts on a new page', async () => {
    const room = (name: string) =>
      [
        `## ${name}`,
        encounter([row('Fen Hare', '1', undefined, FEN_HARE_DATA)]),
      ].join('\n');
    const out = await sheets(
      [
        '# Bog',
        '',
        room('Mire Hollow'),
        '',
        room('Reed Bank'),
        '',
        room('Old Weir'),
      ].join('\n'),
    );
    const starts = out.encounters.map((b) => b.pages[0]);
    expect(new Set(starts).size).toBe(3);
  });

  it('US-043 AC-8: a title is on the same page as the first row', async () => {
    const filler = Array.from(
      {length: 30},
      (_, i) => `Line ${i} of the reeds.`,
    ).join('\n\n');
    const out = await sheets(
      [
        '## R',
        filler,
        '',
        encounter(
          [row('Fen Hare', '2', undefined, FEN_HARE_DATA)],
          'Night watch',
        ),
      ].join('\n'),
    );
    const titlePage =
      out.pages.findIndex((p) => p.text.includes('Night watch')) + 1;
    expect(titlePage).toBe(out.encounters[0]!.pages[0]);
  });
});

describe('US-043 AC-7 writing space (SCAR-048)', {timeout: LIMIT}, () => {
  it('US-043 AC-7: no text frame of a row lies in a box, a cell or the notes line’s clear height (frames, not ink: SCAR-023)', async () => {
    const out = await sheets(MIRE_HOLLOW);
    expect(out.encounterRows).toHaveLength(7);
    for (const r of out.encounterRows) {
      expect(r.zones.length, r.label).toBeGreaterThan(0);
      for (const z of r.zones) {
        for (const t of r.texts)
          expect(overlaps(z, t), `${r.label}`).toBe(false);
      }
    }
  });

  it('US-043 AC-7: the notes line has at least 4.5 mm clear height', async () => {
    const out = await sheets(MIRE_HOLLOW);
    expect(out.encounterRows).toHaveLength(7);
    for (const r of out.encounterRows) {
      const notes = r.zones[r.zones.length - 1]!;
      expect(notes.h, r.label).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe(
  'US-043 AC-9 grayscale, AC-5 box limits in the PDF',
  {timeout: LIMIT},
  () => {
    it('US-043 AC-9: colorMode grayscale → every fill of the page is a grey', async () => {
      const out = await sheets(MIRE_HOLLOW, {colorMode: 'grayscale'});
      // SCAR-023: the rows were drawn, so the greys are theirs, not an empty page's.
      expect(out.encounterRows).toHaveLength(7);
      for (const f of out.pages.flatMap((p) => p.fills)) {
        const [r, g, b] = [f.slice(1, 3), f.slice(3, 5), f.slice(5, 7)];
        expect(r === g && g === b, f).toBe(true);
      }
    });

    it('US-043 AC-5: vigour 46 is drawn as 45 boxes with ENCOUNTER_BOXES_CAPPED', async () => {
      const out = await sheets(
        [
          '## R',
          encounter([
            row('Bog Wight', '1', undefined, ['vigour: 46', 'might: 6']),
          ]),
        ].join('\n'),
      );
      expect(out.encounterRows[0]?.boxes).toBe(45);
      expect(warningsOf(out.result.warnings, US043_CODES)).toEqual([
        'ENCOUNTER_BOXES_CAPPED "Bog Wight": 46 → 45',
      ]);
    });

    it('US-043 AC-6: blank rows follow encounterSheetBoxes 15 and 45', async () => {
      for (const n of [15, 45]) {
        const out = await sheets(
          ['## R', encounter([row('Lost Pilgrim', '1')])].join('\n'),
          {
            entries: {...ENTRIES, encounterSheetBoxes: n},
          },
        );
        expect(out.encounterRows[0]?.boxes, String(n)).toBe(n);
      }
    });
  },
);

describe('US-043 AC-12 a large list', {timeout: LIMIT}, () => {
  it('US-043 AC-12 (SCAR-021, SCAR-030): 300 rows compile, all drawn, in order, within the limit', async () => {
    const start = Date.now();
    const out = await sheets(
      [
        '## R',
        encounter([
          row('Fen Hare', '99', undefined, FEN_HARE_DATA),
          row('Bog Wight', '99', undefined, BOG_WIGHT_DATA),
          row('Fen Hare', '99', undefined, FEN_HARE_DATA),
          row('Lost Pilgrim', '3'),
        ]),
      ].join('\n'),
    );
    const ms = Date.now() - start;
    expect(out.diagnostics).toEqual([]);
    expect(out.encounterRows).toHaveLength(300);
    expect(new Set(out.encounterRows.map((r) => r.label)).size).toBe(300);
    expect(ms).toBeLessThan(LIMIT);
  });
});
