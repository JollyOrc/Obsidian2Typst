// US-042 AC-1, AC-2, AC-6, AC-7, AC-11 — the export command: a direct export
// goes at once into the active preset's remembered folder; without one, and from
// the new entry `Export…`, the dialog asks; its choice is saved before the
// conversion; the progress starts once the folder is known and ends with the run;
// refusals end with a full stop. The real preset store runs over a fake vault; the
// run is a fake (its own tests: us-042-export-run). Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import type {ExportEnd, ExportStep} from '../../src/core/export-progress';
import {
  exportNoteAt,
  exportNoteWithDialog,
  type ExportCommandDeps,
  type ExportRequest,
} from '../../src/plugin/export-command';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import type {ExportResult} from '../../src/plugin/run-export';
import {COMPOSED_NOTE, standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';
import {STRINGS} from '../../src/plugin/strings';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const FOLDER = 'Obsidian2Typst/presets';
const A5 = `${FOLDER}/A5 print.md`;
const A4 = `${FOLDER}/A4 digital.md`;
const NOTE = 'Sample/Rules.md';
const A4_PAGE =
  '#set page(width: 210mm, height: 297mm, margin: (top: 20mm, bottom: 20mm, left: 20mm, right: 20mm))';

type Choice = {preset: string; folder: string} | null;

async function rig(
  options: {
    folders?: Record<string, string>;
    answer?: Choice;
    result?: ExportResult['status'];
    presets?: Record<string, string>;
  } = {},
) {
  const vault = new FakeVault(
    options.presets ?? {
      [A5]: BUILTIN_PRESET_TEXTS['A5 print'],
      [A4]: BUILTIN_PRESET_TEXTS['A4 digital'],
    },
    [FOLDER],
  );
  const data: PluginData = structuredClone(DEFAULT_PLUGIN_DATA);
  data.activePreset = 'A5 print';
  data.lastExportFolders = {...(options.folders ?? {})};
  const store = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await store.load();
  const log: string[] = [];
  const notices: string[] = [];
  const requests: ExportRequest[] = [];
  const asked: {noteName: string; preset: string}[] = [];
  const ends: ExportEnd[] = [];
  const steps: ExportStep[] = [];
  const texts = new Map<string, string>([[NOTE, COMPOSED_NOTE]]);
  const files = [NOTE, 'Sample/assets/map.png', 'Sample/assets/other.png'];
  const active = {path: NOTE as string | null};
  const progress = {
    step: (step: ExportStep) => {
      steps.push(step);
      log.push(`step ${step.kind}`);
    },
    warnings: () => undefined,
    end: (end: ExportEnd) => {
      ends.push(end);
      log.push(`end ${end}`);
    },
    cancel: () => undefined,
    cancelled: false,
    onCancel: () => () => undefined,
  };
  const deps: ExportCommandDeps = {
    notes: {
      activePath: () => active.path,
      read: async (path) => {
        log.push('read');
        return texts.get(path) ?? '';
      },
    },
    vault: {
      files: () => files,
      readHead: async (path, length = 16) => standIn(path).subarray(0, length),
      readBytes: async (path) => standIn(path),
      readText: async (path) => texts.get(path) ?? null,
    },
    presets: store,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async (preset, folder) => {
        log.push(`save folder ${preset} ${folder}`);
        data.lastExportFolders[preset] = folder;
      },
      update: async (patch: {activePreset: string}) => {
        log.push(`save active ${patch.activePreset}`);
        data.activePreset = patch.activePreset;
      },
    },
    exportDialog: async (request) => {
      asked.push(request);
      log.push('dialog');
      return options.answer === undefined
        ? {preset: request.preset, folder: '/chosen'}
        : options.answer;
    },
    startProgress: (noteName: string) => {
      log.push(`progress ${noteName}`);
      return progress;
    },
    run: async (request) => {
      requests.push(request);
      log.push('run');
      return {status: options.result ?? 'exported'};
    },
    notice: (text) => void notices.push(text),
  } as ExportCommandDeps;
  return {
    deps,
    data,
    log,
    notices,
    requests,
    asked,
    ends,
    steps,
    progress,
    active,
  };
}

describe('US-042 AC-1: a direct export goes at once into the remembered folder', () => {
  it('with a remembered folder: no dialog, the run gets that folder', async () => {
    const r = await rig({folders: {'A5 print': '/out/a5'}});
    expect(await exportNoteAt(r.deps, NOTE)).toEqual({status: 'exported'});
    expect(r.asked).toEqual([]);
    expect(r.requests[0]?.exportDir).toBe('/out/a5');
  });

  it('the folder of the active preset, not of another one', async () => {
    const r = await rig({folders: {'A4 digital': '/out/a4'}});
    await exportNoteAt(r.deps, NOTE);
    expect(r.asked).toEqual([{noteName: 'Rules', preset: 'A5 print'}]);
  });

  it('without a remembered folder: the dialog opens, its folder is saved before converting', async () => {
    const r = await rig({answer: {preset: 'A5 print', folder: '/out/a5'}});
    await exportNoteAt(r.deps, NOTE);
    expect(r.asked).toEqual([{noteName: 'Rules', preset: 'A5 print'}]);
    expect(r.requests[0]?.exportDir).toBe('/out/a5');
    expect(r.data.lastExportFolders['A5 print']).toBe('/out/a5');
    expect(r.log.indexOf('save folder A5 print /out/a5')).toBeLessThan(
      r.log.indexOf('read'),
    );
  });

  // Added at T3 (#177; SCAR-023): an empty remembered folder is no folder.
  it('an empty remembered folder: the dialog opens', async () => {
    const r = await rig({folders: {'A5 print': ''}});
    await exportNoteAt(r.deps, NOTE);
    expect(r.asked).toEqual([{noteName: 'Rules', preset: 'A5 print'}]);
    expect(r.requests[0]?.exportDir).toBe('/chosen');
  });

  it('the dialog closed without Export: nothing saved, nothing run, no notice', async () => {
    const r = await rig({answer: null});
    expect(await exportNoteAt(r.deps, NOTE)).toEqual({status: 'cancelled'});
    expect(r.requests).toEqual([]);
    expect(r.notices).toEqual([]);
    expect(r.log.filter((l) => l.startsWith('save'))).toEqual([]);
    expect(r.log.filter((l) => l.startsWith('progress'))).toEqual([]);
  });
});

describe('US-042 AC-2, AC-6: Export… always asks; the chosen preset becomes active (P1)', () => {
  it('opens the dialog even with a remembered folder', async () => {
    const r = await rig({
      folders: {'A5 print': '/out/a5'},
      answer: {preset: 'A5 print', folder: '/out/a5'},
    });
    await exportNoteWithDialog(r.deps, NOTE);
    expect(r.asked).toEqual([{noteName: 'Rules', preset: 'A5 print'}]);
  });

  it('another preset chosen: it is saved as active and the note is converted with it', async () => {
    const r = await rig({answer: {preset: 'A4 digital', folder: '/out/a4'}});
    await exportNoteWithDialog(r.deps, NOTE);
    expect(r.data.activePreset).toBe('A4 digital');
    expect(r.data.lastExportFolders['A4 digital']).toBe('/out/a4');
    expect(r.requests[0]?.exportDir).toBe('/out/a4');
    expect(r.requests[0]?.typ).toContain(A4_PAGE);
  });

  it('no open note: the notice, no dialog', async () => {
    const r = await rig();
    expect(await exportNoteWithDialog(r.deps, null)).toEqual({
      status: 'no-note',
    });
    expect(r.notices).toEqual(['Open a note to export it.']);
    expect(r.asked).toEqual([]);
  });
});

describe('US-042 AC-7, AC-10: the progress starts once the folder is known and ends with the run', () => {
  it('in order: dialog, progress for the note, the convert step, the run, the end', async () => {
    const r = await rig();
    await exportNoteAt(r.deps, NOTE);
    expect(r.log.filter((l) => !l.startsWith('save') && l !== 'read')).toEqual([
      'dialog',
      'progress Rules',
      'step convert',
      'run',
      'end exported',
    ]);
    expect(r.requests[0]?.progress).toBe(r.progress);
  });

  it.each([
    ['exported', 'exported'],
    ['compile-error', 'failed'],
    ['compiler-failed', 'failed'],
    ['aborted', 'aborted'],
    ['cancelled', 'cancelled'],
    ['busy', 'failed'],
  ] as const)(
    'a run that ends %s ends the progress as %s',
    async (status, end) => {
      const r = await rig({folders: {'A5 print': '/out/a5'}, result: status});
      await exportNoteAt(r.deps, NOTE);
      expect(r.ends).toEqual([end]);
    },
  );

  it('a note that cannot be converted ends the progress as failed, without a run', async () => {
    const r = await rig({
      folders: {'A5 print': '/out/a5'},
      presets: {[A5]: BUILTIN_PRESET_TEXTS['A5 print']},
    });
    r.active.path = 'Sample/Missing.md';
    const deps = {
      ...r.deps,
      notes: {
        ...r.deps.notes,
        read: async () => {
          throw new Error('gone');
        },
      },
    } as ExportCommandDeps;
    await expect(exportNoteAt(deps, 'Sample/Missing.md')).rejects.toThrow(
      'gone',
    );
    expect(r.ends).toEqual(['failed']);
    expect(r.requests).toEqual([]);
  });

  it('without startProgress the command still exports (the dep is optional)', async () => {
    const r = await rig({folders: {'A5 print': '/out/a5'}});
    const deps = {...r.deps, startProgress: undefined} as ExportCommandDeps;
    expect(await exportNoteAt(deps, NOTE)).toEqual({status: 'exported'});
    expect(r.requests[0]?.progress).toBeUndefined();
  });
});

describe('US-042 AC-11: refusals before a run end with a full stop', () => {
  it('no open note', async () => {
    const r = await rig();
    await exportNoteAt(r.deps, null);
    expect(r.notices).toEqual(['Open a note to export it.']);
  });

  it('a preset note, no preset, an invalid preset', async () => {
    const r = await rig({folders: {'A5 print': '/out/a5'}});
    await exportNoteAt(r.deps, A5);
    const empty = await rig({presets: {}});
    await exportNoteAt(empty.deps, NOTE);
    const broken = await rig({
      presets: {[A5]: '---\nschemaVersion: 1\npage:\n\tbleed: 3\n---\nbody'},
    });
    await exportNoteAt(broken.deps, NOTE);
    const all = [...r.notices, ...empty.notices, ...broken.notices];
    expect(all).toHaveLength(3);
    for (const text of all) expect(text).toMatch(/\.$/);
    expect(r.notices).toEqual(['Presets are not exported.']);
  });
});

describe('US-042 AC-2: the entries', () => {
  const MENUS = '../../src/plugin/menus';
  interface Entry {
    title?: string;
    icon?: string;
    run?: () => unknown;
  }
  const calls: string[] = [];
  const actions = {
    exportNote: async (path?: string) =>
      void calls.push(`export ${path ?? '-'}`),
    exportWithDialog: async (path?: string) =>
      void calls.push(`dialog ${path ?? '-'}`),
    previewNote: async () => undefined,
    usePreset: async () => undefined,
    changePreset: async () => undefined,
  };

  it('the ribbon menu starts with Export…, then the entries of today', async () => {
    const {ribbonMenuEntries} = (await import(MENUS)) as {
      ribbonMenuEntries(a: unknown, p: unknown): Entry[];
    };
    const entries = ribbonMenuEntries(actions, {
      names: [{name: 'A5 print', valid: true}],
      stored: 'A5 print',
    });
    expect(entries.slice(0, 3).map(({title, icon}) => ({title, icon}))).toEqual(
      [
        {title: 'Export…', icon: 'file-output'},
        {title: 'Export current note', icon: 'file-output'},
        {title: 'Open style panel', icon: 'panel-right'},
      ],
    );
    calls.length = 0;
    await entries[0]?.run?.();
    expect(calls).toEqual(['dialog -']);
  });

  it('the note menus keep their two items (P2)', async () => {
    const {noteMenuEntries} = (await import(MENUS)) as {
      noteMenuEntries(a: unknown, f: unknown, folder: string): Entry[];
    };
    const entries = noteMenuEntries(
      actions,
      {path: NOTE, folder: false},
      FOLDER,
    );
    expect(entries.map((e) => e.title)).toEqual(['Export to PDF', 'Preview']);
    calls.length = 0;
    await entries[0]?.run?.();
    expect(calls).toEqual([`export ${NOTE}`]);
  });

  // Added at T3 (#177; SCAR-023): the action itself asks, also with a
  // remembered folder (not only through an error path).
  it('the action Export… opens the dialog with a remembered folder; Export current note does not', async () => {
    const {createActions} = await import('../../src/plugin/actions');
    const r = await rig({folders: {'A5 print': '/out/a5'}});
    const made = createActions(r.deps as never);
    await made.exportNote(NOTE);
    expect(r.asked).toEqual([]);
    await made.exportWithDialog(NOTE);
    expect(r.asked).toEqual([{noteName: 'Rules', preset: 'A5 print'}]);
  });

  it('the command Export… is registered and calls the action', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    const block = /addCommand\(\{\s*id: 'export-dialog',[\s\S]*?\}\);/.exec(
      main,
    )?.[0];
    expect(block).toBeDefined();
    // Amended at T6 (AC-14): the name is in the string table.
    expect(block).toContain('name: STRINGS.commands.exportDialog');
    expect(STRINGS.commands.exportDialog).toBe('Export…');
    expect(block).toContain('this.actions.exportWithDialog()');
  });

  it('the action Export… hands the note to exportNoteWithDialog; an error is a ❌ notice', async () => {
    const {createActions} = await import('../../src/plugin/actions');
    const notices: string[] = [];
    const spy = vi.fn();
    const actionsMade = createActions({
      notes: {
        activePath: () => {
          spy();
          throw new Error('boom');
        },
      },
      notice: (t: string) => void notices.push(t),
    } as never);
    await actionsMade.exportWithDialog();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(notices).toEqual(['❌ Export failed: boom']);
    await actionsMade.exportNote();
    expect(notices).toEqual([
      '❌ Export failed: boom',
      '❌ Export failed: boom',
    ]);
  });
});
