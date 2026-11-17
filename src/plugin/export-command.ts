// US-008 AC-15, US-007 AC-1: the command "Export current note": which preset,
// which settings, which folder, and what the export run gets. Everything the
// command needs from Obsidian is injected, so it runs without Obsidian.
import type {AssetUse} from '../core/assets';
import type {ImageFact, Warning} from '../core/emit';
import type {FontSet} from './fonts';
import {convertNote, noteNameOf, selectPreset} from './prepare-note';
import type {PresetStore} from './presets/store';
import type {ExportResult, FallbackNote} from './run-export';
import type {PluginData} from './settings/data';
import type {ExportSource, WarningSettings} from './warning-flow';
import {endOf, type ExportProgress} from '../core/export-progress';
import {saveExportChoices} from './export-dialog/rules';
import {STRINGS} from './strings';

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
  /** US-028 AC-16: the same note text converted at `images.minScale: 100`. */
  fallback?: () => Promise<FallbackNote | null>;
  /** US-032 AC-9: `entries.emptyWarn` of the preset. */
  entryEmptyWarn?: number;
  /** US-034 AC-1: `images.minDpi` of the preset. */
  minDpi?: number;
  /** US-034 AC-2: the block images whose drawn width the conversion fixes. */
  fixedImages?: readonly ImageFact[];
  /** US-034 AC-5, AC-8: `entries.maxWordGap` of the preset. */
  maxWordGap?: number;
  /** US-036 AC-5: the A4 encounter sheet's source, when it is on. */
  sheetTyp?: string | null;
  /** US-037 AC-4: the effective `page.facingPages` of the preset. */
  facingPages?: boolean;
  /** US-042 AC-7: the export's progress, started by the command. */
  progress?: ExportProgress;
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
    update(patch: {activePreset: string}): Promise<void>;
  };
  /** US-042 AC-3: the export dialog; null when closed without Export. */
  exportDialog(request: {
    noteName: string;
    preset: string;
  }): Promise<{preset: string; folder: string} | null>;
  /** US-042 AC-7: starts the progress of an export (optional). */
  startProgress?(noteName: string): ExportProgress;
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

/** US-042 AC-11: a refusal reads as a sentence (a full stop at its end). */
const sentence = (text: string): string =>
  /[.!?]$/.test(text) ? text : `${text}.`;

/**
 * US-008 AC-15 | US-020 AC-2 | US-042 AC-1: The export of the note at `path`
 * (null: no note): at once into the active preset's remembered folder, through
 * the dialog when it has none.
 */
export function exportNoteAt(
  deps: ExportCommandDeps,
  path: string | null,
): Promise<{status: CommandStatus} | ExportResult> {
  return exportWith(deps, path, false);
}

/** US-042 | AC-2: The export of the note at `path`, always through the dialog. */
export function exportNoteWithDialog(
  deps: ExportCommandDeps,
  path: string | null,
): Promise<{status: CommandStatus} | ExportResult> {
  return exportWith(deps, path, true);
}

/**
 * US-008 AC-15 | US-042 AC-1, AC-2, AC-6, AC-7: Takes the active preset, the
 * folder (remembered, or from the dialog, whose choice is saved before the
 * conversion: P1), converts the note and hands it to the run with a progress
 * that the command ends with the run's end. Refuses, with a notice ending in a
 * full stop, when there is no note, the note is a preset, there is no preset or
 * the active preset is invalid. A dialog closed without Export ends quietly.
 */
async function exportWith(
  deps: ExportCommandDeps,
  path: string | null,
  ask: boolean,
): Promise<{status: CommandStatus} | ExportResult> {
  const {notice} = deps;
  if (path === null) {
    notice(STRINGS.notices.openNote);
    return {status: 'no-note'};
  }
  let selected = selectPreset(deps, path);
  if (!selected.ok) {
    notice(sentence(selected.message));
    return {status: selected.status};
  }
  const noteName = noteNameOf(path);
  const remembered = deps.settings.data.lastExportFolders[selected.active];
  let folder: string;
  if (!ask && remembered !== undefined && remembered !== '') {
    folder = remembered;
  } else {
    const choice = await deps.exportDialog({
      noteName,
      preset: selected.active,
    });
    if (choice === null) return {status: 'cancelled'};
    await saveExportChoices(deps.settings, choice);
    folder = choice.folder;
    selected = selectPreset(deps, path);
    if (!selected.ok) {
      notice(sentence(selected.message));
      return {status: selected.status};
    }
  }
  const {active} = selected;
  const progress = deps.startProgress?.(noteName);
  progress?.step({kind: 'convert'});
  let ended = false;
  try {
    const prepared = await convertNote(deps, path, active, selected.preset);
    if (!prepared.ok) {
      notice(sentence(prepared.message));
      return {status: prepared.status};
    }
    const result = await runPrepared(deps, {
      path,
      selected,
      prepared,
      folder,
      progress,
    });
    progress?.end(endOf(result.status));
    ended = true;
    return result;
  } finally {
    if (!ended) progress?.end('failed');
  }
}

/**
 * US-007 AC-1 | US-042 AC-7: Hands a converted note to the run, with the
 * folder, the settings of now and the progress (when there is one).
 */
function runPrepared(
  deps: ExportCommandDeps,
  job: {
    path: string;
    selected: Extract<ReturnType<typeof selectPreset>, {ok: true}>;
    prepared: Extract<Awaited<ReturnType<typeof convertNote>>, {ok: true}>;
    folder: string;
    progress: ExportProgress | undefined;
  },
): Promise<ExportResult> {
  const {path, selected, prepared, folder, progress} = job;
  const {active} = selected;
  const data = deps.settings.data;
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
    // US-032 AC-9: the threshold of ENTRY_SPREAD_EMPTY.
    entryEmptyWarn: prepared.emptyWarn,
    // US-034 AC-1, AC-2: the print resolution check.
    minDpi: prepared.minDpi,
    fixedImages: prepared.fixedImages,
    // US-034 AC-8: the word-gap scan runs on export only.
    maxWordGap: prepared.maxWordGap,
    // US-036 AC-5: the A4 encounter sheet, a second compile.
    sheetTyp: prepared.sheetTyp,
    // US-037 AC-4: facing pages decide whether the PDF opens as spreads.
    facingPages: prepared.facingPages,
    // US-042 AC-7: the progress goes with the run.
    ...(progress === undefined ? {} : {progress}),
    // US-028 AC-16: the text read above, converted again without image fit.
    fallback: async () => {
      const at100 = await convertNote(deps, path, active, selected.preset, {
        source: prepared.source,
        imagesOff: true,
      });
      return at100.ok ? {typ: at100.typ, images: at100.fixedImages} : null;
    },
  });
}
