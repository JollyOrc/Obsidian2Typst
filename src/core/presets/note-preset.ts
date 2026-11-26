// US-045 AC-1, AC-6: a note names its preset in the top-level property
// `typst-preset`. Pure core: no Obsidian, Node, or I/O imports. The key is read
// from the YAML between a note's `---` lines (the split `parse` makes, SCAR-034);
// names compare as the preset list compares them (`nameKey`, SCAR-017).
import {parse} from 'yaml';
import {nameKey} from './names';

/** US-045 AC-1: the property a note names its preset in. */
export const NOTE_PRESET_KEY = 'typst-preset';

/** US-045 AC-6: the chooser line that removes the property. */
export const ACTIVE_PRESET_CHOICE = 'Active preset (no property)';

/** US-045 AC-1: what a note's frontmatter says about its preset. */
export type NotePresetRead =
  | {kind: 'none'}
  | {kind: 'name'; name: string}
  | {kind: 'bad'; message: string};

/**
 * US-045 AC-1: the key of `frontmatter` (the YAML of a note, null without
 * one). A text is trimmed; empty, null or absent is no key; another type is
 * refused. YAML that does not parse, or is not a mapping, is no key: the note
 * is then exported with the active preset as before (its frontmatter is never
 * printed).
 */
export function readNotePreset(frontmatter: string | null): NotePresetRead {
  if (frontmatter === null) return {kind: 'none'};
  let data: unknown;
  try {
    data = parse(frontmatter);
  } catch {
    return {kind: 'none'};
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {kind: 'none'};
  }
  const value = (data as Record<string, unknown>)[NOTE_PRESET_KEY];
  if (value === undefined || value === null) return {kind: 'none'};
  if (typeof value !== 'string') {
    return {
      kind: 'bad',
      message: `the property ${NOTE_PRESET_KEY} must be a preset name`,
    };
  }
  const name = value.trim();
  return name === '' ? {kind: 'none'} : {kind: 'name', name};
}

/** US-045 AC-6: one line of the chooser; `value` null removes the property. */
export interface NotePresetChoice {
  label: string;
  value: string | null;
  current: boolean;
}

/**
 * US-045 AC-6: the chooser's lines: first the active preset (removes the
 * property), then the valid presets in the order given. `current` is the
 * note's key now (null: none); it marks the line whose name compares equal,
 * or the first line without a key. A key naming no listed preset marks
 * nothing.
 */
export function notePresetChoices(
  presets: readonly {name: string; valid: boolean}[],
  current: string | null,
): NotePresetChoice[] {
  const key = current === null ? null : nameKey(current);
  return [
    {label: ACTIVE_PRESET_CHOICE, value: null, current: current === null},
    ...presets
      .filter((preset) => preset.valid)
      .map((preset) => ({
        label: preset.name,
        value: preset.name,
        current: key !== null && nameKey(preset.name) === key,
      })),
  ];
}
