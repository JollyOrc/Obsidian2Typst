// US-022 AC-1, AC-3, AC-5 to AC-10 — the items of the editor and file
// explorer menus that change the active preset, the question before every
// write, the write itself (one atomic change, read at the moment of the
// write), the notice, the screens that follow, and the one writer (SCAR-017).
// The note texts are tested in tests/unit/us-022-preset-edits.test.ts; the
// menus in the app by hand (AC-12). Source of truth:
// docs/user-stories/US-022-heading-and-image-menus.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import * as menus from '../../src/plugin/menus';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';
import {png} from '../support/images';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

/** US-022: shapes of code that does not exist yet (red until the code). */
type Change =
  | {kind: 'heading-rule'; text: string; rule: 'glossary' | 'none' | null}
  | {kind: 'cover'; file: string | null};
interface Request {
  preset: string;
  change: Change;
  question: string;
}
interface Entry {
  title?: string;
  icon?: string;
  disabled?: boolean;
  run?: () => Promise<unknown>;
}
interface Ctx {
  // US-027 AC-7 (TICKET-086): the real line context gives the level; level 2
  // offers no contents item, so these lists stay US-022's.
  heading: {text: string; level: number} | null;
  images: string[];
}
/** The active preset as the menus see it when they open. */
interface ActiveView {
  name: string | null;
  valid: boolean;
  fields: unknown;
}
type PresetEditEntries = (
  actions: {changePreset(request: Request): Promise<void>},
  context: Ctx,
  active: ActiveView,
) => Entry[];
type ImageFileEntries = (
  actions: {changePreset(request: Request): Promise<void>},
  path: string,
  active: ActiveView,
) => Entry[];

const fn = <T>(name: string): T =>
  (menus as unknown as Record<string, T>)[name] as T;
const ACTIONS = '../../src/plugin/actions';
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;

const FOLDER = 'Obsidian2Typst/presets';
const FOLIOS = `${FOLDER}/Folios.md`;
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

const recorder = () => {
  const calls: Request[] = [];
  return {
    calls,
    actions: {
      changePreset: async (request: Request) => void calls.push(request),
    },
  };
};

describe('US-022 AC-1, AC-6 the heading item', () => {
  const valid = (fields: unknown): ActiveView => ({
    name: 'Folios',
    valid: true,
    fields,
  });

  it('US-022 AC-1: a heading line gets Use as glossary section; the click asks for the smallest change', async () => {
    const presetEditEntries = fn<PresetEditEntries>('presetEditEntries');
    expect(typeof presetEditEntries).toBe('function');
    const {calls, actions} = recorder();
    const entries = presetEditEntries(
      actions,
      {heading: {text: 'Glossar', level: 2}, images: []},
      valid({}),
    );
    expect(entries.map((e) => [e.title, e.icon, e.disabled === true])).toEqual([
      ['Use as glossary section', 'list', false],
    ]);
    await entries[0]?.run?.();
    expect(calls).toEqual([
      {
        preset: 'Folios',
        change: {kind: 'heading-rule', text: 'Glossar', rule: 'glossary'},
        question:
          'Add "Glossar" → glossary to the heading rules of preset "Folios"?',
      },
    ]);
  });

  it('US-022 AC-1: the built-in Glossary rule makes it Stop using as glossary section', () => {
    const presetEditEntries = fn<PresetEditEntries>('presetEditEntries');
    const {actions} = recorder();
    expect(
      presetEditEntries(
        actions,
        {heading: {text: 'Glossary', level: 2}, images: []},
        valid({}),
      )[0]?.title,
    ).toBe('Stop using as glossary section');
  });

  it('US-022 AC-6, SCAR-019: no preset and an invalid preset give disabled items with the reason', () => {
    const presetEditEntries = fn<PresetEditEntries>('presetEditEntries');
    const {actions} = recorder();
    const ctx = {heading: {text: 'Glossar', level: 2}, images: ['a/cover.png']};
    expect(
      presetEditEntries(actions, ctx, {
        name: null,
        valid: false,
        fields: null,
      }).map((e) => [e.title, e.disabled]),
    ).toEqual([
      ['Use as glossary section (no preset)', true],
      ['Use as cover (no preset)', true],
    ]);
    expect(
      presetEditEntries(actions, ctx, {
        name: 'Broken',
        valid: false,
        fields: null,
      }).map((e) => [e.title, e.disabled]),
    ).toEqual([
      ['Use as glossary section (preset "Broken" is invalid)', true],
      ['Use as cover (preset "Broken" is invalid)', true],
    ]);
  });

  it('US-022 AC-1: a line that is neither a heading nor holds an image gets no item', () => {
    const presetEditEntries = fn<PresetEditEntries>('presetEditEntries');
    const {actions} = recorder();
    expect(
      presetEditEntries(actions, {heading: null, images: []}, valid({})),
    ).toEqual([]);
  });
});

describe('US-022 AC-3 the image items', () => {
  const valid = (fields: unknown): ActiveView => ({
    name: 'Folios',
    valid: true,
    fields,
  });

  it('US-022 AC-3 (decision 1): one item per image of the line, titled with the file name', () => {
    const presetEditEntries = fn<PresetEditEntries>('presetEditEntries');
    const {actions} = recorder();
    const entries = presetEditEntries(
      actions,
      {heading: null, images: ['a/front.png', 'a/back.png']},
      valid({cover: {mode: 'file', file: 'a/back.png'}}),
    );
    expect(entries.map((e) => [e.title, e.icon])).toEqual([
      ['Use "front.png" as cover', 'image'],
      ['Stop using "back.png" as cover', 'image'],
    ]);
  });

  it('US-022 AC-3: an image file in the file explorer gets Use as cover; a non-image, none', () => {
    const imageFileEntries = fn<ImageFileEntries>('imageFileEntries');
    expect(typeof imageFileEntries).toBe('function');
    const {actions} = recorder();
    expect(
      imageFileEntries(actions, 'Sample/assets/cover.png', valid({})).map(
        (e) => e.title,
      ),
    ).toEqual(['Use as cover']);
    expect(imageFileEntries(actions, 'Sample/a.pdf', valid({}))).toEqual([]);
    expect(imageFileEntries(actions, 'Sample/Rules.md', valid({}))).toEqual([]);
  });
});

const COVER = 'Sample/assets/cover.png';
const FRONT = 'Sample/assets/front.png';
const BROKEN = 'Sample/assets/broken.png';
const NOT_AN_IMAGE = new TextEncoder().encode('not a png');

/**
 * A vault with the preset `Folios` active, the image files `images` (path →
 * bytes, changed by the tests between the menu and the click) and a recorder
 * of the question; `events` lists the image reads and the question in order.
 */
async function rig(
  folios: string,
  answer: boolean,
  images: Record<string, Uint8Array> = {},
) {
  const vault = new FakeVault({[FOLIOS]: folios, [`${FOLDER}/Book.md`]: fm()}, [
    FOLDER,
  ]);
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
  const store = createPresetStore({
    vault,
    folder: () => settings.data.presetsFolder,
    defaults: () => settings.data.defaults,
    notify: () => undefined,
  });
  await store.load();
  const asked: {
    title: string;
    lines: string[];
    confirmLabel: string;
    cancelLabel: string;
  }[] = [];
  const notices: string[] = [];
  const events: string[] = [];
  const bytes = new Map(Object.entries(images));
  const hooks = {beforeAnswer: async () => undefined as void};
  const read = (path: string): Uint8Array => {
    events.push(`read:${path}`);
    const found = bytes.get(path);
    if (found === undefined) throw new Error(`No such file: ${path}`);
    return found;
  };
  const deps = {
    notes: {activePath: () => null, read: async () => ''},
    vault: {
      files: () => [...bytes.keys()],
      readHead: async (path: string, length = 16) =>
        bytes.size === 0
          ? standIn(path).subarray(0, length)
          : read(path).subarray(0, length),
      readBytes: async (path: string) =>
        bytes.size === 0 ? standIn(path) : read(path),
      readText: async () => null,
    },
    presets: store,
    settings,
    chooseFolder: async () => null,
    run: async () => ({ok: true}),
    notice: (text: string) => void notices.push(text),
    showNote: async () => undefined,
    openPanel: async () => true,
    presetNotes: vault,
    confirm: async (question: {
      title: string;
      lines: string[];
      confirmLabel: string;
      cancelLabel: string;
    }) => {
      asked.push(question);
      events.push('ask');
      await hooks.beforeAnswer();
      return answer;
    },
  };
  const {createActions} = await load<{
    createActions(d: unknown): {changePreset(r: Request): Promise<void>};
  }>(ACTIONS);
  return {
    vault,
    settings,
    store,
    deps,
    asked,
    notices,
    events,
    bytes,
    hooks,
    actions: createActions(deps),
  };
}

const GLOSSAR: Request = {
  preset: 'Folios',
  change: {kind: 'heading-rule', text: 'Glossar', rule: 'glossary'},
  question: 'Add "Glossar" → glossary to the heading rules of preset "Folios"?',
};

describe('US-022 AC-5, AC-7, AC-8, AC-9 the question and the write', () => {
  it('US-022 AC-5: the question names the change, with Change preset and Cancel', async () => {
    const r = await rig(fm('group: Print'), false);
    await r.actions.changePreset(GLOSSAR);
    expect(r.asked).toEqual([
      {
        title: 'Change preset "Folios"',
        lines: [
          'Add "Glossar" → glossary to the heading rules of preset "Folios"?',
        ],
        confirmLabel: 'Change preset',
        cancelLabel: 'Cancel',
      },
    ]);
  });

  it('US-022 AC-5: Cancel writes nothing', async () => {
    const r = await rig(fm('group: Print'), false);
    await r.actions.changePreset(GLOSSAR);
    expect(r.vault.writes).toEqual([]);
    expect(r.vault.files.get(FOLIOS)).toBe(fm('group: Print'));
    expect(r.notices).toEqual([]);
  });

  it('US-022 AC-7, AC-8 (decision 2): Change preset writes the one key atomically and gives the notice', async () => {
    const r = await rig(fm('group: Print'), true);
    await r.actions.changePreset(GLOSSAR);
    expect(r.vault.writes).toEqual([`process:${FOLIOS}`]);
    expect(r.vault.files.get(FOLIOS)).toBe(
      fm('group: Print', 'headingRules:', '  Glossar: glossary'),
    );
    expect(r.notices).toEqual(['Preset "Folios" changed']);
  });

  it('US-022 AC-7: an edit made while the question was open is kept (the note is read at the write)', async () => {
    const r = await rig(fm('group: Print'), true);
    r.hooks.beforeAnswer = async () => {
      r.vault.edit(FOLIOS, fm('group: Screen'));
    };
    await r.actions.changePreset(GLOSSAR);
    expect(r.vault.files.get(FOLIOS)).toBe(
      fm('group: Screen', 'headingRules:', '  Glossar: glossary'),
    );
  });

  it('US-022 AC-7: a preset note without frontmatter is not written; the notice gives the reason', async () => {
    const r = await rig('Notes of a preset without settings.\n', true);
    await r.actions.changePreset(GLOSSAR);
    expect(r.asked).toHaveLength(1);
    expect(r.vault.writes).toEqual([]);
    expect(r.vault.files.get(FOLIOS)).toBe(
      'Notes of a preset without settings.\n',
    );
    expect(r.notices).toEqual(['The preset note has no frontmatter']);
  });

  it('US-022 AC-9: the active preset changed while the question was open: nothing written, the notice says so', async () => {
    const r = await rig(fm('group: Print'), true);
    r.hooks.beforeAnswer = async () => {
      await r.settings.update({activePreset: 'Book'});
    };
    await r.actions.changePreset(GLOSSAR);
    expect(r.vault.writes).toEqual([]);
    expect(r.notices).toEqual([
      'The active preset changed; nothing was written',
    ]);
  });

  it('US-022 AC-8: after the write the store reads the note again, so the pop-up and the panel follow', async () => {
    const r = await rig(fm('group: Print'), true);
    await r.actions.changePreset(GLOSSAR);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const entry = r.store.get('Folios');
    expect(entry?.preset?.fields.headingRules).toEqual({Glossar: 'glossary'});
  }, 10_000);
});

describe('US-022 AC-9 (amended 2026-10-22) the image is read after the click, before the question', () => {
  /** The active preset as the menu reads it when it opens. */
  const opened = (r: Awaited<ReturnType<typeof rig>>): ActiveView => ({
    name: 'Folios',
    valid: true,
    fields: r.store.get('Folios')?.preset?.fields,
  });
  const menu = (r: Awaited<ReturnType<typeof rig>>, images: string[]) =>
    fn<PresetEditEntries>('presetEditEntries')(
      r.actions,
      {heading: null, images},
      opened(r),
    );

  it('US-022 AC-9: a PNG is read at the click, then the question; Change preset writes the cover (AC-4)', async () => {
    const r = await rig(fm('group: Print'), true, {[COVER]: png(30, 20)});
    const entries = menu(r, [COVER]);
    expect(r.events).toEqual([]);
    await entries[0]?.run?.();
    expect(r.events).toEqual([`read:${COVER}`, 'ask']);
    expect(r.asked[0]?.lines).toEqual([
      `Make "${COVER}" the cover of preset "Folios"?`,
    ]);
    expect(r.vault.files.get(FOLIOS)).toBe(
      fm('group: Print', 'cover:', '  mode: file', `  file: ${COVER}`),
    );
    expect(r.notices).toEqual(['Preset "Folios" changed']);
  });

  it('US-022 AC-9, SCAR-014: bytes that are not a PNG are refused before the question; nothing written', async () => {
    const r = await rig(fm('group: Print'), true, {[BROKEN]: NOT_AN_IMAGE});
    await menu(r, [BROKEN])[0]?.run?.();
    expect(r.asked).toEqual([]);
    expect(r.vault.writes).toEqual([]);
    expect(r.notices).toEqual([
      '"broken.png" is not a valid .png image; preset "Folios" was not changed',
    ]);
  });

  it('US-022 AC-9, SCAR-016: menu, then the file replaced by text, then the click: refused', async () => {
    const r = await rig(fm('group: Print'), true, {[COVER]: png(30, 20)});
    const entries = menu(r, [COVER]);
    r.bytes.set(COVER, NOT_AN_IMAGE);
    await entries[0]?.run?.();
    expect(r.asked).toEqual([]);
    expect(r.vault.writes).toEqual([]);
    expect(r.notices).toEqual([
      '"cover.png" is not a valid .png image; preset "Folios" was not changed',
    ]);
  });

  it('US-022 AC-9 (decision 4), SCAR-016: menu, then the file deleted, then the click: refused', async () => {
    const r = await rig(fm('group: Print'), true, {
      [COVER]: png(30, 20),
      [FRONT]: png(30, 20),
    });
    const entries = menu(r, [COVER]);
    r.bytes.delete(COVER);
    await entries[0]?.run?.();
    expect(r.asked).toEqual([]);
    expect(r.vault.writes).toEqual([]);
    expect(r.notices).toEqual([
      '"cover.png" no longer exists; preset "Folios" was not changed',
    ]);
  });

  it('US-022 AC-9: two images on a line, one broken: the item of the good one reads only its own image and asks', async () => {
    const r = await rig(fm('group: Print'), false, {
      [FRONT]: png(30, 20),
      [BROKEN]: NOT_AN_IMAGE,
    });
    const entries = menu(r, [FRONT, BROKEN]);
    expect(entries.map((e) => e.title)).toEqual([
      'Use "front.png" as cover',
      'Use "broken.png" as cover',
    ]);
    await entries[0]?.run?.();
    expect(r.events).toEqual([`read:${FRONT}`, 'ask']);
    expect(r.notices).toEqual([]);
  });

  it('US-022 AC-9: the file explorer item on a broken image is refused the same way', async () => {
    const r = await rig(fm('group: Print'), true, {[BROKEN]: NOT_AN_IMAGE});
    await fn<ImageFileEntries>('imageFileEntries')(
      r.actions,
      BROKEN,
      opened(r),
    )[0]?.run?.();
    expect(r.asked).toEqual([]);
    expect(r.vault.writes).toEqual([]);
    expect(r.notices).toEqual([
      '"broken.png" is not a valid .png image; preset "Folios" was not changed',
    ]);
  });

  it('US-022 AC-9: Stop using as cover and the heading item read no image', async () => {
    const r = await rig(
      fm('cover:', '  mode: file', `  file: ${COVER}`),
      false,
      {[COVER]: NOT_AN_IMAGE},
    );
    const stop = menu(r, [COVER]);
    expect(stop.map((e) => e.title)).toEqual(['Stop using as cover']);
    await stop[0]?.run?.();
    const heading = fn<PresetEditEntries>('presetEditEntries')(
      r.actions,
      {heading: {text: 'Glossar', level: 2}, images: []},
      opened(r),
    );
    await heading[0]?.run?.();
    expect(r.events).toEqual(['ask', 'ask']);
    expect(r.notices).toEqual([]);
  });
});

describe('US-022 AC-10 one writer of preset fields (SCAR-017)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? files(path)
        : path.endsWith('.ts')
          ? [path]
          : [];
    });

  it('US-022 AC-10: editPresetField is called only by src/plugin/actions.ts; process( only by the vault port and actions', () => {
    const plugin = files('src/plugin');
    const callers = plugin.filter((f) =>
      readFileSync(f, 'utf8').includes('editPresetField('),
    );
    expect(callers).toEqual([join('src', 'plugin', 'actions.ts')]);
    const processors = plugin.filter((f) =>
      /\.process\(/.test(readFileSync(f, 'utf8')),
    );
    expect(processors.sort()).toEqual(
      [
        join('src', 'plugin', 'actions.ts'),
        join('src', 'plugin', 'obsidian', 'vault-port.ts'),
      ].sort(),
    );
  });

  it('US-022 AC-6, SCAR-017: "a preset note" is one predicate (isPresetNote); no other folder check in src/plugin', () => {
    const plugin = files('src/plugin');
    const copies = plugin.filter((f) =>
      /startsWith\(`\$\{[\w.]*presetsFolder\}\/`\)/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(copies).toEqual([]);
    const users = plugin
      .filter((f) => readFileSync(f, 'utf8').includes('isPresetNote('))
      .sort();
    expect(users).toEqual(
      [
        join('src', 'plugin', 'main.ts'),
        join('src', 'plugin', 'menus.ts'),
        join('src', 'plugin', 'prepare-note.ts'),
      ].sort(),
    );
  });

  it('US-022 AC-1, AC-3: main.ts adds the edit items to the editor menu and the image items to the file menu', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    expect(main).toContain('presetEditEntries(');
    expect(main).toContain('imageFileEntries(');
    expect(main).toContain('lineContext(');
    // AC-6: the whole statement that leaves preset notes out (SCAR-017)
    expect(main).toMatch(
      /if \(isPresetNote\(file\.path, this\.pluginSettings\.data\.presetsFolder\)\) \{\s*return;\s*\}/,
    );
  });

  it("US-022 AC-6, SCAR-019: the menus' active preset is pickActive over the store at opening: stored, missing, invalid, none", () => {
    const view = fn<
      (
        entries: {
          name: string;
          valid: boolean;
          preset?: {fields: unknown};
        }[],
        stored: string,
      ) => ActiveView
    >('activePresetView');
    const entries = [
      {name: 'Book', valid: true, preset: {fields: {group: 'B'}}},
      {name: 'Folios', valid: true, preset: {fields: {group: 'F'}}},
      {name: 'Broken', valid: false},
    ];
    expect(view(entries, 'Folios')).toEqual({
      name: 'Folios',
      valid: true,
      fields: {group: 'F'},
    });
    // the stored name no longer exists: the first in alphabetical order
    expect(view(entries, 'Gone')).toEqual({
      name: 'Book',
      valid: true,
      fields: {group: 'B'},
    });
    expect(view(entries, 'Broken')).toEqual({
      name: 'Broken',
      valid: false,
      fields: null,
    });
    expect(view([], 'Folios')).toEqual({
      name: null,
      valid: false,
      fields: null,
    });
  });
});
