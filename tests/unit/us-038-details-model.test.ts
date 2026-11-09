// US-038 AC-4, AC-16 — the model of the row: which badges a block's data gives
// under preset E, the value matching, flags, unmapped and not-text values.
// The table is the one of the story. Through the model (the one function the
// PDF, the preview and the API draw from) and through the whole conversion.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {
  DETAILS_E,
  LONG_NEEDS,
  detailWarnings,
  details,
  detailsCalls,
  runDetails,
} from '../support/details';
import {detailsModel} from '../../src/core/details/model';

/** The badges as `icon-path|label-or-value` (icon `-` when none). */
function badges(data: Record<string, unknown>, settings: unknown = DETAILS_E) {
  const model = detailsModel(data, settings);
  return {
    badges: (model?.badges ?? []).map(
      (b) => `${b.icon ?? '-'}|${b.label ?? b.value ?? ''}`,
    ),
    checks: (model?.checks ?? []).map((c) => `${c.code} ${c.detail}`),
  };
}

describe('US-038 AC-4 the table of the story, through the model', () => {
  it('US-038 AC-4: pace, kind and needs: three badges in the preset order', () => {
    expect(
      badges({needs: 'Basket Knots', kind: 'craft', pace: 'brisk'}),
    ).toEqual({
      badges: [
        'Icons/brisk.svg|Brisk',
        'Icons/kind.svg|Craft',
        'Icons/lock.svg|Basket Knots',
      ],
      checks: [],
    });
  });

  it('US-038 AC-4: kind only, flag only, a long requirement', () => {
    expect(badges({kind: 'lore'}).badges).toEqual(['Icons/kind.svg|Lore']);
    expect(badges({starter: true}).badges).toEqual([
      'Icons/sprout.svg|Known from the start',
    ]);
    expect(badges({needs: LONG_NEEDS}).badges).toEqual([
      `Icons/lock.svg|${LONG_NEEDS}`,
    ]);
  });

  it('US-038 AC-4: nothing set → a model with no badge; no group → no model', () => {
    expect(detailsModel({}, DETAILS_E)?.badges).toEqual([]);
    expect(detailsModel({pace: 'slow'}, undefined)).toBeNull();
    expect(detailsModel({pace: 'slow'}, {items: []})).toBeNull();
    expect(detailsModel({pace: 'slow'}, {})).toBeNull();
  });

  it('US-038 AC-4: values match without case and surrounding spaces; keys in any case', () => {
    for (const v of ['brisk', ' BRISK ', 'Brisk', '\tbrisk\n']) {
      expect(badges({pace: v}).badges, JSON.stringify(v)).toEqual([
        'Icons/brisk.svg|Brisk',
      ]);
    }
    expect(badges({Pace: 'swift'}).badges).toEqual(['Icons/swift.svg|Swift']);
    expect(badges({Kind: ' Lore ', kind: 'feat'}).badges).toEqual([
      'Icons/kind.svg|Lore',
    ]);
  });

  it("US-038 AC-4: the keys of the item's maps are compared without case and spaces too; an item key may have capitals", () => {
    const spaced = {
      items: [{key: 'Pace', labels: {' Brisk ': 'B', SLOW: 'S'}}],
    };
    expect(badges({pace: 'brisk'}, spaced).badges).toEqual(['-|B']);
    expect(badges({PACE: ' slow'}, spaced)).toEqual({
      badges: ['-|S'],
      checks: [],
    });
  });

  it('US-038 AC-4: a badge with a label has no value; one without a label has its value (trimmed)', () => {
    const model = detailsModel({pace: ' brisk ', needs: ' Basket '}, DETAILS_E);
    expect(model?.badges.map((b) => [b.label, b.value])).toEqual([
      ['Brisk', null],
      [null, 'Basket'],
    ]);
  });

  it('US-038 AC-4: not set values show nothing: false, null, empty, blank, no key', () => {
    for (const data of [
      {starter: false},
      {starter: null},
      {starter: ''},
      {needs: '   '},
      {needs: null},
      {pace: ''},
    ]) {
      expect(badges(data), JSON.stringify(data)).toEqual({
        badges: [],
        checks: [],
      });
    }
  });

  it('US-038 AC-4: a number is text (`3` and "3" alike)', () => {
    expect(badges({needs: 3}).badges).toEqual(['Icons/lock.svg|3']);
    expect(badges({needs: '3'}).badges).toEqual(['Icons/lock.svg|3']);
  });

  it('US-038 AC-4: an unmapped value is printed as written, with the icon that exists, and checked once', () => {
    expect(badges({pace: 'soon'})).toEqual({
      badges: ['-|soon'],
      checks: ['DETAIL_VALUE_UNMAPPED pace: soon'],
    });
    // labels know the value, icons do not: the label is printed without an icon
    const half = {
      items: [
        {
          key: 'pace',
          icons: {slow: 'a.svg'},
          labels: {slow: 'Slow', swift: 'Swift'},
        },
      ],
    };
    expect(badges({pace: 'swift'}, half)).toEqual({
      badges: ['-|Swift'],
      checks: ['DETAIL_VALUE_UNMAPPED pace: swift'],
    });
    // a single icon is the fallback: no check for the icon
    const fallback = {
      items: [{key: 'pace', icon: 'a.svg', labels: {slow: 'Slow'}}],
    };
    expect(badges({pace: 'slow'}, fallback).checks).toEqual([]);
    expect(badges({pace: 'swift'}, fallback)).toEqual({
      badges: ['a.svg|swift'],
      checks: ['DETAIL_VALUE_UNMAPPED pace: swift'],
    });
  });

  it('US-038 AC-4: a single label is the fallback for labels; an empty map counts as not set', () => {
    const single = {items: [{key: 'k', label: 'Fixed', labels: {a: 'A'}}]};
    expect(badges({k: 'zzz'})).toEqual({badges: [], checks: []});
    expect(badges({k: 'zzz'}, single)).toEqual({
      badges: ['-|Fixed'],
      checks: [],
    });
    const empty = {items: [{key: 'k', icon: 'i.svg', labels: {}, icons: {}}]};
    expect(badges({k: 'zzz'}, empty)).toEqual({
      badges: ['i.svg|zzz'],
      checks: [],
    });
  });

  it('US-038 AC-4: a list or a map value is left out with a check, once per key; the others stay', () => {
    expect(
      badges({kind: ['craft', 'lore'], pace: 'slow', needs: {a: 1}}),
    ).toEqual({
      badges: ['Icons/slow.svg|Slow'],
      checks: ['DETAIL_VALUE_NOT_TEXT kind', 'DETAIL_VALUE_NOT_TEXT needs'],
    });
  });

  it('US-038 AC-4: a flag with neither icon nor label shows nothing; a flag may use `true` in the maps', () => {
    expect(badges({f: true}, {items: [{key: 'f'}]}).badges).toEqual([]);
    expect(
      badges(
        {f: true},
        {items: [{key: 'f', labels: {true: 'Yes'}, icons: {true: 'y.svg'}}]},
      ).badges,
    ).toEqual(['y.svg|Yes']);
  });

  it('US-038 AC-4: the order is the preset order whatever the order in the block', () => {
    const a = badges({starter: true, needs: 'x', kind: 'feat', pace: 'slow'});
    expect(a.badges.map((b) => b.split('|')[0])).toEqual([
      'Icons/slow.svg',
      'Icons/kind.svg',
      'Icons/lock.svg',
      'Icons/sprout.svg',
    ]);
  });
});

describe('US-038 AC-4, AC-12 the same table through the conversion (warnings once, exact)', () => {
  const cases: [string, string[], string[], string[]][] = [
    [
      'all three',
      ['pace: brisk', 'kind: craft', 'needs: Basket Knots'],
      ['Brisk', 'Craft', 'Basket Knots'],
      [],
    ],
    ['kind only', ['kind: lore'], ['Lore'], []],
    ['flag only', ['starter: true'], ['Known from the start'], []],
    ['long requirement', [`needs: ${LONG_NEEDS}`], [LONG_NEEDS], []],
    ['empty', ['{}'], [], []],
    [
      'unmapped',
      ['pace: soon'],
      ['soon'],
      ['DETAIL_VALUE_UNMAPPED "Reed Weaving": pace: soon (line 2)'],
    ],
    [
      'not text',
      ['kind: [craft, lore]'],
      [],
      ['DETAIL_VALUE_NOT_TEXT "Reed Weaving": kind (line 2)'],
    ],
    ['flag false', ['starter: false'], [], []],
    ['number', ['needs: 3'], ['3'], []],
    ['first key wins', ['kind: " Lore "', 'Kind: feat'], ['Lore'], []],
  ];
  for (const [name, yaml, bodies, expected] of cases) {
    it(`US-038 AC-4: ${name}`, async () => {
      const {typ, warnings} = await runDetails(
        details('###### Reed Weaving', yaml),
      );
      const calls = detailsCalls(typ);
      if (bodies.length === 0) expect(calls).toEqual([]);
      else {
        expect(calls).toHaveLength(1);
        expect(
          [...(calls[0] ?? '').matchAll(/body: \[([^\]]*)\]/g)].map(
            (m) => m[1],
          ),
        ).toEqual(bodies);
      }
      expect(detailWarnings(warnings)).toEqual(expected);
    });
  }
});
