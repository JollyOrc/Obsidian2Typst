// US-026 AC-9, AC-10 — the Book rows (dropdowns of US-025's row kind and a
// switch; the Defaults section and the style panel draw the same rows), the
// reset question with the value at the click (SCAR-016), a row the preset
// owns, and the preview that places the parts as the export does.
// Source of truth: docs/user-stories/US-026-book-parts-and-signatures.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
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

const ROWS = [
  {
    label: 'Pages per signature',
    path: ['book', 'signature'],
    kind: 'dropdown',
    options: ['0', '4', '8', '16', '32'],
  },
  {
    label: 'Roman folios in the front matter',
    path: ['book', 'romanFrontMatter'],
    kind: 'toggle',
  },
  {
    label: 'First chapter',
    path: ['book', 'firstChapter'],
    kind: 'dropdown',
    options: ['left', 'right'],
  },
  {
    label: 'Colophon heading',
    path: ['book', 'colophonHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
  {
    label: 'Back notes heading',
    path: ['book', 'backNotesHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
];

describe('US-026 AC-9 the Book rows', () => {
  it('US-026 AC-9: the five rows follow each other with their kinds and options', () => {
    const first = DEFAULT_ROWS.findIndex((r) => r.label === ROWS[0]?.label);
    expect(first).toBeGreaterThan(-1);
    expect(DEFAULT_ROWS.slice(first, first + ROWS.length)).toEqual(ROWS);
  });

  it('US-026 AC-9: each row is drawn with its control and the reset icon', async () => {
    const {row} = await rowsRig(null);
    for (const r of ROWS) {
      const drawn = row(r.label);
      expect(drawn.controls[0]?.kind, r.label).toBe(r.kind);
      if (r.kind === 'dropdown') {
        expect(drawn.controls[0]?.options, r.label).toEqual([
          '',
          ...(r.options ?? []),
        ]);
      }
      expect(
        drawn.buttons.map((b) => b.icon),
        r.label,
      ).toEqual(['reset']);
    }
  });

  it('US-026 AC-9: a signature chosen is saved as a number at once', async () => {
    const {row, settings} = await rowsRig(null);
    const change = row('Pages per signature').controls[0]?.changed as (
      value: string,
    ) => Promise<void>;
    await change('16');
    expect((settings.data.defaults as Record<string, unknown>)['book']).toEqual(
      {
        signature: 16,
      },
    );
  });

  it('US-026 AC-9: in the style panel a field the preset sets is not editable and names the preset', async () => {
    const {row} = await rowsRig({book: {signature: 8}});
    const signature = row('Pages per signature');
    expect(signature.controls[0]?.value).toBe('8');
    expect(signature.controls[0]?.disabled).toBe(true);
    expect(signature.desc).toBe(
      'Set by preset "Book"; change it in the preset note',
    );
    expect(row('First chapter').controls[0]?.disabled).toBe(false);
  });

  it('US-026 AC-9: the reset question names the value chosen after the row was drawn', async () => {
    const holder = {value: '4'};
    const confirm = vi.fn(async () => true);
    holder.value = '32';
    await resetDefaultField(
      {confirm, save: vi.fn(async () => true)},
      {label: 'Pages per signature', value: () => holder.value},
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          'The value "32" is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
      }),
    );
  });
});

describe('US-026 AC-10 the preview shows the same pages', () => {
  const SOURCE =
    '# Colophon\n\nPrinted.\n\n# Rules\n\nText.\n\n# Back notes\n\nNote.';

  it('US-026 AC-10: the preview source places the colophon before the body with the preset settings', async () => {
    const {deps} = await previewRig(
      presetNote('book:', '  signature: 8', '  romanFrontMatter: true'),
      SOURCE,
    );
    const prepared = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!prepared.ok) throw new Error('prepared');
    const source = prepared.request.source;
    expect(source.indexOf('Printed.')).toBeLessThan(source.indexOf('= Rules'));
    expect(source).toContain('#metadata(none) <h-colophon>');
    expect(source).toContain('numbering: "i"');
  });

  it('US-026 AC-10: an edit of the preset reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await previewRig(
      presetNote('book:', '  colophonHeading: hidden'),
      SOURCE,
    );
    const before = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    vault.edit(PRESET_PATH, presetNote('book:', '  colophonHeading: printed'));
    await presets.load();
    const after = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).not.toContain('= Colophon <h-colophon>');
    expect(after.request.source).toContain('= Colophon <h-colophon>');
  });
});
