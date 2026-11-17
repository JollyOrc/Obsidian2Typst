// US-042 AC-12, AC-13 — the settings tab: the debug info text and its button in
// the first line; the reset of a whole section (which paths, what is removed, the
// question, Cancel first) and the rows that offer it. The tab is drawn with the
// fake `obsidian` as in us-029-settings-tab. Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createFontCatalog} from '../../src/core/fonts';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {
  made,
  modals,
  resetFake,
  type FakeEl,
  type FakeSetting,
} from '../support/fake-obsidian';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));
vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
  fn();
  return 0;
});

const FOLDER = 'Obsidian2Typst/presets';
const FONTS = async () => ({
  catalog: createFontCatalog([
    {family: 'Libertinus Serif', coverage: [32, 95]},
  ]),
  files: [],
  warnings: [],
});

describe('US-042 AC-12: the debug info text', () => {
  it('versions, enabled plugins sorted by id, the settings file', async () => {
    const {debugInfo} = await import('../../src/plugin/debug-info');
    expect(
      debugInfo({
        pluginVersion: '0.16.0',
        obsidianVersion: '1.15.0',
        settingsText: '{"activePreset":"A5 print"}',
        plugins: [
          {id: 'obsidian2typst', version: '0.16.0'},
          {id: 'game-card-creator', version: '0.7.0'},
        ],
      }),
    ).toBe(
      [
        'Obsidian2Typst 0.16.0',
        'Obsidian 1.15.0',
        'Enabled plugins:',
        '- game-card-creator 0.7.0',
        '- obsidian2typst 0.16.0',
        'Settings file:',
        '{"activePreset":"A5 print"}',
        '',
      ].join('\n'),
    );
  });

  it('no settings file, no plugins', async () => {
    const {debugInfo} = await import('../../src/plugin/debug-info');
    expect(
      debugInfo({
        pluginVersion: '0.16.0',
        obsidianVersion: '1.15.0',
        settingsText: null,
        plugins: [],
      }),
    ).toBe(
      'Obsidian2Typst 0.16.0\nObsidian 1.15.0\nEnabled plugins:\nSettings file:\n(no settings file)\n',
    );
  });
});

async function tab(defaults: unknown = {}) {
  resetFake();
  const vault = new FakeVault(
    {[`${FOLDER}/A5 print.md`]: '---\nschemaVersion: 1\n---\n'},
    [FOLDER],
  );
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: 'A5 print',
    defaults,
  };
  const settings = createSettingsStore({
    load: async () => saved,
    save: async (data) => {
      saved = JSON.parse(JSON.stringify(data));
    },
  });
  await settings.load();
  const presets = createPresetStore({
    vault,
    folder: () => settings.data.presetsFolder,
    defaults: () => settings.data.defaults,
    notify: () => undefined,
  });
  await presets.load();
  let copied = 0;
  const {Obsidian2TypstSettingTab} =
    await import('../../src/plugin/settings/settings-tab');
  const t = new Obsidian2TypstSettingTab(
    {} as never,
    {manifest: {version: '0.16.0-test'}} as never,
    {
      settings,
      presets,
      fonts: FONTS as never,
      usePreset: async () => undefined,
      openDetails: () => undefined,
      copyDebugInfo: async () => void copied++,
    } as never,
  );
  t.display();
  const root = (t as unknown as {containerEl: FakeEl}).containerEl;
  return {root, settings, copied: () => copied};
}

function inside(el: unknown, ancestor: FakeEl): boolean {
  let at = el as FakeEl | null | undefined;
  while (at !== null && at !== undefined) {
    if (at === ancestor) return true;
    at = at.parentElement;
  }
  return false;
}
const sections = (root: FakeEl): FakeEl[] =>
  root.descendants().filter((el) => el.tag === 'details');
const nameOf = (section: FakeEl): string =>
  made.find((s) => s.heading && inside(s.parent, section))?.name ?? '';
const section = (root: FakeEl, name: string): FakeEl => {
  const found = sections(root).find((s) => nameOf(s) === name);
  if (found === undefined) throw new Error(`no section ${name}`);
  return found;
};
const rowsIn = (el: FakeEl): FakeSetting[] =>
  made.filter((s) => inside(s.parent, el));

describe('US-042 AC-12: the first line of the tab', () => {
  it('the version text, and a bug button that copies the debug info', async () => {
    const t = await tab();
    const first = t.root.children[0] as FakeEl;
    const row = made.find((s) => inside(s.parent, first));
    expect(row?.desc).toBe('Obsidian2Typst 0.16.0-test');
    const bug = row?.buttons.find((b) => b.icon === 'bug');
    expect(bug?.tooltip).toBe('Copy debug info');
    await bug?.clicked?.();
    expect(t.copied()).toBe(1);
  });

  it("no heading with the plugin's name", async () => {
    const t = await tab();
    const headings = made.filter((s) => s.heading).map((s) => s.name);
    expect(headings).not.toContain('Obsidian2Typst');
    expect(t.root.descendants().some((e) => e.tag === 'h2')).toBe(false);
  });
});

describe('US-042 AC-13: which values a section reset removes', () => {
  it('the sections that offer it (P3)', async () => {
    const {RESETTABLE_SECTIONS} =
      await import('../../src/plugin/settings/section-reset');
    expect(RESETTABLE_SECTIONS).toEqual(['Page', 'Text', 'Book']);
  });

  it("the paths of a section: its rows and toggles, no other section's", async () => {
    const {sectionResetPaths} =
      await import('../../src/plugin/settings/section-reset');
    const page = sectionResetPaths('Page').map((p) => p.join('.'));
    expect(page).toContain('page.bleed');
    expect(page).toContain('page.facingPages');
    expect(page).toContain('page.folios');
    expect(page).not.toContain('toc.depth');
    const book = sectionResetPaths('Book').map((p) => p.join('.'));
    expect(book).toContain('toc.depth');
    expect(book).not.toContain('page.bleed');
    const text = sectionResetPaths('Text').map((p) => p.join('.'));
    expect(text).toContain('fonts.body.size');
    expect(text).toContain('linkPageNumbers');
    // No section's paths overlap another's.
    const all = [...page, ...book, ...text];
    expect(new Set(all).size).toBe(all.length);
  });

  it('withoutPaths removes exactly those keys; an object left empty goes', async () => {
    const {withoutPaths} =
      await import('../../src/plugin/settings/section-reset');
    const fields = {
      page: {bleed: 5},
      toc: {depth: 2},
      fonts: {body: {size: 10}},
    };
    expect(withoutPaths(fields, [['page', 'bleed']])).toEqual({
      toc: {depth: 2},
      fonts: {body: {size: 10}},
    });
    expect(withoutPaths(fields, [['fonts', 'body', 'size']])).toEqual({
      page: {bleed: 5},
      toc: {depth: 2},
    });
    expect(fields).toEqual({
      page: {bleed: 5},
      toc: {depth: 2},
      fonts: {body: {size: 10}},
    });
  });

  it('the question', async () => {
    const {resetSectionQuestion} =
      await import('../../src/plugin/settings/section-reset');
    expect(resetSectionQuestion('Page')).toEqual({
      title: 'Reset "Page" to its defaults?',
      lines: [
        'Your values in this section will be removed; presets that do not set them use the built-in values.',
      ],
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    });
  });
});

describe('US-042 AC-13: the reset itself', () => {
  async function store(defaults: unknown) {
    let saves = 0;
    const settings = createSettingsStore({
      load: async () => ({...structuredClone(DEFAULT_PLUGIN_DATA), defaults}),
      save: async () => void saves++,
    });
    await settings.load();
    return {settings, saves: () => saves};
  }

  it('Page: removes the bleed, keeps the contents depth (Book)', async () => {
    const {resetSection} =
      await import('../../src/plugin/settings/section-reset');
    const s = await store({page: {bleed: 5}, toc: {depth: 2}});
    const asked: string[] = [];
    expect(
      await resetSection(
        {
          settings: s.settings,
          confirm: async (q) => (asked.push(q.title), true),
        },
        'Page',
      ),
    ).toBe(true);
    expect(asked).toEqual(['Reset "Page" to its defaults?']);
    expect(s.settings.data.defaults).toEqual({toc: {depth: 2}});
    expect(s.saves()).toBe(1);
  });

  it('Cancel: nothing changes, nothing is saved', async () => {
    const {resetSection} =
      await import('../../src/plugin/settings/section-reset');
    const s = await store({page: {bleed: 5}});
    expect(
      await resetSection(
        {settings: s.settings, confirm: async () => false},
        'Page',
      ),
    ).toBe(false);
    expect(s.settings.data.defaults).toEqual({page: {bleed: 5}});
    expect(s.saves()).toBe(0);
  });

  it('nothing to remove: no question, nothing saved', async () => {
    const {resetSection} =
      await import('../../src/plugin/settings/section-reset');
    const s = await store({toc: {depth: 2}});
    const asked: string[] = [];
    expect(
      await resetSection(
        {
          settings: s.settings,
          confirm: async (q) => (asked.push(q.title), true),
        },
        'Page',
      ),
    ).toBe(false);
    expect(asked).toEqual([]);
    expect(s.saves()).toBe(0);
  });

  it('reads the Defaults when it runs, not when the tab was drawn (SCAR-016)', async () => {
    const {resetSection} =
      await import('../../src/plugin/settings/section-reset');
    const s = await store({});
    await s.settings.setDefaults({page: {bleed: 3}});
    await resetSection(
      {settings: s.settings, confirm: async () => true},
      'Page',
    );
    expect(s.settings.data.defaults).toEqual({});
  });
});

describe('US-042 AC-13: the rows in the tab', () => {
  beforeEach(() => resetFake());
  it('Page, Text and Book end with the reset row; Presets and Export have none', async () => {
    const t = await tab();
    for (const name of ['Page', 'Text', 'Book']) {
      const rows = rowsIn(section(t.root, name));
      expect(rows.at(-1)?.buttons.map((b) => b.text)).toEqual([
        'Reset this section to defaults',
      ]);
    }
    for (const name of ['Presets', 'Export']) {
      const texts = rowsIn(section(t.root, name)).flatMap((r) =>
        r.buttons.map((b) => b.text),
      );
      expect(texts).not.toContain('Reset this section to defaults');
    }
  });

  it("the row opens the question with Cancel first; Reset removes the section's values", async () => {
    const t = await tab({page: {bleed: 5}, toc: {depth: 2}});
    const rows = rowsIn(section(t.root, 'Page'));
    const before = modals.length;
    void rows.at(-1)?.buttons[0]?.clicked?.();
    await Promise.resolve();
    expect(modals.length).toBe(before + 1);
    const modal = modals.at(-1) as unknown as {
      contentEl: FakeEl;
      onOpen(): void;
    };
    modal.onOpen();
    const buttons = modal.contentEl
      .descendants()
      .filter((e) => e.tag === 'button');
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Reset']);
    buttons[1]?.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(t.settings.data.defaults).toEqual({toc: {depth: 2}});
  });
});
