// US-029 AC-1 to AC-3, AC-5 to AC-7, AC-11 — the settings tab drawn with the
// fake `obsidian`: its sections, feature rows (toggle, reset icon, gear), the
// gear's modal (rows, saving on close, redraws; SCAR-013, SCAR-016: draw,
// change, use), the preset row and the open and closed sections. The look
// (chevrons, the gear's kept space) and the keys of a section are checked in
// M19. Source of truth:
// docs/user-stories/US-029-settings-screen-and-menu-marking.md.
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
  notices,
  resetFake,
  type FakeEl,
  type FakeSetting,
} from '../support/fake-obsidian';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));
// The tab restores its scroll in the next frame (US-008 AC-19); run it at once.
vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
  fn();
  return 0;
});

const FOLDER = 'Obsidian2Typst/presets';
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/**
 * The font set a real `FontSet` gives: a catalog of two families (coverage
 * runs as in us-010: printable ASCII), no files, no warnings. Added at #112:
 * the first rig returned undefined, which the font rows report as an error.
 */
const FONTS = async () => ({
  catalog: createFontCatalog([
    {family: 'Libertinus Serif', coverage: [32, 95]},
    {family: 'DejaVu Sans Mono', coverage: [32, 95]},
  ]),
  files: [],
  warnings: [],
});

/** What a test calls on a modal the code opened (Obsidian calls these). */
interface OpenedModal {
  titleEl: FakeEl;
  contentEl: FakeEl;
  onOpen(): void;
  onClose(): void;
}

async function rig(defaults: unknown = {}, notes?: Record<string, string>) {
  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(
    notes ?? {'A5 print': fm('page:', '  trimSize: A5'), Book: fm()},
  )) {
    files[`${FOLDER}/${name}.md`] = text;
  }
  const vault = new FakeVault(files, [FOLDER]);
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: 'A5 print',
    defaults,
  };
  let saves = 0;
  const settings = createSettingsStore({
    load: async () => saved,
    save: async (data) => {
      saves++;
      saved = JSON.parse(JSON.stringify(data));
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
  const opened: string[] = [];
  const {Obsidian2TypstSettingTab} =
    await import('../../src/plugin/settings/settings-tab');
  const make = () =>
    new Obsidian2TypstSettingTab(
      {} as never,
      {manifest: {version: '0.11.0-test'}} as never,
      {
        settings,
        presets: store,
        fonts: FONTS as never,
        usePreset: async (name: string) => {
          await settings.update({activePreset: name});
        },
        openDetails: (name: string) => void opened.push(name),
      },
    );
  const tab = make();
  tab.display();
  const root = (tab as unknown as {containerEl: FakeEl}).containerEl;
  return {
    tab,
    make,
    root,
    settings,
    store,
    vault,
    opened,
    saves: () => saves,
    saved: () => saved,
  };
}

/** True when `el` is `ancestor` or lies inside it. */
function inside(el: unknown, ancestor: FakeEl): boolean {
  let node = el as FakeEl | null | undefined;
  while (node !== null && node !== undefined) {
    if (node === ancestor) return true;
    node = node.parentElement;
  }
  return false;
}

/** The `details` elements of a screen, in order. */
const sectionsOf = (root: FakeEl): FakeEl[] =>
  root.children.filter((c) => c.tag === 'details');

/** The heading of a section: the heading row inside it. */
const sectionName = (section: FakeEl): string =>
  made.find((s) => s.heading && inside(s.parent, section))?.name ?? '';

/** The newest section of a screen with this name (a redraw makes new ones). */
function section(root: FakeEl, name: string): FakeEl {
  const found = sectionsOf(root).find((s) => sectionName(s) === name);
  if (found === undefined) throw new Error(`no section ${name}`);
  return found;
}

/** The rows of a section or modal that are not headings, in order. */
const rowsIn = (ancestor: FakeEl): FakeSetting[] =>
  made.filter((s) => !s.heading && inside(s.parent, ancestor));

/** The newest row with this name inside `ancestor`. */
function rowIn(ancestor: FakeEl, name: string): FakeSetting {
  const found = rowsIn(ancestor)
    .filter((s) => s.name === name)
    .at(-1);
  if (found === undefined) throw new Error(`no row ${name}`);
  return found;
}

/** Clicks the gear of a feature row and opens the modal it makes. */
function openGear(row: FakeSetting): OpenedModal {
  const gear = row.buttons.find((b) => b.icon === 'settings');
  if (gear === undefined) throw new Error(`no gear on ${row.name}`);
  const before = modals.length;
  void gear.clicked?.();
  expect(modals.length).toBe(before + 1);
  const modal = modals.at(-1) as unknown as OpenedModal;
  modal.onOpen();
  return modal;
}

beforeEach(() => resetFake());

describe('US-029 AC-1 the sections of the tab, drawn', () => {
  it('US-029 AC-1: five collapsible sections after the version line, in order', async () => {
    const {root} = await rig();
    expect(root.children[0]?.text).toBe('Obsidian2Typst 0.11.0-test');
    expect(sectionsOf(root).map(sectionName)).toEqual([
      'Presets',
      'Page',
      'Text',
      'Book',
      'Export',
    ]);
  });

  it('US-029 AC-1: each section holds its feature rows and plain rows, in the order of the story', async () => {
    const {root} = await rig();
    const names = (name: string) =>
      rowsIn(section(root, name)).map((s) => s.name);
    expect(names('Page')).toEqual([
      'Page setup',
      'Page numbers',
      'Running header',
      'Page breaks',
    ]);
    expect(names('Text')).toEqual([
      'Fonts',
      'Heading numbering',
      'Highlight colour',
      'Page numbers in links',
      'Footnotes for external links',
      'Template file',
    ]);
    expect(names('Book')).toEqual([
      'Book parts',
      'Roman folios in the front matter',
      'Signatures',
      'Contents',
      'Image fit',
    ]);
    expect(names('Export')).toEqual([
      'Strict mode',
      'Presets folder',
      'Warnings note folder',
    ]);
  });

  it('US-029 AC-1: no row of a modal is drawn on the tab itself (Bleed, Body font, Contents depth)', async () => {
    const {root} = await rig();
    const onTab = rowsIn(root).map((s) => s.name);
    for (const name of ['Bleed (mm)', 'Body font', 'Contents depth']) {
      expect(onTab, name).not.toContain(name);
    }
  });
});

describe('US-029 AC-2 a feature row', () => {
  it('US-029 AC-2: name, description, toggle, reset icon and gear with its tooltip (Running header)', async () => {
    const {root} = await rig();
    const row = rowIn(section(root, 'Page'), 'Running header');
    expect(row.desc).toBe('The chapter title at the head of the page.');
    expect(row.controls.map((c) => c.kind)).toEqual(['toggle']);
    expect(row.buttons.map((b) => b.icon)).toEqual(['reset', 'settings']);
    expect(row.buttons[1]?.tooltip).toBe('Settings of Running header');
  });

  it('US-029 AC-2: no gear without rows (Page numbers); no toggle without a field (Page setup)', async () => {
    const {root} = await rig();
    const numbers = rowIn(section(root, 'Page'), 'Page numbers');
    expect(numbers.buttons.map((b) => b.icon)).toEqual(['reset']);
    // the gear's space is kept by a class (its width: M19)
    expect(numbers.settingEl.classes.has('o2t-no-gear')).toBe(true);
    expect(
      rowIn(section(root, 'Export'), 'Strict mode').settingEl.classes.has(
        'o2t-no-gear',
      ),
    ).toBe(true);
    expect(
      rowIn(section(root, 'Page'), 'Running header').settingEl.classes.has(
        'o2t-no-gear',
      ),
    ).toBe(false);
    const setup = rowIn(section(root, 'Page'), 'Page setup');
    expect(setup.controls).toEqual([]);
    expect(setup.buttons.map((b) => b.icon)).toEqual(['settings']);
  });

  it('US-029 AC-2, AC-3: Strict mode is plugin data: a toggle, no reset icon, no gear; switching saves strictMode', async () => {
    const {root, settings} = await rig();
    const strict = rowIn(section(root, 'Export'), 'Strict mode');
    expect(strict.buttons).toEqual([]);
    expect(strict.controls[0]?.value).toBe(false);
    await (strict.controls[0]?.changed as (v: boolean) => Promise<void>)(true);
    expect(settings.data.strictMode).toBe(true);
  });
});

describe('US-029 AC-3 a toggle shows the effective value (the G0 defect)', () => {
  it('US-029 AC-3: unset Footnotes for external links shows on; unset Roman folios shows off', async () => {
    const {root} = await rig();
    expect(
      rowIn(section(root, 'Text'), 'Footnotes for external links').controls[0]
        ?.value,
    ).toBe(true);
    expect(
      rowIn(section(root, 'Book'), 'Roman folios in the front matter')
        .controls[0]?.value,
    ).toBe(false);
  });

  it('US-029 AC-3: a Defaults false shows off; switching writes true into the Defaults', async () => {
    const {root, settings} = await rig({externalLinkFootnotes: false});
    const row = rowIn(section(root, 'Text'), 'Footnotes for external links');
    expect(row.controls[0]?.value).toBe(false);
    await (row.controls[0]?.changed as (v: boolean) => Promise<void>)(true);
    expect(settings.data.defaults.externalLinkFootnotes).toBe(true);
  });

  it('US-029 AC-3: every toggle inside a modal shows its built-in value too (Facing pages, Contents page numbers, Contents dot leaders)', async () => {
    const {root} = await rig();
    const setup = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    expect(rowIn(setup.contentEl, 'Facing pages').controls[0]?.value).toBe(
      true,
    );
    const contents = openGear(rowIn(section(root, 'Book'), 'Contents'));
    expect(
      rowIn(contents.contentEl, 'Contents page numbers').controls[0]?.value,
    ).toBe(true);
    expect(
      rowIn(contents.contentEl, 'Contents dot leaders').controls[0]?.value,
    ).toBe(true);
  });
});

describe('US-029 AC-4 a group without a boolean', () => {
  it('US-029 AC-4: the Contents modal shows Contents depth not set (—) while the Defaults leave it unset', async () => {
    const {root} = await rig();
    const contents = openGear(rowIn(section(root, 'Book'), 'Contents'));
    const depth = rowIn(contents.contentEl, 'Contents depth');
    expect(depth.controls[0]?.kind).toBe('dropdown');
    expect(depth.controls[0]?.value).toBe('');
  });
});

describe('US-029 AC-5 the modal of a feature row', () => {
  it('US-029 AC-5: titled with the row name, holding the rows of the story in order', async () => {
    const {root} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Running header'));
    expect(modal.titleEl.text).toBe('Running header');
    expect(rowsIn(modal.contentEl).map((s) => s.name)).toEqual([
      'Running header level',
    ]);
    const breaks = openGear(rowIn(section(root, 'Page'), 'Page breaks'));
    expect(rowsIn(breaks.contentEl).map((s) => s.name)).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `Break before H${n}`),
    );
  });

  it('US-029 AC-5, US-010 AC-6: the Fonts modal draws its rows once the fonts are read', async () => {
    const {root} = await rig();
    const fonts = openGear(rowIn(section(root, 'Text'), 'Fonts'));
    await vi.waitFor(() =>
      expect(rowsIn(fonts.contentEl).map((s) => s.name)).toContain(
        'Code size (pt)',
      ),
    );
    expect(rowsIn(fonts.contentEl)[0]?.name).toBe('Font folder');
  });

  it('US-029 AC-5, AC-11: a value saved in the modal goes through the row code (Bleed 3 saved, -1 refused in its row)', async () => {
    const {root, settings} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.type('3');
    await vi.waitFor(() => expect(settings.data.defaults.page?.bleed).toBe(3));
    // The store holds 3 before the save has shown its result in the row; let
    // it finish, or its late "saved" clears the next refusal (found at #112).
    await new Promise((resolve) => setTimeout(resolve, 0));
    const bleed = rowIn(modal.contentEl, 'Bleed (mm)');
    bleed.controls[0]?.type('-1');
    await vi.waitFor(() =>
      expect(bleed.descEl.classes.has('mod-warning')).toBe(true),
    );
    expect(settings.data.defaults.page?.bleed).toBe(3);
  });

  it('US-029 AC-5 (decision 3): a value typed but not saved is saved when the modal closes (Bleed 4)', async () => {
    const {root, settings} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    const field = rowIn(modal.contentEl, 'Bleed (mm)').controls[0];
    if (field === undefined) throw new Error('no field');
    field.inputEl.value = '4'; // typed, no change event (the modal is removed)
    modal.onClose();
    await vi.waitFor(() => expect(settings.data.defaults.page?.bleed).toBe(4));
  });

  it('US-029 AC-5 (decision 3): a field already saved by change is not saved twice on close', async () => {
    const {root, settings, saves} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.type('4');
    await vi.waitFor(() => expect(settings.data.defaults.page?.bleed).toBe(4));
    const before = saves();
    modal.onClose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves()).toBe(before);
  });

  it('US-029 AC-5 (decision 3): closing with no field touched saves nothing', async () => {
    const {root, saves} = await rig();
    const before = saves();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    modal.onClose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves()).toBe(before);
  });

  it('US-029 AC-5 (decision 3): a refused value typed before close is not saved and shows its message as a notice', async () => {
    const {root, settings} = await rig({page: {bleed: 2}});
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    const field = rowIn(modal.contentEl, 'Bleed (mm)').controls[0];
    if (field === undefined) throw new Error('no field');
    field.inputEl.value = 'abc';
    modal.onClose();
    await vi.waitFor(() => expect(notices.length).toBe(1));
    expect(notices[0]).toMatch(/bleed/i);
    expect(settings.data.defaults.page?.bleed).toBe(2);
  });

  it('US-029 AC-5 (refined at #112): a save made by a row of the modal does not draw the modal again (the field keeps its place)', async () => {
    const {root, settings} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    const count = (): number =>
      made.filter((s) => s.name === 'Bleed (mm)').length;
    const before = count();
    rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.type('3');
    await vi.waitFor(() => expect(settings.data.defaults.page?.bleed).toBe(3));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count()).toBe(before);
    // the other side is in effect: a change from outside does redraw
    await settings.setDefaults({page: {bleed: 5}});
    await vi.waitFor(() => expect(count()).toBe(before + 1));
  });

  it('US-029 AC-5 example 1: Facing pages switched off in the modal disables Gutter in the same modal', async () => {
    const {root} = await rig({page: {facingPages: true}});
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    expect(rowIn(modal.contentEl, 'Gutter (mm)').controls[0]?.disabled).toBe(
      false,
    );
    await (
      rowIn(modal.contentEl, 'Facing pages').controls[0]?.changed as (
        v: boolean,
      ) => Promise<void>
    )(false);
    await vi.waitFor(() =>
      expect(rowIn(modal.contentEl, 'Gutter (mm)').controls[0]?.disabled).toBe(
        true,
      ),
    );
    expect(rowIn(modal.contentEl, 'Gutter (mm)').desc).toBe(
      'Used only with facing pages',
    );
  });

  it('US-029 AC-5, AC-12: Custom trim size in the modal enables width and height in the same modal', async () => {
    const {root} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    expect(
      rowIn(modal.contentEl, 'Trim width (mm)').controls[0]?.disabled,
    ).toBe(true);
    await (
      rowIn(modal.contentEl, 'Trim size').controls[0]?.changed as (
        v: string,
      ) => Promise<void>
    )('Custom');
    await vi.waitFor(() =>
      expect(
        rowIn(modal.contentEl, 'Trim width (mm)').controls[0]?.disabled,
      ).toBe(false),
    );
  });

  it('US-029 AC-5 (SCAR-016): a settings change from outside while open redraws the modal; after close it no longer listens', async () => {
    const {root, settings} = await rig();
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    await settings.setDefaults({page: {bleed: 7}});
    await vi.waitFor(() =>
      expect(rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.value).toBe('7'),
    );
    modal.onClose();
    const count = made.filter((s) => s.name === 'Bleed (mm)').length;
    await settings.setDefaults({page: {bleed: 8}});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(made.filter((s) => s.name === 'Bleed (mm)').length).toBe(count);
  });

  it('US-029 AC-5 example 3: closing the modal draws the tab again; the open section stays open', async () => {
    const {root} = await rig();
    const page = section(root, 'Page');
    page.open = true;
    page.fire('toggle');
    const modal = openGear(rowIn(page, 'Running header'));
    rowIn(modal.contentEl, 'Running header level').controls[0]?.type('3');
    const before = made.filter((s) => s.name === 'Running header').length;
    modal.onClose();
    await vi.waitFor(() =>
      expect(made.filter((s) => s.name === 'Running header').length).toBe(
        before + 1,
      ),
    );
    expect(section(root, 'Page').open).toBe(true);
  });
});

describe('US-029 AC-6 the preset rows', () => {
  it('US-029 AC-6: a preset row has Use (In use for the active one) and a gear titled with the preset; no Details, Duplicate, Rename, Delete', async () => {
    const {root} = await rig();
    const presets = section(root, 'Presets');
    const active = rowIn(presets, 'A5 print');
    expect(active.buttons.map((b) => b.text || b.icon)).toEqual([
      'In use',
      'settings',
    ]);
    expect(active.buttons[1]?.tooltip).toBe('Preset "A5 print"');
    const other = rowIn(presets, 'Book');
    expect(other.buttons.map((b) => b.text || b.icon)).toEqual([
      'Use',
      'settings',
    ]);
    const texts = rowsIn(presets).flatMap((s) => s.buttons.map((b) => b.text));
    for (const gone of ['Details', 'Duplicate', 'Rename', 'Delete']) {
      expect(texts).not.toContain(gone);
    }
    expect(texts).toContain('New preset');
  });

  it('US-029 AC-6: the gear opens the preset screen of that row', async () => {
    const {root, opened} = await rig();
    const gear = rowIn(section(root, 'Presets'), 'Book').buttons.find(
      (b) => b.icon === 'settings',
    );
    await gear?.clicked?.();
    expect(opened).toEqual(['Book']);
  });
});

describe('US-029 AC-7 open and closed sections', () => {
  it('US-029 AC-7 (decision 2): on first draw Presets is open and the rest closed', async () => {
    const {root} = await rig();
    expect(sectionsOf(root).map((s) => [sectionName(s), s.open])).toEqual([
      ['Presets', true],
      ['Page', false],
      ['Text', false],
      ['Book', false],
      ['Export', false],
    ]);
  });

  it('US-029 AC-7: a section opened or closed keeps its state across a redraw and across closing and reopening the tab', async () => {
    const {root, tab, store, vault} = await rig();
    const page = section(root, 'Page');
    page.open = true;
    page.fire('toggle');
    const presets = section(root, 'Presets');
    presets.open = false;
    presets.fire('toggle');
    tab.display();
    expect(section(root, 'Page').open).toBe(true);
    expect(section(root, 'Presets').open).toBe(false);
    // a preset change redraws the tab
    vault.edit(`${FOLDER}/Book.md`, fm('page:', '  bleed: 1'));
    await store.load();
    expect(section(root, 'Page').open).toBe(true);
    tab.hide();
    tab.display();
    expect(section(root, 'Page').open).toBe(true);
    expect(section(root, 'Presets').open).toBe(false);
  });

  it('US-029 AC-7: the states are not written to data.json', async () => {
    const {root, settings, saved} = await rig();
    const page = section(root, 'Page');
    page.open = true;
    page.fire('toggle');
    await settings.update({strictMode: true}); // any save
    expect(Object.keys(saved() as object).sort()).toEqual(
      Object.keys(DEFAULT_PLUGIN_DATA).sort(),
    );
  });
});
