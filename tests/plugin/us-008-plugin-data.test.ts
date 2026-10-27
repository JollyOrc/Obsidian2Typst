// US-008 AC-7, AC-8 (and US-001 AC-13, US-009 AC-2 for the Defaults) — plugin
// data in data.json: what is stored, what survives a restart, what an old or
// damaged file does (plugin logic with a fake storage). Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it} from 'vitest';
import {
  DATA_SCHEMA_VERSION,
  DEFAULT_PLUGIN_DATA,
  RESET_NOTICE,
  createSettingsStore,
  loadPluginData,
  type PluginData,
  type SettingsStorage,
} from '../../src/plugin/settings/data';

class FakeStorage implements SettingsStorage {
  saved: unknown[] = [];
  constructor(public stored: unknown = null) {}
  async load(): Promise<unknown> {
    return this.stored === null
      ? null
      : (JSON.parse(JSON.stringify(this.stored)) as unknown);
  }
  async save(data: unknown): Promise<void> {
    this.stored = JSON.parse(JSON.stringify(data));
    this.saved.push(this.stored);
  }
}

const FULL: PluginData = {
  schemaVersion: 1,
  activePreset: 'A4 digital',
  defaults: {
    highlightColor: '#a5d6a7',
    headingNumbering: 'a.1',
    externalLinkFootnotes: false,
    template: 'Styles/template.typ',
    page: {trimSize: 'A4', bleed: 2, margins: {top: 25}},
  },
  strictMode: true,
  warningsNoteFolder: 'Reports',
  presetsFolder: 'Books/presets',
  lastExportFolders: {
    'A5 print': '/Users/me/Print',
    'A4 digital': 'C:\\Users\\me\\Digital',
  },
};

describe('US-008 AC-8 plugin data', () => {
  it('US-008 AC-8: has built-in values for a first start, without a notice', () => {
    expect(DATA_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_PLUGIN_DATA).toEqual({
      schemaVersion: 1,
      activePreset: 'A5 print',
      defaults: {},
      strictMode: false,
      warningsNoteFolder: '',
      presetsFolder: 'Obsidian2Typst/presets',
      lastExportFolders: {},
    });
    for (const raw of [null, undefined]) {
      expect(loadPluginData(raw)).toEqual({
        data: DEFAULT_PLUGIN_DATA,
        reset: false,
      });
    }
  });

  it('US-008 AC-8: keeps active preset, Defaults, strict mode, warnings folder, presets folder and last export folders across restart', async () => {
    const storage = new FakeStorage();
    const first = createSettingsStore(storage);
    await first.load();
    await first.update(FULL);
    const second = createSettingsStore(storage);
    expect(await second.load()).toEqual({reset: false});
    expect(second.data).toEqual(FULL);
    expect(loadPluginData(JSON.parse(JSON.stringify(FULL)))).toEqual({
      data: FULL,
      reset: false,
    });
  });

  it("US-008 AC-8: replaces unknown or invalid data.json fields by defaults and shows 'Some settings were reset' without crashing", async () => {
    expect(RESET_NOTICE).toBe('Some settings were reset');
    const damaged = {
      ...FULL,
      strictMode: 'yes',
      unknownField: 1,
      warningsNoteFolder: 5,
    };
    const {data, reset} = loadPluginData(damaged);
    expect(reset).toBe(true);
    expect(data).toEqual({
      ...FULL,
      strictMode: false,
      warningsNoteFolder: '',
    });
    expect(Object.keys(data).sort()).toEqual(Object.keys(FULL).sort());

    const storage = new FakeStorage(damaged);
    const store = createSettingsStore(storage);
    expect(await store.load()).toEqual({reset: true});
  });

  it('US-008 AC-8: replaces only the invalid field of the Defaults and of the export folders', () => {
    const {data, reset} = loadPluginData({
      ...FULL,
      defaults: {...FULL.defaults, highlightColor: 'red', template: 5},
      lastExportFolders: {'A5 print': '/ok', 'A4 digital': 7},
    });
    expect(reset).toBe(true);
    expect(data.defaults).toEqual({
      headingNumbering: 'a.1',
      externalLinkFootnotes: false,
      page: FULL.defaults.page,
    });
    expect(data.lastExportFolders).toEqual({'A5 print': '/ok'});
  });

  it('US-008 AC-8: drops an unknown field of data.json and of the Defaults, with the notice', () => {
    const extra = loadPluginData({...FULL, unknownField: 1});
    expect(extra.reset).toBe(true);
    expect(extra.data).toEqual(FULL);
    expect('unknownField' in extra.data).toBe(false);
    const inner = loadPluginData({
      ...FULL,
      defaults: {...FULL.defaults, strictMode: true},
    });
    expect(inner.reset).toBe(true);
    expect(inner.data.defaults).toEqual(FULL.defaults);
  });

  it('US-008 AC-8: a Defaults pattern without a counting symbol in data.json is replaced by "1.1" with the notice', () => {
    const result = loadPluginData({
      ...FULL,
      defaults: {...FULL.defaults, headingNumbering: 'x'},
    });
    expect(result.reset).toBe(true);
    expect(result.data.defaults.headingNumbering).toBe('1.1');
  });

  it('US-008 AC-8: does not crash on any shape of file and resets all of it', () => {
    for (const raw of [
      'text',
      42,
      true,
      [],
      [1, 2],
      {schemaVersion: 99},
      {schemaVersion: 'one'},
      {defaults: 'x'},
      {lastExportFolders: []},
    ]) {
      const result = loadPluginData(raw);
      expect(result.reset, JSON.stringify(raw)).toBe(true);
      expect(result.data.schemaVersion).toBe(1);
    }
    expect(loadPluginData({schemaVersion: 99}).data).toEqual(
      DEFAULT_PLUGIN_DATA,
    );
  });

  it('US-008 AC-8: a data.json from before the schema version is read as version 1 without a notice', () => {
    const old: Record<string, unknown> = {...FULL};
    delete old['schemaVersion'];
    expect(loadPluginData(old)).toEqual({data: FULL, reset: false});
  });

  it('US-008 AC-8: stores the presets folder without a trailing slash, and an empty one is invalid', () => {
    expect(
      loadPluginData({...FULL, presetsFolder: 'Books/presets/'}).data
        .presetsFolder,
    ).toBe('Books/presets');
    const empty = loadPluginData({...FULL, presetsFolder: ''});
    expect(empty.reset).toBe(true);
    expect(empty.data.presetsFolder).toBe('Obsidian2Typst/presets');
  });

  it('US-008 AC-8: writes plain JSON with the schema version, and a copy of the data on every read', async () => {
    const storage = new FakeStorage();
    const store = createSettingsStore(storage);
    await store.load();
    await store.update({strictMode: true});
    expect(storage.stored).toEqual({...DEFAULT_PLUGIN_DATA, strictMode: true});
    const copy = store.data;
    copy.strictMode = false;
    copy.lastExportFolders['x'] = 'y';
    expect(store.data.strictMode).toBe(true);
    expect(store.data.lastExportFolders).toEqual({});
  });
});

describe('US-008 AC-7 the last export folder is kept per preset in data.json', () => {
  it('US-008 AC-7: stores the last export folder per preset name in data.json, not in the note', async () => {
    const storage = new FakeStorage();
    const store = createSettingsStore(storage);
    await store.load();
    await store.setLastExportFolder('A5 print', '/out/print');
    await store.setLastExportFolder('A4 digital', '/out/digital');
    await store.setLastExportFolder('A5 print', '/out/print2');
    expect((storage.stored as PluginData).lastExportFolders).toEqual({
      'A5 print': '/out/print2',
      'A4 digital': '/out/digital',
    });
    expect(storage.saved.length).toBe(3);
    const again = createSettingsStore(storage);
    await again.load();
    expect(again.data.lastExportFolders['A5 print']).toBe('/out/print2');
  });

  it('US-008 AC-7: changing one setting keeps all others', async () => {
    const storage = new FakeStorage(FULL);
    const store = createSettingsStore(storage);
    await store.load();
    await store.setLastExportFolder('New', '/new');
    await store.update({activePreset: 'New'});
    expect(store.data).toEqual({
      ...FULL,
      activePreset: 'New',
      lastExportFolders: {...FULL.lastExportFolders, New: '/new'},
    });
  });
});

describe('US-008 AC-1 the Defaults', () => {
  it("US-001 AC-13: rejects a highlightColor that is not '#' plus 6 hex digits and keeps the previous value", async () => {
    const storage = new FakeStorage(FULL);
    const store = createSettingsStore(storage);
    await store.load();
    const saves = storage.saved.length;
    for (const bad of ['red', '#fff', '#ffeb3bX', '', 5]) {
      const result = await store.setDefaults({
        ...FULL.defaults,
        highlightColor: bad,
      });
      expect(result, String(bad)).toEqual({
        ok: false,
        error: 'highlightColor must be a colour written #rrggbb',
      });
    }
    expect(store.data.defaults.highlightColor).toBe('#a5d6a7');
    expect(storage.saved.length).toBe(saves);
    expect(await store.setDefaults({highlightColor: '#102030'})).toEqual({
      ok: true,
      notices: [],
    });
    expect(store.data.defaults).toEqual({highlightColor: '#102030'});
  });

  it('US-009 AC-2: the settings tab keeps the previous page value when a new one is refused', async () => {
    const storage = new FakeStorage(FULL);
    const store = createSettingsStore(storage);
    await store.load();
    const result = await store.setDefaults({
      ...FULL.defaults,
      page: {...FULL.defaults.page, bleed: -1},
    });
    expect(result).toEqual({
      ok: false,
      error: 'page.bleed must be a number of at least 0',
    });
    expect(store.data.defaults.page?.bleed).toBe(2);
  });

  it('US-008 AC-13: a Defaults pattern without a counting symbol is replaced by "1.1" with a notice', async () => {
    const store = createSettingsStore(new FakeStorage());
    await store.load();
    const result = await store.setDefaults({headingNumbering: 'x'});
    expect(result).toEqual({
      ok: true,
      notices: ['Invalid heading numbering; "1.1" is used'],
    });
    expect(store.data.defaults.headingNumbering).toBe('1.1');
  });
});
