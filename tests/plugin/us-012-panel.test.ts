// US-012 AC-1, AC-2, AC-3, AC-5, AC-14, AC-15 — the panel: the command and the
// single view, who owns a value, the save of one Defaults field, the preset
// choices, the change event of the settings, and the text checks that keep the
// panel and the Settings tab on one set of row functions (SCAR-017). The panel
// drawn in Obsidian: manual check M2 step 15. Source of truth:
// docs/user-stories/US-012-style-preview-panel.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {ownerNote, shownValue} from '../../src/core/presets/owner';
import {
  VIEW_TYPE_STYLE_PANEL,
  openStylePanel,
  presetChoices,
  type PanelLeaf,
  type PanelWorkspace,
} from '../../src/plugin/preview/open';
import {saveDefaultsField} from '../../src/plugin/settings/save-field';
import {
  createSettingsStore,
  type PluginData,
  type SettingsStorage,
} from '../../src/plugin/settings/data';

const read = (path: string) => readFileSync(path, 'utf8');

class Leaf implements PanelLeaf {
  states: {type: string; active?: boolean}[] = [];
  async setViewState(state: {type: string; active?: boolean}): Promise<void> {
    this.states.push(state);
  }
}

class Workspace implements PanelWorkspace {
  leaves: Leaf[] = [];
  revealed: Leaf[] = [];
  rightLeaves = 0;
  rightAvailable = true;
  getLeavesOfType(type: string): Leaf[] {
    return type === VIEW_TYPE_STYLE_PANEL ? this.leaves : [];
  }
  getRightLeaf(): Leaf | null {
    if (!this.rightAvailable) return null;
    this.rightLeaves++;
    const leaf = new Leaf();
    this.leaves.push(leaf);
    return leaf;
  }
  async revealLeaf(leaf: PanelLeaf): Promise<void> {
    this.revealed.push(leaf as Leaf);
  }
}

describe('US-012 AC-1 the command and the single panel', () => {
  it('US-012 AC-1: the command is registered as "Open style panel"', () => {
    const main = read('src/plugin/main.ts');
    expect(main).toContain("id: 'open-style-panel'");
    expect(main).toContain("name: 'Open style panel'");
    expect(main).toContain('registerView(');
    expect(main).toContain('VIEW_TYPE_STYLE_PANEL');
  });

  it('US-012 AC-1: the first call makes a view in the right sidebar and shows it', async () => {
    const ws = new Workspace();
    expect(await openStylePanel(ws)).toBe(true);
    expect(ws.rightLeaves).toBe(1);
    expect(ws.leaves[0]?.states).toEqual([
      {type: VIEW_TYPE_STYLE_PANEL, active: true},
    ]);
    expect(ws.revealed).toEqual([ws.leaves[0]]);
  });

  it('US-012 AC-1: a second call shows the open panel; there is never a second one', async () => {
    const ws = new Workspace();
    await openStylePanel(ws);
    await openStylePanel(ws);
    expect(ws.rightLeaves).toBe(1);
    expect(ws.leaves).toHaveLength(1);
    expect(ws.leaves[0]?.states).toHaveLength(1);
    expect(ws.revealed).toHaveLength(2);
  });

  it('US-012 AC-1: no leaf on the right gives false and shows nothing', async () => {
    const ws = new Workspace();
    ws.rightAvailable = false;
    expect(await openStylePanel(ws)).toBe(false);
    expect(ws.revealed).toEqual([]);
  });

  it('US-012 AC-1: the panel holds the preset selector, the three groups, the range field, Refresh and the status line, in this order', () => {
    const panel = read('src/plugin/preview/panel.ts');
    const order = [
      'presetSelector',
      'pageRows',
      'fontRows',
      'coverRows',
      'rangeField',
      'Refresh',
      'statusLine',
      'previewArea',
    ].map((name) => panel.indexOf(name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('US-012 AC-2 who owns a value', () => {
  const preset = {page: {bleed: 5}};

  it('US-012 AC-2: a field the preset sets is owned by it, with the text of the story', () => {
    expect(ownerNote('Slug 5', preset, ['page', 'bleed'])).toBe(
      'Set by preset "Slug 5"; change it in the preset note',
    );
  });

  it('US-012 AC-2: a field the preset does not set is not owned (Trim size of the example)', () => {
    expect(ownerNote('Slug 5', preset, ['page', 'trimSize'])).toBeNull();
    expect(ownerNote('Slug 5', {}, ['page', 'bleed'])).toBeNull();
  });

  it('US-012 AC-2: trim size, width and height are one group: a preset that sets one owns all three', () => {
    const owned = {page: {trimWidth: 160}};
    for (const key of ['trimSize', 'trimWidth', 'trimHeight'])
      expect(ownerNote('P', owned, ['page', key])).toContain('Set by preset');
  });

  it('US-012 AC-2: a nested field (margins.top) is owned only when the preset sets that one', () => {
    const margins = {page: {margins: {top: 20}}};
    expect(ownerNote('P', margins, ['page', 'margins', 'top'])).toContain(
      'Set by',
    );
    expect(ownerNote('P', margins, ['page', 'margins', 'bottom'])).toBeNull();
  });

  it('US-012 AC-2: the shown value is the preset value when it owns the field, else the Defaults value, else nothing', () => {
    const defaults = {page: {bleed: 3, trimSize: 'A5'}};
    expect(shownValue(preset, defaults, ['page', 'bleed'])).toBe(5);
    expect(shownValue(preset, defaults, ['page', 'trimSize'])).toBe('A5');
    expect(shownValue(preset, defaults, ['page', 'gutter'])).toBeUndefined();
  });

  it('US-012 AC-2: the panel never writes a preset note', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).not.toMatch(
      /presets\.(create|rename|remove|duplicate)|vault\.(modify|create)/,
    );
  });
});

describe('US-012 AC-3 a change is a saved change', () => {
  function fakeDeps(initial: Record<string, unknown> = {}) {
    let defaults = initial;
    const calls: unknown[] = [];
    let refreshed = 0;
    return {
      calls,
      refreshed: () => refreshed,
      deps: {
        settings: {
          get data() {
            return {defaults} as unknown as PluginData;
          },
          setDefaults: async (fields: unknown) => {
            calls.push(fields);
            const page = (fields as {page?: {bleed?: number}}).page;
            if (page?.bleed !== undefined && page.bleed < 0)
              return {ok: false as const, error: 'Bleed must be 0 or more'};
            defaults = fields as Record<string, unknown>;
            return {ok: true as const, notices: ['note']};
          },
        },
        presets: {refresh: () => void refreshed++},
      },
    };
  }

  it('US-012 AC-3: Bleed 3 is saved into the Defaults, the presets are checked again, the notices come back', async () => {
    const {deps, calls, refreshed} = fakeDeps({page: {trimSize: 'A5'}});
    const result = await saveDefaultsField(deps, ['page', 'bleed'], 3);
    expect(result).toEqual({ok: true, notices: ['note']});
    expect(calls).toEqual([{page: {trimSize: 'A5', bleed: 3}}]);
    expect(deps.settings.data.defaults).toEqual({
      page: {trimSize: 'A5', bleed: 3},
    });
    expect(refreshed()).toBe(1);
  });

  it('US-012 AC-3: a refused value gives its message, the old value stays, the presets are not touched', async () => {
    const {deps, refreshed} = fakeDeps({page: {bleed: 2}});
    const result = await saveDefaultsField(deps, ['page', 'bleed'], -1);
    expect(result).toEqual({ok: false, error: 'Bleed must be 0 or more'});
    expect(deps.settings.data.defaults).toEqual({page: {bleed: 2}});
    expect(refreshed()).toBe(0);
  });

  it('US-012 AC-3: undefined removes the field (the reset of a row)', async () => {
    const {deps} = fakeDeps({page: {bleed: 2, gutter: 4}});
    await saveDefaultsField(deps, ['page', 'bleed'], undefined);
    expect(deps.settings.data.defaults).toEqual({page: {gutter: 4}});
  });

  it('US-012 AC-3: the save reads the Defaults when it runs, not when the control was made (SCAR-016)', async () => {
    const {deps} = fakeDeps({page: {bleed: 2}});
    const control = (value: number) =>
      saveDefaultsField(deps, ['page', 'bleed'], value);
    // the Settings tab changes another field after the control exists
    await deps.settings.setDefaults({page: {bleed: 2, gutter: 7}});
    await control(4);
    expect(deps.settings.data.defaults).toEqual({page: {bleed: 4, gutter: 7}});
  });

  it('US-012 AC-3: the Settings tab and the panel save through the same function, via the shared rows', () => {
    const rows = read('src/plugin/settings/rows.ts');
    expect(rows.match(/saveDefaultsField\(/g)?.length).toBeGreaterThanOrEqual(
      4,
    );
    for (const file of [
      'src/plugin/settings/settings-tab.ts',
      'src/plugin/preview/panel.ts',
    ]) {
      const source = read(file);
      expect(source, file).toContain('addDefaultRows(');
      expect(source, file).toContain('addFontRows(');
    }
  });
});

describe('US-012 AC-3 the preset selector', () => {
  const entries = [
    {name: 'A4 digital', valid: true},
    {name: 'A5 print', valid: true},
    {name: 'Broken', valid: false, error: 'page.bleed: not a number'},
  ];

  it('US-012 AC-3: valid presets can be chosen, an invalid one is listed greyed with its error as tooltip', () => {
    expect(presetChoices(entries, 'A5 print')).toEqual([
      {name: 'A4 digital', selectable: true, active: false, tooltip: null},
      {name: 'A5 print', selectable: true, active: true, tooltip: null},
      {
        name: 'Broken',
        selectable: false,
        active: false,
        tooltip: 'page.bleed: not a number',
      },
    ]);
  });

  it('US-012 AC-3: choosing a preset sets the active preset like the export command does', () => {
    // US-020 AC-1 (2026-10-21): through the usePreset action, which saves
    // activePreset (tested in us-020-actions-menus); main.ts wires it.
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).toContain('this.deps.usePreset(name)');
    const main = read('src/plugin/main.ts');
    expect(main).toContain('usePreset: (name) => this.actions.usePreset(name)');
  });
});

describe('US-012 AC-14 the panel follows the data', () => {
  class Storage implements SettingsStorage {
    stored: unknown = null;
    async load(): Promise<unknown> {
      return this.stored;
    }
    async save(data: unknown): Promise<void> {
      this.stored = JSON.parse(JSON.stringify(data));
    }
  }

  it('US-012 AC-14: the order draw, change, use: the store gives the new value to a control used after a change', async () => {
    const store = createSettingsStore(new Storage());
    await store.load();
    await store.setDefaults({page: {bleed: 2}});
    const drawnWith = store.data.defaults.page?.bleed;
    await store.setDefaults({page: {bleed: 4}});
    expect(drawnWith).toBe(2);
    expect(store.data.defaults.page?.bleed).toBe(4);
  });

  it('US-012 AC-14: the panel listens to the settings and the presets and stops listening when it closes', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).toContain('settings.onChange(');
    expect(panel).toContain('presets.onChange(');
    expect(panel).toContain('onClose');
    expect(panel).toMatch(/off\(\)|stopListening/);
  });

  it('US-012 AC-14: a change from any source goes to the controller as a style change', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).toContain('styleChanged(');
  });

  it('US-012 AC-5: the panel does not listen to edits of the note, only to its name and removal', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).not.toMatch(/['"]modify['"]|editor-change/);
    expect(panel).toContain("'rename'");
    expect(panel).toContain("'delete'");
    expect(panel).toContain('active-leaf-change');
  });
});

describe('US-012 AC-15 one set of rows (SCAR-017)', () => {
  const FORBIDDEN =
    /\.addText\(|\.addDropdown\(|\.addToggle\(|new ConfirmModal\(|createEl\('input'/;

  it('US-012 AC-15: the panel file builds no field of its own and imports the row functions', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).not.toMatch(FORBIDDEN);
    expect(panel).toMatch(/from '\.\.\/settings\/rows'/);
  });

  it('US-012 AC-15: the row functions live in rows.ts and are gone from the Settings tab', () => {
    const rows = read('src/plugin/settings/rows.ts');
    for (const name of [
      'DEFAULT_ROWS',
      'addTrimDropdown',
      'addResetButton',
      'saveDefaultsField',
    ])
      expect(rows, name).toContain(name);
    const tab = read('src/plugin/settings/settings-tab.ts');
    expect(tab).not.toMatch(
      /const DEFAULT_ROWS|addTrimDropdown\(setting|private addResetButton|private addTrimDropdown/,
    );
    expect(tab).toMatch(/from '\.\/rows'/);
  });

  it('US-012 AC-15: the range field and every other text field of the panel go through commitOnChange', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).toContain('commitOnChange(');
    expect(panel).not.toMatch(
      /addEventListener\('input'|onChange\(async \(text|inputEl\.addEventListener\('keyup'/,
    );
    const rows = read('src/plugin/settings/rows.ts');
    expect(rows).toContain('commitOnChange(');
    expect(rows).not.toMatch(
      /addText\([^)]*\)\s*\.\s*onChange|setValue\([^)]*\)\.onChange\(async \(text/,
    );
  });

  it('US-012 AC-15: a redraw of the panel keeps the scroll position', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).toContain('captureScroll(');
    expect(panel).toContain('requestAnimationFrame');
  });

  it('US-012 AC-15: the panel reads the state when a control is used (no value kept from the drawing)', () => {
    const panel = read('src/plugin/preview/panel.ts');
    expect(panel).not.toMatch(
      /const snapshot = this\.deps\.settings\.data|private data = /,
    );
  });
});

describe('US-012 AC-2, AC-7, AC-11, AC-15 more text checks (SCAR-008, SCAR-016, SCAR-017)', () => {
  it('US-012 AC-2: a row owned by a preset gets no reset icon', () => {
    const rows = read('src/plugin/settings/rows.ts');
    expect(rows).toMatch(/owner[\s\S]{0,400}setDisabled\(true\)/);
    expect(rows).toMatch(
      /owner === null[\s\S]{0,200}addResetButton|if \(owner[\s\S]{0,200}return/,
    );
  });

  it('US-012 AC-7: only the canvas helper creates a canvas', () => {
    for (const file of [
      'src/plugin/preview/panel.ts',
      'src/plugin/preview/browser-downsample.ts',
      'src/plugin/preview/renderer.ts',
      'src/plugin/settings/rows.ts',
    ]) {
      expect(read(file), file).not.toMatch(
        /createElement\(['"]canvas['"]\)|new OffscreenCanvas\(|createEl\(['"]canvas['"]/,
      );
    }
    expect(read('src/plugin/preview/canvas.ts')).toMatch(
      /createElement\(['"]canvas['"]\)|createEl\(['"]canvas['"]|new OffscreenCanvas\(/,
    );
    expect(read('src/plugin/preview/browser-downsample.ts')).toContain(
      "from './canvas'",
    );
  });

  it('US-012 AC-7: drawing is logged step by step', () => {
    expect(read('src/plugin/preview/panel.ts')).toContain('[o2t preview]');
  });

  it('US-012 AC-11: the greyed pages have opacity 0.4 in the style sheet', () => {
    expect(read('styles.css')).toMatch(
      /o2t-preview-greyed[^}]*opacity:\s*0\.4/,
    );
    expect(read('src/plugin/preview/panel.ts')).toContain('o2t-preview-greyed');
  });

  it('US-012 AC-15: over the tab, the rows module and the panel together, every text field is saved through commitOnChange and none on every key (class check over all files)', () => {
    const tab = read('src/plugin/settings/settings-tab.ts');
    const body = tab.slice(
      tab.indexOf('export class Obsidian2TypstSettingTab'),
    );
    const all = [
      body,
      read('src/plugin/settings/rows.ts'),
      read('src/plugin/preview/panel.ts'),
    ].join('\n');
    const fields = all.match(/\.addText\(/g)?.length ?? 0;
    const commits = all.match(/commitOnChange\(/g)?.length ?? 0;
    expect(fields).toBeGreaterThanOrEqual(5);
    expect(commits).toBeGreaterThanOrEqual(fields);
    expect(all).not.toMatch(/t\.onChange\(\s*async \(text\)/);
  });
});
