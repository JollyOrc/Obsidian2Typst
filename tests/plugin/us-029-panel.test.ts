// US-029 AC-3, AC-5, AC-7, AC-8 — the style panel drawn with the fake
// `obsidian`: the sections Page, Text, Book, Cover (all closed at first), the
// rows owned by the active preset on a feature row and in its modal, and a
// preset note changed on disk while a modal is open (SCAR-016). Source of
// truth: docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {
  FakeApp,
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
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

interface OpenedModal {
  titleEl: FakeEl;
  contentEl: FakeEl;
  onOpen(): void;
  onClose(): void;
}

async function rig(note: string, defaults: unknown = {}) {
  const vault = new FakeVault({[`${FOLDER}/A5 print.md`]: note}, [FOLDER]);
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: 'A5 print',
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
  const {StylePanelView} = await import('../../src/plugin/preview/panel');
  const opened: string[] = [];
  const view = new StylePanelView(
    {app: new FakeApp()} as never,
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
      openDetails: (name: string) => void opened.push(name),
      subscribe: () => () => undefined,
    } as never,
  );
  await view.onOpen();
  const root = (view as unknown as {contentEl: FakeEl}).contentEl;
  return {view, root, settings, store, vault, opened};
}

function inside(el: unknown, ancestor: FakeEl): boolean {
  let node = el as FakeEl | null | undefined;
  while (node !== null && node !== undefined) {
    if (node === ancestor) return true;
    node = node.parentElement;
  }
  return false;
}

/** Every `details` element below `root`, in document order. */
function sectionsOf(root: FakeEl): FakeEl[] {
  const out: FakeEl[] = [];
  const walk = (el: FakeEl): void => {
    for (const child of el.children) {
      if (child.tag === 'details') out.push(child);
      else walk(child);
    }
  };
  walk(root);
  return out;
}
const sectionName = (s: FakeEl): string =>
  made.find((m) => m.heading && inside(m.parent, s))?.name ?? '';
function section(root: FakeEl, name: string): FakeEl {
  const found = sectionsOf(root)
    .filter((s) => sectionName(s) === name)
    .at(-1);
  if (found === undefined) throw new Error(`no section ${name}`);
  return found;
}
const rowsIn = (a: FakeEl): FakeSetting[] =>
  made.filter((s) => !s.heading && inside(s.parent, a));
function rowIn(a: FakeEl, name: string): FakeSetting {
  const found = rowsIn(a)
    .filter((s) => s.name === name)
    .at(-1);
  if (found === undefined) throw new Error(`no row ${name}`);
  return found;
}
function openGear(row: FakeSetting): OpenedModal {
  const gear = row.buttons.find((b) => b.icon === 'settings');
  if (gear === undefined) throw new Error(`no gear on ${row.name}`);
  void gear.clicked?.();
  const modal = modals.at(-1) as unknown as OpenedModal;
  modal.onOpen();
  return modal;
}

beforeEach(() => resetFake());

describe('US-029 AC-8 the sections of the panel', () => {
  it('US-029 AC-8, AC-7 (decision 2): Page, Text, Book, Cover, all closed at first; no Presets, no Export', async () => {
    const {root, view} = await rig(fm());
    expect(sectionsOf(root).map((s) => [sectionName(s), s.open])).toEqual([
      ['Page', false],
      ['Text', false],
      ['Book', false],
      ['Cover', false],
    ]);
    await view.onClose();
  });

  it('US-029 AC-8: the Cover section keeps its four read-only rows', async () => {
    const {root, view} = await rig(fm());
    expect(rowsIn(section(root, 'Cover')).map((s) => s.name)).toEqual([
      'Cover',
      'Cover image',
      'Blank page after cover',
      'Crop warning (%)',
    ]);
    await view.onClose();
  });

  it('US-029 AC-7: a section opened in the panel stays open after the panel redraws for a preset change', async () => {
    const {root, view, vault, store} = await rig(fm());
    const page = section(root, 'Page');
    page.open = true;
    page.fire('toggle');
    vault.edit(`${FOLDER}/A5 print.md`, fm('page:', '  bleed: 1'));
    await store.load();
    expect(section(root, 'Page').open).toBe(true);
    await view.onClose();
  });
});

describe('US-029 AC-8 rows owned by the active preset (decision 7)', () => {
  it('US-029 AC-8: Page setup names the owned rows after its description; Page breaks names none', async () => {
    const {root, view} = await rig(fm('page:', '  trimSize: A5', '  bleed: 3'));
    expect(rowIn(section(root, 'Page'), 'Page setup').desc).toBe(
      'Trim size, margins, bleed and facing pages. Set by preset "A5 print": Trim size, Trim width (mm), Trim height (mm), Bleed (mm).',
    );
    expect(rowIn(section(root, 'Page'), 'Page breaks').desc).toBe(
      'A new page or spread before headings, by level.',
    );
    await view.onClose();
  });

  it('US-029 AC-8, AC-3: an owned feature toggle shows the preset value, disabled, with the owner text and no reset icon', async () => {
    const {root, view} = await rig(fm('page:', '  folios: false'), {
      page: {folios: true},
    });
    const row = rowIn(section(root, 'Page'), 'Page numbers');
    expect(row.controls[0]?.value).toBe(false);
    expect(row.controls[0]?.disabled).toBe(true);
    expect(row.desc).toContain(
      'Set by preset "A5 print"; change it in the preset note',
    );
    expect(row.buttons.map((b) => b.icon)).not.toContain('reset');
    await view.onClose();
  });

  it('US-029 AC-8: inside the modal an owned row is disabled with the owner text and has no reset icon', async () => {
    const {root, view} = await rig(fm('page:', '  bleed: 3'));
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    const bleed = rowIn(modal.contentEl, 'Bleed (mm)');
    expect(bleed.controls[0]?.disabled).toBe(true);
    expect(bleed.controls[0]?.value).toBe('3');
    expect(bleed.desc).toBe(
      'Set by preset "A5 print"; change it in the preset note',
    );
    expect(bleed.buttons.map((b) => b.icon)).not.toContain('reset');
    modal.onClose();
    await view.onClose();
  });

  it('US-029 AC-5 example 2 (SCAR-016): the preset note gets page.bleed: 3 on disk while the modal is open; Bleed in the open modal shows 3, disabled', async () => {
    const {root, view, vault, store} = await rig(fm());
    const modal = openGear(rowIn(section(root, 'Page'), 'Page setup'));
    expect(rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.disabled).toBe(
      false,
    );
    vault.edit(`${FOLDER}/A5 print.md`, fm('page:', '  bleed: 3'));
    await store.load();
    await vi.waitFor(() =>
      expect(rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.disabled).toBe(
        true,
      ),
    );
    expect(rowIn(modal.contentEl, 'Bleed (mm)').controls[0]?.value).toBe('3');
    modal.onClose();
    await view.onClose();
  });
});

describe('US-029 AC-8 (decision 5) the info button', () => {
  it('US-029 AC-8: the info button opens the preset screen of the active preset at the click', async () => {
    const {view, settings, opened} = await rig(fm());
    const info = made.flatMap((s) => s.buttons).find((b) => b.icon === 'info');
    await settings.update({activePreset: 'Other'});
    await info?.clicked?.();
    expect(opened).toEqual(['Other']);
    await view.onClose();
  });
});
