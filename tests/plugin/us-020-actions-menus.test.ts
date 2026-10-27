// US-020 AC-1 to AC-9 — one function per action, the ribbon menu and the note
// context menus: the actions (export a note by path, preview a note, use a
// preset) with their messages, the menu entries as data (order, titles,
// icons, checked and disabled items, which files get items), the state read
// at the click (SCAR-016: draw, change, use), and text checks that every entry
// point goes through the actions (SCAR-017). The menus in the app are checked
// by hand (AC-10). Source of truth:
// docs/user-stories/US-020-actions-ribbon-and-note-menus.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import * as exportCommand from '../../src/plugin/export-command';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

/** US-020: a menu entry as data (the menus module does not exist yet). */
interface Entry {
  title?: string;
  icon?: string;
  checked?: boolean;
  disabled?: boolean;
  label?: boolean;
  separator?: boolean;
  run?: () => Promise<void> | void;
}
interface Actions {
  /** No path: the active note. */
  exportNote(path?: string): Promise<unknown>;
  /** No path: open the panel only. */
  previewNote(path?: string): Promise<void>;
  usePreset(name: string): Promise<void>;
}
interface MenusModule {
  ribbonMenuEntries(actions: Actions, presets: PresetView): Entry[];
  noteMenuEntries(
    actions: Actions,
    file: {path: string; folder: boolean},
    presetsFolder: string,
  ): Entry[];
}
interface PresetView {
  names: readonly {name: string; valid: boolean}[];
  stored: string;
}
interface ActionsModule {
  createActions(deps: unknown): Actions;
}

// Loaded by a path held in a variable, so that typecheck does not resolve the
// modules before TICKET code exists (red until then).
const MENUS = '../../src/plugin/menus';
const ACTIONS = '../../src/plugin/actions';
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;

const FOLDER = 'Obsidian2Typst/presets';
const presetText = (extra = ''): string =>
  ['---', 'schemaVersion: 1', 'page:', '  trimSize: A5', extra, '---', '']
    .filter((l) => l !== '')
    .join('\n');

/** The stores and a recorder of what the actions did. */
async function rig(
  presets: Record<string, string> = {
    'A4 digital': presetText(),
    'A5 print': presetText(),
  },
  stored = 'A5 print',
) {
  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(presets)) {
    files[`${FOLDER}/${name}.md`] = text;
  }
  const vault = new FakeVault(files, [FOLDER]);
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: stored,
  };
  const settings = createSettingsStore({
    load: async () => saved,
    save: async (data) => {
      saved = data;
    },
  });
  await settings.load();
  const store = createPresetStore({
    vault,
    folder: () => settings.data.presetsFolder,
    defaults: () => settings.data.defaults,
    notify: () => undefined,
  });
  await store.load();
  const log: string[] = [];
  const notices: string[] = [];
  const deps = {
    notes: {
      activePath: () => 'Rules.md',
      read: async (path: string) => `# ${path}\n\nText of ${path}.`,
    },
    vault: {
      files: () => ['Rules.md', 'Glossary.md'],
      readHead: async (path: string, length = 16) =>
        standIn(path).subarray(0, length),
      readBytes: async (path: string) => standIn(path),
      readText: async () => null,
    },
    presets: store,
    settings,
    chooseFolder: async () => '/tmp/out',
    run: async (request: {noteName: string; source: {path: string}}) => {
      log.push(`run:${request.source.path}:${request.noteName}`);
      return {ok: true};
    },
    notice: (text: string) => void notices.push(text),
    showNote: async (path: string) => void log.push(`show:${path}`),
    openPanel: async () => {
      log.push('panel');
      return true;
    },
  };
  return {vault, settings, store, deps, log, notices};
}

const view = (names: [string, boolean][], stored: string): PresetView => ({
  names: names.map(([name, valid]) => ({name, valid})),
  stored,
});

/** An entry without its function, for comparing the drawn shape. */
function withoutRun(entry: Entry): Omit<Entry, 'run'> {
  const shape = {...entry};
  delete shape.run;
  return shape;
}

const noActions: Actions = {
  exportNote: async () => undefined,
  previewNote: async () => undefined,
  usePreset: async () => undefined,
};

describe('US-020 AC-2 export a note by its path', () => {
  it('US-020 AC-2: export-command exports exportNoteAt(deps, path)', () => {
    expect(
      typeof (exportCommand as unknown as Record<string, unknown>)[
        'exportNoteAt'
      ],
    ).toBe('function');
  });

  it('US-020 AC-2: the clicked note is exported, not the active one; the active note stays', async () => {
    const {deps, log} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.exportNote('Glossary.md');
    expect(log).toEqual(['run:Glossary.md:Glossary']);
    expect(deps.notes.activePath()).toBe('Rules.md');
  });

  it('US-020 AC-2: the messages of US-008 AC-15 for the given note', async () => {
    const {deps, notices, log} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    deps.notes.activePath = () => null as unknown as string;
    await actions.exportNote();
    await actions.exportNote(`${FOLDER}/A5 print.md`);
    expect(notices).toEqual([
      'Open a note to export it',
      'Presets are not exported',
    ]);
    expect(log).toEqual([]);
    const empty = await rig({}, '');
    const none = (await load<ActionsModule>(ACTIONS)).createActions(empty.deps);
    await none.exportNote('Rules.md');
    expect(empty.notices).toEqual([
      'There is no preset; create one in the settings of Obsidian2Typst',
    ]);
  });
});

describe('US-020 AC-2 an export error', () => {
  it('US-020 AC-2: an error during the export becomes the notice Export failed (as the command did, US-007)', async () => {
    const {deps, notices} = await rig();
    deps.run = async () => {
      throw new Error('disk full');
    };
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.exportNote('Glossary.md');
    expect(notices).toEqual(['Export failed: disk full']);
  });
});

describe('US-020 AC-3 the ribbon menu entries', () => {
  it('US-020 AC-3: export, panel, separator, the Preset label, every preset in settings order, the active one checked, an invalid one disabled', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const entries = ribbonMenuEntries(
      noActions,
      view(
        [
          ['A4 digital', true],
          ['A5 print', true],
          ['Broken', false],
        ],
        'A5 print',
      ),
    );
    expect(entries.map(withoutRun)).toEqual([
      {title: 'Export current note', icon: 'file-output'},
      {title: 'Open style panel', icon: 'panel-right'},
      {separator: true},
      {title: 'Preset', label: true},
      {title: 'A4 digital', checked: false},
      {title: 'A5 print', checked: true},
      {title: 'Broken (invalid)', checked: false, disabled: true},
    ]);
  });

  it('US-020 AC-3, SCAR-019: no preset: the label and a disabled No preset yet', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const entries = ribbonMenuEntries(noActions, view([], ''));
    expect(entries.slice(3).map(withoutRun)).toEqual([
      {title: 'Preset', label: true},
      {title: 'No preset yet', disabled: true},
    ]);
  });

  it('US-020 AC-3, SCAR-019: one preset; and a stored name that no longer exists checks the first name in settings order, valid or not', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const one = ribbonMenuEntries(noActions, view([['Book', true]], 'Book'));
    expect(one.at(-1)).toMatchObject({title: 'Book', checked: true});
    // settings order is sorted (the store's entries()): Archive before Book
    const missing = ribbonMenuEntries(
      noActions,
      view(
        [
          ['Archive', false],
          ['Book', true],
        ],
        'Gone',
      ),
    );
    expect(missing.slice(4).map((e) => [e.title, e.checked])).toEqual([
      ['Archive (invalid)', true],
      ['Book', false],
    ]);
    // a valid first preset is checked too when the stored name is gone
    const valid = ribbonMenuEntries(
      noActions,
      view(
        [
          ['Book', true],
          ['Broken', false],
        ],
        'Gone',
      ),
    );
    expect(valid.slice(4).map((e) => [e.title, e.checked])).toEqual([
      ['Book', true],
      ['Broken (invalid)', false],
    ]);
  });

  it('US-020 AC-3: the first two entries run the export of the active note and open the panel', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const calls: string[] = [];
    const actions: Actions = {
      exportNote: async (p) => void calls.push(`export:${p}`),
      previewNote: async (p) => void calls.push(`preview:${p}`),
      usePreset: async (n) => void calls.push(`use:${n}`),
    };
    const entries = ribbonMenuEntries(actions, view([['Book', true]], 'Book'));
    // no path: the action reads the active note itself
    await entries[0]?.run?.();
    await entries[1]?.run?.();
    expect(calls).toEqual(['export:undefined', 'preview:undefined']);
  });
});

describe('US-020 AC-4, AC-5 choosing a preset; the state at the click (SCAR-016)', () => {
  it('US-020 AC-4: a preset entry makes it active and saves it; the checked one changes nothing', async () => {
    const {deps, settings} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    const save = vi.spyOn(settings, 'update');
    await actions.usePreset('A4 digital');
    expect(settings.data.activePreset).toBe('A4 digital');
    expect(save).toHaveBeenCalledTimes(1);
    await actions.usePreset('A4 digital');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('US-020 AC-5: the action asks the store at the call: a missing or invalid preset gives its message and changes nothing', async () => {
    const {deps, vault, store, settings, notices} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.usePreset('Gone');
    vault.edit(`${FOLDER}/A4 digital.md`, presetText('linkPageLevel: 9'));
    await store.load();
    await actions.usePreset('A4 digital');
    expect(notices).toEqual([
      'Preset "Gone" does not exist',
      'Preset "A4 digital" is invalid: linkPageLevel must be a whole number from 1 to 6 (line 5)',
    ]);
    expect(settings.data.activePreset).toBe('A5 print');
  });

  it('US-020 AC-5: drawn with Folios, Folios renamed to Book, then clicked: notice, nothing changes', async () => {
    const {deps, vault, store, settings, notices} = await rig(
      {Folios: presetText(), 'A5 print': presetText()},
      'A5 print',
    );
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    const entries = ribbonMenuEntries(actions, {
      names: store.entries(),
      stored: settings.data.activePreset,
    });
    // change: the note is renamed elsewhere
    vault.remove(`${FOLDER}/Folios.md`);
    vault.edit(`${FOLDER}/Book.md`, presetText());
    await store.load();
    // use
    await entries.find((e) => e.title === 'Folios')?.run?.();
    expect(notices).toEqual(['Preset "Folios" does not exist']);
    expect(settings.data.activePreset).toBe('A5 print');
  });

  it('US-020 AC-5: drawn valid, made invalid, then clicked: notice with the preset error, active unchanged', async () => {
    const {deps, vault, store, settings, notices} = await rig();
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    const entries = ribbonMenuEntries(actions, {
      names: store.entries(),
      stored: settings.data.activePreset,
    });
    vault.edit(`${FOLDER}/A4 digital.md`, presetText('linkPageLevel: 9'));
    await store.load();
    await entries.find((e) => e.title === 'A4 digital')?.run?.();
    expect(notices).toEqual([
      'Preset "A4 digital" is invalid: linkPageLevel must be a whole number from 1 to 6 (line 5)',
    ]);
    expect(settings.data.activePreset).toBe('A5 print');
  });

  it('US-020 AC-5: a preset created after a menu was drawn is in the next menu', async () => {
    const {deps, vault, store, settings} = await rig();
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    vault.edit(`${FOLDER}/Book.md`, presetText());
    await store.load();
    const titles = ribbonMenuEntries(actions, {
      names: store.entries(),
      stored: settings.data.activePreset,
    }).map((e) => e.title);
    expect(titles).toContain('Book');
  });
});

describe('US-020 AC-4 an open settings tab follows a preset chosen elsewhere (SCAR-016)', () => {
  type Follow = (
    store: {data: {activePreset: string}; onChange(l: () => void): () => void},
    listener: () => void,
  ) => () => void;
  const follow = async (): Promise<Follow> =>
    (
      (await import('../../src/plugin/settings/data')) as unknown as Record<
        string,
        Follow
      >
    )['onActivePresetChange'] as Follow;

  it('US-020 AC-4: drawn, then another field saved (no redraw), then the preset chosen in a menu (one redraw), then stopped', async () => {
    const {deps, settings} = await rig();
    const onActivePresetChange = await follow();
    expect(typeof onActivePresetChange).toBe('function');
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    let redraws = 0;
    const stop = onActivePresetChange(settings, () => void redraws++);
    await settings.update({strictMode: true});
    expect(redraws).toBe(0);
    await actions.usePreset('A4 digital');
    expect(redraws).toBe(1);
    await actions.usePreset('A4 digital');
    expect(redraws).toBe(1);
    await actions.usePreset('A5 print');
    expect(redraws).toBe(2);
    stop();
    await actions.usePreset('A4 digital');
    expect(redraws).toBe(2);
  });

  it('US-020 AC-4: the settings tab redraws through onActivePresetChange and stops it when hidden', () => {
    const tab = readFileSync('src/plugin/settings/settings-tab.ts', 'utf8');
    const display = tab.slice(tab.indexOf('override display()'));
    expect(display.slice(0, display.indexOf('\n  }\n'))).toContain(
      'onActivePresetChange(',
    );
    const hide = tab.slice(tab.indexOf('override hide()'));
    expect(hide.slice(0, hide.indexOf('\n  }\n'))).toContain(
      'this.stopActive?.()',
    );
  });
});

describe('US-020 AC-6, AC-7 the note menus', () => {
  const cases: [string, boolean, number][] = [
    ['Glossary.md', false, 2],
    ['Notes/Upper.MD', false, 2],
    ['Notes', true, 0],
    ['Archive.md', true, 0],
    ['Sample/assets/cover.png', false, 0],
    [`${FOLDER}/A5 print.md`, false, 0],
  ];
  for (const [path, folder, count] of cases) {
    it(`US-020 AC-6: ${folder ? 'folder' : 'file'} ${path} gets ${count} items`, async () => {
      const {noteMenuEntries} = await load<MenusModule>(MENUS);
      expect(noteMenuEntries(noActions, {path, folder}, FOLDER)).toHaveLength(
        count,
      );
    });
  }

  it('US-020 AC-6: the two items, their icons, and what they run for the clicked note', async () => {
    const {noteMenuEntries} = await load<MenusModule>(MENUS);
    const calls: string[] = [];
    const actions: Actions = {
      exportNote: async (p) => void calls.push(`export:${p}`),
      previewNote: async (p) => void calls.push(`preview:${p}`),
      usePreset: async () => undefined,
    };
    const entries = noteMenuEntries(
      actions,
      {path: 'Glossary.md', folder: false},
      FOLDER,
    );
    expect(entries.map(withoutRun)).toEqual([
      {title: 'Export to PDF', icon: 'file-output'},
      {title: 'Preview', icon: 'panel-right'},
    ]);
    for (const entry of entries) await entry.run?.();
    expect(calls).toEqual(['export:Glossary.md', 'preview:Glossary.md']);
  });

  it('US-020 AC-6, AC-7: main.ts registers file-menu and editor-menu (the editor menu for info.file), not files-menu', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    expect(main).toContain("'file-menu'");
    expect(main).toContain("'editor-menu'");
    expect(main).toContain('info.file');
    expect(main).not.toContain("'files-menu'");
    expect(main).toContain('noteMenuEntries(');
  });
});

describe('US-020 AC-8 preview a note', () => {
  it('US-020 AC-8: the clicked note is shown (made active) before the panel opens', async () => {
    const {deps, log} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.previewNote('Glossary.md');
    expect(log).toEqual(['show:Glossary.md', 'panel']);
  });

  it('US-020 AC-8: without a note only the panel opens (command and ribbon)', async () => {
    const {deps, log} = await rig();
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.previewNote();
    expect(log).toEqual(['panel']);
  });

  it('US-020 AC-8: no room for the panel gives today’s notice', async () => {
    const {deps, notices} = await rig();
    deps.openPanel = async () => false;
    const actions = (await load<ActionsModule>(ACTIONS)).createActions(deps);
    await actions.previewNote();
    expect(notices).toEqual([
      'There is no room for the panel in the right sidebar',
    ]);
  });
});

describe('US-020 AC-1, AC-9 every entry point goes through the actions (SCAR-017)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? files(path)
        : path.endsWith('.ts')
          ? [path]
          : [];
    });
  const plugin = files('src/plugin');

  it('US-020 AC-1: exportNoteAt( or exportCurrentNote( of export-command and openStylePanel( are called only from src/plugin/actions.ts', () => {
    const callers = (call: RegExp, home: string) =>
      plugin.filter(
        (file) => file !== home && call.test(readFileSync(file, 'utf8')),
      );
    expect(
      callers(
        /\b(exportNoteAt|exportCurrentNote)\(/,
        join('src', 'plugin', 'export-command.ts'),
      ),
    ).toEqual([join('src', 'plugin', 'actions.ts')]);
    expect(
      callers(
        /\bopenStylePanel\(/,
        join('src', 'plugin', 'preview', 'open.ts'),
      ),
    ).toEqual([join('src', 'plugin', 'actions.ts')]);
  });

  it('US-020 AC-1: the preset dropdown of the style panel calls usePreset (added 2026-10-21)', () => {
    const panel = readFileSync('src/plugin/preview/panel.ts', 'utf8');
    expect(panel).toContain('usePreset(name)');
    expect(panel).not.toContain('settings.update({activePreset');
  });

  it('US-020 AC-1: the Use button of the settings tab calls usePreset', () => {
    const tab = readFileSync('src/plugin/settings/settings-tab.ts', 'utf8');
    expect(tab).toContain('usePreset(entry.name)');
    expect(tab).not.toContain('settings.update({activePreset: entry.name})');
  });

  it('US-020 AC-3, AC-6, SCAR-017: menu items are drawn only by showEntries in main.ts (one addItem in src/plugin)', () => {
    const drawers = plugin.filter((file) =>
      readFileSync(file, 'utf8').includes('.addItem('),
    );
    expect(drawers).toEqual([join('src', 'plugin', 'main.ts')]);
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    expect(main.split('.addItem(').length - 1).toBe(1);
    const body = main.slice(main.indexOf('private showEntries('));
    expect(body.indexOf('.addItem(')).toBeGreaterThan(0);
    expect(body.indexOf('.addItem(')).toBeLessThan(body.indexOf('\n  }\n'));
  });

  it('US-020 AC-9: the commands keep their ids and names and call the actions; the ribbon icon is printer with the tooltip Obsidian2Typst', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8').replace(
      /\s+/g,
      ' ',
    );
    for (const [id, name] of [
      ['open-style-panel', 'Open style panel'],
      ['export-current-note', 'Export current note'],
      ['check-compiler', 'Check compiler (developer)'],
    ]) {
      expect(main).toContain(`id: '${id}', name: '${name}'`);
    }
    expect(main).toContain("addRibbonIcon('printer', 'Obsidian2Typst'");
    expect(main).toContain('actions.exportNote(');
    expect(main).toContain('actions.previewNote(');
  });
});
