// US-008 AC-1, AC-7, AC-8: the plugin data in `data.json`: what is stored, what
// an old or damaged file does, and the store that keeps it. The file is read and
// written through `SettingsStorage` (Obsidian's `loadData` and `saveData`).
import {validateFields, type PresetFields} from '../../core/presets';

/** The version of `data.json` that this plugin writes and reads. */
export const DATA_SCHEMA_VERSION = 1;

/** The notice shown when `data.json` held values that were replaced. */
export const RESET_NOTICE = 'Some settings were reset';

export interface PluginData {
  schemaVersion: 1;
  /** The name of the active preset. */
  activePreset: string;
  /** The `Defaults` section of the settings tab (preset fields only). */
  defaults: PresetFields;
  /** US-006: any warning aborts the export. */
  strictMode: boolean;
  /** US-006: vault folder of the warnings note; empty is the vault root. */
  warningsNoteFolder: string;
  /** The vault folder of the preset notes, without a trailing slash. */
  presetsFolder: string;
  /** The last export folder, by preset name. */
  lastExportFolders: Record<string, string>;
}

export const DEFAULT_PRESETS_FOLDER = 'Obsidian2Typst/presets';

export const DEFAULT_PLUGIN_DATA: Readonly<PluginData> = {
  schemaVersion: DATA_SCHEMA_VERSION,
  activePreset: 'A5 print',
  defaults: {},
  strictMode: false,
  warningsNoteFolder: '',
  presetsFolder: DEFAULT_PRESETS_FOLDER,
  lastExportFolders: {},
};

type Group = Record<string, unknown>;

const isGroup = (value: unknown): value is Group =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The Defaults of `raw`: every valid field is kept, the others are dropped. */
function readDefaults(raw: unknown): {value: PresetFields; reset: boolean} {
  if (!isGroup(raw)) return {value: {}, reset: true};
  const value: PresetFields = {};
  let reset = false;
  for (const key of Object.keys(raw)) {
    const checked = validateFields({[key]: raw[key]});
    const kept = checked.ok
      ? (checked.fields as Record<string, unknown>)[key]
      : undefined;
    if (!checked.ok || checked.notices.length > 0 || kept === undefined) {
      reset = true;
      if (!checked.ok || kept === undefined) continue;
    }
    (value as Record<string, unknown>)[key] = kept;
  }
  return {value, reset};
}

function readFolders(raw: unknown): {
  value: Record<string, string>;
  reset: boolean;
} {
  if (!isGroup(raw)) return {value: {}, reset: true};
  const value: Record<string, string> = {};
  let reset = false;
  for (const [preset, folder] of Object.entries(raw)) {
    if (typeof folder === 'string') value[preset] = folder;
    else reset = true;
  }
  return {value, reset};
}

/**
 * US-008 AC-8: reads `data.json`. Nothing (a first start) gives the defaults
 * without a notice; a field that is missing gets its default without a notice;
 * a field that is invalid or unknown is replaced or dropped and `reset` is
 * true. A file of a newer version, or one that is not a group of settings, is
 * replaced as a whole. Never throws.
 */
export function loadPluginData(raw: unknown): {
  data: PluginData;
  reset: boolean;
} {
  if (raw === null || raw === undefined) {
    return {data: clone(DEFAULT_PLUGIN_DATA) as PluginData, reset: false};
  }
  const fresh = (): {data: PluginData; reset: boolean} => ({
    data: clone(DEFAULT_PLUGIN_DATA) as PluginData,
    reset: true,
  });
  if (!isGroup(raw)) return fresh();
  const version = Object.hasOwn(raw, 'schemaVersion')
    ? raw['schemaVersion']
    : 1;
  if (version !== DATA_SCHEMA_VERSION) return fresh();

  const data = clone(DEFAULT_PLUGIN_DATA) as PluginData;
  let reset = false;
  const known = new Set(Object.keys(DEFAULT_PLUGIN_DATA));
  for (const key of Object.keys(raw)) if (!known.has(key)) reset = true;

  const text = (key: 'activePreset' | 'warningsNoteFolder'): void => {
    if (!Object.hasOwn(raw, key)) return;
    if (typeof raw[key] === 'string') data[key] = raw[key];
    else reset = true;
  };
  text('activePreset');
  text('warningsNoteFolder');
  if (Object.hasOwn(raw, 'strictMode')) {
    if (typeof raw['strictMode'] === 'boolean')
      data.strictMode = raw['strictMode'];
    else reset = true;
  }
  if (Object.hasOwn(raw, 'presetsFolder')) {
    const folder = raw['presetsFolder'];
    const trimmed =
      typeof folder === 'string' ? folder.replace(/\/+$/, '') : '';
    if (trimmed === '') reset = true;
    else data.presetsFolder = trimmed;
  }
  if (Object.hasOwn(raw, 'defaults')) {
    const defaults = readDefaults(raw['defaults']);
    data.defaults = defaults.value;
    if (defaults.reset) reset = true;
  }
  if (Object.hasOwn(raw, 'lastExportFolders')) {
    const folders = readFolders(raw['lastExportFolders']);
    data.lastExportFolders = folders.value;
    if (folders.reset) reset = true;
  }
  return {data, reset};
}

/** Where `data.json` is read and written (Obsidian's `loadData`/`saveData`). */
export interface SettingsStorage {
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
}

export interface SettingsStore {
  /** Reads the file; `reset` is true when values were replaced (AC-8). */
  load(): Promise<{reset: boolean}>;
  /** A copy of the data; changing it changes nothing in the store. */
  readonly data: PluginData;
  update(patch: Partial<PluginData>): Promise<void>;
  /** US-008 AC-7: the last export folder of a preset, kept in `data.json`. */
  setLastExportFolder(preset: string, folder: string): Promise<void>;
  /**
   * US-008 AC-1: replaces the Defaults. A refused value gives its message and
   * leaves the previous Defaults in place; a pattern that is replaced gives
   * a notice (AC-13).
   */
  setDefaults(
    fields: unknown,
  ): Promise<{ok: true; notices: string[]} | {ok: false; error: string}>;
  /**
   * US-012 AC-14: calls `listener` once after each change that was saved
   * (`update`, `setLastExportFolder`, `setDefaults` when it is accepted), never
   * after a refused value. Returns the function that stops listening.
   */
  onChange(listener: () => void): () => void;
}

export function createSettingsStore(storage: SettingsStorage): SettingsStore {
  let current: PluginData = clone(DEFAULT_PLUGIN_DATA) as PluginData;
  const listeners = new Set<() => void>();
  const save = async (): Promise<void> => {
    await storage.save(clone(current));
    for (const listener of [...listeners]) listener();
  };
  return {
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    async load() {
      const loaded = loadPluginData(await storage.load());
      current = loaded.data;
      return {reset: loaded.reset};
    },
    get data() {
      return clone(current);
    },
    async update(patch) {
      current = {...current, ...clone(patch)};
      await save();
    },
    async setLastExportFolder(preset, folder) {
      current = {
        ...current,
        lastExportFolders: {...current.lastExportFolders, [preset]: folder},
      };
      await save();
    },
    async setDefaults(fields) {
      const checked = validateFields(fields);
      if (!checked.ok) return {ok: false, error: checked.error.message};
      current = {...current, defaults: clone(checked.fields)};
      await save();
      return {ok: true, notices: checked.notices};
    },
  };
}

/**
 * US-020 | AC-4: Calls `listener` after a saved change of `activePreset` only.
 *
 * For a screen that shows which preset is active but must not redraw on every
 * other save (a redraw while the author moves between Defaults fields would
 * take the focus away). Remembers the value seen when it was called and
 * compares it after each change of `store` (SCAR-016: the state is read when
 * the change happens). Returns the function that stops listening.
 */
export function onActivePresetChange(
  store: Pick<SettingsStore, 'data' | 'onChange'>,
  listener: () => void,
): () => void {
  let seen = store.data.activePreset;
  return store.onChange(() => {
    const now = store.data.activePreset;
    if (now === seen) return;
    seen = now;
    listener();
  });
}
