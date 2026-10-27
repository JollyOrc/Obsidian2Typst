// US-021 AC-1, AC-2 — the preset field `group:` and the one grouping of
// presets that every list uses: the field and its message, the Defaults
// ignoring it, the group of an invalid note read on its own, and the five
// grouping rules with the story's table (SCAR-019: unset, empty, blanks, one
// group, several, case, `Other`). The lists and the pop-up are tested in
// tests/plugin/us-021-groups-details.test.ts.
// Source of truth: docs/user-stories/US-021-preset-groups-and-details.md.
import {describe, expect, it} from 'vitest';
import {
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import * as presets from '../../src/core/presets';

/** US-021: a preset as the grouping sees it. */
interface Item {
  name: string;
  group: string | null;
}
interface Group {
  heading: string | null;
  entries: Item[];
}
type GroupPresets = (entries: readonly Item[]) => Group[];
type ReadGroup = (text: string) => string | null;

/** Reads an export the code does not have yet (red until the code). */
const fn = <T>(name: string): T =>
  (presets as unknown as Record<string, T>)[name] as T;

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const groupOf = (...lines: string[]): unknown => {
  const result = parsePreset(note(...lines));
  return result.ok
    ? (result.fields as unknown as Record<string, unknown>)['group']
    : 'invalid';
};

describe('US-021 AC-1 the field', () => {
  it('US-021 AC-1: reads group as text with its line, blanks at the ends removed', () => {
    const result = parsePreset(note('group: "  Print  "'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.fields as unknown as Record<string, unknown>)['group']).toBe(
      'Print',
    );
    expect(result.lines['group']).toBe(3);
  });

  it('US-021 AC-1: a non-text value is refused with its message and line', () => {
    expect(errorOf('group: 5')).toBe('group must be text (line 3)');
    expect(errorOf('group: [a]')).toBe('group must be text (line 3)');
  });

  it('US-021 AC-1: null, "" and blanks are no group, without a message', () => {
    expect(groupOf('group: null')).toBeUndefined();
    expect(groupOf('group: ""')).toBeUndefined();
    expect(groupOf('group: "   "')).toBeUndefined();
  });

  it('US-021 AC-1: the Defaults ignore group (preset notes only)', () => {
    const result = validateFields({group: 'Print'});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).not.toHaveProperty('group');
  });
});

describe('US-021 AC-2 the group of an invalid note (decision 5)', () => {
  it('US-021 AC-2: an invalid note that is still YAML keeps its group', () => {
    const readGroup = fn<ReadGroup>('readGroup');
    expect(typeof readGroup).toBe('function');
    const broken = note('group: Print', 'page:', '  bleed: abc');
    expect(parsePreset(broken).ok).toBe(false);
    expect(readGroup(broken)).toBe('Print');
  });

  it('US-021 AC-2: frontmatter that is not YAML, an unclosed one, or a non-text group give no group', () => {
    const readGroup = fn<ReadGroup>('readGroup');
    expect(
      readGroup(
        '---\nschemaVersion: 1\ngroup: Print\npage:\n\tbleed: 2\n---\n',
      ),
    ).toBeNull();
    expect(readGroup('---\nschemaVersion: 1\ngroup: Print\n')).toBeNull();
    expect(readGroup(note('group: 5', 'page:', '  bleed: abc'))).toBeNull();
  });
});

describe('US-021 AC-2 one grouping for every list', () => {
  const items = (...pairs: [string, string | null][]): Item[] =>
    pairs.map(([name, group]) => ({name, group}));
  const shape = (groups: Group[]) =>
    groups.map((g) => [g.heading, g.entries.map((e) => e.name)]);

  it('US-021 AC-2 rule 5: no preset has a group: one list without a heading (today)', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    expect(typeof groupPresets).toBe('function');
    expect(
      shape(
        groupPresets(
          items(['A4 digital', null], ['A5 print', null], ['Minimal', null]),
        ),
      ),
    ).toEqual([[null, ['A4 digital', 'A5 print', 'Minimal']]]);
  });

  it('US-021 AC-2 rules 1 to 4: case and blanks ignored, heading of the first preset, alphabetical, Other last', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    expect(
      shape(
        groupPresets(
          items(
            ['A4 digital', 'Screen'],
            ['A5 print', 'print'],
            ['Book', 'Print'],
            ['Minimal', null],
          ),
        ),
      ),
    ).toEqual([
      ['print', ['A5 print', 'Book']],
      ['Screen', ['A4 digital']],
      ['Other', ['Minimal']],
    ]);
  });

  it('US-021 AC-2 rule 1: runs of blanks are one blank (Print run, Print  run)', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    expect(
      shape(
        groupPresets(
          items(['A', 'Print run'], ['B', 'Print  run '], ['C', null]),
        ),
      ),
    ).toEqual([
      ['Print run', ['A', 'B']],
      ['Other', ['C']],
    ]);
  });

  it('US-021 AC-2 rule 4: a group named other (any case) or empty joins the ungrouped', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    expect(
      shape(
        groupPresets(
          items(['A5 print', 'Print'], ['Draft', 'other'], ['Minimal', '']),
        ),
      ),
    ).toEqual([
      ['Print', ['A5 print']],
      ['Other', ['Draft', 'Minimal']],
    ]);
  });

  it('US-021 AC-2: a group of one; one group for all (no Other); every preset Other means no headings', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    expect(shape(groupPresets(items(['Solo', 'Print'])))).toEqual([
      ['Print', ['Solo']],
    ]);
    expect(shape(groupPresets(items(['A', 'Print'], ['B', 'print'])))).toEqual([
      ['Print', ['A', 'B']],
    ]);
    expect(shape(groupPresets(items(['A', 'Other'], ['B', 'OTHER'])))).toEqual([
      [null, ['A', 'B']],
    ]);
  });

  it('US-021 AC-2: the entries keep their own data (names in settings order inside a group)', () => {
    const groupPresets = fn<GroupPresets>('groupPresets');
    const entries = [
      {name: 'A', group: 'G', extra: 1},
      {name: 'B', group: 'g', extra: 2},
    ];
    const [group] = groupPresets(entries);
    expect(group?.entries).toEqual(entries);
  });
});
