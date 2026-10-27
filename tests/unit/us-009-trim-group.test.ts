// US-009 AC-14 — trimSize, trimWidth and trimHeight come from one layer
// together: a preset keeps its own size whatever the Defaults hold. Source of
// truth: docs/user-stories/US-009-page-setup.md.
import {describe, expect, it} from 'vitest';
import {resolvePageSetup} from '../../src/core/layout/page-setup';
import {resolveFields} from '../../src/core/presets/merge';
import type {PresetFields} from '../../src/core/presets';

const fields = (page: PresetFields['page']): PresetFields => ({page});

/** The width and height of the page without bleed, as the page rules see them. */
function trim(preset: PresetFields, defaults: PresetFields) {
  const page = resolveFields(preset, defaults).page;
  const r = resolvePageSetup({...page, bleed: 0, slug: 0});
  return r.ok ? [r.value.pageWidth, r.value.pageHeight] : r.errors[0]?.message;
}

describe('US-009 AC-14 the trim size is one group', () => {
  it('US-009 AC-14: a preset with trimSize A5 beats a custom size of the Defaults', () => {
    expect(
      trim(fields({trimSize: 'A5'}), fields({trimWidth: 160, trimHeight: 240})),
    ).toEqual([148, 210]);
  });

  it('US-009 AC-14: a preset with width and height beats the trimSize of the Defaults', () => {
    expect(
      trim(fields({trimWidth: 160, trimHeight: 240}), fields({trimSize: 'A4'})),
    ).toEqual([160, 240]);
  });

  it('US-009 AC-14: a preset that sets none of the three inherits the custom size of the Defaults', () => {
    expect(
      trim(fields({bleed: 3}), fields({trimWidth: 160, trimHeight: 240})),
    ).toEqual([160, 240]);
  });

  it('US-009 AC-14: a preset that sets none of the three inherits the name of the Defaults, else the built-in A5', () => {
    expect(trim(fields({bleed: 3}), fields({trimSize: 'A4'}))).toEqual([
      210, 297,
    ]);
    expect(trim(fields({bleed: 3}), fields({}))).toEqual([148, 210]);
  });

  it('US-009 AC-14: Defaults with a custom size replace the built-in name', () => {
    expect(trim(fields({}), fields({trimWidth: 160, trimHeight: 240}))).toEqual(
      [160, 240],
    );
  });

  it('US-009 AC-14: a preset with only trimWidth has no size, the trimSize of the Defaults is not filled in', () => {
    expect(trim(fields({trimWidth: 160}), fields({trimSize: 'A4'}))).toBe(
      'Trim size missing (set trimSize, or both trimWidth and trimHeight)',
    );
  });

  it('US-009 AC-14: does not change its arguments', () => {
    const preset = fields({trimSize: 'A5'});
    const defaults = fields({trimWidth: 160, trimHeight: 240});
    resolveFields(preset, defaults);
    expect(defaults.page).toEqual({trimWidth: 160, trimHeight: 240});
    expect(preset.page).toEqual({trimSize: 'A5'});
  });
});
