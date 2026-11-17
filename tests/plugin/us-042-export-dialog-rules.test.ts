// US-042 AC-3 to AC-6 — the export dialog's rules, without Obsidian: the title,
// the folder check, the destination line, the presets offered, the folder of a
// preset, the keys and what is saved when Export runs. Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {posix, win32} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  checkExportFolder,
  destinationLine,
  dialogTitle,
  exportDialogKey,
  folderOf,
  presetChoices,
  saveExportChoices,
} from '../../src/plugin/export-dialog/rules';

describe('US-042 AC-3: the title', () => {
  it('names the note', () => {
    expect(dialogTitle('Book')).toBe('Export Book');
    expect(dialogTitle('Fen Hare notes')).toBe('Export Fen Hare notes');
  });
});

describe('US-042 AC-4: the folder is checked before anything is written', () => {
  it('accepts an absolute path of the system', () => {
    expect(checkExportFolder('/out/a5', posix)).toEqual({
      ok: true,
      folder: '/out/a5',
    });
    expect(checkExportFolder('C:\\out\\a5', win32)).toEqual({
      ok: true,
      folder: 'C:\\out\\a5',
    });
  });

  it('trims surrounding spaces and trailing separators, keeps a root', () => {
    expect(checkExportFolder('  /out/a5/  ', posix)).toEqual({
      ok: true,
      folder: '/out/a5',
    });
    expect(checkExportFolder('/out/a5//', posix)).toEqual({
      ok: true,
      folder: '/out/a5',
    });
    expect(checkExportFolder('/', posix)).toEqual({ok: true, folder: '/'});
    expect(checkExportFolder('C:\\out\\', win32)).toEqual({
      ok: true,
      folder: 'C:\\out',
    });
    expect(checkExportFolder('C:\\', win32)).toEqual({
      ok: true,
      folder: 'C:\\',
    });
  });

  it('refuses an empty folder', () => {
    for (const text of ['', '   ']) {
      expect(checkExportFolder(text, posix)).toEqual({
        ok: false,
        message: 'Choose an export folder.',
      });
    }
  });

  it('refuses a relative folder, naming it as typed', () => {
    expect(checkExportFolder('out/a5', posix)).toEqual({
      ok: false,
      message: 'Export folder "out/a5" is not an absolute path.',
    });
    expect(checkExportFolder('out\\a5', win32)).toEqual({
      ok: false,
      message: 'Export folder "out\\a5" is not an absolute path.',
    });
    // A POSIX path is not absolute on Windows, and the reverse: the system's rule.
    expect(checkExportFolder('C:\\out', posix).ok).toBe(false);
  });
});

describe('US-042 AC-5: what is at the destination', () => {
  it('a PDF that does not exist yet', () => {
    expect(destinationLine('Book.pdf', null)).toBe('Book.pdf will be written.');
  });

  it('an existing PDF, with its local modification time', () => {
    const modified = new Date(2026, 10, 17, 14, 2, 59);
    expect(destinationLine('Book.pdf', modified)).toBe(
      'Book.pdf exists (from 2026-11-17 14:02) and will be replaced.',
    );
  });

  it('pads month, day, hour and minute', () => {
    expect(destinationLine('Fen Hare.pdf', new Date(2027, 0, 5, 7, 9))).toBe(
      'Fen Hare.pdf exists (from 2027-01-05 07:09) and will be replaced.',
    );
  });
});

describe('US-042 AC-3: the presets offered', () => {
  it('valid presets only, in their order, one group without a heading', () => {
    expect(
      presetChoices([
        {name: 'A5 print', valid: true, group: null},
        {name: 'Broken', valid: false, group: null},
        {name: 'Proof', valid: true, group: null},
      ]),
    ).toEqual([{heading: null, names: ['A5 print', 'Proof']}]);
  });

  it('grouped as the ribbon menu groups them; a group without a valid preset is left out', () => {
    const groups = presetChoices([
      {name: 'A5 print', valid: true, group: 'Print'},
      {name: 'A4 digital', valid: true, group: 'Screen'},
      {name: 'Broken', valid: false, group: 'Drafts'},
      {name: 'Proof', valid: true, group: 'Print'},
    ]);
    expect(groups).toEqual([
      {heading: 'Print', names: ['A5 print', 'Proof']},
      {heading: 'Screen', names: ['A4 digital']},
    ]);
  });

  it('groups in alphabetical order, ungrouped presets last under "Other"', () => {
    expect(
      presetChoices([
        {name: 'Loose', valid: true, group: null},
        {name: 'Proof', valid: true, group: 'Screen'},
        {name: 'A5 print', valid: true, group: 'Print'},
      ]),
    ).toEqual([
      {heading: 'Print', names: ['A5 print']},
      {heading: 'Screen', names: ['Proof']},
      {heading: 'Other', names: ['Loose']},
    ]);
  });

  it('no valid preset: no choice', () => {
    expect(
      presetChoices([{name: 'Broken', valid: false, group: null}]),
    ).toEqual([]);
  });
});

describe('US-042 AC-3: the folder of a preset', () => {
  const folders = {'A5 print': '/out/a5', Proof: '/out/proof'};
  it('the remembered folder, or empty', () => {
    expect(folderOf(folders, 'A5 print')).toBe('/out/a5');
    expect(folderOf(folders, 'Proof')).toBe('/out/proof');
    expect(folderOf(folders, 'A4 digital')).toBe('');
  });
  it('does not read inherited keys', () => {
    expect(folderOf(folders, 'toString')).toBe('');
  });
});

describe('US-042 AC-6: the keys (SCAR-013)', () => {
  const key = (
    k: string,
    more: Partial<{isComposing: boolean; keyCode: number}> = {},
  ) => ({
    key: k,
    isComposing: false,
    keyCode: k === 'Enter' ? 13 : 27,
    ...more,
  });
  it('Enter runs only while Export is enabled', () => {
    expect(exportDialogKey(key('Enter'), true)).toBe('run');
    expect(exportDialogKey(key('Enter'), false)).toBe('none');
  });
  it('Escape cancels, enabled or not', () => {
    expect(exportDialogKey(key('Escape'), true)).toBe('cancel');
    expect(exportDialogKey(key('Escape'), false)).toBe('cancel');
  });
  it('Enter while an input method composes does nothing', () => {
    expect(exportDialogKey(key('Enter', {isComposing: true}), true)).toBe(
      'none',
    );
    expect(exportDialogKey(key('Enter', {keyCode: 229}), true)).toBe('none');
  });
  it('other keys do nothing', () => {
    expect(exportDialogKey(key('a'), true)).toBe('none');
    expect(exportDialogKey(key('Tab'), true)).toBe('none');
  });
});

describe('US-042 AC-6: what is saved when Export runs (P1)', () => {
  function store(active: string) {
    const calls: string[] = [];
    const data = {
      activePreset: active,
      lastExportFolders: {} as Record<string, string>,
    };
    return {
      calls,
      data,
      settings: {
        get data() {
          return data;
        },
        setLastExportFolder: async (preset: string, folder: string) => {
          calls.push(`folder ${preset} ${folder}`);
          data.lastExportFolders[preset] = folder;
        },
        update: async (patch: {activePreset: string}) => {
          calls.push(`active ${patch.activePreset}`);
          data.activePreset = patch.activePreset;
        },
      },
    };
  }

  it("the folder as that preset's, then the preset as the active one", async () => {
    const s = store('A5 print');
    await saveExportChoices(s.settings, {
      preset: 'Proof',
      folder: '/out/proof',
    });
    expect(s.calls).toEqual(['folder Proof /out/proof', 'active Proof']);
    expect(s.data.activePreset).toBe('Proof');
  });

  it('the active preset again: only the folder is saved', async () => {
    const s = store('A5 print');
    await saveExportChoices(s.settings, {
      preset: 'A5 print',
      folder: '/out/a5',
    });
    expect(s.calls).toEqual(['folder A5 print /out/a5']);
  });

  it('reads the active preset when it saves, not before (SCAR-016)', async () => {
    const s = store('A5 print');
    s.data.activePreset = 'Proof';
    await saveExportChoices(s.settings, {
      preset: 'Proof',
      folder: '/out/proof',
    });
    expect(s.calls).toEqual(['folder Proof /out/proof']);
  });
});
