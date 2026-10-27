// US-007 AC-1, AC-1b, AC-3, AC-4: one export run: write the .typ, the assets
// and the template, compile, write the PDF, then the warnings report. The host,
// the compiler and the file reader are injected; nothing here imports Obsidian.
import {exportNames, type CompileRequest} from '../core/compile';
import type {AssetUse} from '../core/assets';
import type {Warning} from '../core/emit';
import type {TypstCompiler} from './compiler';
import {copyAssets} from './copy-assets';
import {
  finishExport,
  type ExportHost,
  type ExportSource,
  type WarningSettings,
} from './warning-flow';

/** What a run needs from the plugin: the host of US-006 plus byte output. */
export interface RunExportHost extends ExportHost {
  /** Writes a binary file below the export folder (creates folders). */
  writeExportBytes(path: string, data: Uint8Array): Promise<void>;
}

/** Allows one export at a time (US-007 AC-3). */
export interface ExportLock {
  /** A release function, or null while another export holds the lock. */
  tryAcquire(): (() => void) | null;
}

/** US-007 AC-3: a lock; a release frees only the hold it belongs to. */
export function createExportLock(): ExportLock {
  let holder: object | null = null;
  return {
    tryAcquire() {
      if (holder !== null) return null;
      const mine = {};
      holder = mine;
      return () => {
        if (holder === mine) holder = null;
      };
    },
  };
}

export interface RunExportOptions {
  /** The note's file name without extension. */
  noteName: string;
  source: ExportSource;
  typ: string;
  warnings: readonly Warning[];
  /** The assets to copy (US-003). */
  uses: readonly AssetUse[];
  /** Reads an asset from the vault. */
  readAsset: (vaultPath: string) => Promise<Uint8Array>;
  /** The text of the template copy, if one is configured (US-008). */
  template: string | null;
  /** Absolute path of the export folder. */
  exportDir: string;
  settings: WarningSettings;
  host: RunExportHost;
  compiler: TypstCompiler;
  fonts: readonly Uint8Array[];
  lock: ExportLock;
}

/** How a run ended. */
export interface ExportResult {
  status: 'exported' | 'aborted' | 'busy' | 'compile-error' | 'compiler-failed';
}

/**
 * US-007 AC-1 to AC-4: runs an export. The lock is released however the run
 * ends; an error of the host or the compiler reaches the caller.
 */
export async function runExport(
  options: RunExportOptions,
): Promise<ExportResult> {
  const {host} = options;
  const release = options.lock.tryAcquire();
  if (release === null) {
    host.notice('An export is already running');
    return {status: 'busy'};
  }
  try {
    const names = exportNames(options.noteName);
    const dir = options.exportDir.replace(/\/+$/, '');
    let status: ExportResult['status'] = 'exported';

    const writeOutput = async (): Promise<void | {failed: true}> => {
      await host.writeExportFile(`${dir}/${names.typ}`, options.typ);
      const files: Record<string, Uint8Array> = {};
      await copyAssets(
        options.uses,
        {
          read: options.readAsset,
          write: async (path, data) => {
            await host.writeExportBytes(path, data);
            files[path.slice(dir.length + 1)] = data;
          },
        },
        dir,
      );
      if (options.template !== null) {
        await host.writeExportFile(
          `${dir}/${names.template}`,
          options.template,
        );
        files[names.template] = new TextEncoder().encode(options.template);
      }
      host.notice('Compiling…');
      const request: CompileRequest = {
        file: names.typ,
        source: options.typ,
        files,
        fonts: options.fonts,
      };
      const result = await options.compiler.compile(request);
      if (!result.ok) {
        status = result.kind === 'typst' ? 'compile-error' : 'compiler-failed';
        host.notice(result.error);
        return {failed: true};
      }
      await host.writeExportBytes(`${dir}/${names.pdf}`, result.pdf);
    };

    const flow = await finishExport({
      warnings: options.warnings,
      source: options.source,
      exportDir: options.exportDir,
      settings: options.settings,
      host,
      writeOutput,
    });
    return {status: flow.aborted ? 'aborted' : status};
  } finally {
    release();
  }
}
