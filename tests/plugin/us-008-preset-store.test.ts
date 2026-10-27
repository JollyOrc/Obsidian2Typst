// US-008 AC-3 to AC-7, AC-12 — the preset store over the vault: built-in
// notes, re-reading by hand edits and sync, invalid notes, create, duplicate,
// rename, delete, and what it never writes (plugin logic with a fake vault;
// the real vault is checked by the manual check M2). Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BUILTIN_PRESET_TEXTS,
  effectiveSettings,
  type PresetFields,
} from '../../src/core/presets';
import {
  createPresetStore,
  type PresetStore,
} from '../../src/plugin/presets/store';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';
const A5 = `${FOLDER}/A5 print.md`;
const A4 = `${FOLDER}/A4 digital.md`;

const withBleed = (bleed: number): string =>
  `---\nschemaVersion: 1\npage:\n  trimSize: A5\n  bleed: ${bleed}\n---\nremarks\n`;
const TAB = '---\nschemaVersion: 1\npage:\n\tbleed: 3\n---\nbody';

interface Rig {
  vault: FakeVault;
  notices: string[];
  changes: string[][];
  defaults: PresetFields;
  store: PresetStore;
}

async function rig(
  files: Record<string, string> = {
    [A5]: BUILTIN_PRESET_TEXTS['A5 print'],
    [A4]: BUILTIN_PRESET_TEXTS['A4 digital'],
  },
  folders: string[] = [FOLDER],
): Promise<Rig> {
  const vault = new FakeVault(files, folders);
  const notices: string[] = [];
  const changes: string[][] = [];
  const state = {defaults: {} as PresetFields};
  const store = createPresetStore({
    vault,
    folder: () => FOLDER,
    defaults: () => state.defaults,
    notify: (text) => notices.push(text),
  });
  store.onChange((names) => changes.push(names));
  await store.load();
  // US-021 AC-9: the load itself is announced (tested there); `changes`
  // holds the events of what happens after the load.
  changes.length = 0;
  return {
    vault,
    notices,
    changes,
    store,
    get defaults() {
      return state.defaults;
    },
    set defaults(value: PresetFields) {
      state.defaults = value;
    },
  };
}

const tick = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('US-008 AC-6 built-in presets', () => {
  it("US-008 AC-6: creates the presets folder with 'A5 print' and 'A4 digital' when the folder does not exist", async () => {
    const {vault, store} = await rig({}, []);
    expect(vault.writes).toEqual([
      `folder:${FOLDER}`,
      `create:${A4}`,
      `create:${A5}`,
    ]);
    expect(vault.files.get(A5)).toBe(BUILTIN_PRESET_TEXTS['A5 print']);
    expect(vault.files.get(A4)).toBe(BUILTIN_PRESET_TEXTS['A4 digital']);
    expect(store.entries().map((e) => [e.name, e.valid])).toEqual([
      ['A4 digital', true],
      ['A5 print', true],
    ]);
  });

  it('US-008 AC-6: creates nothing when the folder exists, so deleted built-ins do not return', async () => {
    const empty = await rig({}, [FOLDER]);
    expect(empty.vault.writes).toEqual([]);
    expect(empty.store.entries()).toEqual([]);
    const one = await rig({[A4]: BUILTIN_PRESET_TEXTS['A4 digital']}, [FOLDER]);
    expect(one.vault.writes).toEqual([]);
    expect(one.store.entries().map((e) => e.name)).toEqual(['A4 digital']);
  });

  it('US-008 AC-6: reads only notes directly in the folder, no other file type, no subfolder', async () => {
    const {store} = await rig({
      [A5]: BUILTIN_PRESET_TEXTS['A5 print'],
      [`${FOLDER}/readme.txt`]: 'x',
      [`${FOLDER}/old/Archive.md`]: BUILTIN_PRESET_TEXTS['A5 print'],
      'Elsewhere/Other.md': BUILTIN_PRESET_TEXTS['A5 print'],
    });
    expect(store.entries().map((e) => e.name)).toEqual(['A5 print']);
  });
});

describe('US-008 AC-3 editing by hand and sync', () => {
  it('US-008 AC-3: re-reads a modified preset note within 2 seconds; settings, panel and preview use the new values', async () => {
    const {vault, store, changes} = await rig();
    vault.edit(A5, withBleed(5));
    await tick(1999);
    expect(store.get('A5 print')?.preset?.fields.page?.bleed).toBe(5);
    expect(changes).toEqual([['A5 print']]);
  });

  it('US-008 AC-3: reads a note once when it changes several times within the wait', async () => {
    const {vault, store, changes} = await rig();
    const before = vault.reads.length;
    vault.edit(A5, withBleed(1));
    await tick(100);
    vault.edit(A5, withBleed(2));
    await tick(100);
    vault.edit(A5, withBleed(7));
    await tick(2000);
    expect(vault.reads.length - before).toBe(1);
    expect(store.get('A5 print')?.preset?.fields.page?.bleed).toBe(7);
    expect(changes).toEqual([['A5 print']]);
  });

  it('US-008 AC-3: waits 300 ms after the last change of a note, not after the first', async () => {
    const {vault, store} = await rig();
    const before = vault.reads.length;
    vault.edit(A5, withBleed(1));
    await tick(250);
    vault.edit(A5, withBleed(2));
    await tick(200);
    expect(vault.reads.length).toBe(before);
    await tick(150);
    expect(vault.reads.length - before).toBe(1);
    expect(store.get('A5 print')?.preset?.fields.page?.bleed).toBe(2);
  });

  it('US-008 AC-3: sends a change event when only the lines of the fields move (a blank line in the frontmatter)', async () => {
    const {vault, store, changes} = await rig();
    const text = BUILTIN_PRESET_TEXTS['A5 print'].replace(
      'page:',
      '\n# remarks\npage:',
    );
    vault.edit(A5, text);
    await tick(2000);
    expect(changes).toEqual([['A5 print']]);
    expect(store.get('A5 print')?.preset?.lines['page']).toBe(5);
  });

  it('US-008 AC-3: does no work for changes of other files and other folders', async () => {
    const {vault} = await rig();
    const listed = vi.spyOn(vault, 'listNotes');
    vault.edit('Notes/Book.md', 'x');
    vault.edit(`${FOLDER}/sub/Deep.md`, withBleed(1));
    vault.edit(`${FOLDER}/readme.txt`, 'x');
    vault.emit({kind: 'delete', path: 'Notes/Other.md'});
    await tick(2000);
    expect(listed).not.toHaveBeenCalled();
  });

  it('US-008 AC-3: a change event without a change of the text sends no event and no second notice', async () => {
    const {vault, notices, changes} = await rig({
      [A5]: TAB,
      [A4]: BUILTIN_PRESET_TEXTS['A4 digital'],
    });
    vault.emit({kind: 'modify', path: A5});
    vault.emit({kind: 'modify', path: A4});
    await tick(2000);
    expect(notices.length).toBe(1);
    expect(changes).toEqual([]);
  });

  it('US-008 AC-3: sends no change event when only the remarks (the body) of the note change', async () => {
    const {vault, changes} = await rig();
    vault.edit(A5, `${BUILTIN_PRESET_TEXTS['A5 print']}\nNew remarks.\n`);
    await tick(2000);
    expect(changes).toEqual([]);
  });

  it('US-008 AC-3: ignores changes of other files and of notes in other folders', async () => {
    const {vault, changes} = await rig();
    const before = vault.reads.length;
    vault.edit('Notes/Book.md', 'x');
    vault.edit(`${FOLDER}/sub/Deep.md`, withBleed(1));
    vault.edit(`${FOLDER}/readme.txt`, 'x');
    await tick(2000);
    expect(vault.reads.length).toBe(before);
    expect(changes).toEqual([]);
  });

  it('US-008 AC-3: picks up a note that is added, renamed or deleted by hand or by sync', async () => {
    const {vault, store, changes} = await rig();
    vault.edit(`${FOLDER}/Synced.md`, withBleed(2));
    await tick(2000);
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'A5 print',
      'Synced',
    ]);
    vault.emit({kind: 'rename', path: `${FOLDER}/Renamed.md`, oldPath: A5});
    vault.files.set(`${FOLDER}/Renamed.md`, vault.files.get(A5) ?? '');
    vault.files.delete(A5);
    await tick(2000);
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'Renamed',
      'Synced',
    ]);
    vault.remove(A4);
    await tick(2000);
    expect(store.entries().map((e) => e.name)).toEqual(['Renamed', 'Synced']);
    expect(changes.length).toBe(3);
  });

  it('US-008 AC-3: a note moved out of the folder is no longer a preset', async () => {
    const {vault, store} = await rig();
    vault.emit({kind: 'rename', path: 'Elsewhere/A5 print.md', oldPath: A5});
    vault.files.set('Elsewhere/A5 print.md', vault.files.get(A5) ?? '');
    vault.files.delete(A5);
    await tick(2000);
    expect(store.entries().map((e) => e.name)).toEqual(['A4 digital']);
  });

  it('US-008 AC-3: a listener that was removed gets no more events', async () => {
    const {vault, store} = await rig();
    const seen: string[][] = [];
    const off = store.onChange((names) => seen.push(names));
    vault.edit(A5, withBleed(1));
    await tick(2000);
    off();
    vault.edit(A5, withBleed(2));
    await tick(2000);
    expect(seen).toEqual([['A5 print']]);
  });

  it('US-008 AC-3: stops listening and waiting when it is disposed', async () => {
    const {vault, store, changes, notices} = await rig();
    expect(vault.watching).toBe(1);
    const reads = vault.reads.length;
    vault.edit(A5, TAB);
    store.dispose();
    await tick(2000);
    expect(vault.watching).toBe(0);
    expect(changes).toEqual([]);
    expect(notices).toEqual([]);
    expect(vault.reads.length).toBe(reads);
  });
});

describe('US-008 AC-4 invalid preset notes', () => {
  it('US-008 AC-4: shows one notice per change for an invalid preset note and revalidates when it is fixed', async () => {
    const {vault, store, notices, changes} = await rig();
    vault.edit(A5, TAB);
    await tick(2000);
    const entry = store.get('A5 print');
    expect(entry?.valid).toBe(false);
    expect(entry?.error).toEqual({
      message: 'Tabs are not allowed as indentation',
      line: 4,
    });
    expect(notices).toEqual([
      'Preset "A5 print": Tabs are not allowed as indentation (line 4)',
    ]);
    expect(store.get('A4 digital')?.valid).toBe(true);

    vault.edit(A5, withBleed(3));
    await tick(2000);
    expect(store.get('A5 print')?.valid).toBe(true);
    expect(notices.length).toBe(1);
    expect(changes).toEqual([['A5 print'], ['A5 print']]);
  });

  it('US-008 AC-4: a note that is invalid when the plugin loads is marked and announced once', async () => {
    const {store, notices} = await rig({
      [A5]: TAB,
      [A4]: BUILTIN_PRESET_TEXTS['A4 digital'],
    });
    expect(store.get('A5 print')?.valid).toBe(false);
    expect(store.get('A4 digital')?.valid).toBe(true);
    expect(notices).toEqual([
      'Preset "A5 print": Tabs are not allowed as indentation (line 4)',
    ]);
  });

  it('US-008 AC-4: cannot be selected for export or preview, and says why', async () => {
    const {store} = await rig({[A5]: TAB});
    expect(store.use('A5 print')).toEqual({
      ok: false,
      error:
        'Preset "A5 print" is invalid: Tabs are not allowed as indentation (line 4)',
    });
    expect(store.use('Nope')).toEqual({
      ok: false,
      error: 'Preset "Nope" does not exist',
    });
    const good = await rig();
    const used = good.store.use('A5 print');
    expect(used.ok && used.preset.fields.page?.bleed).toBe(3);
  });

  it('US-008 AC-4: a note with the same error twice in a row is announced again only after a new change', async () => {
    const {vault, notices} = await rig();
    vault.edit(A5, TAB);
    await tick(2000);
    vault.edit(A5, TAB + '\n');
    await tick(2000);
    expect(notices.length).toBe(2);
  });

  it('US-008 AC-4: announces a heading numbering that is replaced, once per change', async () => {
    const {vault, notices, store} = await rig();
    vault.edit(A5, '---\nschemaVersion: 1\nheadingNumbering: "x"\n---\n');
    await tick(2000);
    expect(notices).toEqual([
      'Preset "A5 print": Invalid heading numbering; "1.1" is used',
    ]);
    expect(store.get('A5 print')?.valid).toBe(true);
    expect(store.get('A5 print')?.preset?.fields.headingNumbering).toBe('1.1');
  });

  it('US-009 AC-2: a page that is too small for its margins makes the preset invalid, judged with the Defaults', async () => {
    const r = await rig();
    expect(r.store.get('A5 print')?.valid).toBe(true);
    r.defaults = {page: {trimSize: 'A6', margins: {inside: 40, outside: 40}}};
    r.vault.edit(A5, '---\nschemaVersion: 1\npage:\n  gutter: 0\n---\n');
    await tick(2000);
    const entry = r.store.get('A5 print');
    expect(entry?.valid).toBe(false);
    expect(entry?.error?.message).toContain('Text block would be only');
    expect(entry?.error?.line).toBeNull();
  });

  it('US-008 AC-4: refresh() judges all notes again after the Defaults changed, and tells what changed', async () => {
    const r = await rig();
    const small = {page: {trimSize: 'A6', margins: {inside: 40, outside: 40}}};
    r.changes.length = 0;
    r.defaults = small;
    r.store.refresh();
    // Both built-in notes set their own page, so these Defaults do not change them.
    expect(r.store.entries().map((e) => e.valid)).toEqual([true, true]);
    expect(r.changes).toEqual([]);

    r.defaults = {};
    r.vault.edit(A5, '---\nschemaVersion: 1\nhighlightColor: "#000000"\n---\n');
    await tick(2000);
    expect(r.store.get('A5 print')?.valid).toBe(true);
    r.changes.length = 0;
    r.defaults = small;
    r.store.refresh();
    expect(r.store.get('A5 print')?.valid).toBe(false);
    expect(r.store.get('A4 digital')?.valid).toBe(true);
    expect(r.changes).toEqual([['A5 print']]);
    expect(r.notices.length).toBe(1);

    r.defaults = {};
    r.store.refresh();
    expect(r.store.get('A5 print')?.valid).toBe(true);
    expect(r.changes).toEqual([['A5 print'], ['A5 print']]);
  });
});

describe('US-008 AC-5 create, duplicate, rename, delete', () => {
  it('US-008 AC-5: creates a preset as a new note, empty or as a copy', async () => {
    const {vault, store} = await rig();
    const result = await store.create('Tryout');
    expect(result).toEqual({ok: true, name: 'Tryout'});
    expect(vault.files.get(`${FOLDER}/Tryout.md`)).toBe(
      '---\nschemaVersion: 1\n---\n',
    );
    expect(store.get('Tryout')?.valid).toBe(true);

    const body = '---\nschemaVersion: 1\nfuture: 1\n---\nMy remarks\n';
    vault.files.set(A4, body);
    const copy = await store.create('Clone', 'A4 digital');
    expect(copy).toEqual({ok: true, name: 'Clone'});
    expect(vault.files.get(`${FOLDER}/Clone.md`)).toBe(body);
  });

  it('US-008 AC-5: creates the presets folder again when it was removed after the start', async () => {
    const {vault, store} = await rig();
    vault.folders.delete(FOLDER);
    const writes = vault.writes.length;
    expect(await store.create('Again')).toEqual({ok: true, name: 'Again'});
    expect(vault.writes.slice(writes)).toEqual([
      `folder:${FOLDER}`,
      `create:${FOLDER}/Again.md`,
    ]);
  });

  it('US-008 AC-5: duplicates a preset as "<name> copy" and "<name> copy 2"', async () => {
    const {vault, store} = await rig();
    expect(await store.duplicate('A5 print')).toEqual({
      ok: true,
      name: 'A5 print copy',
    });
    expect(await store.duplicate('A5 print')).toEqual({
      ok: true,
      name: 'A5 print copy 2',
    });
    expect(vault.files.get(`${FOLDER}/A5 print copy 2.md`)).toBe(
      BUILTIN_PRESET_TEXTS['A5 print'],
    );
  });

  it('US-008 AC-5: rejects a bad or taken name without touching the vault', async () => {
    const {vault, store} = await rig();
    const writes = vault.writes.length;
    expect(await store.create('a5 print')).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(await store.create('a/b')).toEqual({
      ok: false,
      error: 'A preset name cannot contain / \\ : * ? " < > |',
    });
    expect(await store.create('Copy', 'Nope')).toEqual({
      ok: false,
      error: 'Preset "Nope" does not exist',
    });
    expect(await store.rename('A5 print', 'a4 DIGITAL')).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(vault.writes.length).toBe(writes);
  });

  it('US-008 AC-5: renames a preset through the vault rename so links update', async () => {
    const {vault, store} = await rig();
    const writes = vault.writes.length;
    expect(await store.rename('A5 print', 'Print 2')).toEqual({
      ok: true,
      name: 'Print 2',
    });
    expect(vault.writes.slice(writes)).toEqual([
      `rename:${A5}->${FOLDER}/Print 2.md`,
    ]);
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'Print 2',
    ]);
    await tick(2000);
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'Print 2',
    ]);
  });

  it('US-008 AC-5: sends one change event for a rename, with the old and the new name', async () => {
    const {store, changes} = await rig();
    await store.rename('A5 print', 'Print 2');
    await tick(2000);
    expect(changes).toEqual([['A5 print', 'Print 2']]);
  });

  it('US-008 AC-5: renames only the case of a name', async () => {
    const {vault, store} = await rig();
    expect(await store.rename('A5 print', 'a5 PRINT')).toEqual({
      ok: true,
      name: 'a5 PRINT',
    });
    expect(vault.writes.at(-1)).toBe(`rename:${A5}->${FOLDER}/a5 PRINT.md`);
  });

  it('US-008 AC-5: moves a deleted preset note to the trash according to the Obsidian setting', async () => {
    const {vault, store} = await rig();
    const result = await store.remove('A4 digital', 'A5 print');
    expect(result).toEqual({ok: true, active: 'A5 print'});
    expect(vault.trashed).toEqual([A4]);
    expect(vault.writes.at(-1)).toBe(`trash:${A4}`);
    expect(store.entries().map((e) => e.name)).toEqual(['A5 print']);
  });

  it('US-008 AC-5: activates the first remaining preset, alphabetically, when the active one is deleted', async () => {
    const {store} = await rig();
    await store.create('Zeta');
    const result = await store.remove('A5 print', 'A5 print');
    expect(result).toEqual({ok: true, active: 'A4 digital'});
  });

  it('US-008 AC-5: refuses to delete the last remaining preset', async () => {
    const {vault, store} = await rig({[A5]: BUILTIN_PRESET_TEXTS['A5 print']});
    const writes = vault.writes.length;
    expect(await store.remove('A5 print', 'A5 print')).toEqual({
      ok: false,
      error: 'The last preset cannot be deleted',
    });
    expect(vault.writes.length).toBe(writes);
    expect(vault.trashed).toEqual([]);
  });

  it('US-008 AC-5: does not announce its own changes as invalid notes or as changes twice', async () => {
    const {store, notices, changes} = await rig();
    await store.create('Tryout');
    await tick(2000);
    expect(notices).toEqual([]);
    expect(changes).toEqual([['Tryout']]);
  });
});

describe('US-008 AC-7 and AC-12 the store never writes presets by itself', () => {
  it('US-008 AC-7: loading, refreshing, using and listing change nothing in the vault', async () => {
    const r = await rig();
    const writes = [...r.vault.writes];
    const texts = new Map(r.vault.files);
    r.store.use('A5 print');
    r.store.entries();
    r.store.refresh();
    r.vault.edit(A5, withBleed(4));
    await tick(2000);
    expect(r.vault.writes).toEqual(writes);
    expect(r.vault.files.get(A4)).toBe(texts.get(A4));
  });

  it('US-008 AC-12: a new value of a preset note reaches the settings that the pipeline gets, without restart', async () => {
    const {vault, store} = await rig();
    const page = () => {
      const used = store.use('A5 print');
      if (!used.ok) throw new Error(used.error);
      const effective = effectiveSettings(used.preset, {}, () => false);
      if (!effective.ok) throw new Error(effective.error.message);
      return effective.settings.page.pageWidth;
    };
    expect(page()).toBe(154);
    vault.edit(A5, withBleed(5));
    await tick(2000);
    expect(page()).toBe(158);
  });
});

describe('US-008 AC-3 a changed presets folder', () => {
  it('US-008 AC-3: loading again reads the new folder, creates its built-in notes and listens only once', async () => {
    const vault = new FakeVault({[A5]: BUILTIN_PRESET_TEXTS['A5 print']}, [
      FOLDER,
    ]);
    const state = {folder: FOLDER};
    const changes: string[][] = [];
    const store = createPresetStore({
      vault,
      folder: () => state.folder,
      defaults: () => ({}),
      notify: () => undefined,
    });
    store.onChange((names) => changes.push(names));
    await store.load();
    expect(store.entries().map((e) => e.name)).toEqual(['A5 print']);

    state.folder = 'Books/presets';
    await store.load();
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'A5 print',
    ]);
    // US-021 AC-9: both loads are announced, the second with the new folder.
    expect(changes).toEqual([['A5 print'], ['A4 digital', 'A5 print']]);
    changes.length = 0;
    expect(vault.files.has('Books/presets/A5 print.md')).toBe(true);
    expect(vault.watching).toBe(1);

    vault.edit(A5, withBleed(9));
    await tick(2000);
    expect(changes).toEqual([]);
    vault.edit('Books/presets/A5 print.md', withBleed(9));
    await tick(2000);
    expect(changes).toEqual([['A5 print']]);
  });
});
