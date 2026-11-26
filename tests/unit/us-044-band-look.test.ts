// US-044 AC-1, AC-5, AC-8 — the two band keys of `entries.statblock`: read and
// checked like `boxFill`, shown as Details rows, no built-in value (SCAR-037),
// and the look they give in colour and in greyscale (SCAR-019). Without
// `bandFill` the look's Typst text is the 0.17.0 text (pinned at G2 from 0.17.0).
// Source of truth: docs/user-stories/US-044-filled-statblock-band.md.
// Red until US-044 is implemented (G2, 2026-11-26).
import {describe, expect, it} from 'vitest';
import {statblockLook, statblockLookValues} from '../../src/core/emit/entry';
import {STATBLOCK_BUILTINS} from '../../src/core/markers';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {detailRows} from '../../src/plugin/settings/details';
import {ENTRIES} from '../support/entries';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}
const band = (...keys: string[]) => ['entries:', '  statblock:', ...keys];

/** The look values with the band keys (the names the story's AC-1 gives). */
type BandLook = ReturnType<typeof statblockLookValues> & {
  bandFill?: string;
  bandColor?: string;
};
const withBand = (bandFill?: string, bandColor?: string) => ({
  ...ENTRIES,
  statblock: {
    ...ENTRIES.statblock,
    ...(bandFill === undefined ? {} : {bandFill}),
    ...(bandColor === undefined ? {} : {bandColor}),
  },
});

describe('US-044 AC-1 the two keys are read and checked like boxFill', () => {
  it('US-044 AC-1: bandFill and bandColor are read', () => {
    const result = parsePreset(
      note(...band('    bandFill: "#8A4A2A"', '    bandColor: "#F3EEE3"')),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const sb = (
      result.fields as {entries: {statblock: Record<string, unknown>}}
    ).entries.statblock;
    expect(sb['bandFill']).toBe('#8A4A2A');
    expect(sb['bandColor']).toBe('#F3EEE3');
  });

  it('US-044 AC-1: bandFill takes "none"; bandColor does not', () => {
    expect(errorOf(...band('    bandFill: none'))).toBeNull();
    expect(errorOf(...band('    bandColor: none'))).toBe(
      'entries.statblock.bandColor must be a colour "#rrggbb" (line 5)',
    );
  });

  it('US-044 AC-1 (SCAR-019): a bad value gives the message a bad boxFill gives', () => {
    for (const bad of ['umber', '"#12345"', '"#12345g"', '3']) {
      expect(errorOf(...band(`    boxFill: ${bad}`)), `boxFill ${bad}`).toBe(
        'entries.statblock.boxFill must be a colour "#rrggbb" or "none" (line 5)',
      );
      expect(errorOf(...band(`    bandFill: ${bad}`)), `bandFill ${bad}`).toBe(
        'entries.statblock.bandFill must be a colour "#rrggbb" or "none" (line 5)',
      );
      expect(
        errorOf(...band(`    bandColor: ${bad}`)),
        `bandColor ${bad}`,
      ).toBe('entries.statblock.bandColor must be a colour "#rrggbb" (line 5)');
    }
  });

  it('US-044 AC-1: both are Details rows, after boxFill, with their values', () => {
    const result = parsePreset(
      note(
        ...band(
          '    boxFill: "#fefcf0"',
          '    bandFill: "#8A4A2A"',
          '    bandColor: "#F3EEE3"',
        ),
      ),
    );
    if (!result.ok) throw new Error('preset must be valid');
    const rows = detailRows(result.fields, {});
    const labels = rows.map((r) => r.label);
    const at = labels.indexOf('entries.statblock.boxFill');
    expect(labels.slice(at, at + 3)).toEqual([
      'entries.statblock.boxFill',
      'entries.statblock.bandFill',
      'entries.statblock.bandColor',
    ]);
    const row = (l: string) => rows.find((r) => r.label === l);
    expect(row('entries.statblock.bandFill')?.source).toBe('preset');
    expect(row('entries.statblock.bandFill')?.used).toContain('#8A4A2A');
    expect(row('entries.statblock.bandColor')?.used).toContain('#F3EEE3');
  });

  it('US-044 AC-1 (SCAR-037): neither key has a built-in value', () => {
    expect(Object.keys(STATBLOCK_BUILTINS)).not.toContain('bandFill');
    expect(Object.keys(STATBLOCK_BUILTINS)).not.toContain('bandColor');
  });
});

describe('US-044 AC-1, AC-5 the look values', () => {
  const cases: [
    string,
    string | undefined,
    string | undefined,
    string | undefined,
    BandLook['bandFill'],
    BandLook['bandColor'],
  ][] = [
    // name, bandFill, bandColor, colorMode, expected fill, expected text colour
    ['colour, filled', '#8A4A2A', '#F3EEE3', undefined, '#8A4A2A', '#F3EEE3'],
    [
      'colour, filled, no bandColor: the accent',
      '#8A4A2A',
      undefined,
      undefined,
      '#8A4A2A',
      '#7a4a2e',
    ],
    ['colour, none', 'none', '#F3EEE3', undefined, 'none', undefined],
    ['colour, unset', undefined, '#F3EEE3', undefined, 'none', undefined],
    [
      'greyscale, filled',
      '#8A4A2A',
      '#F3EEE3',
      'grayscale',
      '#4d4d4d',
      '#ffffff',
    ],
    ['greyscale, none', 'none', undefined, 'grayscale', 'none', undefined],
    ['greyscale, unset', undefined, undefined, 'grayscale', 'none', undefined],
  ];
  for (const [name, fill, color, mode, wantFill, wantColor] of cases) {
    it(`US-044 AC-1, AC-5: ${name}`, () => {
      const settings = {
        ...withBand(fill, color),
        statblock: {
          ...withBand(fill, color).statblock,
          frame: {color: '#7a4a2e', width: 0.75},
        },
      };
      const v = statblockLookValues(
        settings as never,
        mode as never,
      ) as BandLook;
      expect(v.bandFill).toBe(wantFill);
      if (wantColor === undefined) expect(v.bandColor).toBeUndefined();
      else expect(v.bandColor?.toLowerCase()).toBe(wantColor.toLowerCase());
    });
  }
});

describe('US-044 AC-8 without bandFill the look is the 0.17.0 look', () => {
  // Pinned at G2 (2026-11-26) from 0.17.0's `statblockLook` for these inputs.
  it('US-044 AC-8: colour and greyscale, unset and "none", byte for byte', () => {
    for (const mode of [undefined, 'grayscale'] as const) {
      const pinned = mode === undefined ? LOOK_0_17_0 : LOOK_GRAY_0_17_0;
      expect(statblockLook(ENTRIES as never, mode), String(mode)).toBe(pinned);
      expect(
        statblockLook(withBand('none', '#F3EEE3') as never, mode),
        `${String(mode)}, none`,
      ).toBe(pinned);
    }
  });

  it('US-044 AC-1: with bandFill the Typst look carries the two colours', () => {
    const look = statblockLook(
      withBand('#8A4A2A', '#F3EEE3') as never,
      undefined,
    );
    expect(look).toMatch(/band-fill: rgb\("#8a4a2a"\)/i);
    expect(look).toMatch(/band-color: rgb\("#f3eee3"\)/i);
    const gray = statblockLook(
      withBand('#8A4A2A', '#F3EEE3') as never,
      'grayscale',
    );
    expect(gray).toMatch(/band-fill: rgb\("#4d4d4d"\)/i);
    expect(gray).toMatch(/band-color: rgb\("#ffffff"\)/i);
  });
});

const LOOK_0_17_0 =
  '(fill: none, frame: (color: rgb("#000000"), width: 0.75pt), rules: (color: rgb("#000000"), width: 0.4pt), box-fill: rgb("#ffffff"), accent: rgb("#000000"), icon: "#000000", fonts: (:), sizes: (band: 11.5pt, value: 11pt, label: 5.5pt, text: 7pt, attacks: 7.5pt, skills: 9pt), narrow: (spacing: (min: 80%, max: 150%), tracking: (min: -0.01em, max: 0.03em)))';
const LOOK_GRAY_0_17_0 =
  '(fill: none, frame: (color: rgb("#4d4d4d"), width: 0.75pt), rules: (color: rgb("#4d4d4d"), width: 0.4pt), box-fill: rgb("#ffffff"), accent: rgb("#4d4d4d"), icon: "#4d4d4d", fonts: (:), sizes: (band: 11.5pt, value: 11pt, label: 5.5pt, text: 7pt, attacks: 7.5pt, skills: 9pt), narrow: (spacing: (min: 80%, max: 150%), tracking: (min: -0.01em, max: 0.03em)))';
