// US-021 AC-2 to AC-10 — the grouped preset lists (the panel's dropdown, the
// settings tab, the ribbon menu), the details pop-up as data (its table, its
// buttons and keys, where it opens) and how everything follows a change of a
// preset note (SCAR-016: draw, change, use). The screens in the app are
// checked by hand (AC-11). Source of truth:
// docs/user-stories/US-021-preset-groups-and-details.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));
// The panel restores its scroll in the next frame (US-008 AC-19); run it at once.
vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
  fn();
  return 0;
});

/** US-021: shapes of the modules that do not exist yet (red until the code). */
interface DetailRow {
  label: string;
  own: string;
  used: string;
  source: 'preset' | 'Defaults' | 'built-in' | null;
}
interface DetailButton {
  text: string;
  disabled: boolean;
  run?: () => Promise<void> | void;
}
interface DetailsView {
  title: string;
  rows?: DetailRow[];
  error?: string;
  buttons: DetailButton[];
  focus: string;
}
interface DetailsModule {
  detailRows(fields: unknown, defaults: unknown): DetailRow[];
  detailsView(
    deps: {
      presets: ReturnType<typeof createPresetStore>;
      settings: {data: {activePreset: string; defaults: unknown}};
      usePreset(name: string): Promise<void>;
      openNote(path: string): Promise<void>;
      close(): void;
    },
    name: string,
  ): DetailsView;
}
interface Choice {
  name: string;
  selectable: boolean;
  active: boolean;
}
interface OpenModule {
  presetDropdownGroups(
    entries: readonly {
      name: string;
      valid: boolean;
      group: string | null;
      error?: string;
    }[],
    active: string,
  ): {label: string | null; choices: Choice[]}[];
}
interface MenuEntry {
  title?: string;
  label?: boolean;
  separator?: boolean;
  checked?: boolean;
  disabled?: boolean;
}
interface MenusModule {
  ribbonMenuEntries(
    actions: unknown,
    presets: {
      names: readonly {name: string; valid: boolean; group: string | null}[];
      stored: string;
    },
  ): MenuEntry[];
}

const DETAILS = '../../src/plugin/settings/details';
const OPEN = '../../src/plugin/preview/open';
const MENUS = '../../src/plugin/menus';
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;

const FOLDER = 'Obsidian2Typst/presets';
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

async function rig(
  notes: Record<string, string>,
  stored: string,
  defaults: unknown = {},
) {
  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(notes)) {
    files[`${FOLDER}/${name}.md`] = text;
  }
  const vault = new FakeVault(files, [FOLDER]);
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: stored,
    defaults,
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
  const deps = {
    presets: store,
    settings,
    usePreset: async (name: string) => {
      log.push(`use:${name}`);
      await settings.update({activePreset: name});
    },
    openNote: async (path: string) => void log.push(`open:${path}`),
    close: () => void log.push('close'),
  };
  return {vault, settings, store, deps, log};
}

const GROUPED = {
  'A4 digital': fm('group: Screen'),
  'A5 print': fm('group: print'),
  Book: fm('group: Print'),
  Broken: fm('group: Print', 'page:', '  bleed: abc'),
  Minimal: fm(),
};

describe('US-021 AC-1, AC-2 the store knows each preset’s group', () => {
  it('US-021 AC-2: entries carry group (null without one); an invalid note that is YAML keeps its group', async () => {
    const {store} = await rig(GROUPED, 'A5 print');
    expect(
      store
        .entries()
        .map((e) => [
          e.name,
          (e as unknown as {group: string | null}).group,
          e.valid,
        ]),
    ).toEqual([
      ['A4 digital', 'Screen', true],
      ['A5 print', 'print', true],
      ['Book', 'Print', true],
      ['Broken', 'Print', false],
      ['Minimal', null, true],
    ]);
  });
});

describe('US-021 AC-3 the panel’s dropdown', () => {
  it('US-021 AC-3: one group per heading in AC-2 order; the invalid option disabled; the active one marked', async () => {
    const {presetDropdownGroups} = await load<OpenModule>(OPEN);
    const groups = presetDropdownGroups(
      [
        {name: 'A4 digital', valid: true, group: 'Screen'},
        {name: 'A5 print', valid: true, group: 'print'},
        {name: 'Book', valid: true, group: 'Print'},
        {name: 'Broken', valid: false, group: 'Print', error: 'bad'},
        {name: 'Minimal', valid: true, group: null},
      ],
      'Book',
    );
    expect(
      groups.map((g) => [
        g.label,
        g.choices.map(
          (c) => `${c.name}${c.selectable ? '' : '!'}${c.active ? '*' : ''}`,
        ),
      ]),
    ).toEqual([
      ['print', ['A5 print', 'Book*', 'Broken!']],
      ['Screen', ['A4 digital']],
      ['Other', ['Minimal']],
    ]);
  });

  it('US-021 AC-3: without groups one unlabelled group, as today', async () => {
    const {presetDropdownGroups} = await load<OpenModule>(OPEN);
    const groups = presetDropdownGroups(
      [
        {name: 'A', valid: true, group: null},
        {name: 'B', valid: true, group: null},
      ],
      'A',
    );
    expect(groups.map((g) => [g.label, g.choices.length])).toEqual([[null, 2]]);
  });

  it('US-021 AC-3: drawn with groups, the options sit in labelled optgroups, the invalid one disabled with its error', async () => {
    const {addPresetDropdown} = await import('../../src/plugin/settings/rows');
    const {made} = await import('../support/fake-obsidian');
    const {presetDropdownGroups} = await load<OpenModule>(OPEN);
    const before = made.length;
    addPresetDropdown(
      new (await import('../support/fake-obsidian')).FakeEl() as never,
      presetDropdownGroups(
        [
          {name: 'A5 print', valid: true, group: 'Print'},
          {name: 'Broken', valid: false, group: 'Print', error: 'bad (line 4)'},
          {name: 'Minimal', valid: true, group: null},
        ],
        'A5 print',
      ) as never,
      () => undefined,
    );
    const select = made[before]?.controls[0]?.selectEl;
    expect(select?.groups).toEqual([
      {label: 'Print', values: ['A5 print', 'Broken']},
      {label: 'Other', values: ['Minimal']},
    ]);
    expect(
      select?.options.map((o) => [o.value, o.disabled === true, o.title ?? '']),
    ).toEqual([
      ['A5 print', false, ''],
      ['Broken', true, 'bad (line 4)'],
      ['Minimal', false, ''],
    ]);
  });

  it('US-021 AC-3, AC-9: the style panel draws the store\u2019s groups into its dropdown', async () => {
    const {store, settings} = await rig(GROUPED, 'A5 print');
    const fake = await import('../support/fake-obsidian');
    const {StylePanelView} = await import('../../src/plugin/preview/panel');
    fake.resetFake();
    const app = new fake.FakeApp();
    const view = new StylePanelView(
      {app} as never,
      {
        settings,
        presets: store,
        fonts: (async () => undefined) as never,
        controller: {
          state: {
            status: 'no-note',
            note: null,
            noteName: null,
            error: null,
            hint: null,
            warnings: 0,
            greyed: false,
            pages: null,
            rangeText: '',
            rangeError: null,
            rangeMessage: null,
            shown: [],
          },
          setNote: () => undefined,
        } as never,
        usePreset: async () => undefined,
        subscribe: () => () => undefined,
      } as never,
    );
    await view.onOpen();
    const dropdown = fake.made.find((m) => m.name === 'Preset')?.controls[0];
    expect(dropdown?.selectEl.groups).toEqual([
      {label: 'print', values: ['A5 print', 'Book', 'Broken']},
      {label: 'Screen', values: ['A4 digital']},
      {label: 'Other', values: ['Minimal']},
    ]);
    await view.onClose();
  });

  it('US-021 AC-3: the dropdown places options in optgroup elements (text check)', () => {
    const rows = readFileSync('src/plugin/settings/rows.ts', 'utf8');
    const body = rows.slice(rows.indexOf('export function addPresetDropdown('));
    expect(body.slice(0, body.indexOf('\n}\n'))).toContain("'optgroup'");
  });
});

describe('US-021 AC-4 the settings tab’s list (text checks)', () => {
  const tab = readFileSync('src/plugin/settings/settings-tab.ts', 'utf8');
  it('US-021 AC-4: the list is grouped by groupPresets with a heading row per group', () => {
    expect(tab).toContain('groupPresets(');
    expect(tab).toMatch(
      /if \(group\.heading !== null\) \{\s*new Setting\(root\)\.setName\(group\.heading\)\.setHeading\(\);\s*\}/,
    );
  });
  it('US-021 AC-4: each row has Details right after Use, opening the pop-up of that preset', () => {
    const use = tab.indexOf("isActive ? 'In use' : 'Use'");
    const details = tab.indexOf("setButtonText('Details')");
    const duplicate = tab.indexOf("setButtonText('Duplicate')");
    expect(use).toBeGreaterThan(0);
    expect(details).toBeGreaterThan(use);
    expect(details).toBeLessThan(duplicate);
    expect(tab).toContain('openDetails(entry.name)');
  });
});

describe('US-021 AC-5 the ribbon menu', () => {
  const view = {
    names: [
      {name: 'A4 digital', valid: true, group: 'Screen'},
      {name: 'A5 print', valid: true, group: 'print'},
      {name: 'Book', valid: true, group: 'Print'},
      {name: 'Minimal', valid: true, group: null},
    ],
    stored: 'A5 print',
  };
  it('US-021 AC-5: a separator and a label per group replace the Preset label', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const entries = ribbonMenuEntries({}, view);
    expect(
      entries
        .slice(2)
        .map((e) =>
          e.separator === true
            ? '---'
            : `${e.title ?? ''}${e.label ? ' (label)' : ''}${e.checked ? ' ✓' : ''}`,
        ),
    ).toEqual([
      '---',
      'print (label)',
      'A5 print ✓',
      'Book',
      '---',
      'Screen (label)',
      'A4 digital',
      '---',
      'Other (label)',
      'Minimal',
    ]);
  });

  it('US-021 AC-5: without groups the US-020 menu stays (Preset label, no group labels)', async () => {
    const {ribbonMenuEntries} = await load<MenusModule>(MENUS);
    const entries = ribbonMenuEntries(
      {},
      {
        names: view.names.map((n) => ({...n, group: null})),
        stored: 'A5 print',
      },
    );
    expect(entries.filter((e) => e.label).map((e) => e.title)).toEqual([
      'Preset',
    ]);
  });
});

describe('US-021 AC-6 the details table', () => {
  it('US-021 AC-6: the story example — own value, used value and its source', async () => {
    const {detailRows} = await load<DetailsModule>(DETAILS);
    const rows = detailRows(
      {page: {trimSize: 'A5', bleed: 3}},
      {page: {bleed: 2}, highlightColor: '#00ff00'},
    );
    const byLabel = (label: string) => rows.find((r) => r.label === label);
    expect(byLabel('Highlight colour')).toEqual({
      label: 'Highlight colour',
      own: '',
      used: '#00ff00',
      source: 'Defaults',
    });
    expect(byLabel('Trim size')).toEqual({
      label: 'Trim size',
      own: 'A5',
      used: 'A5',
      source: 'preset',
    });
    expect(byLabel('Bleed (mm)')).toEqual({
      label: 'Bleed (mm)',
      own: '3',
      used: '3',
      source: 'preset',
    });
    expect(byLabel('Slug (mm)')).toEqual({
      label: 'Slug (mm)',
      own: '',
      used: '0',
      source: 'built-in',
    });
  });

  it('US-021 AC-6: the trim size is one group (US-009 AC-14): a preset trimSize owns the width row, whose value is set nowhere', async () => {
    const {detailRows} = await load<DetailsModule>(DETAILS);
    const rows = detailRows({page: {trimSize: 'A5'}}, {page: {trimWidth: 150}});
    expect(rows.find((r) => r.label === 'Trim width (mm)')).toEqual({
      label: 'Trim width (mm)',
      own: '',
      used: '—',
      source: 'preset',
    });
  });

  it('US-021 AC-6: rows in the order of the Defaults rows, then fonts, then the three summaries', async () => {
    const {detailRows} = await load<DetailsModule>(DETAILS);
    const labels = detailRows({}, {}).map((r) => r.label);
    expect(labels[0]).toBe('Highlight colour');
    expect(labels.indexOf('Gutter (mm)')).toBeLessThan(
      labels.indexOf('Page numbers'),
    );
    expect(labels.indexOf('Link page word')).toBeLessThan(
      labels.indexOf('Font folder'),
    );
    expect(labels.slice(-3)).toEqual([
      'Cover',
      'Callout styles',
      'Heading rules',
    ]);
  });

  it('US-021 AC-6: values are written as text — true/false, numbers as written, a missing value as —', async () => {
    const {detailRows} = await load<DetailsModule>(DETAILS);
    const rows = detailRows({page: {facingPages: false}}, {});
    const byLabel = (label: string) => rows.find((r) => r.label === label);
    expect(byLabel('Facing pages')).toMatchObject({
      own: 'false',
      used: 'false',
      source: 'preset',
    });
    expect(byLabel('Body size (pt)')).toMatchObject({
      own: '',
      used: '10',
      source: 'built-in',
    });
    expect(byLabel('Body font')).toMatchObject({
      own: '',
      used: '—',
      source: 'built-in',
    });
  });

  it('US-021 AC-6 (decision 3): the summaries of cover, callout styles and heading rules', async () => {
    const {detailRows} = await load<DetailsModule>(DETAILS);
    const rows = detailRows(
      {
        cover: {mode: 'auto', file: 'assets/cover.png'},
        callouts: {example: {}, rule: {}},
        headingRules: {Glossary: 'glossary', Index: 'none'},
      },
      {},
    );
    const byLabel = (label: string) => rows.find((r) => r.label === label);
    expect(byLabel('Cover')).toMatchObject({
      used: 'auto, assets/cover.png',
      source: 'preset',
    });
    expect(byLabel('Callout styles')).toMatchObject({
      used: 'example, rule',
      source: 'preset',
    });
    expect(byLabel('Heading rules')).toMatchObject({
      used: 'Glossary → glossary, Index → none',
      source: 'preset',
    });
    const none = detailRows({}, {});
    // US-011: the built-in cover is auto (the first image of the note)
    expect(none.find((r) => r.label === 'Cover')).toMatchObject({
      used: 'auto',
      source: 'built-in',
    });
  });
});

describe('US-021 AC-7 the pop-up’s buttons and keys', () => {
  it('US-021 AC-7: Use, Open the note, Close; Close has the focus; the title names the preset', async () => {
    const {deps} = await rig(GROUPED, 'A5 print');
    const {detailsView} = await load<DetailsModule>(DETAILS);
    const view = detailsView(deps, 'Book');
    expect(view.title).toBe('Preset "Book"');
    expect(view.buttons.map((b) => [b.text, b.disabled])).toEqual([
      ['Use', false],
      ['Open the note', false],
      ['Close', false],
    ]);
    expect(view.focus).toBe('Close');
  });

  it('US-021 AC-7 (decision 2): Use makes it active and the pop-up stays with In use (draw, change, use)', async () => {
    const {deps, settings, log} = await rig(GROUPED, 'A5 print');
    const {detailsView} = await load<DetailsModule>(DETAILS);
    await detailsView(deps, 'Book').buttons[0]?.run?.();
    expect(settings.data.activePreset).toBe('Book');
    expect(log).toEqual(['use:Book']);
    const again = detailsView(deps, 'Book');
    expect(again.buttons[0]).toMatchObject({text: 'In use', disabled: true});
  });

  it('US-021 AC-7: Open the note opens the preset note and closes the pop-up', async () => {
    const {deps, log} = await rig(GROUPED, 'A5 print');
    const {detailsView} = await load<DetailsModule>(DETAILS);
    await detailsView(deps, 'Book').buttons[1]?.run?.();
    expect(log).toEqual([`open:${FOLDER}/Book.md`, 'close']);
  });

  it('US-021 AC-6, AC-7: an invalid preset shows its error, Use disabled, Open the note enabled', async () => {
    const {deps} = await rig(GROUPED, 'A5 print');
    const {detailsView} = await load<DetailsModule>(DETAILS);
    const view = detailsView(deps, 'Broken');
    expect(view.error).toBe(
      'page.bleed must be a number of at least 0 (line 5)',
    );
    expect(view.rows).toBeUndefined();
    expect(view.buttons.map((b) => [b.text, b.disabled])).toEqual([
      ['Use', true],
      ['Open the note', false],
      ['Close', false],
    ]);
  });

  it('US-021 AC-7: Escape closes (the modal is an Obsidian Modal) and the focus goes to Close (text check)', () => {
    const modal = readFileSync('src/plugin/settings/details-modal.ts', 'utf8');
    expect(modal).toContain('extends Modal');
    expect(modal).toContain('.focus()');
  });
});

describe('US-021 AC-8, AC-9 where it opens and how it follows (SCAR-016)', () => {
  it('US-021 AC-8: the panel button is info / Details of the preset and reads the active preset at the click (text check)', () => {
    const panel = readFileSync('src/plugin/preview/panel.ts', 'utf8');
    expect(panel).toContain("setIcon('info')");
    expect(panel).toContain("setTooltip('Details of the preset')");
    expect(panel).toMatch(
      /onClick\(\(\) =>\s*this\.deps\.openDetails\(this\.deps\.settings\.data\.activePreset\)/,
    );
  });

  it('US-021 AC-9 (decision 1): drawn, the note edited, drawn again: the new value; deleted: does not exist with only Close', async () => {
    const {deps, vault, store} = await rig(
      {'A5 print': fm('page:', '  bleed: 3')},
      'A5 print',
    );
    const {detailsView} = await load<DetailsModule>(DETAILS);
    const before = detailsView(deps, 'A5 print');
    expect(before.rows?.find((r) => r.label === 'Bleed (mm)')?.used).toBe('3');
    vault.edit(`${FOLDER}/A5 print.md`, fm('page:', '  bleed: 4'));
    await store.load();
    const after = detailsView(deps, 'A5 print');
    expect(after.rows?.find((r) => r.label === 'Bleed (mm)')).toMatchObject({
      own: '4',
      used: '4',
      source: 'preset',
    });
    vault.remove(`${FOLDER}/A5 print.md`);
    await store.load();
    const gone = detailsView(deps, 'A5 print');
    expect(gone.error).toBe('Preset "A5 print" does not exist');
    expect(gone.buttons.map((b) => b.text)).toEqual(['Close']);
  });

  it('US-021 AC-9: the open pop-up redraws on presets.onChange and stops listening when closed (text check)', () => {
    const modal = readFileSync('src/plugin/settings/details-modal.ts', 'utf8');
    expect(modal).toContain('presets.onChange(');
    // and on the settings, so `In use` follows a preset chosen elsewhere
    expect(modal).toContain('settings.onChange(');
    const close = modal.slice(modal.indexOf('onClose()'));
    expect(close.slice(0, close.indexOf('\n  }\n'))).toContain('stop()');
  });
});

describe('US-021 AC-9 every screen follows the loading of the store (found by M11 step 3)', () => {
  /** A store over `notes` that is not loaded yet, as at Obsidian's start. */
  async function unloaded(notes: Record<string, string>) {
    const files: Record<string, string> = {};
    for (const [name, text] of Object.entries(notes)) {
      files[`${FOLDER}/${name}.md`] = text;
    }
    const vault = new FakeVault(files, [FOLDER, 'Other']);
    let saved: unknown = {
      ...structuredClone(DEFAULT_PLUGIN_DATA),
      activePreset: 'Folios',
    };
    const settings = createSettingsStore({
      load: async () => saved,
      save: async (data) => {
        saved = data;
      },
    });
    await settings.load();
    let folder = FOLDER;
    const store = createPresetStore({
      vault,
      folder: () => folder,
      defaults: () => settings.data.defaults,
      notify: () => undefined,
    });
    return {vault, settings, store, setFolder: (f: string) => (folder = f)};
  }

  it('US-021 AC-9: load() tells every listener once, with the names it read', async () => {
    const {store} = await unloaded({Folios: fm('group: Print'), Minimal: fm()});
    const heard: string[][] = [];
    store.onChange((names) => void heard.push(names));
    await store.load();
    expect(heard).toEqual([['Folios', 'Minimal']]);
  });

  it('US-021 AC-9: loading another folder that has no preset note tells the listeners too (an empty list)', async () => {
    const {vault, store, setFolder} = await unloaded({Folios: fm()});
    await store.load();
    vault.edit('Other/readme.txt', 'not a preset');
    const heard: string[][] = [];
    store.onChange((names) => void heard.push(names));
    setFolder('Other');
    await store.load();
    // the folder exists and holds no preset note: the listeners hear an empty list
    expect(heard).toEqual([[]]);
  });

  it('US-021 AC-9: a style panel drawn before the load shows the grouped presets after it (draw, load, look)', async () => {
    const {settings, store} = await unloaded({
      Folios: fm('group: Print'),
      Minimal: fm(),
    });
    const fake = await import('../support/fake-obsidian');
    const {StylePanelView} = await import('../../src/plugin/preview/panel');
    fake.resetFake();
    const view = new StylePanelView(
      {app: new fake.FakeApp()} as never,
      {
        settings,
        presets: store,
        fonts: (async () => undefined) as never,
        controller: {
          state: {
            status: 'no-note',
            note: null,
            noteName: null,
            error: null,
            hint: null,
            warnings: 0,
            greyed: false,
            pages: null,
            rangeText: '',
            rangeError: null,
            rangeMessage: null,
            shown: [],
          },
          setNote: () => undefined,
          styleChanged: () => undefined,
        } as never,
        usePreset: async () => undefined,
        openDetails: () => undefined,
        subscribe: () => () => undefined,
      } as never,
    );
    await view.onOpen();
    await store.load();
    const dropdown = fake.made.filter((m) => m.name === 'Preset').at(-1)
      ?.controls[0];
    expect(dropdown?.selectEl.groups).toEqual([
      {label: 'Print', values: ['Folios']},
      {label: 'Other', values: ['Minimal']},
    ]);
    await view.onClose();
  });
});

describe('US-021 AC-2, SCAR-017 every list of presets groups through groupPresets', () => {
  it('US-021 AC-2: settings tab, dropdown model and ribbon menu call groupPresets', () => {
    for (const file of [
      'src/plugin/settings/settings-tab.ts',
      'src/plugin/preview/open.ts',
      'src/plugin/menus.ts',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toContain('groupPresets(');
    }
  });
});
