// US-038 AC-5, AC-6 — the `details` group in preset notes: what is valid and
// the messages of invalid values, preset notes only, the merge into the
// effective settings, the rows of the settings details view, and the look
// (built-ins, grayscale, sizes).
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
} from '../../src/core/presets';
import {detailRows} from '../../src/plugin/settings/details';
import {detailsLookValues} from '../../src/core/emit/details';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');
const errorOf = (...lines: string[]): string | null => {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
};

const VALID = [
  'details:',
  '  color: "#7a4a2e"',
  '  size: 9.5',
  '  items:',
  '    - key: pace',
  '      icons: {slow: Icons/slow.svg, brisk: Icons/brisk.svg}',
  '      labels: {slow: Slow, brisk: Brisk}',
  '    - key: needs',
  '      icon: Icons/lock.svg',
  '    - key: starter',
  '      icon: Icons/sprout.svg',
  '      label: Known from the start',
];

describe('US-038 AC-5 the details group', () => {
  it('US-038 AC-5: a full group is valid and read as written', () => {
    const result = parsePreset(note(...VALID));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const d = (result.fields as Record<string, unknown>)['details'] as {
      color: string;
      size: number;
      items: {key: string; icons?: object; label?: string}[];
    };
    expect(d.color).toBe('#7a4a2e');
    expect(d.size).toBe(9.5);
    expect(d.items.map((i) => i.key)).toEqual(['pace', 'needs', 'starter']);
    expect(d.items[0]?.icons).toEqual({
      slow: 'Icons/slow.svg',
      brisk: 'Icons/brisk.svg',
    });
    expect(d.items[2]?.label).toBe('Known from the start');
  });

  it('US-038 AC-5: the messages of the story, each at its own line', () => {
    expect(errorOf('details: [a]')).toBe(
      'details must be a group of settings (line 3)',
    );
    expect(errorOf('details:', '  items: pace')).toBe(
      'details.items must be a list of items {key, icon, icons, label, labels} (line 4)',
    );
    expect(errorOf('details:', '  items:', '    - icon: a.svg')).toBe(
      'details.items[1].key must be a key (line 5)',
    );
    expect(
      errorOf(
        'details:',
        '  items:',
        '    - key: a',
        '    - key: b',
        '      labels: [x]',
      ),
    ).toBe('details.items[2].labels must be a map of value → text (line 7)');
    expect(
      errorOf('details:', '  items:', '    - key: a', '      icons: {x: 3}'),
    ).toBe('details.items[1].icons must be a map of value → path (line 6)');
    expect(
      errorOf('details:', '  items:', '    - key: a', '      icon: [x]'),
    ).toBe('details.items[1].icon must be text (line 6)');
    expect(
      errorOf('details:', '  items:', '    - key: Pace', '    - key: pace'),
    ).toBe('details.items[2].key "pace" is listed twice (line 6)');
    expect(errorOf('details:', '  color: red')).toBe(
      'details.color must be a colour written #rrggbb (line 4)',
    );
    expect(errorOf('details:', '  size: 0')).toBe(
      'details.size must be a number of pt greater than 0 and at most 200 (line 4)',
    );
  });

  it('US-038 AC-5: unknown fields are ignored and null is unset', () => {
    expect(
      errorOf(
        'details:',
        '  other: 1',
        '  color: null',
        '  items:',
        '    - key: a',
        '      extra: 2',
      ),
    ).toBeNull();
  });

  it('US-038 AC-5: the group exists in preset notes only (the Defaults ignore it)', () => {
    const result = parsePreset(note(...VALID));
    if (!result.ok) throw new Error('valid');
    const effective = effectiveSettings(
      {fields: result.fields, lines: result.lines},
      {details: {items: [{key: 'x'}]}} as never,
      () => false,
    );
    expect(effective.ok).toBe(true);
    if (!effective.ok) return;
    const settings = effective.settings as unknown as {
      details?: {items: {key: string}[]};
    };
    expect(settings.details?.items.map((i) => i.key)).toEqual([
      'pace',
      'needs',
      'starter',
    ]);
    const without = effectiveSettings(
      {fields: {}, lines: {}},
      {details: {items: [{key: 'x'}]}} as never,
      () => false,
    );
    if (!without.ok) throw new Error('valid');
    expect(Object.keys(without.settings)).not.toContain('details');
  });

  it('US-038 AC-5: a preset without the group keeps the effective settings it had', () => {
    const result = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    if (!result.ok) throw new Error('valid');
    expect('details' in result.settings).toBe(false);
  });

  it('US-038 AC-5: the details view lists items, color and size as preset rows, before colorMode', () => {
    const result = parsePreset(note(...VALID, 'colorMode: grayscale'));
    if (!result.ok) throw new Error('valid');
    const rows = detailRows(result.fields, {});
    const labels = rows.map((r) => r.label);
    expect(
      labels.filter((l) => l.startsWith('details.') || l === 'colorMode'),
    ).toEqual(['details.items', 'details.color', 'details.size', 'colorMode']);
    const items = rows.find((r) => r.label === 'details.items');
    expect(items?.source).toBe('preset');
    expect(items?.used).toContain('pace');
    expect(rows.find((r) => r.label === 'details.size')?.used).toBe('9.5');
    expect(
      detailRows({}, {})
        .map((r) => r.label)
        .some((l) => l.startsWith('details.')),
    ).toBe(false);
  });
});

describe('US-038 AC-6 the look', () => {
  it('US-038 AC-6: the built-ins are umber, 9.5 pt; a preset sets both', () => {
    expect(detailsLookValues(undefined, undefined)).toMatchObject({
      color: '#7a4a2e',
      size: 9.5,
    });
    expect(
      detailsLookValues({items: [], color: '#112233', size: 14}, 'color'),
    ).toMatchObject({
      color: '#112233',
      size: 14,
    });
  });

  it('US-038 AC-6: grayscale makes text and icons #4d4d4d whatever the colour says', () => {
    for (const color of [undefined, '#112233']) {
      expect(
        detailsLookValues(
          {items: [], ...(color === undefined ? {} : {color})},
          'grayscale',
        ),
      ).toMatchObject({color: '#4d4d4d'});
    }
  });

  it('US-038 AC-6: the sizes at both ends and in the middle are kept', () => {
    for (const size of [6, 9.5, 14, 200]) {
      expect(detailsLookValues({items: [], size}, undefined).size).toBe(size);
    }
  });
});
