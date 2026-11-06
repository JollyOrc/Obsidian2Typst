// US-030 AC-10 to AC-18 — the statblock: when there is one, the box row's
// values, the state track's cells, tags, the helper as a plugin name, the
// opening paragraph, and the data checks. Warnings and the `.typ`; the drawn
// parts are read from the PDF in tests/integration/us-030-statblock-pdf.test.ts.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until US-030 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {PLUGIN_NAMES, templateWarnings} from '../../src/core/template';
import {
  ENTRIES,
  STATBLOCK_HELPER,
  US030_CODES,
  entry,
  runEntries,
  statblockCalls,
  warningsOf,
} from '../support/entries';

const codes = [...US030_CODES];
const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];

describe('US-030 AC-11 no data, partial data', () => {
  it('US-030 AC-11: only attacks → a statblock; only skills and tags → none', async () => {
    expect(
      statblockCalls(
        (await runEntries(entry('### A', ['attacks: ["Kick: 2d6"]']))).typ,
      ),
    ).toBe(1);
    expect(
      statblockCalls(
        (await runEntries(entry('### B', ['skills: [Swift]', 'tags: [beast]'])))
          .typ,
      ),
    ).toBe(0);
  });

  it('US-030 AC-11 (G0-C1): with the built-in (empty) settings there is never a statblock', async () => {
    const {typ, warnings} = await runEntries(
      entry('### A', ['might: 4', 'tags: [rare]']),
      {entries: undefined},
    );
    expect(statblockCalls(typ)).toBe(0);
    expect(warningsOf(warnings, codes)).toEqual([]);
    // The block is still data, not text (AC-1), also without settings.
    expect(typ).not.toContain('might:');
  });
});

describe('US-030 AC-12 the box row', () => {
  const cases: [string, string[]][] = [
    ['0', []],
    ['11', []],
    ['15', []],
    ['16', []],
    ['45', []],
    ['46', ['STAT_BOXES_MANY "A": 46']],
    ['"varies"', ['STAT_BOXES_NOT_NUMBER "A"']],
    ['2d6', ['STAT_BOXES_NOT_NUMBER "A"']],
    ['-3', ['STAT_BOXES_NOT_NUMBER "A"']],
    ['2.5', ['STAT_BOXES_NOT_NUMBER "A"']],
  ];
  for (const [value, want] of cases) {
    it(`US-030 AC-12: vigour ${value} → ${want.length === 0 ? 'no warning' : want[0]}`, async () => {
      const {typ, warnings} = await runEntries(
        entry('### A', ['might: 4', `vigour: ${value}`], LEDE),
      );
      expect(warningsOf(warnings, codes)).toEqual(want);
      expect(statblockCalls(typ)).toBe(1);
    });
  }

  it('US-030 AC-12: without boxes in the preset, vigour is an ordinary stat and never warns', async () => {
    const statblock = {...ENTRIES.statblock, boxes: undefined};
    const {warnings} = await runEntries(
      entry('### A', ['might: 4', 'vigour: 46'], LEDE),
      {
        entries: {...ENTRIES, statblock},
      },
    );
    expect(warningsOf(warnings, codes)).toEqual([]);
    expect(warnings.map((w) => w.code)).not.toContain('ENTRY_YAML_INVALID');
    expect(
      statblockCalls(
        (
          await runEntries(entry('### A', ['might: 4', 'vigour: 46'], LEDE), {
            entries: {...ENTRIES, statblock},
          })
        ).typ,
      ),
    ).toBe(1);
  });
});

describe('US-030 AC-13 the state track', () => {
  it('US-030 AC-13: an unknown label is left out with ENTRY_TRACK_UNKNOWN; labels match in any case', async () => {
    const {warnings} = await runEntries(
      entry('### A', ['might: 4', 'states: [fine, HURT, Lost]'], LEDE),
    );
    expect(warningsOf(warnings, codes)).toEqual([
      'ENTRY_TRACK_UNKNOWN "A": Lost',
    ]);
  });

  it('US-030 AC-13: states none, missing and full give no warning', async () => {
    for (const states of [
      'states: none',
      'might: 4',
      'states: [Fine, Hurt, Down, Fading, Gone]',
    ]) {
      const {typ, warnings} = await runEntries(
        entry('### A', ['might: 4', states], LEDE),
      );
      expect(statblockCalls(typ), states).toBe(1);
      expect(warningsOf(warnings, codes), states).toEqual([]);
    }
  });
});

describe('US-030 AC-14 tags', () => {
  it('US-030 AC-14: an unmapped tag warns only when the map is not empty', async () => {
    const source = entry(
      '### A',
      ['might: 4', 'tags: [beast, Magical, "#rare"]'],
      LEDE,
    );
    expect(warningsOf((await runEntries(source)).warnings, codes)).toEqual([
      'TAG_UNMAPPED "A": rare',
    ]);
    const noMap = {...ENTRIES, tagLabels: {}};
    expect(
      warningsOf((await runEntries(source, {entries: noMap})).warnings, codes),
    ).toEqual([]);
  });
});

describe('US-030 AC-15 the helper is a plugin name', () => {
  it('US-030 AC-15: PLUGIN_NAMES hold the statblock helper; a template defining it gets TEMPLATE_NAME_TAKEN', () => {
    expect(PLUGIN_NAMES).toContain(STATBLOCK_HELPER);
    expect(
      templateWarnings(`#let ${STATBLOCK_HELPER}(..a) = none\n`).map(
        (w) => w.code,
      ),
    ).toEqual(['TEMPLATE_NAME_TAKEN']);
  });
});

describe('US-030 AC-16 the opening paragraph', () => {
  const firsts: [string, string][] = [
    ['- A list item', 'list'],
    ['![x](assets/map.png)', 'image'],
    ['> [!note] A callout', 'callout'],
    ['> A quote', 'quote'],
    ['#### A heading', 'heading'],
    ['| a | b |\n| - | - |\n| 1 | 2 |', 'table'],
    ['```js\nx\n```', 'code'],
  ];
  for (const [first, kind] of firsts) {
    it(`US-030 AC-16: an entry starting with a ${kind} gives ENTRY_NO_LEDE`, async () => {
      const {warnings} = await runEntries(
        entry('### A', ['might: 4'], [first]),
      );
      expect(warningsOf(warnings, codes)).toEqual([
        `ENTRY_NO_LEDE "A": starts with ${kind}`,
      ]);
    });
  }

  it('US-030 AC-16: an opening paragraph of 9 words warns, 10 words does not', async () => {
    const nine = await runEntries(
      entry(
        '### A',
        ['might: 4'],
        ['One two three four five six seven eight nine.'],
      ),
    );
    expect(warningsOf(nine.warnings, codes)).toEqual([
      'ENTRY_LEDE_SHORT "A": 9 words',
    ]);
    const ten = await runEntries(
      entry(
        '### A',
        ['might: 4'],
        ['One two three four five six seven eight nine ten.'],
      ),
    );
    expect(warningsOf(ten.warnings, codes)).toEqual([]);
  });
});

describe('US-030 AC-18 data checks', () => {
  const withSum = {
    ...ENTRIES,
    statblock: {
      ...ENTRIES.statblock,
      sum: {total: 'vigour', of: ['might', 'wits', 'speed']},
    },
  };

  it('US-030 AC-18: a sum that differs warns with the numbers; one that matches does not', async () => {
    const off = await runEntries(
      entry('### A', ['vigour: 20', 'might: 4', 'wits: 8', 'speed: 3'], LEDE),
      {entries: withSum},
    );
    expect(warningsOf(off.warnings, codes)).toEqual([
      'STAT_SUM_MISMATCH "A": 20 ≠ 4+8+3',
    ]);
    const ok = await runEntries(
      entry('### A', ['vigour: 15', 'might: 4', 'wits: 8', 'speed: 3'], LEDE),
      {entries: withSum},
    );
    expect(warningsOf(ok.warnings, codes)).toEqual([]);
  });

  it('US-030 AC-18: a non-number on either side skips the check; no sum rule, no check', async () => {
    const skip = await runEntries(
      entry(
        '### A',
        ['vigour: varies', 'might: 4', 'wits: 8', 'speed: 3'],
        LEDE,
      ),
      {entries: withSum},
    );
    expect(warningsOf(skip.warnings, ['STAT_SUM_MISMATCH'])).toEqual([]);
    expect(statblockCalls(skip.typ)).toBe(1);
    const none = await runEntries(
      entry('### A', ['vigour: 20', 'might: 4', 'wits: 8', 'speed: 3'], LEDE),
    );
    expect(warningsOf(none.warnings, ['STAT_SUM_MISMATCH'])).toEqual([]);
  });

  it('US-030 AC-18 (decision 1): an attack without dice warns; one without ": " but with dice does not', async () => {
    const {warnings} = await runEntries(
      entry(
        '### A',
        ['might: 4', 'attacks: ["Glare: frightens", "Kick 2d6", "Bite: 1d6"]'],
        LEDE,
      ),
    );
    expect(warningsOf(warnings, codes)).toEqual([
      'STAT_ATTACK_NO_DICE "A": "Glare: frightens"',
    ]);
  });
});
