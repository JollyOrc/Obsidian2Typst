// US-028 AC-5, AC-9 — the Images row (a number row in a new group; the
// Defaults section and the style panel draw the same rows), a row the preset
// owns, the reset question with the value at the click (SCAR-016), and the
// preview that writes the helper with the preset's limit.
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {validateFields} from '../../src/core/presets';
import {preparePreview} from '../../src/plugin/preview/request';
import {resetDefaultField} from '../../src/plugin/settings/dialog';
import {DEFAULT_ROWS} from '../../src/plugin/settings/rows';
import {
  NO_DOWNSAMPLE,
  PRESET_PATH,
  RIG_NOTE,
  presetNote,
  previewRig,
  rowsRig,
} from '../support/book-rig';
import {resetFake} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

beforeEach(() => resetFake());

describe('US-028 AC-9 the Images row (decision 4)', () => {
  it('US-028 AC-9: Smallest image size is a number row over images.minScale with its hint', () => {
    expect(DEFAULT_ROWS.find((r) => r.label === 'Smallest image size')).toEqual(
      {
        label: 'Smallest image size',
        path: ['images', 'minScale'],
        kind: 'number',
        hint: '%, 10 to 100',
      },
    );
  });

  it('US-028 AC-9: a typed value is saved; a refused one keeps the old with the AC-1 message', async () => {
    const {row, settings} = await rowsRig(null);
    const control = row('Smallest image size').controls[0];
    control?.type('70');
    await Promise.resolve();
    expect(
      (settings.data.defaults as Record<string, unknown>)['images'],
    ).toEqual({
      minScale: 70,
    });
    expect(validateFields({images: {minScale: 5}})).toEqual({
      ok: false,
      error: {
        message: 'images.minScale must be a whole number from 10 to 100',
        line: null,
      },
    });
  });

  it('US-028 AC-9: in the style panel a preset value is shown, not editable, and names the preset', async () => {
    const {row} = await rowsRig({images: {minScale: 60}});
    const drawn = row('Smallest image size');
    expect(drawn.controls[0]?.value).toBe('60');
    expect(drawn.controls[0]?.disabled).toBe(true);
    expect(drawn.desc).toBe(
      'Set by preset "Book"; change it in the preset note',
    );
  });

  it('US-028 AC-9: the reset question names the value typed after the row was drawn', async () => {
    const holder = {value: 80};
    const confirm = vi.fn(async () => true);
    holder.value = 60;
    await resetDefaultField(
      {confirm, save: vi.fn(async () => true)},
      {label: 'Smallest image size', value: () => holder.value},
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          'The value "60" is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
      }),
    );
  });
});

describe('US-028 AC-9 the preview reads the preset', () => {
  it('US-028 AC-9: the preview source writes the helper with min 0.7; an edit to 100 removes it (draw, change, use)', async () => {
    const {vault, presets, deps} = await previewRig(
      presetNote('images:', '  minScale: 70'),
      'Text.\n\n![[map.png]]\n\nMore.',
    );
    // the image must be in the vault, or it is a missing image without the
    // call (AC-2; the user's answer of 2026-10-29)
    deps.vault.files = () => [RIG_NOTE, 'Sample/map.png'];
    const before = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    vault.edit(PRESET_PATH, presetNote('images:', '  minScale: 100'));
    await presets.load();
    const after = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain('min: 0.7');
    expect(after.request.source).not.toContain('fit-flow');
  });
});
