// US-029 AC-6, AC-12 — the preset screen: US-021's details pop-up with the
// buttons Use, Open the note, Duplicate, Rename, Delete, Close (SCAR-013,
// SCAR-014: Close has the focus, Delete asks first), a rename that the
// pop-up follows (decision 6) and a delete that closes it. Source of truth:
// docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {made, resetFake, type FakeEl} from '../support/fake-obsidian';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const FOLDER = 'Obsidian2Typst/presets';
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** US-029: the shapes after the change (red until the code). */
interface DetailButton {
  text: string;
  disabled: boolean;
  run?: () => Promise<void> | void;
}
interface DetailsView {
  title: string;
  rows?: unknown[];
  error?: string;
  buttons: DetailButton[];
  focus: string;
}
interface ScreenDeps {
  presets: ReturnType<typeof createPresetStore>;
  settings: {data: {activePreset: string; defaults: unknown}};
  usePreset(name: string): Promise<void>;
  openNote(path: string): Promise<void>;
  duplicate(name: string): Promise<void>;
  /** Asks for the new name; the new name, or null when cancelled or refused. */
  rename(name: string): Promise<string | null>;
  /** Asks first (deletePreset); true when the preset was deleted. */
  remove(name: string): Promise<boolean>;
  close(): void;
}
interface DetailsModule {
  detailsView(deps: ScreenDeps, name: string): DetailsView;
}

async function rig(answers: {rename?: string | null; remove?: boolean} = {}) {
  const vault = new FakeVault(
    {
      [`${FOLDER}/A5 print.md`]: fm('page:', '  bleed: 3'),
      [`${FOLDER}/Broken.md`]: fm('page:', '  bleed: abc'),
    },
    [FOLDER],
  );
  let saved: unknown = {
    ...structuredClone(DEFAULT_PLUGIN_DATA),
    activePreset: 'A5 print',
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
  const deps: ScreenDeps = {
    presets: store,
    settings,
    usePreset: async (name) => void log.push(`use:${name}`),
    openNote: async (path) => void log.push(`open:${path}`),
    duplicate: async (name) => void log.push(`duplicate:${name}`),
    rename: async (name) => {
      log.push(`rename:${name}`);
      const to = answers.rename ?? null;
      if (to !== null) {
        const result = await store.rename(name, to);
        if (!result.ok) return null;
      }
      return to;
    },
    remove: async (name) => {
      log.push(`remove:${name}`);
      return answers.remove ?? false;
    },
    close: () => void log.push('close'),
  };
  return {deps, log, store, settings};
}

const load = async (): Promise<DetailsModule> =>
  (await import(
    /* @vite-ignore */ '../../src/plugin/settings/details'
  )) as unknown as DetailsModule;

beforeEach(() => resetFake());

describe('US-029 AC-6 the buttons of the preset screen', () => {
  it('US-029 AC-6: a readable preset: Use, Open the note, Duplicate, Rename, Delete, Close in that order; Close has the focus', async () => {
    const {deps} = await rig();
    const {detailsView} = await load();
    const view = detailsView(deps, 'A5 print');
    expect(view.buttons.map((b) => [b.text, b.disabled])).toEqual([
      ['In use', true],
      ['Open the note', false],
      ['Duplicate', false],
      ['Rename', false],
      ['Delete', false],
      ['Close', false],
    ]);
    expect(view.focus).toBe('Close');
  });

  it('US-029 AC-6: an invalid preset can still be duplicated, renamed and deleted (as from today’s row)', async () => {
    const {deps} = await rig();
    const {detailsView} = await load();
    const view = detailsView(deps, 'Broken');
    expect(view.error).toBeDefined();
    expect(view.buttons.map((b) => [b.text, b.disabled])).toEqual([
      ['Use', true],
      ['Open the note', false],
      ['Duplicate', false],
      ['Rename', false],
      ['Delete', false],
      ['Close', false],
    ]);
  });

  it('US-029 AC-6: a preset that is gone keeps only Close (US-021 AC-9)', async () => {
    const {deps} = await rig();
    const {detailsView} = await load();
    expect(detailsView(deps, 'Nope').buttons.map((b) => b.text)).toEqual([
      'Close',
    ]);
  });

  it('US-029 AC-6: Duplicate calls duplicate and leaves the pop-up open', async () => {
    const {deps, log} = await rig();
    const {detailsView} = await load();
    const dup = detailsView(deps, 'A5 print').buttons.find(
      (b) => b.text === 'Duplicate',
    );
    await dup?.run?.();
    expect(log).toEqual(['duplicate:A5 print']);
  });

  it('US-029 AC-6, SCAR-014: Delete asks (remove); a confirmed delete closes the pop-up, a cancelled one does not', async () => {
    const yes = await rig({remove: true});
    const {detailsView} = await load();
    await detailsView(yes.deps, 'A5 print')
      .buttons.find((b) => b.text === 'Delete')
      ?.run?.();
    expect(yes.log).toEqual(['remove:A5 print', 'close']);
    const no = await rig({remove: false});
    await detailsView(no.deps, 'A5 print')
      .buttons.find((b) => b.text === 'Delete')
      ?.run?.();
    expect(no.log).toEqual(['remove:A5 print']);
  });
});

describe('US-029 AC-6 (decision 6) the pop-up follows a rename', () => {
  it('US-029 AC-6: after Rename to "A5 renamed" the open pop-up shows Preset "A5 renamed" with its table', async () => {
    const {deps, store} = await rig({rename: 'A5 renamed'});
    const {PresetDetailsModal} =
      await import('../../src/plugin/settings/details-modal');
    const modal = new PresetDetailsModal(
      {} as never,
      deps as never,
      'A5 print',
    );
    modal.onOpen();
    const titleEl = (modal as unknown as {titleEl: FakeEl}).titleEl;
    expect(titleEl.text).toBe('Preset "A5 print"');
    const rename = made
      .flatMap((s) => s.buttons)
      .filter((b) => b.text === 'Rename')
      .at(-1);
    await rename?.clicked?.();
    await store.load();
    await vi.waitFor(() => expect(titleEl.text).toBe('Preset "A5 renamed"'));
    const contentEl = (modal as unknown as {contentEl: FakeEl}).contentEl;
    expect(contentEl.children.some((c) => c.tag === 'table')).toBe(true);
    modal.onClose();
  });

  it('US-029 AC-6: a cancelled rename keeps the old name', async () => {
    const {deps} = await rig({rename: null});
    const {PresetDetailsModal} =
      await import('../../src/plugin/settings/details-modal');
    const modal = new PresetDetailsModal(
      {} as never,
      deps as never,
      'A5 print',
    );
    modal.onOpen();
    const rename = made
      .flatMap((s) => s.buttons)
      .filter((b) => b.text === 'Rename')
      .at(-1);
    expect(rename).toBeDefined(); // else the test passes without a button
    await rename?.clicked?.();
    const titleEl = (modal as unknown as {titleEl: FakeEl}).titleEl;
    expect(titleEl.text).toBe('Preset "A5 print"');
    modal.onClose();
  });
});
