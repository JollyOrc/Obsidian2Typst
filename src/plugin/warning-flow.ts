// US-006: what the plugin does with the warnings of an export: strict-mode
// check, report file, vault note, notice, and the protocol handler's logic.
// The host (notices, file writes) is injected; nothing here imports Obsidian.
import type {Warning} from '../core/emit';
import {
  buildReport,
  reportNotice,
  strictNotice,
  warningsNotePath,
} from '../core/report';

/** The settings of US-006 (the screen that edits them is US-008). */
export interface WarningSettings {
  /** US-006 AC-4: any warning aborts the export. Off by default. */
  strictMode: boolean;
  /** US-006 AC-2b: vault folder of the warnings note; empty = vault root. */
  warningsNoteFolder: string;
}

export const DEFAULT_WARNING_SETTINGS: WarningSettings = {
  strictMode: false,
  warningsNoteFolder: '',
};

/** What `finishExport` needs from the plugin. */
export interface ExportHost {
  notice(text: string): void;
  /** Writes a file below the export folder (creates folders as needed). */
  writeExportFile(path: string, text: string): Promise<void>;
  /** Writes a note into the vault (creates folders as needed). */
  writeVaultFile(path: string, text: string): Promise<void>;
}

/** The note that is exported. */
export interface ExportSource {
  path: string;
  /** True when `path` is a vault path (the report can link to its lines). */
  inVault: boolean;
}

export interface FinishExportOptions {
  warnings: readonly Warning[];
  source: ExportSource;
  exportDir: string;
  settings: WarningSettings;
  host: ExportHost;
  /**
   * Writes the `.typ`, the assets and the PDF; not called on a strict abort.
   * Returns `{failed: true}` when the export did not succeed (US-007 AC-4):
   * the report files are still written, the success notice is not shown.
   * US-028 AC-5: may return `{warnings}` found by the compile (the image fit
   * warnings); they join the report and the notice, never the strict check.
   */
  writeOutput: () => Promise<
    void | {failed: true} | {warnings: readonly Warning[]}
  >;
}

/**
 * US-006 AC-2, AC-2b, AC-3, AC-4, AC-7, AC-9: in strict mode a warning aborts
 * before anything is written; otherwise the output, the report file, the vault
 * note and the notice follow, in this order.
 */
export async function finishExport(
  options: FinishExportOptions,
): Promise<{aborted: boolean; failed?: true}> {
  const {warnings, source, host, settings} = options;
  const notePath = warningsNotePath(source.path, settings.warningsNoteFolder);
  if (settings.strictMode && warnings.length > 0) {
    host.notice(strictNotice(warnings));
    return {aborted: true};
  }
  const output = await options.writeOutput();
  // US-028 AC-5 (decision 8): the compile's warnings after the strict check,
  // merged by line (stable: the conversion's first on a tie).
  const all =
    output !== undefined && 'warnings' in output
      ? [...warnings, ...output.warnings].sort((a, b) => a.line - b.line)
      : warnings;
  const reportPath = `${options.exportDir.replace(/\/+$/, '')}/export-warnings.md`;
  await host.writeExportFile(reportPath, buildReport(all));
  await host.writeVaultFile(
    notePath,
    buildReport(all, {linkFile: source.inVault ? source.path : null}),
  );
  if (output !== undefined && 'failed' in output)
    return {aborted: false, failed: true};
  const notice = reportNotice(all.length, reportPath);
  if (notice !== null) host.notice(notice);
  return {aborted: false};
}

/** US-006 AC-2b: where a click on a report line goes. */
export interface GotoTarget {
  file: string;
  line: number;
}

/** The parameters of `obsidian://obsidian2typst-goto`. */
export type GotoParams = Readonly<Record<string, string | undefined>>;

/** US-006 AC-2b: file and line of a link; null without a file; line 1 if invalid. */
export function gotoTarget(params: GotoParams): GotoTarget | null {
  const file = params['file'];
  if (file === undefined || file === '') return null;
  const line = params['line'];
  return {
    file,
    line: line !== undefined && /^[1-9]\d*$/.test(line) ? Number(line) : 1,
  };
}

/** US-006 AC-2b: the body of the protocol handler; `openAt` opens the note. */
export function handleGoto(
  params: GotoParams,
  openAt: (file: string, line: number) => void,
): void {
  const target = gotoTarget(params);
  if (target !== null) openAt(target.file, target.line);
}
