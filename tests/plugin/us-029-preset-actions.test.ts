// US-029 AC-6, AC-12 — the preset screen's Duplicate, Rename and Delete over
// the real preset store (added at #113 after four mutants of the wiring in
// main.ts survived): a refused duplicate is a notice; a rename of the active
// preset keeps it active (read when it runs, SCAR-016), a refused name stays
// in the dialog, a cancelled dialog gives null; Delete asks first and tells
// whether the preset was deleted (SCAR-014). The name dialog tells when it
// closes. Source of truth:
// docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {readFileSync} from 'node:fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  createSettingsStore,
} from '../../src/plugin/settings/data';
import {presetScreenActions} from '../../src/plugin/settings/preset-actions';
import {resetFake} from '../support/fake-obsidian';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const FOLDER = 'Obsidian2Typst/presets';
const fm = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/**
 * The stores and the actions; `names` are what the user types into the name
 * dialog, one after another (null: closes it without OK); `confirm` answers
 * the delete question.
 */
async function rig(
  answers: {names?: (string | null)[]; confirm?: boolean} = {},
) {
  const vault = new FakeVault(
    {[`${FOLDER}/A5 print.md`]: fm(), [`${FOLDER}/Book.md`]: fm()},
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
  const presets = createPresetStore({
    vault,
    folder: () => settings.data.presetsFolder,
    defaults: () => settings.data.defaults,
    notify: () => undefined,
  });
  await presets.load();
  const log: string[] = [];
  const typed = [...(answers.names ?? [])];
  const actions = presetScreenActions({
    presets,
    settings,
    askName: async (title, initial, submit) => {
      log.push(`ask:${title}:${initial}`);
      for (;;) {
        const name = typed.shift() ?? null;
        if (name === null) return; // closed without OK
        const error = await submit(name);
        if (error === null) return; // OK closes the dialog
        log.push(`refused:${error}`);
      }
    },
    confirm: async (text) => {
      log.push(`confirm:${text.title}`);
      return answers.confirm ?? false;
    },
    notify: (text) => void log.push(`notice:${text}`),
  });
  return {actions, presets, settings, log};
}

const names = (presets: ReturnType<typeof createPresetStore>): string[] =>
  presets.entries().map((e) => e.name);

beforeEach(() => resetFake());

describe('US-029 AC-6 Duplicate', () => {
  it('US-029 AC-6: makes a copy; no notice', async () => {
    const {actions, presets, log} = await rig();
    await actions.duplicate('Book');
    expect(names(presets).length).toBe(3);
    expect(log).toEqual([]);
  });

  it('US-029 AC-6: a refusal is a notice', async () => {
    const {actions, log} = await rig();
    await actions.duplicate('Nope');
    expect(log).toEqual(['notice:Preset "Nope" does not exist']);
  });
});

describe('US-029 AC-6 Rename', () => {
  it('US-029 AC-6, AC-12: renaming the active preset keeps it active; the new name comes back', async () => {
    const {actions, presets, settings} = await rig({names: ['A5 new']});
    expect(await actions.rename('A5 print')).toBe('A5 new');
    expect(names(presets)).toContain('A5 new');
    expect(settings.data.activePreset).toBe('A5 new');
  });

  it('US-029 AC-6: renaming another preset leaves the active one as it is', async () => {
    const {actions, settings} = await rig({names: ['Novel']});
    expect(await actions.rename('Book')).toBe('Novel');
    expect(settings.data.activePreset).toBe('A5 print');
  });

  it('US-029 AC-6: a refused name stays in the dialog; the next name is taken', async () => {
    const {actions, log} = await rig({names: ['Book', 'Novel']});
    expect(await actions.rename('A5 print')).toBe('Novel');
    expect(log[0]).toBe('ask:Rename preset:A5 print');
    expect(log.filter((l) => l.startsWith('refused:'))).toHaveLength(1);
  });

  it('US-029 AC-6: a dialog closed without OK gives null and changes nothing', async () => {
    const {actions, presets, settings} = await rig({names: [null]});
    expect(await actions.rename('A5 print')).toBeNull();
    expect(names(presets)).toContain('A5 print');
    expect(settings.data.activePreset).toBe('A5 print');
  });
});

describe('US-029 AC-6, SCAR-014 Delete', () => {
  it('US-029 AC-6, AC-12: confirmed: the preset is gone, the next one is active, true', async () => {
    const {actions, presets, settings, log} = await rig({confirm: true});
    expect(await actions.remove('A5 print')).toBe(true);
    expect(names(presets)).toEqual(['Book']);
    expect(settings.data.activePreset).toBe('Book');
    expect(log).toEqual(['confirm:Delete preset "A5 print"?']);
  });

  it('US-029 AC-6: cancelled: nothing changes, false', async () => {
    const {actions, presets} = await rig({confirm: false});
    expect(await actions.remove('A5 print')).toBe(false);
    expect(names(presets)).toEqual(['A5 print', 'Book']);
  });

  it('US-029 AC-6: refused (a preset that is gone): a notice, no question, false', async () => {
    const {actions, log} = await rig({confirm: true});
    expect(await actions.remove('Nope')).toBe(false);
    expect(log).toEqual(['notice:Preset "Nope" does not exist']);
  });
});

describe('US-029 AC-6 the name dialog tells when it closes', () => {
  it('US-029 AC-6: closing the dialog calls closed (the rename waits for it)', async () => {
    const {NameModal} = await import('../../src/plugin/settings/name-modal');
    let closed = 0;
    const modal = new NameModal(
      {} as never,
      'Rename preset',
      'A5 print',
      async () => null,
      () => void closed++,
    );
    modal.onClose();
    expect(closed).toBe(1);
  });
});

describe('US-029 AC-6 main.ts hands the dialogs their answers (text check)', () => {
  it('US-029 AC-6: the name dialog resolves the rename when it closes; the confirmation resolves Delete', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    const open = main.slice(main.indexOf('private openDetails('));
    const body = open.slice(0, open.indexOf('\n  }\n'));
    expect(body).toMatch(
      /new NameModal\(this\.app, title, initial, submit, resolve\)\.open\(\)/,
    );
    expect(body).toMatch(
      /new ConfirmModal\(this\.app, text, resolve\)\.open\(\)/,
    );
  });
});
