// US-045 AC-2 to AC-6, AC-8 — the note's preset in the export (direct and
// through the dialog), the preview's preparation, the panel's preset list and
// the note menu. The real preset store runs over a fake vault (as US-008's
// command test); which preset was used is read from the Typst that comes out
// (its page line, SCAR-015), not from the decision alone. Names are invented
// (SCAR-035). Source of truth: docs/user-stories/US-045-note-preset.md.
// Red until US-045 is implemented (G2, 2026-11-26).
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import {
  exportCurrentNote,
  exportNoteWithDialog,
  type ExportRequest,
} from '../../src/plugin/export-command';
import {noteMenuEntries} from '../../src/plugin/menus';
import {prepareNote} from '../../src/plugin/prepare-note';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {COMPOSED_NOTE, standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';
const A5 = `${FOLDER}/A5 print.md`;
const A4 = `${FOLDER}/A4 digital.md`;
const BROKEN = `${FOLDER}/Broken.md`;
const NOTE = 'Sample/Reed Sheets.md';
const A5_PAGE = '#set page(width: 154mm, height: 216mm';
const A4_PAGE = '#set page(width: 210mm, height: 297mm';
const withKey = (value: string): string =>
  `---\ntypst-preset: ${value}\n---\n${COMPOSED_NOTE}`;

interface Dialog {
  noteName: string;
  preset: string;
  /** US-045 AC-4: the refusal line the dialog shows (absent without one). */
  problem?: string;
}
interface Rig {
  data: PluginData;
  notices: string[];
  requests: ExportRequest[];
  dialogs: Dialog[];
  answer: {value: {preset: string; folder: string} | null | 'same'};
  saved: [string, string][];
  texts: Map<string, string>;
  deps: Parameters<typeof exportCurrentNote>[0];
}

async function rig(note: string): Promise<Rig> {
  const vault = new FakeVault(
    {
      [A5]: BUILTIN_PRESET_TEXTS['A5 print'],
      [A4]: BUILTIN_PRESET_TEXTS['A4 digital'],
      [BROKEN]: '---\nschemaVersion: 1\npage: 7\n---\n',
    },
    [FOLDER],
  );
  const data = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)) as PluginData;
  data.activePreset = 'A5 print';
  data.lastExportFolders = {'A5 print': '/a5', 'A4 digital': '/a4'};
  const notices: string[] = [];
  const store = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await store.load();
  const texts = new Map<string, string>([[NOTE, note]]);
  const r = {
    data,
    notices,
    requests: [],
    dialogs: [],
    answer: {value: 'same'},
    saved: [],
    texts,
  } as unknown as Rig;
  r.deps = {
    notes: {
      activePath: () => NOTE,
      read: async (path: string) => texts.get(path) ?? '',
    },
    vault: {
      files: () => [NOTE, 'Sample/assets/map.png', 'Sample/assets/other.png'],
      readHead: async (path: string, length = 16) =>
        standIn(path).subarray(0, length),
      readBytes: async (path: string) => standIn(path),
      readText: async (path: string) => texts.get(path) ?? null,
    },
    presets: store,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async (preset: string, folder: string) => {
        r.saved.push([preset, folder]);
        data.lastExportFolders[preset] = folder;
      },
      update: async (patch: {activePreset: string}) => {
        data.activePreset = patch.activePreset;
      },
    },
    exportDialog: async (request: Dialog) => {
      r.dialogs.push(request);
      const a = r.answer.value;
      return a === 'same' ? {preset: request.preset, folder: '/chosen'} : a;
    },
    run: async (request: ExportRequest) => {
      r.requests.push(request);
      return {status: 'exported'};
    },
    notice: (text: string) => notices.push(text),
  } as never;
  return r;
}
const typOf = (r: Rig): string => {
  const request = r.requests[0];
  if (request === undefined) throw new Error('no export was started');
  return request.typ;
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('US-045 AC-2, AC-3 the direct export', () => {
  it('US-045 AC-2: a note naming A4 digital is exported with it, into A4 digital’s folder', async () => {
    const r = await rig(withKey('A4 digital'));
    expect((await exportCurrentNote(r.deps)) as {status: string}).toEqual({
      status: 'exported',
    });
    expect(typOf(r)).toContain(A4_PAGE);
    expect(r.requests[0]!.exportDir).toBe('/a4');
  });
  it('US-045 AC-3: the active preset stays A5 print', async () => {
    const r = await rig(withKey('A4 digital'));
    await exportCurrentNote(r.deps);
    expect(r.data.activePreset).toBe('A5 print');
    expect(r.dialogs).toEqual([]);
  });
  it('US-045 AC-1 (D7): the name matches as the preset list compares names (case ignored)', async () => {
    const r = await rig(withKey('a4 DIGITAL'));
    await exportCurrentNote(r.deps);
    expect(typOf(r)).toContain(A4_PAGE);
  });
  it('US-045 AC-8 (SCAR-019): without the key, or with an empty one, the active preset as before', async () => {
    for (const note of [COMPOSED_NOTE, withKey('""')]) {
      const r = await rig(note);
      await exportCurrentNote(r.deps);
      expect(typOf(r)).toContain(A5_PAGE);
      expect(r.data.activePreset).toBe('A5 print');
    }
  });
  it('US-045 AC-2 (SCAR-022): the key is read from the note as it is now, not as it was at the last export', async () => {
    const r = await rig(withKey('A4 digital'));
    await exportCurrentNote(r.deps);
    expect(typOf(r)).toContain(A4_PAGE);
    r.texts.set(NOTE, withKey('A5 print'));
    r.requests.length = 0;
    await exportCurrentNote(r.deps);
    expect(typOf(r)).toContain(A5_PAGE);
  });
});

describe('US-045 AC-4 a key that names nothing usable', () => {
  it('US-045 AC-4: an unknown name: the direct export refuses with the property named', async () => {
    const r = await rig(withKey('Gone Sheets'));
    const result = (await exportCurrentNote(r.deps)) as {status: string};
    expect(result.status).not.toBe('exported');
    expect(r.requests).toEqual([]);
    expect(r.notices).toContain(
      'Preset "Gone Sheets" (from this note\'s properties) does not exist.',
    );
  });
  it('US-045 AC-4: an invalid preset: refused with the property named and the reason', async () => {
    const r = await rig(withKey('Broken'));
    await exportCurrentNote(r.deps);
    expect(r.requests).toEqual([]);
    expect(
      r.notices.some((n) =>
        n.startsWith(
          'Preset "Broken" (from this note\'s properties) is invalid: ',
        ),
      ),
      r.notices.join(' | '),
    ).toBe(true);
  });
  it('US-045 AC-1, AC-4: a list as the value is refused with the property message', async () => {
    const r = await rig(withKey('[A4 digital]'));
    await exportCurrentNote(r.deps);
    expect(r.requests).toEqual([]);
    expect(r.notices.join(' ')).toContain(
      'the property typst-preset must be a preset name',
    );
  });
  it('US-045 AC-4: the dialog opens on the active preset and shows the line; exporting uses the choice', async () => {
    const r = await rig(withKey('Gone Sheets'));
    await exportNoteWithDialog(r.deps, NOTE);
    expect(r.dialogs).toHaveLength(1);
    expect(r.dialogs[0]!.preset).toBe('A5 print');
    expect(r.dialogs[0]!.problem).toBe(
      'Preset "Gone Sheets" (from this note\'s properties) does not exist',
    );
    expect(typOf(r)).toContain(A5_PAGE);
  });
});

describe('US-045 AC-2, AC-3 the export dialog', () => {
  it('US-045 AC-2: the dialog’s first choice is the note’s preset, without a problem line', async () => {
    const r = await rig(withKey('A4 digital'));
    await exportNoteWithDialog(r.deps, NOTE);
    expect(r.dialogs[0]).toEqual({
      noteName: 'Reed Sheets',
      preset: 'A4 digital',
    });
    expect(typOf(r)).toContain(A4_PAGE);
    expect(r.data.activePreset).toBe('A5 print');
  });
  it('US-045 AC-3: another preset chosen for a note with the key: exported with it once; active preset and note unchanged; its folder remembered', async () => {
    const r = await rig(withKey('A4 digital'));
    r.answer.value = {preset: 'A5 print', folder: '/once'};
    r.data.activePreset = 'A4 digital';
    await exportNoteWithDialog(r.deps, NOTE);
    expect(typOf(r)).toContain(A5_PAGE);
    expect(r.data.activePreset).toBe('A4 digital');
    expect(r.texts.get(NOTE)).toBe(withKey('A4 digital'));
    expect(r.saved).toEqual([['A5 print', '/once']]);
  });
  it('US-045 AC-3, AC-8: without the key the dialog behaves as before: the choice becomes active', async () => {
    const r = await rig(COMPOSED_NOTE);
    r.answer.value = {preset: 'A4 digital', folder: '/x'};
    await exportNoteWithDialog(r.deps, NOTE);
    expect(r.dialogs[0]).toEqual({noteName: 'Reed Sheets', preset: 'A5 print'});
    expect(r.data.activePreset).toBe('A4 digital');
  });
});

describe('US-045 AC-2 the preview', () => {
  it('US-045 AC-2: the preview prepares the note with its preset, and the active preset stays', async () => {
    const r = await rig(withKey('A4 digital'));
    const prepared = (await prepareNote(r.deps as never, NOTE)) as {
      ok?: boolean;
      typ?: string;
    };
    expect(prepared.ok, JSON.stringify(prepared).slice(0, 200)).toBe(true);
    expect(prepared.typ).toContain(A4_PAGE);
    expect(r.data.activePreset).toBe('A5 print');
  });
  it('US-045 AC-4: the preview refuses an unknown name with the property named', async () => {
    const r = await rig(withKey('Gone Sheets'));
    const prepared = (await prepareNote(r.deps as never, NOTE)) as {
      ok: boolean;
      message?: string;
    };
    expect(prepared.ok).toBe(false);
    expect(prepared.message).toBe(
      'Preset "Gone Sheets" (from this note\'s properties) does not exist',
    );
  });
});

describe('US-045 AC-5 the preview panel’s preset list', () => {
  const PANEL = '../../src/plugin/preview/preset-control';
  interface PanelModule {
    previewPresetControl(state: {active: string; notePreset: string | null}): {
      value: string;
      locked: boolean;
      hint: string | null;
    };
  }
  it('US-045 AC-5: with the note’s preset: shown, locked, with the hint; without: the active preset, free', async () => {
    const {previewPresetControl} = (await import(
      /* @vite-ignore */ PANEL
    )) as PanelModule;
    expect(
      previewPresetControl({active: 'A5 print', notePreset: 'A4 digital'}),
    ).toEqual({
      value: 'A4 digital',
      locked: true,
      hint: "Set by this note's properties (O2T: Preset for this note…)",
    });
    expect(
      previewPresetControl({active: 'A5 print', notePreset: null}),
    ).toEqual({value: 'A5 print', locked: false, hint: null});
  });
});

describe('US-045 AC-6 the note menu', () => {
  it('US-045 AC-6: a note gets "Preset for this note…" after Export to PDF and Preview; it opens the chooser for that note', async () => {
    const calls: string[] = [];
    const actions = new Proxy(
      {},
      {
        get: (_t, name: string) => async (path: string) => {
          calls.push(`${name}:${path}`);
        },
      },
    ) as never;
    const entries = noteMenuEntries(
      actions,
      {path: NOTE, folder: false},
      FOLDER,
    );
    expect(entries.map((e) => e.title)).toEqual([
      'Export to PDF',
      'Preview',
      'Preset for this note…',
    ]);
    await entries[2]!.run!();
    expect(calls).toEqual([`chooseNotePreset:${NOTE}`]);
  });
  it('US-045 AC-6: a preset note gets no such entry', () => {
    expect(
      noteMenuEntries({} as never, {path: A5, folder: false}, FOLDER),
    ).toEqual([]);
  });
});
