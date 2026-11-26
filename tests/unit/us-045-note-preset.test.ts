// US-045 AC-1, AC-6, AC-7 — the note's `typst-preset` key: how it is read,
// how the menu's chooser lists the presets, and how a choice is written into
// the note (only that key; the rest of the file kept). Pure core functions.
// Names are invented (SCAR-035). Source of truth:
// docs/user-stories/US-045-note-preset.md.
// Red until US-045 is implemented (G2, 2026-11-26).
import {describe, expect, it} from 'vitest';

// The modules this story adds (their names fixed here, G2).
const NOTE_PRESET = '../../src/core/presets/note-preset';
const NOTE_EDIT = '../../src/core/presets/note-edit';

type Read =
  | {kind: 'none'}
  | {kind: 'name'; name: string}
  | {kind: 'bad'; message: string};
interface NotePresetModule {
  /** AC-1: the key of a note's frontmatter (the YAML between the `---` lines, or null). */
  readNotePreset(frontmatter: string | null): Read;
  /** AC-6: the chooser's lines: first the active preset (value null), then the valid presets in order. */
  notePresetChoices(
    presets: readonly {name: string; valid: boolean}[],
    current: string | null,
  ): {label: string; value: string | null; current: boolean}[];
}
interface NoteEditModule {
  /** AC-7: sets (`value` a name) or removes (`null`) one top-level key of a note. */
  editNoteProperty(
    text: string,
    key: string,
    value: string | null,
  ): {ok: true; text: string} | {ok: false; error: string};
}
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;

describe('US-045 AC-1 reading the key', () => {
  const cases: [string, string | null, Read][] = [
    ['no frontmatter', null, {kind: 'none'}],
    ['no key', 'tags: [x]', {kind: 'none'}],
    [
      'a name',
      'typst-preset: A4 Encounter Sheets',
      {kind: 'name', name: 'A4 Encounter Sheets'},
    ],
    [
      'trimmed',
      'typst-preset: "  A5 print  "',
      {kind: 'name', name: 'A5 print'},
    ],
    ['empty is no key', 'typst-preset: ""', {kind: 'none'}],
    ['null is no key', 'typst-preset:', {kind: 'none'}],
    [
      'a list is refused',
      'typst-preset: [A5 print]',
      {kind: 'bad', message: 'the property typst-preset must be a preset name'},
    ],
    [
      'a number is refused',
      'typst-preset: 5',
      {kind: 'bad', message: 'the property typst-preset must be a preset name'},
    ],
    [
      'among other keys',
      'tags: [x]\ntypst-preset: Reed Sheets\naliases: []',
      {kind: 'name', name: 'Reed Sheets'},
    ],
  ];
  for (const [what, yaml, want] of cases) {
    it(`US-045 AC-1 (SCAR-019): ${what}`, async () => {
      const {readNotePreset} = await load<NotePresetModule>(NOTE_PRESET);
      expect(readNotePreset(yaml)).toEqual(want);
    });
  }
  it('US-045 AC-1: a frontmatter that is not YAML is no key (the export goes on with the active preset)', async () => {
    const {readNotePreset} = await load<NotePresetModule>(NOTE_PRESET);
    expect(readNotePreset('typst-preset: [unclosed')).toEqual({kind: 'none'});
  });
});

describe('US-045 AC-6 the chooser', () => {
  const presets = [
    {name: 'A4 digital', valid: true},
    {name: 'A5 print', valid: true},
    {name: 'Broken', valid: false},
    {name: 'Reed Sheets', valid: true},
  ];
  it('US-045 AC-6: the active preset first, then the valid presets in order; invalid ones left out', async () => {
    const {notePresetChoices} = await load<NotePresetModule>(NOTE_PRESET);
    expect(
      notePresetChoices(presets, null).map((c) => [c.label, c.value]),
    ).toEqual([
      ['Active preset (no property)', null],
      ['A4 digital', 'A4 digital'],
      ['A5 print', 'A5 print'],
      ['Reed Sheets', 'Reed Sheets'],
    ]);
  });
  it('US-045 AC-6 (SCAR-016): the current choice is marked, compared as names are (case ignored)', async () => {
    const {notePresetChoices} = await load<NotePresetModule>(NOTE_PRESET);
    const marked = (current: string | null) =>
      notePresetChoices(presets, current)
        .filter((c) => c.current)
        .map((c) => c.label);
    expect(marked(null)).toEqual(['Active preset (no property)']);
    expect(marked('reed sheets')).toEqual(['Reed Sheets']);
    // a key naming no listed preset marks nothing
    expect(marked('Gone')).toEqual([]);
  });
});

describe('US-045 AC-7 the write', () => {
  const cases: [string, string, string | null, string][] = [
    [
      'added after the other keys',
      '---\ntags: [x]\n---\nText',
      'A4 Encounter Sheets',
      '---\ntags: [x]\ntypst-preset: A4 Encounter Sheets\n---\nText',
    ],
    [
      'a note without frontmatter gets one',
      'Text\n',
      'A5 print',
      '---\ntypst-preset: A5 print\n---\nText\n',
    ],
    [
      'replaced in place, order kept',
      '---\ntypst-preset: A5 print\ntags: [x]\n---\nText',
      'Reed Sheets',
      '---\ntypst-preset: Reed Sheets\ntags: [x]\n---\nText',
    ],
    [
      'removed; the other keys stay',
      '---\ntags: [x]\ntypst-preset: A5 print\n---\nText',
      null,
      '---\ntags: [x]\n---\nText',
    ],
    [
      'removing the last key removes the block',
      '---\ntypst-preset: A5 print\n---\nText',
      null,
      'Text',
    ],
    ['removing a key that is not there changes nothing', 'Text', null, 'Text'],
    [
      'a comment and the order of the others are kept',
      '---\n# kept\naliases: []\ntags: [x]\n---\nText',
      'A5 print',
      '---\n# kept\naliases: []\ntags: [x]\ntypst-preset: A5 print\n---\nText',
    ],
    [
      'a name YAML would read otherwise is quoted',
      'Text',
      'yes: no',
      '---\ntypst-preset: "yes: no"\n---\nText',
    ],
    [
      'Windows line ends are kept',
      '---\r\ntags: [x]\r\n---\r\nText',
      'A5 print',
      '---\r\ntags: [x]\r\ntypst-preset: A5 print\r\n---\r\nText',
    ],
  ];
  for (const [what, before, value, after] of cases) {
    it(`US-045 AC-7: ${what}`, async () => {
      const {editNoteProperty} = await load<NoteEditModule>(NOTE_EDIT);
      expect(editNoteProperty(before, 'typst-preset', value)).toEqual({
        ok: true,
        text: after,
      });
    });
  }
  it('US-045 AC-7: an unclosed or non-mapping frontmatter is not changed; the reason is given', async () => {
    const {editNoteProperty} = await load<NoteEditModule>(NOTE_EDIT);
    for (const text of ['---\ntags: [x]\nText', '---\n- a\n- b\n---\nText']) {
      const r = editNoteProperty(text, 'typst-preset', 'A5 print');
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    }
  });
});
