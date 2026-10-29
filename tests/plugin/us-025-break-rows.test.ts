// US-025 AC-7, AC-10 — the dropdown row kind and the six break rows (the
// Defaults section and the style panel draw the same rows), the reset question
// with the value at the click (SCAR-016), a row the preset owns, and the
// preview that carries the breaks of the export. The rows drawn in Obsidian:
// manual check at G4.
// Source of truth: docs/user-stories/US-025-page-breaks-by-heading.md.
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

const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const OPTIONS = ['none', 'page', 'right', 'left'];

describe('US-025 AC-7 the six rows', () => {
  it('US-025 AC-7: Break before H1 to H6 follow each other, dropdowns over page.breakBefore.hN', () => {
    const labels = DEFAULT_ROWS.map((r) => r.label);
    const first = labels.indexOf('Break before H1');
    expect(first).toBeGreaterThan(-1);
    expect(DEFAULT_ROWS.slice(first, first + 6)).toEqual(
      LEVELS.map((n) => ({
        label: `Break before H${n}`,
        path: ['page', 'breakBefore', `h${n}`],
        kind: 'dropdown',
        options: OPTIONS,
      })),
    );
  });

  it('US-025 AC-7: a drawn row is a dropdown with — (not set) and the four values', async () => {
    const {row} = await rowsRig(null);
    const control = row('Break before H1').controls[0];
    expect(control?.kind).toBe('dropdown');
    expect(control?.options).toEqual(['', ...OPTIONS]);
    expect(control?.value).toBe('');
    expect(row('Break before H1').buttons.map((b) => b.icon)).toEqual([
      'reset',
    ]);
  });

  it('US-025 AC-7: a choice is saved to the Defaults at once; — removes the value', async () => {
    const {row, settings} = await rowsRig(null);
    const change = row('Break before H2').controls[0]?.changed as (
      value: string,
    ) => Promise<void>;
    await change('right');
    expect(settings.data.defaults.page).toEqual({breakBefore: {h2: 'right'}});
    await change('');
    expect(settings.data.defaults.page ?? {}).not.toHaveProperty([
      'breakBefore',
      'h2',
    ]);
  });

  it('US-025 AC-7: in the style panel a row the preset sets is not editable and names the preset', async () => {
    const {row} = await rowsRig({page: {breakBefore: {h1: 'right'}}});
    const h1 = row('Break before H1');
    expect(h1.controls[0]?.value).toBe('right');
    expect(h1.controls[0]?.disabled).toBe(true);
    expect(h1.desc).toBe('Set by preset "Book"; change it in the preset note');
    expect(h1.buttons).toHaveLength(0);
    // guard: a level the preset does not set stays editable
    expect(row('Break before H2').controls[0]?.disabled).toBe(false);
  });

  it('US-025 AC-7: the reset question names the value chosen after the row was drawn (draw, change, use)', async () => {
    const holder = {value: 'page'};
    const confirm = vi.fn(async () => true);
    const save = vi.fn(async () => true);
    holder.value = 'right';
    await resetDefaultField(
      {confirm, save},
      {label: 'Break before H1', value: () => holder.value},
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          'The value "right" is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
      }),
    );
  });

  it('US-025 AC-7: a refused Defaults value gets the AC-1 message without a line', () => {
    expect(validateFields({page: {breakBefore: {h3: 'odd'}}})).toEqual({
      ok: false,
      error: {
        message: 'page.breakBefore.h3 must be none, page, right or left',
        line: null,
      },
    });
  });
});

describe('US-025 AC-10 the preview is the export', () => {
  const SOURCE = '# One\n\nText.\n\n# Two\n\nText.';

  it('US-025 AC-10: the preview source holds the breaks of the preset', async () => {
    const {deps} = await previewRig(
      presetNote('page:', '  breakBefore:', '    h1: right'),
      SOURCE,
    );
    const prepared = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.request.source).toContain(
      '#metadata(none) <o2t-break-before>\n#pagebreak(to: "odd", weak: true)\n#metadata(none) <o2t-break-after>\n= Two <h-two>',
    );
  });

  it('US-025 AC-10: an edit of the rule reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await previewRig(
      presetNote('page:', '  breakBefore:', '    h1: right'),
      SOURCE,
    );
    const before = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    vault.edit(
      PRESET_PATH,
      presetNote('page:', '  breakBefore:', '    h1: left'),
    );
    await presets.load();
    const after = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain('to: "odd"');
    expect(after.request.source).toContain('to: "even"');
    expect(after.request.source).not.toContain('to: "odd"');
  });
});
