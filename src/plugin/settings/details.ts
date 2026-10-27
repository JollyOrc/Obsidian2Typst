// US-021 AC-6 to AC-9: the details pop-up of a preset as data — its table and
// its buttons. No Obsidian import: `details-modal.ts` draws it, the tests read
// it. Built from the store and the settings at each call (SCAR-016), so an
// open pop-up that redraws shows the state of that moment.
import {DEFAULT_COVER} from '../../core/cover';
import {DEFAULT_FONTS} from '../../core/fonts';
import {BUILTIN_HEADING_RULES} from '../../core/markers';
import {
  BUILTIN_DEFAULTS,
  formatPresetError,
  type PresetFields,
} from '../../core/presets';
import {ownerNote, shownValue} from '../../core/presets/owner';
import type {PresetStore} from '../presets/store';
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
  close(): void;
}

/** The built-in value of every row: the US-008 built-ins and the fonts. */
const BUILTIN: unknown = {...BUILTIN_DEFAULTS, fonts: DEFAULT_FONTS};

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
    used: text(valueAt(BUILTIN, path), '—'),
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
 * US-021 | AC-6: The table of a readable preset: every row of `DEFAULT_ROWS`
 * and `FONT_ROWS` in their order (label; the note's value; the used value
 * with its source — the preset when it owns the field, the trim size being one
 * group as in owner.ts; else the Defaults; else the built-in value), then the
 * summaries `Cover`, `Callout styles`, `Heading rules` (preset notes only).
 */
export function detailRows(fields: unknown, defaults: unknown): DetailRow[] {
  const rows = [...DEFAULT_ROWS, ...FONT_ROWS].map((row) =>
    fieldRow(row.label, row.path, fields, defaults),
  );
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
  rows.push(
    summaryRow('Cover', cover, DEFAULT_COVER.mode),
    summaryRow('Callout styles', callouts, '—'),
    summaryRow('Heading rules', rules, pairs(BUILTIN_HEADING_RULES)),
  );
  return rows;
}

/**
 * US-021 | AC-6, AC-7, AC-9: The pop-up of the preset `name`, read from the
 * store and the settings now. A preset that is gone: its message and only
 * `Close`. An invalid one: its error instead of the table, `Use` disabled. A
 * readable one: the table. Buttons `Use` (`In use` and disabled for the
 * active preset; it calls `usePreset` and leaves the pop-up open, decision 2),
 * `Open the note` (opens the note, then closes), `Close`; `Close` has the
 * focus.
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
  const buttons = [use, open, close];
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
