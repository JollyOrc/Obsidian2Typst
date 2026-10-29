// Test support for US-025 to US-028 in the plugin: the shared rows drawn with
// the stand-in for Obsidian (as tests/plugin/us-012-rows.test.ts draws them)
// and a preview rig over a preset note (as US-019 AC-10 does). The caller
// mocks `obsidian` with tests/support/fake-obsidian.
import {ownerNote, shownValue} from '../../src/core/presets/owner';
import type {FieldPath} from '../../src/core/presets';
import type {FontSet} from '../../src/plugin/fonts';
import {type PrepareDeps} from '../../src/plugin/prepare-note';
import {
  createPresetStore,
  type PresetStore,
} from '../../src/plugin/presets/store';
import {
  createSettingsStore,
  DEFAULT_PLUGIN_DATA,
  type PluginData,
  type SettingsStorage,
} from '../../src/plugin/settings/data';
import {
  addDefaultRows,
  createTrimState,
  type RowsEnv,
} from '../../src/plugin/settings/rows';
import {standIn} from './convert';
import {FakeVault} from './fake-vault';
import {made, type FakeSetting} from './fake-obsidian';

class Storage implements SettingsStorage {
  stored: unknown = null;
  async load(): Promise<unknown> {
    return this.stored;
  }
  async save(data: unknown): Promise<void> {
    this.stored = JSON.parse(JSON.stringify(data));
  }
}

/**
 * Draws the Defaults rows; `preset` (its fields) owns the rows it sets, as in
 * the style panel; `null` is the Settings tab.
 */
export async function rowsRig(preset: Record<string, unknown> | null = null) {
  const settings = createSettingsStore(new Storage());
  await settings.load();
  const env: RowsEnv = {
    app: {} as never,
    settings,
    presets: {refresh: () => undefined} as unknown as PresetStore,
    fonts: (async () => {
      throw new Error('no fonts here');
    }) as unknown as FontSet,
    redraw: () => undefined,
    ownerNote: (path: FieldPath) =>
      preset === null ? null : ownerNote('Book', preset, path),
    shown: (path: FieldPath) =>
      shownValue(preset ?? {}, settings.data.defaults, path),
    trim: createTrimState(),
  };
  addDefaultRows({} as HTMLElement, env);
  const row = (name: string): FakeSetting => {
    const found = made.find((s) => s.name === name);
    if (found === undefined) throw new Error(`no row ${name}`);
    return found;
  };
  return {settings, env, row};
}

export const PRESET_FOLDER = 'Obsidian2Typst/presets';
export const PRESET_PATH = `${PRESET_FOLDER}/Book.md`;
export const RIG_NOTE = 'Sample/Rules.md';

/** A preset note with the YAML lines `lines` (after `schemaVersion: 1`). */
export const presetNote = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** The export and preview dependencies over one preset note and one note. */
export async function previewRig(presetText: string, source: string) {
  const vault = new FakeVault({[PRESET_PATH]: presetText}, [PRESET_FOLDER]);
  const data: PluginData = JSON.parse(
    JSON.stringify(DEFAULT_PLUGIN_DATA),
  ) as PluginData;
  data.activePreset = 'Book';
  const presets = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await presets.load();
  let text = source;
  const deps: PrepareDeps = {
    notes: {activePath: () => RIG_NOTE, read: async () => text},
    vault: {
      files: () => [RIG_NOTE],
      readHead: async (path, length = 16) => standIn(path).subarray(0, length),
      readBytes: async (path) => standIn(path),
      readText: async () => null,
    },
    presets,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async () => undefined,
    },
  };
  return {
    vault,
    presets,
    deps,
    data,
    setSource: (next: string) => {
      text = next;
    },
  };
}

/** The preview step that skips image downsampling. */
export const NO_DOWNSAMPLE = {downsample: async () => null};
