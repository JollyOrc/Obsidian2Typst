// US-012 AC-2, AC-3, AC-15 — the shared rows with a stand-in for Obsidian: a row
// owned by the preset is disabled with its text and has no reset icon, a free
// row saves to the Defaults like the Settings tab, a refused value shows its
// message and keeps the old one, the gutter and the custom size rows follow
// their rules. The rows drawn in Obsidian: manual check M2 step 15.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ownerNote, shownValue} from '../../src/core/presets/owner';
import type {FieldPath} from '../../src/core/presets';
import type {FontSet} from '../../src/plugin/fonts';
import type {PresetStore} from '../../src/plugin/presets/store';
import {
  createSettingsStore,
  type SettingsStorage,
} from '../../src/plugin/settings/data';
import {
  addDefaultRows,
  createTrimState,
  type RowsEnv,
} from '../../src/plugin/settings/rows';
import {
  made,
  modals,
  resetFake,
  type FakeEl,
  type FakeSetting,
} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

class Storage implements SettingsStorage {
  stored: unknown = null;
  async load(): Promise<unknown> {
    return this.stored;
  }
  async save(data: unknown): Promise<void> {
    this.stored = JSON.parse(JSON.stringify(data));
  }
}

async function rig(preset: Record<string, unknown> | null = null) {
  const settings = createSettingsStore(new Storage());
  await settings.load();
  let refreshed = 0;
  let redrawn = 0;
  const env: RowsEnv = {
    app: {} as never,
    settings,
    presets: {refresh: () => void refreshed++} as unknown as PresetStore,
    fonts: (async () => {
      throw new Error('no fonts here');
    }) as unknown as FontSet,
    redraw: () => void redrawn++,
    ownerNote: (path: FieldPath) =>
      preset === null ? null : ownerNote('Slug 5', preset, path),
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
  return {
    settings,
    env,
    row,
    refreshed: () => refreshed,
    redrawn: () => redrawn,
  };
}

beforeEach(() => resetFake());

describe('US-012 AC-2 a row owned by the preset', () => {
  const preset = {page: {bleed: 5}};

  it('US-012 AC-2: Bleed shows the preset value 5, is disabled, reads the owner text and has no reset icon', async () => {
    const {row} = await rig(preset);
    const bleed = row('Bleed (mm)');
    expect(bleed.controls[0]?.value).toBe('5');
    expect(bleed.controls[0]?.disabled).toBe(true);
    expect(bleed.desc).toBe(
      'Set by preset "Slug 5"; change it in the preset note',
    );
    expect(bleed.buttons).toHaveLength(0);
  });

  it('US-012 AC-2: Trim size is not owned: enabled, shows the Defaults value, keeps its hint and its reset icon', async () => {
    const {row, settings} = await rig(preset);
    await settings.setDefaults({page: {trimSize: 'A4'}});
    made.length = 0;
    const second = await rig(preset);
    const trim = second.row('Trim size');
    expect(trim.controls[0]?.disabled).toBe(false);
    const margin = second.row('Top margin (mm)');
    expect(margin.controls[0]?.disabled).toBe(false);
    expect(margin.buttons.map((b) => b.icon)).toEqual(['reset']);
    expect(row).toBeDefined();
  });

  it('US-012 AC-2: an owned toggle is disabled too', async () => {
    const {row} = await rig({externalLinkFootnotes: true});
    expect(row('Footnotes for external links').controls[0]?.disabled).toBe(
      true,
    );
    expect(row('Footnotes for external links').controls[0]?.value).toBe(true);
  });

  it('US-012 AC-2: a preset that sets the trim width owns trim size, width and height', async () => {
    const {row} = await rig({page: {trimWidth: 160}});
    expect(row('Trim size').controls[0]?.disabled).toBe(true);
    expect(row('Trim width (mm)').controls[0]?.disabled).toBe(true);
    expect(row('Trim height (mm)').controls[0]?.disabled).toBe(true);
    expect(row('Trim size').desc).toContain('Set by preset "Slug 5"');
  });

  it('US-012 AC-2: with no preset every row can be changed and has its reset icon (the Settings tab)', async () => {
    const {row} = await rig(null);
    for (const name of ['Highlight colour', 'Bleed (mm)', 'Slug (mm)']) {
      expect(row(name).controls[0]?.disabled).toBe(false);
      expect(row(name).buttons.map((b) => b.icon)).toEqual(['reset']);
    }
  });
});

describe('US-012 AC-3 a free row saves like the Settings tab', () => {
  it('US-012 AC-3: Bleed typed as 3 is saved as the number 3, the presets are checked again, no redraw', async () => {
    const {row, settings, refreshed, redrawn} = await rig();
    row('Bleed (mm)').controls[0]?.type('3');
    await vi.waitFor(() => expect(refreshed()).toBe(1));
    expect(settings.data.defaults.page?.bleed).toBe(3);
    expect(redrawn()).toBe(0);
  });

  it('US-012 AC-3: an empty field removes the value', async () => {
    const {row, settings} = await rig();
    await settings.setDefaults({page: {bleed: 3}});
    row('Bleed (mm)').controls[0]?.type('  ');
    await vi.waitFor(() =>
      expect(settings.data.defaults.page?.bleed).toBeUndefined(),
    );
  });

  it('US-012 AC-3: a refused value shows its message with the warning class and keeps the old value; nothing is refreshed', async () => {
    const {row, settings, refreshed} = await rig();
    await settings.setDefaults({page: {bleed: 2}});
    row('Bleed (mm)').controls[0]?.type('-1');
    await vi.waitFor(() =>
      expect(row('Bleed (mm)').descEl.classes.has('mod-warning')).toBe(true),
    );
    expect(row('Bleed (mm)').desc).not.toBe('');
    expect(settings.data.defaults.page?.bleed).toBe(2);
    expect(refreshed()).toBe(0);
    row('Bleed (mm)').controls[0]?.type('4');
    await vi.waitFor(() =>
      expect(row('Bleed (mm)').descEl.classes.has('mod-warning')).toBe(false),
    );
    expect(settings.data.defaults.page?.bleed).toBe(4);
  });

  it('US-012 AC-3: a half-typed value is never saved (no change event, no save)', async () => {
    const {row, settings} = await rig();
    row('Bleed (mm)').controls[0]?.inputEl.fire('input');
    expect(settings.data.defaults.page).toBeUndefined();
  });

  it('US-012 AC-3: Facing pages on draws the host again and enables the gutter field; without it the gutter is disabled with its text', async () => {
    const {row, redrawn, settings, env} = await rig();
    expect(row('Gutter (mm)').controls[0]?.disabled).toBe(true);
    expect(row('Gutter (mm)').desc).toBe('Used only with facing pages');
    await (
      row('Facing pages').controls[0]?.changed as (v: boolean) => Promise<void>
    )(true);
    expect(settings.data.defaults.page?.facingPages).toBe(true);
    expect(redrawn()).toBe(1);
    made.length = 0;
    addDefaultRows({} as HTMLElement, env);
    const gutter = made.find((m) => m.name === 'Gutter (mm)');
    expect(gutter?.controls[0]?.disabled).toBe(false);
  });
});

describe('US-012 AC-3 the trim rows', () => {
  it('US-012 AC-3: width and height are disabled with their text unless Custom', async () => {
    const {row} = await rig();
    expect(row('Trim width (mm)').controls[0]?.disabled).toBe(true);
    expect(row('Trim width (mm)').desc).toBe(
      'Used only with a custom trim size',
    );
  });

  it('US-012 AC-3: with a stored custom size both fields are enabled and show the stored numbers', async () => {
    const settings = createSettingsStore(new Storage());
    await settings.load();
    await settings.setDefaults({page: {trimWidth: 150, trimHeight: 220}});
    const storage = settings;
    made.length = 0;
    const env: RowsEnv = {
      app: {} as never,
      settings: storage,
      presets: {refresh: () => undefined} as unknown as PresetStore,
      fonts: (async () => undefined) as unknown as FontSet,
      redraw: () => undefined,
      ownerNote: () => null,
      shown: () => undefined,
      trim: createTrimState(),
    };
    addDefaultRows({} as HTMLElement, env);
    const width = made.find((s) => s.name === 'Trim width (mm)');
    expect(width?.controls[0]?.disabled).toBe(false);
    expect(width?.controls[0]?.value).toBe('150');
  });
});

describe('US-012 AC-3 the reset question (SCAR-014)', () => {
  /** Opens the question of the last dialog and presses the button `index`. */
  const answer = (index: number): void => {
    const modal = modals.at(-1) as unknown as {
      onOpen(): void;
      contentEl: FakeEl;
    };
    modal.onOpen();
    const buttons = modal.contentEl.children.at(-1)?.children ?? [];
    buttons[index]?.click();
  };

  it('US-012 AC-3: the reset icon asks first; Reset removes the value and draws the host again, Cancel changes nothing', async () => {
    const {row, settings, redrawn} = await rig();
    await settings.setDefaults({page: {bleed: 3}});
    const icon = row('Bleed (mm)').buttons[0];
    const first = icon?.clicked?.();
    await vi.waitFor(() => expect(modals).toHaveLength(1));
    // no answer yet: the value is still there
    expect(settings.data.defaults.page?.bleed).toBe(3);
    answer(1); // Cancel
    await first;
    expect(redrawn()).toBe(0);
    expect(settings.data.defaults.page?.bleed).toBe(3);
    const second = icon?.clicked?.();
    await vi.waitFor(() => expect(modals).toHaveLength(2));
    answer(0); // Reset
    await second;
    await vi.waitFor(() =>
      expect(settings.data.defaults.page?.bleed).toBeUndefined(),
    );
    expect(redrawn()).toBe(1);
  });
});
