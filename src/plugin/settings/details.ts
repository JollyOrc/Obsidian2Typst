// US-021 AC-6 to AC-9: the details pop-up of a preset as data — its table and
// its buttons. No Obsidian import: `details-modal.ts` draws it, the tests read
// it. Built from the store and the settings at each call (SCAR-016), so an
// open pop-up that redraws shows the state of that moment.
import {DEFAULT_COVER} from '../../core/cover';
import {DEFAULT_FONTS} from '../../core/fonts';
import {BUILTIN_HEADING_RULES} from '../../core/markers';
import {formatPresetError, type PresetFields} from '../../core/presets';
import {builtinValue, ownerNote, shownValue} from '../../core/presets/owner';
import type {PresetStore} from '../presets/store';
import {layoutRowOrder} from './layout';
import {DEFAULT_ROWS, FONT_ROWS} from './row-data';

/** Where the used value comes from (AC-6); null for a row with no value. */
export type DetailSource = 'preset' | 'Defaults' | 'built-in';

/** One row of the table: label, the note's value, the used value, its source. */
export interface DetailRow {
  label: string;
  own: string;
  used: string;
  source: DetailSource | null;
}

/** One button of the pop-up; `run` is absent for a disabled button. */
export interface DetailButton {
  text: string;
  disabled: boolean;
  run?: () => Promise<void> | void;
}

/** The pop-up: a title, the table or an error, the buttons, the focused one. */
export interface DetailsView {
  title: string;
  rows?: DetailRow[];
  error?: string;
  buttons: DetailButton[];
  focus: string;
}

/** What `detailsView` reads and calls. */
export interface DetailsDeps {
  presets: Pick<PresetStore, 'get'>;
  settings: {readonly data: {activePreset: string; defaults: unknown}};
  usePreset(name: string): Promise<void>;
  openNote(path: string): Promise<void>;
  /** US-029 AC-6: makes a copy of the preset (a notice on a refusal). */
  duplicate(name: string): Promise<void>;
  /** US-029 AC-6: asks for a new name; the new name, or null. */
  rename(name: string): Promise<string | null>;
  /** US-029 AC-6: asks first (`deletePreset`); true when it was deleted. */
  remove(name: string): Promise<boolean>;
  close(): void;
}

/**
 * US-021 AC-6 | US-029 AC-9: the built-in value of a row: a font field from
 * `DEFAULT_FONTS` (a family is `—`: the default font), every other field from
 * the export's merge (`builtinValue`, one lookup with the toggles).
 */
function builtin(path: readonly string[]): unknown {
  return path[0] === 'fonts'
    ? valueAt({fonts: DEFAULT_FONTS}, path)
    : builtinValue(path);
}

/** The value at `path` of a plain object, or undefined. */
function valueAt(root: unknown, path: readonly string[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/**
 * US-021 | AC-6: A value as the table writes it: text as written, numbers as
 * written, `true` / `false`; `empty` for a value that is set nowhere
 * (undefined or null).
 */
function text(value: unknown, empty: string): string {
  if (value === undefined || value === null) return empty;
  return String(value);
}

/** US-021 AC-6: one row of a Defaults or font field, by the rule of owner.ts. */
function fieldRow(
  label: string,
  path: readonly string[],
  fields: unknown,
  defaults: unknown,
): DetailRow {
  const own = text(valueAt(fields, path), '');
  if (ownerNote('', fields, path) !== null) {
    return {
      label,
      own,
      used: text(shownValue(fields, defaults, path), '—'),
      source: 'preset',
    };
  }
  const fromDefaults = valueAt(defaults, path);
  if (fromDefaults !== undefined && fromDefaults !== null) {
    return {label, own, used: text(fromDefaults, '—'), source: 'Defaults'};
  }
  return {
    label,
    own,
    used: text(builtin(path), '—'),
    source: 'built-in',
  };
}

/** US-021 AC-6 (decision 3): a summary row of a group the note may set. */
function summaryRow(
  label: string,
  own: string | null,
  builtin: string,
): DetailRow {
  return own === null
    ? {label, own: '', used: builtin, source: 'built-in'}
    : {label, own, used: own, source: 'preset'};
}

/**
 * US-021 | AC-6, US-029 | AC-9: The table of a readable preset: every row of
 * `DEFAULT_ROWS` and `FONT_ROWS` in the order of the settings layout
 * (`layoutRowOrder`) (label; the note's value; the used value
 * with its source — the preset when it owns the field, the trim size being one
 * group as in owner.ts; else the Defaults; else the built-in value), then the
 * summaries `Cover`, `Callout styles`, `Heading rules` (preset notes only)
 * and US-027 AC-8 `Contents place` (`before "Rules"`, or `default`).
 */
export function detailRows(fields: unknown, defaults: unknown): DetailRow[] {
  const all = [...DEFAULT_ROWS, ...FONT_ROWS];
  const rows = layoutRowOrder().map((label) => {
    const row = all.find((candidate) => candidate.label === label);
    if (row === undefined) throw new Error(`no row ${label}`);
    return fieldRow(row.label, row.path, fields, defaults);
  });
  const own = (fields ?? {}) as PresetFields;
  const cover =
    own.cover === undefined
      ? null
      : [own.cover.mode ?? DEFAULT_COVER.mode, own.cover.file]
          .filter((part) => part !== undefined && part !== null)
          .join(', ');
  const callouts =
    own.callouts === undefined ? null : Object.keys(own.callouts).join(', ');
  const pairs = (rules: Readonly<Record<string, string>>): string =>
    Object.entries(rules)
      .map(([key, rule]) => `${key} → ${rule}`)
      .join(', ');
  const rules = own.headingRules === undefined ? null : pairs(own.headingRules);
  // US-027 AC-8 (decision 6): the place the preset picks; a missing position
  // reads as before.
  const place =
    own.toc?.heading === undefined
      ? null
      : `${own.toc.position ?? 'before'} "${own.toc.heading}"`;
  rows.push(
    summaryRow('Cover', cover, DEFAULT_COVER.mode),
    summaryRow('Callout styles', callouts, '—'),
    summaryRow('Heading rules', rules, pairs(BUILTIN_HEADING_RULES)),
    summaryRow('Contents place', place, 'default'),
    ...entryRows(own),
  );
  return rows;
}

/** US-030 AC-9: the `entries.*` fields in the order of the story's table. */
const ENTRY_ROW_PATHS: readonly (readonly string[])[] = [
  ...[
    'stats',
    'traits',
    'boxes',
    'track',
    'trackKey',
    'trackLabel',
    'trackDefault',
    'sum',
    'fill',
    'frame',
    'rules',
    'boxFill',
    'fonts',
    'sizes',
  ].map((key) => ['entries', 'statblock', key]),
  ['entries', 'tagLabels'],
  // US-031 AC-6, US-032 AC-1, US-033 AC-12: the layout's fields (added
  // 2026-11-07; they were missing since #127 to #130).
  ['entries', 'fullImageHeader'],
  ['entries', 'image', 'minScale'],
  ['entries', 'emptyWarn'],
  ['entries', 'quickReference'],
  ['entries', 'quickReferenceTitle'],
  // US-034 AC-5: the word-gap settings (shown when the preset sets them).
  ['entries', 'narrowJustification'],
  ['entries', 'maxWordGap'],
  // US-036 AC-1: the encounter sheet.
  ['entries', 'encounterSheet'],
  ['entries', 'encounterSheetFile'],
  ['entries', 'encounterSheetBoxes'],
  ['entries', 'encounterSheetText'],
  ['colorMode'],
];

/** US-030 AC-9: a set value as one line (`might: Might, wits: Wits`). */
function entryText(value: unknown): string {
  if (Array.isArray(value)) return value.map(entryText).join(', ');
  if (typeof value === 'object' && value !== null) {
    const parts = Object.entries(value).map(
      ([key, item]) =>
        `${key}: ${Array.isArray(item) ? `[${entryText(item)}]` : entryText(item)}`,
    );
    return parts.length === 0 ? '' : parts.join(', ');
  }
  return String(value);
}

/**
 * US-030 | AC-9 (G0-C9): one row per `entries.*` field and `colorMode` the
 * preset note sets, labelled with its path, in the order of the table, with
 * the source `preset` (the fields exist in preset notes only); nothing when
 * the note sets none of them.
 */
function entryRows(own: PresetFields): DetailRow[] {
  return ENTRY_ROW_PATHS.flatMap((path): DetailRow[] => {
    const value = valueAt(own, path);
    if (value === undefined || value === null) return [];
    const shown = entryText(value);
    return [{label: path.join('.'), own: shown, used: shown, source: 'preset'}];
  });
}

/**
 * US-021 | AC-6, AC-7, AC-9: The pop-up of the preset `name`, read from the
 * store and the settings now. A preset that is gone: its message and only
 * `Close`. An invalid one: its error instead of the table, `Use` disabled. A
 * readable one: the table. Buttons `Use` (`In use` and disabled for the
 * active preset; it calls `usePreset` and leaves the pop-up open, decision 2),
 * `Open the note` (opens the note, then closes), `Close`; `Close` has the
 * focus.
 * US-029 AC-6: between `Open the note` and `Close`, for a readable or an
 * invalid preset, `Duplicate` (the pop-up stays), `Rename` (the modal follows
 * the new name) and `Delete` (asks first; closes the pop-up after a
 * confirmed delete).
 */
export function detailsView(deps: DetailsDeps, name: string): DetailsView {
  const title = `Preset "${name}"`;
  const close: DetailButton = {
    text: 'Close',
    disabled: false,
    run: () => deps.close(),
  };
  const entry = deps.presets.get(name);
  if (entry === undefined) {
    return {
      title,
      error: `Preset "${name}" does not exist`,
      buttons: [close],
      focus: 'Close',
    };
  }
  const active = deps.settings.data.activePreset === name;
  const use: DetailButton =
    entry.valid && !active
      ? {text: 'Use', disabled: false, run: () => deps.usePreset(name)}
      : {text: active ? 'In use' : 'Use', disabled: true};
  const open: DetailButton = {
    text: 'Open the note',
    disabled: false,
    run: async () => {
      await deps.openNote(entry.path);
      deps.close();
    },
  };
  const manage: DetailButton[] = [
    {text: 'Duplicate', disabled: false, run: () => deps.duplicate(name)},
    {
      text: 'Rename',
      disabled: false,
      run: async () => void (await deps.rename(name)),
    },
    {
      text: 'Delete',
      disabled: false,
      run: async () => {
        if (await deps.remove(name)) deps.close();
      },
    },
  ];
  const buttons = [use, open, ...manage, close];
  if (!entry.valid || entry.preset === undefined) {
    const error =
      entry.error === undefined
        ? 'The preset is invalid'
        : formatPresetError(entry.error);
    return {title, error, buttons, focus: 'Close'};
  }
  return {
    title,
    rows: detailRows(entry.preset.fields, deps.settings.data.defaults),
    buttons,
    focus: 'Close',
  };
}
