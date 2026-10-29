// US-027 AC-7, AC-8 — the editor menu items that place the table of contents
// (US-022's machinery: the line read when the menu opens, a question first,
// one atomic change of the preset note), the Contents rows, and the preview.
// Source of truth: docs/user-stories/US-027-table-of-contents.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {lineContext} from '../../src/core/convert/line-context';
import {
  editPresetField,
  type PresetChange,
} from '../../src/core/presets/note-edit';
import type {PresetFields} from '../../src/core/presets';
import {presetEditEntries, type ActivePresetView} from '../../src/plugin/menus';
import {preparePreview} from '../../src/plugin/preview/request';
import {detailRows} from '../../src/plugin/settings/details';
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

const NOTE =
  '# Rules\n\nText.\n\n## Combat\n\nMore.\n\n# Colophon\n\nPrinted.\n\n> [!note]\n> # Boxed';
const BEFORE = 'Table of contents before this heading';
const AFTER = 'Table of contents after this heading';
const REMOVE = 'Remove table of contents placement';

const active = (
  fields: Record<string, unknown> | null,
  valid = true,
): ActivePresetView => ({
  name: 'Folios',
  valid,
  fields: (valid ? (fields ?? {}) : null) as PresetFields | null,
});

/** The entries for the 0-based line `line` of NOTE. */
function entriesAt(line: number, view: ActivePresetView) {
  const changePreset = vi.fn();
  const context = lineContext(NOTE, line, RIG_NOTE, [RIG_NOTE]);
  return {
    entries: presetEditEntries({changePreset}, context, view),
    changePreset,
  };
}

describe('US-027 AC-7 which lines offer the items', () => {
  it('US-027 AC-7: the line context names the heading level', () => {
    expect(lineContext(NOTE, 0, RIG_NOTE, [RIG_NOTE]).heading).toEqual({
      text: 'Rules',
      level: 1,
    });
    expect(lineContext(NOTE, 4, RIG_NOTE, [RIG_NOTE]).heading).toEqual({
      text: 'Combat',
      level: 2,
    });
  });

  it('US-027 AC-7: a top-level H1 offers before and after, after the glossary item', () => {
    const {entries} = entriesAt(0, active({toc: {depth: 2}}));
    expect(entries.map((e) => e.title)).toEqual([
      'Use as glossary section',
      BEFORE,
      AFTER,
    ]);
  });

  it('US-027 AC-7: an H2, a colophon heading and a callout heading offer no contents item', () => {
    for (const line of [4, 8, 13]) {
      const titles = entriesAt(line, active({toc: {depth: 2}})).entries.map(
        (e) => e.title,
      );
      expect(titles, `line ${line}`).not.toContain(BEFORE);
      expect(titles, `line ${line}`).not.toContain(AFTER);
    }
  });
});

describe('US-027 AC-7 the questions and the change (SCAR-013, SCAR-014)', () => {
  it('US-027 AC-7: before "Rules" asks first and writes heading and position', () => {
    const {entries, changePreset} = entriesAt(0, active({toc: {depth: 2}}));
    entries.find((e) => e.title === BEFORE)?.run?.();
    expect(changePreset).toHaveBeenCalledWith({
      preset: 'Folios',
      question:
        'Place the table of contents of preset "Folios" before "Rules"?',
      change: {kind: 'toc', heading: 'Rules', position: 'before'},
    });
  });

  it('US-027 AC-7: with the contents off the question also sets depth 2 (decision 3)', () => {
    for (const fields of [{}, {toc: {depth: 0}}]) {
      const {entries, changePreset} = entriesAt(0, active(fields));
      entries.find((e) => e.title === AFTER)?.run?.();
      expect(changePreset).toHaveBeenCalledWith({
        preset: 'Folios',
        question:
          'Place the table of contents of preset "Folios" after "Rules" and show headings down to level 2?',
        change: {kind: 'toc', heading: 'Rules', position: 'after', depth: 2},
      });
    }
  });

  it('US-027 AC-7 (decision 3, SCAR-019): the contents are off by the effective depth: Defaults depth 3 and a silent preset write no depth; a preset depth 0 over Defaults 3 writes depth 2', () => {
    const on = entriesAt(0, {
      ...active({}),
      defaults: {toc: {depth: 3}},
    } as ActivePresetView);
    on.entries.find((e) => e.title === BEFORE)?.run?.();
    expect(on.changePreset).toHaveBeenCalledWith({
      preset: 'Folios',
      question:
        'Place the table of contents of preset "Folios" before "Rules"?',
      change: {kind: 'toc', heading: 'Rules', position: 'before'},
    });
    const off = entriesAt(0, {
      ...active({toc: {depth: 0}}),
      defaults: {toc: {depth: 3}},
    } as ActivePresetView);
    off.entries.find((e) => e.title === BEFORE)?.run?.();
    expect(off.changePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        change: {kind: 'toc', heading: 'Rules', position: 'before', depth: 2},
      }),
    );
  });

  it('US-027 AC-7 (decision 6): a placed heading without a position is placed before: that item reads Remove', () => {
    const {entries} = entriesAt(0, active({toc: {depth: 2, heading: 'rules'}}));
    expect(entries.map((e) => e.title)).toEqual([
      'Use as glossary section',
      REMOVE,
      AFTER,
    ]);
  });

  it('US-027 AC-7: where the preset already places it, that item reads Remove and goes back to the default place', () => {
    const {entries, changePreset} = entriesAt(
      0,
      active({toc: {depth: 2, heading: 'Rules', position: 'before'}}),
    );
    expect(entries.map((e) => e.title)).toEqual([
      'Use as glossary section',
      REMOVE,
      AFTER,
    ]);
    entries.find((e) => e.title === REMOVE)?.run?.();
    expect(changePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        change: {kind: 'toc', heading: null, position: null},
      }),
    );
  });

  it('US-027 AC-7: no preset or an invalid one: disabled with the reason (US-022 AC-6)', () => {
    const none = presetEditEntries(
      {changePreset: vi.fn()},
      lineContext(NOTE, 0, RIG_NOTE, [RIG_NOTE]),
      {name: null, valid: false, fields: null},
    );
    expect(none.find((e) => e.title?.startsWith(BEFORE))).toMatchObject({
      title: `${BEFORE} (no preset)`,
      disabled: true,
    });
    const invalid = entriesAt(0, active(null, false)).entries;
    expect(invalid.find((e) => e.title?.startsWith(AFTER))).toMatchObject({
      title: `${AFTER} (preset "Folios" is invalid)`,
      disabled: true,
    });
  });

  it('US-027 AC-7: the change writes toc.heading and toc.position in one edit, every other byte kept (US-022 AC-7)', () => {
    const text =
      '---\nschemaVersion: 1\ntoc:\n  title: Inhalt\n---\n\nThe preset.\n';
    const result = editPresetField(text, {
      kind: 'toc',
      heading: 'Rules',
      position: 'before',
      depth: 2,
    } as unknown as PresetChange);
    expect(result).toEqual({
      ok: true,
      text: '---\nschemaVersion: 1\ntoc:\n  title: Inhalt\n  heading: Rules\n  position: before\n  depth: 2\n---\n\nThe preset.\n',
    });
  });

  it('US-027 AC-7: Remove deletes heading and position and keeps the rest of toc', () => {
    const text =
      '---\nschemaVersion: 1\ntoc:\n  depth: 3\n  heading: Rules\n  position: after\n---\n';
    const result = editPresetField(text, {
      kind: 'toc',
      heading: null,
      position: null,
    } as unknown as PresetChange);
    expect(result).toEqual({
      ok: true,
      text: '---\nschemaVersion: 1\ntoc:\n  depth: 3\n---\n',
    });
  });

  it('US-027 AC-7: Remove of a toc group that holds only the place removes the group (as an empty headingRules map, US-022)', () => {
    const text =
      '---\nschemaVersion: 1\ntoc:\n  heading: Rules\n  position: after\n---\n\nBody.\n';
    expect(
      editPresetField(text, {
        kind: 'toc',
        heading: null,
        position: null,
      } as unknown as PresetChange),
    ).toEqual({ok: true, text: '---\nschemaVersion: 1\n---\n\nBody.\n'});
  });
});

describe('US-027 AC-8 the Contents rows', () => {
  const ROWS = [
    {
      label: 'Contents depth',
      path: ['toc', 'depth'],
      kind: 'dropdown',
      options: ['0', '1', '2', '3', '4', '5', '6'],
    },
    {label: 'Contents title', path: ['toc', 'title'], kind: 'text'},
    {
      label: 'Contents page numbers',
      path: ['toc', 'pageNumbers'],
      kind: 'toggle',
    },
    {
      label: 'Contents dot leaders',
      path: ['toc', 'dotLeaders'],
      kind: 'toggle',
    },
  ];

  it('US-027 AC-8: the four rows follow each other with their kinds', () => {
    const first = DEFAULT_ROWS.findIndex((r) => r.label === 'Contents depth');
    expect(first).toBeGreaterThan(-1);
    expect(DEFAULT_ROWS.slice(first, first + 4)).toEqual(ROWS);
  });

  it('US-027 AC-8: drawn with the reset icon; a preset value is shown and not editable', async () => {
    const {row} = await rowsRig({toc: {depth: 3}});
    expect(row('Contents depth').controls[0]?.value).toBe('3');
    expect(row('Contents depth').controls[0]?.disabled).toBe(true);
    expect(row('Contents title').buttons.map((b) => b.icon)).toEqual(['reset']);
  });
});

describe('US-027 AC-8 the details pop-up (US-021)', () => {
  const CONTENTS = [
    'Contents depth',
    'Contents title',
    'Contents page numbers',
    'Contents dot leaders',
  ];

  it('US-027 AC-8: lists the four Contents rows and ends with the summary Contents place', () => {
    const labels = detailRows({}, {}).map((r) => r.label);
    const first = labels.indexOf('Contents depth');
    expect(first).toBeGreaterThan(-1);
    expect(labels.slice(first, first + 4)).toEqual(CONTENTS);
    expect(labels.slice(-4)).toEqual([
      'Cover',
      'Callout styles',
      'Heading rules',
      'Contents place',
    ]);
  });

  it('US-027 AC-8: Contents place reads the side and heading of the preset, else default', () => {
    const place = (fields: unknown) =>
      detailRows(fields, {}).find((r) => r.label === 'Contents place');
    expect(
      place({toc: {depth: 2, heading: 'Rules', position: 'before'}}),
    ).toEqual({
      label: 'Contents place',
      own: 'before "Rules"',
      used: 'before "Rules"',
      source: 'preset',
    });
    expect(place({toc: {heading: 'Lore', position: 'after'}})).toMatchObject({
      used: 'after "Lore"',
      source: 'preset',
    });
    for (const fields of [{}, {toc: {depth: 2}}]) {
      expect(place(fields)).toEqual({
        label: 'Contents place',
        own: '',
        used: 'default',
        source: 'built-in',
      });
    }
  });
});

describe('US-027 AC-7, AC-8 the preview reads the preset', () => {
  it('US-027: the preview source holds the contents of the preset, and an edit reaches the next request', async () => {
    const {vault, presets, deps} = await previewRig(
      presetNote('toc:', '  depth: 2'),
      '# Rules\n\nText.\n\n# Lore\n\nMore.',
    );
    const before = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    vault.edit(PRESET_PATH, presetNote('toc:', '  depth: 3'));
    await presets.load();
    const after = await preparePreview(deps, RIG_NOTE, NO_DOWNSAMPLE);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain('#outline(title: none, depth: 2)');
    expect(after.request.source).toContain('#outline(title: none, depth: 3)');
  });
});
