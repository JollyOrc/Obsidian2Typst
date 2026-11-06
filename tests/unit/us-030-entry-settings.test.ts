// US-030 AC-8, AC-9 — the `entries` group in preset notes: built-in values,
// messages for invalid values, and the rows of the Details view.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until US-030 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {detailRows} from '../../src/plugin/settings/details';

/** A preset note: `schemaVersion: 1` on line 2, `lines` from line 3. */
const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** The first error of a preset note, formatted; null when it is valid. */
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const VALID = [
  'entries:',
  '  statblock:',
  '    stats: [{key: might, label: Might}, {key: wits, label: Wits}]',
  '    traits: [{key: move, label: Move}]',
  '    boxes: vigour',
  '    track: [{label: Fine, icon: Icons/fine.svg}, {label: Gone, icon: Icons/gone.svg}]',
  '    trackKey: states',
  '    trackLabel: STATE',
  '    trackDefault: [Fine, Gone]',
  '    sum: {total: vigour, of: [might, wits]}',
  '    fill: "#fbe2c5"',
  '    frame: {color: "#7a4a2e", width: 0.75}',
  '    rules: {color: "#7a4a2e", width: 0.4}',
  '    boxFill: "#fefcf0"',
  '  tagLabels: {beast: Beast}',
  'colorMode: grayscale',
];

describe('US-030 AC-8 the entries group', () => {
  it('US-030 AC-8: a full entries group is valid and read', () => {
    const result = parsePreset(note(...VALID));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const fields = result.fields as Record<string, unknown>;
    expect(fields['colorMode']).toBe('grayscale');
    const entries = fields['entries'] as {statblock: Record<string, unknown>};
    expect(entries.statblock['boxes']).toBe('vigour');
    expect(entries.statblock['trackDefault']).toEqual(['Fine', 'Gone']);
  });

  it('US-030 AC-8: the messages of the story', () => {
    expect(errorOf('entries:', '  statblock:', '    boxes: [vigour]')).toBe(
      'entries.statblock.boxes must be a key (line 5)',
    );
    expect(
      errorOf(
        'entries:',
        '  statblock:',
        '    track: [{label: Fine, icon: a.svg}]',
        '    trackDefault: [Fine, Lost]',
      ),
    ).toBe(
      'entries.statblock.trackDefault names "Lost", which is not in entries.statblock.track (line 6)',
    );
    expect(errorOf('entries:', '  statblock:', '    frame: {width: 9}')).toBe(
      'entries.statblock.frame.width must be a number of pt from 0 to 5 (line 5)',
    );
  });

  it('US-030 AC-8 (SCAR-019): frame.width at both ends of its range is valid; just outside is not', () => {
    for (const width of [0, 5]) {
      expect(
        errorOf('entries:', '  statblock:', `    frame: {width: ${width}}`),
        String(width),
      ).toBeNull();
    }
    for (const width of [-0.1, 5.1]) {
      expect(
        errorOf('entries:', '  statblock:', `    frame: {width: ${width}}`),
        String(width),
      ).not.toBeNull();
    }
  });

  it('US-030 AC-8: colorMode takes color or grayscale only', () => {
    expect(errorOf('colorMode: color')).toBeNull();
    expect(errorOf('colorMode: sepia')).toBe(
      'colorMode must be color or grayscale (line 3)',
    );
  });

  it('US-030 AC-8: null is unset', () => {
    expect(errorOf('entries:', '  statblock:', '    boxes: null')).toBeNull();
  });
});

describe('US-030 AC-9 the Details view', () => {
  it('US-030 AC-9: every entries field the preset sets is a row with its source, in the table order', () => {
    const result = parsePreset(note(...VALID));
    if (!result.ok) throw new Error('preset must be valid');
    const labels = detailRows(result.fields, {}).map((r) => r.label);
    const want = [
      'entries.statblock.stats',
      'entries.statblock.traits',
      'entries.statblock.boxes',
      'entries.statblock.track',
      'entries.statblock.trackKey',
      'entries.statblock.trackLabel',
      'entries.statblock.trackDefault',
      'entries.statblock.sum',
      'entries.statblock.fill',
      'entries.statblock.frame',
      'entries.statblock.rules',
      'entries.statblock.boxFill',
      'entries.tagLabels',
      'colorMode',
    ];
    expect(labels.filter((l) => want.includes(l))).toEqual(want);
    const rows = detailRows(result.fields, {});
    expect(
      rows.find((r) => r.label === 'entries.statblock.boxes')?.source,
    ).toBe('preset');
  });

  it('US-030 AC-9: a preset without entries lists no entries rows', () => {
    const labels = detailRows({}, {}).map((r) => r.label);
    expect(labels.filter((l) => l.startsWith('entries.'))).toEqual([]);
  });
});
