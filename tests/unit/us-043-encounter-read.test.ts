// US-043 AC-1 to AC-4 — reading the `o2t-encounter` block: the scan takes it
// out of the tree, the reader gives its lines, the counts become rows, the
// labels are unique, and the data is read with the entry reader's rules.
// Source of truth: docs/user-stories/US-043-prefilled-encounter-rows.md and
// docs/technical/encounter-block.md. Red until US-043 is implemented
// (G2, 2026-11-25).
import {describe, expect, it} from 'vitest';
import {
  ENCOUNTER_BLOCK_LANG,
  readEncounterBlock,
  scanEncounterBlocks,
} from '../../src/core/markers';
import {encounterModel, parseCount} from '../../src/core/encounter/model';
import {parse} from '../../src/core/parse';
import {ENTRIES} from '../support/entries';
import {
  BOG_WIGHT_DATA,
  ENCOUNTER_HELPER,
  FEN_HARE_DATA,
  MIRE_HOLLOW,
  encounter,
  encounterCalls,
  row,
  runEncounter,
} from '../support/encounter';
import {warningsOf} from '../support/entries';

const scan = (source: string) => scanEncounterBlocks(parse(source).root);

/** The model of the first block of `source`. */
function model(source: string, blankBoxes = 30) {
  const found = scan(source).found[0];
  expect(found, 'a block').toBeDefined();
  const read = readEncounterBlock(found!);
  return {read, model: encounterModel(read, ENTRIES, {blankBoxes})};
}

const labels = (source: string): string[] =>
  model(source).model.rows.map((r) => r.label);

describe('US-043 AC-1 one reader, data only', () => {
  it('US-043 AC-1: the language is o2t-encounter', () => {
    expect(ENCOUNTER_BLOCK_LANG).toBe('o2t-encounter');
  });

  it('US-043 AC-1: the block is found; its YAML leaves the tree, an emptied marker keeps its place', () => {
    // Refined at #184 (AC-1 amended): the rows are drawn where the block stood,
    // so an emptied code node of the same language marks the place.
    const result = scan(MIRE_HOLLOW);
    expect(result.found).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.root.map((b) => b.kind)).toEqual([
      'heading',
      'code',
      'paragraph',
    ]);
    const marker = result.root[1] as {lang: string; value: string};
    expect(marker.lang).toBe(ENCOUNTER_BLOCK_LANG);
    expect(marker.value).toBe('');
    expect(result.found[0]?.marker).toBe(result.root[1]);
  });

  it('US-043 AC-1: a four-backtick and a tilde fence are the same block; another language is not', () => {
    for (const fence of ['````', '~~~']) {
      const source = [
        '## R',
        encounter([row('Fen Hare', '1')], undefined, fence),
      ].join('\n');
      expect(scan(source).found, fence).toHaveLength(1);
    }
    const other = ['## R', '```o2t-encounters', 'rows: []', '```'].join('\n');
    expect(scan(other).found).toHaveLength(0);
  });

  it('US-043 AC-1: the YAML is never printed; the rows are drawn where it stood', async () => {
    const {typ} = await runEncounter(MIRE_HOLLOW);
    expect(typ).not.toContain('nibbling reeds\n    data');
    expect(typ).not.toContain('count: "1d4"');
    expect(encounterCalls(typ)).toBe(1);
    const lines = typ.split('\n');
    const heading = lines.findIndex((l) => /^== Mire Hollow/.test(l));
    const call = lines.findIndex((l) => l.startsWith(`#${ENCOUNTER_HELPER}(`));
    const text = lines.findIndex((l) => l === 'The reeds rustle.');
    expect(heading).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(heading);
    expect(text).toBeGreaterThan(call);
  });

  it('US-043 AC-1: the reader gives the title and the lines in order, as written', () => {
    const {read} = model(MIRE_HOLLOW);
    expect(read.title).toBe('Night watch');
    expect(read.lines.map((l) => [l.name, l.count, l.note])).toEqual([
      ['Fen Hare', '2', 'nibbling reeds'],
      ['Bog Wight', '1d4', null],
      ['Lost Pilgrim', '1', 'no stats'],
    ]);
    expect(read.lines.map((l) => l.data === null)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('US-043 AC-1 (contract item 5): unknown keys are ignored with one warning per block naming them', () => {
    const source = [
      '## R',
      '```o2t-encounter',
      'colour: red',
      'rows:',
      '  - name: Fen Hare',
      '    count: "1"',
      '    size: big',
      '```',
    ].join('\n');
    const {read} = model(source);
    expect(read.lines).toHaveLength(1);
    expect(warningsOf(read.warnings, ['ENCOUNTER_KEY_UNKNOWN'])).toEqual([
      'ENCOUNTER_KEY_UNKNOWN Unknown keys in the o2t-encounter block: colour, size',
    ]);
  });

  it('US-043 AC-1: YAML that is not a map with a list of rows → no rows and ENCOUNTER_YAML_INVALID', () => {
    for (const body of [['rows: [oops'], ['- a', '- b'], ['title: x']]) {
      const source = ['## R', '```o2t-encounter', ...body, '```'].join('\n');
      const {read} = model(source);
      expect(read.lines, body.join('|')).toEqual([]);
      expect(read.warnings.map((w) => w.code)).toEqual([
        'ENCOUNTER_YAML_INVALID',
      ]);
    }
  });
});

describe('US-043 AC-2 rows from counts', () => {
  it.each([
    ['2', 2],
    ['1d4', 4],
    ['d6', 6],
    ['3d6', 18],
    ['0', 0],
    ['99', 99],
  ])('US-043 AC-2: count %s → %i rows', (count, rows) => {
    expect(parseCount(count)).toBe(rows);
  });

  it.each([['two'], ['1d'], ['-1'], [''], ['2.5'], ['d']])(
    'US-043 AC-2: count "%s" is not a count',
    (count) => {
      expect(parseCount(count)).toBeNull();
    },
  );

  it('US-043 AC-2: a number (not text) is not a count either', () => {
    expect(parseCount(2)).toBeNull();
  });

  it('US-043 AC-2: a bad count gives no rows for that line and a warning with the line', () => {
    const source = [
      '## R',
      encounter([row('Fen Hare', 'two'), row('Bog Wight', '1')]),
    ].join('\n');
    const {model: m} = model(source);
    expect(m.rows.map((r) => r.label)).toEqual(['Bog Wight']);
    expect(m.warnings.map((w) => `${w.code} ${w.message}`)).toEqual([
      'ENCOUNTER_COUNT_INVALID "Fen Hare": two',
    ]);
    expect(m.warnings[0]?.line).toBeGreaterThan(0);
  });

  it('US-043 AC-2: more than 99 rows from one line → 99 rows and ENCOUNTER_COUNT_CAPPED', () => {
    const source = ['## R', encounter([row('Fen Hare', '3d100')])].join('\n');
    const {model: m} = model(source);
    expect(m.rows).toHaveLength(99);
    expect(m.warnings.map((w) => `${w.code} ${w.message}`)).toEqual([
      'ENCOUNTER_COUNT_CAPPED "Fen Hare": 3d100 → 99',
    ]);
  });

  it('US-043 AC-2: count "0" gives no row and no warning', () => {
    const source = [
      '## R',
      encounter([row('Fen Hare', '0'), row('Bog Wight', '1')]),
    ].join('\n');
    const {model: m} = model(source);
    expect(m.rows.map((r) => r.label)).toEqual(['Bog Wight']);
    expect(m.warnings).toEqual([]);
  });
});

describe('US-043 AC-3 labels', () => {
  it('US-043 AC-3: one row keeps the name; more are numbered from 1', () => {
    expect(
      labels(
        [
          '## R',
          encounter([row('Lost Pilgrim', '1'), row('Fen Hare', '3')]),
        ].join('\n'),
      ),
    ).toEqual(['Lost Pilgrim', 'Fen Hare 1', 'Fen Hare 2', 'Fen Hare 3']);
  });

  it('US-043 AC-3 (SCAR-011): a real "Fen Hare 2" before three Fen Hares → the next free numbers', () => {
    expect(
      labels(
        [
          '## R',
          encounter([row('Fen Hare 2', '1'), row('Fen Hare', '3')]),
        ].join('\n'),
      ),
    ).toEqual(['Fen Hare 2', 'Fen Hare 1', 'Fen Hare 3', 'Fen Hare 4']);
  });

  it('US-043 AC-3 (SCAR-011): the clash in the other order, and the same creature on two lines', () => {
    expect(
      labels(
        [
          '## R',
          encounter([row('Fen Hare', '2'), row('Fen Hare 2', '1')]),
        ].join('\n'),
      ),
    ).toEqual(['Fen Hare 1', 'Fen Hare 3', 'Fen Hare 2']);
    expect(
      labels(
        ['## R', encounter([row('Fen Hare', '1'), row('Fen Hare', '1')])].join(
          '\n',
        ),
      ),
    ).toEqual(['Fen Hare', 'Fen Hare 2']);
  });

  it('US-043 AC-3: no two labels of one block are equal (invariant over a mixed block)', () => {
    const all = labels(
      [
        '## R',
        encounter([
          row('Fen Hare 1', '1'),
          row('Fen Hare', '1d4'),
          row('Fen Hare 3', '2'),
          row('Fen Hare', '1'),
        ]),
      ].join('\n'),
    );
    expect(all).toHaveLength(8);
    expect(new Set(all).size).toBe(all.length);
  });

  it('US-043 AC-3: a dice count puts "1d4 (up to 4)" before the note, on the first row of the line only', () => {
    const rows = model(
      ['## R', encounter([row('Bog Wight', '1d4', 'in the mist')])].join('\n'),
    ).model.rows;
    expect(rows.map((r) => r.note)).toEqual([
      '1d4 (up to 4) — in the mist',
      null,
      null,
      null,
    ]);
    const plain = model(
      ['## R', encounter([row('Bog Wight', '1d2')])].join('\n'),
    ).model.rows;
    expect(plain.map((r) => r.note)).toEqual(['1d2 (up to 2)', null]);
  });
});

describe('US-043 AC-4 data', () => {
  it('US-043 AC-4: data is read with the entry reader: values, the own track, attacks', () => {
    const rows = model(MIRE_HOLLOW).model.rows;
    const hare = rows[0]!;
    expect(hare.blank).toBe(false);
    expect(hare.stats).toEqual(['4', '1', '5']);
    expect(hare.boxes).toBe(11);
    expect(hare.cells).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
    const wight = rows[2]!;
    expect(wight.cells).toEqual(['Fine', 'Down', 'Gone']);
    expect(wight.attacks).toEqual([
      {name: 'Claw', dice: '3d8'},
      {name: 'Wail', dice: 'Wits check, 2 successes'},
    ]);
  });

  it('US-043 AC-4: the entry reader’s warnings come with the row’s name (US-030 AC-5)', () => {
    const source = [
      '## R',
      encounter([
        row('Fen Hare', '1', undefined, [
          'vigour: 3',
          'attacks:',
          '  - B: 2d6',
        ]),
      ]),
    ].join('\n');
    const m = model(source).model;
    expect(warningsOf(m.warnings, ['ENTRY_VALUE_NOT_TEXT'])).toEqual([
      'ENTRY_VALUE_NOT_TEXT "Fen Hare": attacks',
    ]);
  });

  it('US-043 AC-4: no data → a blank row; data with no stat, box value or attack → a blank row with its name', () => {
    const source = [
      '## R',
      encounter([
        row('Lost Pilgrim', '1'),
        row('Reed Wisp', '1', undefined, ['tags: [beast]']),
      ]),
    ].join('\n');
    const rows = model(source).model.rows;
    expect(rows.map((r) => [r.label, r.blank])).toEqual([
      ['Lost Pilgrim', true],
      ['Reed Wisp', true],
    ]);
  });

  it('US-043 AC-4: the data is only the entry’s data; a second row of the same note gets the same values', () => {
    const rows = model(
      [
        '## R',
        encounter([
          row('Bog Wight', '2', undefined, BOG_WIGHT_DATA),
          row('Fen Hare', '1', undefined, FEN_HARE_DATA),
        ]),
      ].join('\n'),
    ).model.rows;
    expect(rows[0]!.stats).toEqual(rows[1]!.stats);
    expect(rows[0]!.boxes).toBe(20);
    expect(rows[2]!.boxes).toBe(11);
  });
});
