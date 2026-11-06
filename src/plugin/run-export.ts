// US-007 AC-1, AC-1b, AC-3, AC-4: one export run: write the .typ, the assets
// and the template, compile, write the PDF, then the warnings report. The host,
// the compiler and the file reader are injected; nothing here imports Obsidian.
import {
  FIT_COMPILE_LIMIT,
  IMAGE_FIT_OFF_WARNING,
  LAYOUT_NOT_SETTLED_WARNING,
  compilingNotice,
  exportNames,
  nextFitCompile,
  withFitHints,
  type CompileResult,
  type FitStep,
} from '../core/compile';
import type {AssetUse} from '../core/assets';
import {FIT_HINT_LINES, fitDecisionWarnings, type Warning} from '../core/emit';
import {
  entryLayoutWarnings,
  type EntryEndFact,
  type EntryPlaceFact,
} from '../core/entries/report';
import {ENTRY_BUILTINS} from '../core/markers';
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
  /**
   * US-028 AC-16: the same note converted with `images.minScale: 100`, for
   * when the image fit does not settle; null when it cannot be converted.
   * Without it the last compile is kept.
   */
  fallback?: () => Promise<FallbackNote | null>;
  /** US-028 AC-18: the most compiles before the fallback (tests only). */
  fitCompileLimit?: number;
  /** US-032 AC-9: `entries.emptyWarn` (built-in 50). */
  entryEmptyWarn?: number;
}

/** US-028 AC-16: the note converted again without image fit. */
export interface FallbackNote {
  typ: string;
}

/** How a run ended. */
export interface ExportResult {
  status: 'exported' | 'aborted' | 'busy' | 'compile-error' | 'compiler-failed';
}

/**
 * US-007 AC-1 to AC-4: runs an export. The lock is released however the run
 * ends; an error of the host or the compiler reaches the caller. US-028
 * AC-15, AC-16: the compile is repeated until the layout settles, else the
 * note at 100 (`fallback`) is compiled (`compileSettled`).
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

    const writeOutput = async (): Promise<
      void | {failed: true} | {warnings: Warning[]}
    > => {
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
      // US-028 AC-15, AC-16: compile until the layout settles, else fall
      // back to the note at 100 (`compileSettled`); one compile without the
      // hints lines (the rule is off) as before.
      const done = await compileSettled({
        typ: options.typ,
        compile: (source) =>
          options.compiler.compile({
            file: names.typ,
            source,
            files,
            fonts: options.fonts,
          }),
        notice: (text) => host.notice(text),
        // AC-16: the note at 100 uses the same images as compile 1 (image
        // fit changes no image list; a US-008 test pins it), so nothing more
        // is copied.
        fallback:
          options.fallback === undefined
            ? undefined
            : async () => (await options.fallback?.())?.typ ?? null,
        limit: options.fitCompileLimit ?? FIT_COMPILE_LIMIT,
      });
      const {result} = done;
      if (!result.ok) {
        status = result.kind === 'typst' ? 'compile-error' : 'compiler-failed';
        host.notice(result.error);
        return {failed: true};
      }
      // US-028 AC-17: the .typ of the result, when it is not the one written.
      if (done.source !== options.typ) {
        await host.writeExportFile(`${dir}/${names.typ}`, done.source);
      }
      await host.writeExportBytes(`${dir}/${names.pdf}`, result.pdf);
      // US-028 AC-5: the image fit warnings of the result; AC-16: none after
      // the fallback, which reports IMAGE_FIT_OFF; AC-14: a layout that did
      // not settle.
      const warnings = done.fellBack
        ? [IMAGE_FIT_OFF_WARNING]
        : fitDecisionWarnings(result.fitDecisions ?? []);
      if (result.settled === false) warnings.push(LAYOUT_NOT_SETTLED_WARNING);
      // US-032 AC-10: the entries' layout warnings, from the compile's facts.
      warnings.push(
        ...entryLayoutWarnings(
          (result.entryPlaces ?? []) as EntryPlaceFact[],
          (result.entryEnds ?? []) as EntryEndFact[],
          {emptyWarn: options.entryEmptyWarn ?? ENTRY_BUILTINS.emptyWarn},
        ),
      );
      return {warnings};
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

/** What `compileSettled` needs. */
interface SettleOptions {
  /** The converted text; the hints lines make it loop (AC-15). */
  typ: string;
  compile: (source: string) => Promise<CompileResult>;
  notice: (text: string) => void;
  /** The text at 100, or null; none: keep the last compile. */
  fallback: (() => Promise<string | null>) | undefined;
  limit: number;
}

/** The compile that ends the loop and the text it compiled. */
interface Settled {
  result: CompileResult;
  source: string;
  fellBack: boolean;
}

/**
 * US-028 | AC-15, AC-16: Compiles `typ` until the layout settles. Compile 1
 * is `typ` as converted (seeded, no hints); a text without the hints lines
 * (`FIT_HINT_LINES`, the rule off) is compiled once. After each compile
 * `nextFitCompile` picks the result, the next compile (`withFitHints` on
 * `typ`) or `'stuck'`; at `'stuck'` or after `limit` compiles the fallback's
 * text is compiled once (`fellBack`), or, without one, the last compile is
 * kept. A failed compile ends the loop at once. Each compile is announced
 * by `compilingNotice`; the fallback's as `Compiling…` (a new compile, not
 * a further try). Assumes `limit` ≥ 1.
 */
async function compileSettled(options: SettleOptions): Promise<Settled> {
  const {typ, compile, notice, fallback, limit} = options;
  const looping = typ.includes(FIT_HINT_LINES);
  let step: FitStep = {mode: 'seeded', hints: []};
  let source = typ;
  for (let n = 1; ; n++) {
    notice(compilingNotice(n, limit));
    const result = await compile(source);
    if (!result.ok || !looping) return {result, source, fellBack: false};
    const next = nextFitCompile(step, result.settled, result.fitDecisions);
    if (next === null) return {result, source, fellBack: false};
    if (next === 'stuck' || n >= limit) {
      const at100 = fallback === undefined ? null : await fallback();
      if (at100 === null) return {result, source, fellBack: false};
      notice(compilingNotice(1, limit));
      return {result: await compile(at100), source: at100, fellBack: true};
    }
    step = next;
    source = withFitHints(typ, next.hints, next.mode === 'pinned');
  }
}
