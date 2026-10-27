// US-008 — the parts that only Obsidian can run are checked here as far as text
// can show (the rest is the manual checks M2 and M3 in
// docs/technical/manual-checks.md). Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {settingsSource} from '../support/settings-source';

const main = readFileSync('src/plugin/main.ts', 'utf8');
const port = readFileSync('src/plugin/obsidian/vault-port.ts', 'utf8');
const tab = settingsSource();
const dialog = readFileSync('src/plugin/settings/dialog.ts', 'utf8');
const manual = readFileSync('docs/technical/manual-checks.md', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('US-008 AC-15 wiring in src/plugin/main.ts', () => {
  it('US-007 AC-1: registers the command Export current note with the id export-current-note', () => {
    expect(main).toMatch(/addCommand\(\{[^}]*id: 'export-current-note'/s);
    expect(main).toContain("name: 'Export current note'");
  });

  it('US-008 AC-8: loads and saves plugin data and adds the settings tab', () => {
    expect(main).toContain('loadData(');
    expect(main).toContain('saveData(');
    expect(main).toContain('addSettingTab(');
    expect(main).toContain('RESET_NOTICE');
  });

  it('US-008 AC-3: starts the preset store at layout ready and disposes it on unload', () => {
    expect(main).toContain('onLayoutReady(');
    expect(main).toMatch(/onunload\(\)[^{]*\{[^}]*presets\.dispose\(\)/s);
  });
});

describe('US-008 AC-3 and AC-7 the vault port', () => {
  it('US-008 AC-7: renames and deletes through the file manager, so that links and the trash setting are respected', () => {
    expect(port).toContain('fileManager.renameFile(');
    expect(port).toContain('fileManager.trashFile(');
  });

  it('US-008 AC-7: never modifies or permanently deletes a vault file', () => {
    // US-022 AC-7 (2026-10-22): the one exception is the atomic write of a
    // preset field, `process`, called only by the `changePreset` action
    // after the question (text check in the US-022 tests); export and
    // preview never reach it.
    expect(port).not.toMatch(/vault\.(modify|delete|append)\(/);
    expect(port.match(/vault\.process\(/g) ?? []).toHaveLength(1);
    expect(port).not.toMatch(/adapter\.(write|remove|rmdir)\(/);
    expect(main).not.toMatch(/vault\.(modify|delete|process|append)\(/);
  });

  it('US-008 AC-3: listens to create, modify, delete and rename events', () => {
    for (const event of ['create', 'modify', 'delete', 'rename']) {
      expect(port, event).toContain(`'${event}'`);
    }
  });
});

describe('US-008 AC-1 the settings tab', () => {
  it('US-008 AC-1: has sections for the Defaults, the presets, the presets folder, strict mode and the warnings folder', () => {
    for (const text of [
      'Defaults',
      'Presets',
      'Presets folder',
      'Strict mode',
      'Warnings note folder',
    ]) {
      expect(tab, text).toContain(`'${text}'`);
    }
  });

  it('US-008 AC-5: offers create, duplicate, rename and delete of a preset, and shows the error of an invalid one', () => {
    for (const text of ['New preset', 'Duplicate', 'Rename', 'Delete']) {
      expect(tab, text).toContain(`'${text}'`);
    }
    expect(tab).toContain('formatPresetError');
  });

  it('US-008 AC-1: changes the Defaults only through setDefaults, so a refused value keeps the previous one', () => {
    expect(tab).toContain('setDefaults(');
  });
});

describe('US-008 AC-17 the dialogs use the tested rules', () => {
  it('US-008 AC-17: the name dialog confirms with Enter through isConfirmKey and focuses the field', () => {
    expect(tab).toContain('isConfirmKey(');
    expect(tab).toContain("'keydown'");
    expect(tab).toMatch(/\.focus\(\)/);
  });

  it('US-008 AC-17: Delete goes through deletePreset and the tab never calls presets.remove itself', () => {
    expect(tab).toContain('deletePreset(');
    expect(tab).not.toMatch(/\.remove\(/);
    expect(dialog).toMatch(/store\.remove\(/);
  });

  it('US-008 AC-17: the confirmation focuses Cancel, not Delete', () => {
    expect(tab).toMatch(/cancel[A-Za-z.]*\.focus\(\)/i);
    expect(tab).not.toMatch(/delete[A-Za-z]*Button\.focus\(\)/i);
  });

  it('US-008 AC-17: dialog.ts does not import Obsidian, so the rules run in the tests', () => {
    expect(dialog).not.toMatch(/from 'obsidian'/);
  });
});

describe('US-008 manual procedures and dependencies', () => {
  it('US-008 AC-16: M2 names the preset folder, a live edit, an invalid preset and a rename on another device', () => {
    expect(manual).toContain('## M2');
    expect(manual).toContain('Obsidian2Typst/presets');
    expect(manual).toMatch(/invalid/i);
    expect(manual).toMatch(/sync/i);
  });

  it('US-008 AC-16: M3 runs Export current note on a real note with a template and checks the files in the folder', () => {
    expect(manual).toContain('## M3');
    expect(manual).toContain('Obsidian2Typst: Export current note');
    expect(manual).toContain('template.typ');
    expect(manual).toContain('export-warnings.md');
  });

  it('US-008 AC-17: M2 has steps for the keyboard, Cancel and Escape', () => {
    expect(manual).toMatch(/keyboard/i);
    expect(manual).toMatch(/Escape/);
    expect(manual).toContain('Cancel');
  });

  it('US-008 AC-4: package.json pins yaml to an exact version', () => {
    expect(pkg.dependencies?.['yaml']).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
