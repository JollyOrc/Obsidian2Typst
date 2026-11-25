// US-043 AC-5, AC-6, AC-11 — what a row holds (the model the row helper
// draws): the stat values, the traits, exactly the boxes, the own track or
// none, every attack split once, and the blank row with the blank sheet's
// box count. Settings at more than their default (SCAR-019).
// The drawn PDF is read in tests/integration/us-043-encounter-pdf.test.ts.
// Source of truth: docs/user-stories/US-043-prefilled-encounter-rows.md.
// Red until US-043 is implemented (G2, 2026-11-25).
import {describe, expect, it} from 'vitest';
import {encounterModel} from '../../src/core/encounter/model';
import {readEncounterBlock, scanEncounterBlocks} from '../../src/core/markers';
import {parse} from '../../src/core/parse';
import {ENTRIES} from '../support/entries';
import {encounter, row} from '../support/encounter';

type Entries = typeof ENTRIES;

/** The rows of one block holding one line `name × count` with `data`. */
function rows(
  data: readonly string[] | undefined,
  options: {count?: string; entries?: unknown; blankBoxes?: number} = {},
) {
  const source = [
    '## R',
    encounter([row('Fen Hare', options.count ?? '1', undefined, data)]),
  ].join('\n');
  const found = scanEncounterBlocks(parse(source).root).found[0]!;
  return encounterModel(
    readEncounterBlock(found),
    (options.entries ?? ENTRIES) as Entries,
    {blankBoxes: options.blankBoxes ?? 30},
  );
}

const SEVEN = [
  {label: 'Fine', icon: 'Icons/fine.svg'},
  {label: 'Hurt', icon: 'Icons/hurt.svg'},
  {label: 'Torn', icon: 'Icons/torn.svg'},
  {label: 'Down', icon: 'Icons/down.svg'},
  {label: 'Fading', icon: 'Icons/fading.svg'},
  {label: 'Lost', icon: 'Icons/lost.svg'},
  {label: 'Gone', icon: 'Icons/gone.svg'},
];

describe('US-043 AC-5 line 1: label, note, stats, traits', () => {
  it('US-043 AC-5: the stats in the preset’s order; a missing value is an empty box', () => {
    const r = rows(['vigour: 5', 'speed: 3', 'might: 7']).rows[0]!;
    expect(r.stats).toEqual(['7', '', '3']);
  });

  it('US-043 AC-5: the traits present, as "Label value", in the preset’s order; none → no line', () => {
    expect(rows(['vigour: 5', 'guard: 2', 'move: 4']).rows[0]!.traits).toEqual([
      'Move 4',
      'Guard 2',
    ]);
    expect(rows(['vigour: 5']).rows[0]!.traits).toEqual([]);
  });

  it('US-043 AC-5: the note of the line is on its first row; no note → null', () => {
    const source = [
      '## R',
      encounter([row('Fen Hare', '2', 'nibbling reeds', ['vigour: 5'])]),
    ].join('\n');
    const found = scanEncounterBlocks(parse(source).root).found[0]!;
    const m = encounterModel(readEncounterBlock(found), ENTRIES, {
      blankBoxes: 30,
    });
    expect(m.rows.map((r) => r.note)).toEqual(['nibbling reeds', null]);
  });
});

describe('US-043 AC-5 line 2: exactly the boxes, the own track', () => {
  it.each([
    [0, 0],
    [1, 1],
    [15, 15],
    [16, 16],
    [45, 45],
  ])('US-043 AC-5: vigour %i → %i boxes, no warning', (vigour, boxes) => {
    const m = rows([`vigour: ${vigour}`, 'attacks:', '  - "Kick: 2d6"']);
    expect(m.rows[0]!.boxes).toBe(boxes);
    expect(m.warnings).toEqual([]);
  });

  it('US-043 AC-5: vigour 46 → 45 boxes and ENCOUNTER_BOXES_CAPPED', () => {
    const m = rows(['vigour: 46']);
    expect(m.rows[0]!.boxes).toBe(45);
    expect(m.warnings.map((w) => `${w.code} ${w.message}`)).toEqual([
      'ENCOUNTER_BOXES_CAPPED "Fen Hare": 46 → 45',
    ]);
  });

  it('US-043 AC-5: the track: own value, the default, one cell, none (empty place, no text)', () => {
    expect(rows(['vigour: 5', 'states: [Fine, Gone]']).rows[0]!.cells).toEqual([
      'Fine',
      'Gone',
    ]);
    expect(rows(['vigour: 5']).rows[0]!.cells).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Gone',
    ]);
    expect(rows(['vigour: 5', 'states: [Gone]']).rows[0]!.cells).toEqual([
      'Gone',
    ]);
    expect(rows(['vigour: 5', 'states: none']).rows[0]!.cells).toEqual([]);
  });

  it('US-043 AC-5: a preset track of seven cells, all of them by default', () => {
    const entries = {
      ...ENTRIES,
      statblock: {
        ...ENTRIES.statblock,
        track: SEVEN,
        trackDefault: SEVEN.map((c) => c.label),
      },
    };
    expect(rows(['vigour: 5'], {entries}).rows[0]!.cells).toHaveLength(7);
  });
});

describe('US-043 AC-5 line 3: every attack', () => {
  it('US-043 AC-5: split at the first ": "; the rest whole; an item without ": " is the name alone', () => {
    const r = rows([
      'vigour: 5',
      'attacks:',
      '  - "Kick: 2d6"',
      '  - "Wail: Wits check: hard, 2 successes"',
      '  - "Stomp 3d6"',
    ]).rows[0]!;
    expect(r.attacks).toEqual([
      {name: 'Kick', dice: '2d6'},
      {name: 'Wail', dice: 'Wits check: hard, 2 successes'},
      {name: 'Stomp 3d6', dice: ''},
    ]);
  });

  it('US-043 AC-5: more than three attacks: all of them, in order (the row grows)', () => {
    const attacks = ['A', 'B', 'C', 'D', 'E'].map((a) => `  - "${a}: 1d6"`);
    expect(
      rows(['vigour: 5', 'attacks:', ...attacks]).rows[0]!.attacks.map(
        (a) => a.name,
      ),
    ).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('US-043 AC-6 the blank row', () => {
  it.each([15, 30, 45])(
    'US-043 AC-6: encounterSheetBoxes %i → that many boxes, every track cell, three slots',
    (blankBoxes) => {
      const r = rows(undefined, {blankBoxes}).rows[0]!;
      expect(r.blank).toBe(true);
      expect(r.boxes).toBe(blankBoxes);
      expect(r.cells).toEqual(['Fine', 'Hurt', 'Down', 'Fading', 'Gone']);
      expect(r.stats).toEqual(['', '', '']);
      expect(r.attacks).toEqual([]);
      expect(r.slots).toBe(3);
    },
  );

  it('US-043 AC-6: a prefilled row has no write-in slots', () => {
    expect(rows(['vigour: 5']).rows[0]!.slots).toBe(0);
  });
});
