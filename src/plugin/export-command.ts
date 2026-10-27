// US-008 AC-15, US-007 AC-1: the command "Export current note": which preset,
// which settings, which folder, and what the export run gets. Everything the
// command needs from Obsidian is injected, so it runs without Obsidian.
import type {AssetUse} from '../core/assets';
import type {Warning} from '../core/emit';
import type {FontSet} from './fonts';
import {convertNote, noteNameOf, selectPreset} from './prepare-note';
import type {PresetStore} from './presets/store';
import type {ExportResult} from './run-export';
import type {PluginData} from './settings/data';
import type {ExportSource, WarningSettings} from './warning-flow';

/** What the export run is given (US-007 `RunExportOptions` without the host). */
export interface ExportRequest {
  noteName: string;
  source: ExportSource;
  typ: string;
  warnings: readonly Warning[];
  uses: readonly AssetUse[];
  readAsset: (vaultPath: string) => Promise<Uint8Array>;
  /** US-010 AC-3: the vault fonts for the compiler (not the bundled ones). */
  fonts: readonly Uint8Array[];
  /** The text of the template to copy; null when none applies. */
  template: string | null;
  exportDir: string;
  settings: WarningSettings;
}

/** How the command ended when no export was run. */
export type CommandStatus =
  'no-note' | 'presets-note' | 'no-preset' | 'invalid-preset' | 'cancelled';

export interface ExportCommandDeps {
  notes: {
    /** The vault path of the open note, or null. */
    activePath(): string | null;
    read(path: string): Promise<string>;
  };
  vault: {
    /** Every file of the vault by path. */
    files(): string[];
    /** The first `length` bytes (default 16) of a file (US-015 `AssetIndex.readHead`). */
    readHead(path: string, length?: number): Promise<Uint8Array>;
    readBytes(path: string): Promise<Uint8Array>;
    /** The text of a file, or null when it does not exist. */
    readText(path: string): Promise<string | null>;
  };
  presets: PresetStore;
  /** US-010: the fonts of the vault folder; without it names are taken as written. */
  fonts?: FontSet;
  settings: {
    readonly data: PluginData;
    setLastExportFolder(preset: string, folder: string): Promise<void>;
  };
  /** Asks for the export folder; null when cancelled. */
  chooseFolder(initial: string | null): Promise<string | null>;
  run(request: ExportRequest): Promise<ExportResult>;
  notice(text: string): void;
}

/**
 * US-008 AC-15: the command "Export current note": the export of the open
 * note ({@link exportNoteAt} with the active path).
 */
export function exportCurrentNote(
  deps: ExportCommandDeps,
): Promise<{status: CommandStatus} | ExportResult> {
  return exportNoteAt(deps, deps.notes.activePath());
}

/**
 * US-008 AC-15 | US-020 AC-2: The export of the note at `path` (null: no note).
 *
 * Takes the active preset, asks for the folder (remembered per preset),
 * converts that note and hands the result to the export run. Refuses, with a
 * notice, when there is no note, when the note is a preset, when there is no
 * preset, or when the active preset is invalid. The note need not be the
 * active one (a context menu passes the clicked note).
 */
export async function exportNoteAt(
  deps: ExportCommandDeps,
  path: string | null,
): Promise<{status: CommandStatus} | ExportResult> {
  const {notice} = deps;
  if (path === null) {
    notice('Open a note to export it');
    return {status: 'no-note'};
  }
  const data = deps.settings.data;
  const selected = selectPreset(deps, path);
  if (!selected.ok) {
    notice(selected.message);
    return {status: selected.status};
  }
  const {active} = selected;

  const folder = await deps.chooseFolder(
    data.lastExportFolders[active] ?? null,
  );
  if (folder === null) return {status: 'cancelled'};
  await deps.settings.setLastExportFolder(active, folder);

  const prepared = await convertNote(deps, path, active, selected.preset);
  if (!prepared.ok) {
    notice(prepared.message);
    return {status: prepared.status};
  }

  return deps.run({
    noteName: noteNameOf(path),
    source: {path, inVault: true},
    typ: prepared.typ,
    warnings: prepared.warnings,
    uses: prepared.uses,
    readAsset: deps.vault.readBytes,
    fonts: prepared.fonts,
    template: prepared.template,
    exportDir: folder,
    settings: {
      strictMode: data.strictMode,
      warningsNoteFolder: data.warningsNoteFolder,
    },
  });
}
