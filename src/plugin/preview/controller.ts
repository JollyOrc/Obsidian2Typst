// US-012 AC-4, AC-5, AC-6, AC-8, AC-9, AC-11: the preview controller. It decides
// which note is shown, when a compile starts, which result is shown, and who has
// priority; it draws nothing and imports nothing from Obsidian. Timers, the
// preparation and the compile are injected.
import type {CompileRequest} from '../../core/compile';
import {fitDecisionWarnings} from '../../core/emit';
import {aspectOf} from '../../core/preview/canvas';
import {
  RANGE_MESSAGE,
  pagesToShow,
  parsePageRange,
  type PageRange,
} from '../../core/preview/range';
import type {StatusState} from '../../core/preview/status';

/** US-012 AC-5: the delay after the last style change. */
export const PREVIEW_DELAY_MS = 500;

/** The outcome of one compile: the pages of the document or an error. */
export type PreviewCompile =
  | {
      ok: true;
      pageCount: number;
      /** The page size in points. */
      pageSize: {width: number; height: number};
      /** What the drawing needs (the renderer document). */
      document: unknown;
      /** Frees the document (US-012 AC-8, memory). */
      release?: () => void;
      /** US-028 AC-5: the image fit decisions of this compile, if any. */
      fitDecisions?: unknown[];
    }
  | {ok: false; error: string};

/** A running compile that can be ended (US-012 AC-8). */
export interface CompileJob {
  result: Promise<PreviewCompile>;
  cancel(): void;
}

/** What the preparation gives: the request and the warning count, or a message. */
export type PreparedPreview =
  | {ok: true; request: CompileRequest; warnings: number}
  | {ok: false; error: string};

export interface PreviewDeps {
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  prepare(notePath: string): Promise<PreparedPreview>;
  compile(request: CompileRequest): CompileJob;
  onState(state: PreviewState): void;
}

/** What the panel shows (see the status line, AC-11). */
export interface PreviewState extends StatusState {
  /** The vault path of the shown note, or null. */
  note: string | null;
  /** True while the shown pages are not the current result (AC-4, AC-11). */
  greyed: boolean;
  pages: {
    count: number;
    document: unknown;
    /** Width over height of a page (AC-5). */
    aspect: number;
    size: {width: number; height: number};
  } | null;
  /** The text of the range field and the pages it shows (AC-6). */
  rangeText: string;
  rangeError: string | null;
  rangeMessage: string | null;
  shown: number[];
}

export interface PreviewController {
  readonly state: PreviewState;
  /** AC-4: the last active Markdown note, or null. */
  setNote(path: string | null): void;
  renamed(oldPath: string, newPath: string): void;
  deleted(path: string): void;
  /** AC-4, AC-5: re-reads the note and compiles at once. */
  refresh(): void;
  /** AC-5: a value the conversion reads changed; compiles after the delay. */
  styleChanged(): void;
  /** AC-6: applies the text of the range field; never compiles. */
  setRange(text: string): void;
  /** AC-9 */
  exportStarted(): void;
  exportFinished(): void;
  /** Ends the compile and the timer and frees the document. */
  dispose(): void;
}

const nameOf = (path: string | null): string | null =>
  path === null
    ? null
    : path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');

/**
 * US-012 AC-4 to AC-11: creates the controller. A result is shown only when no
 * newer request, style change, export or `dispose` happened since its compile
 * began (a counter, AC-8); a result that is not shown is released at once.
 */
export function createPreviewController(deps: PreviewDeps): PreviewController {
  let target: string | null = null;
  let running: CompileJob | null = null;
  let timer: unknown = null;
  let counter = 0;
  let exporting = false;
  let waiting = false;
  let disposed = false;
  let statusBeforeExport: PreviewState['status'] = 'no-note';
  let range: PageRange = {kind: 'all'};
  let release: (() => void) | null = null;
  let state: PreviewState = {
    status: 'no-note',
    note: null,
    noteName: null,
    error: null,
    hint: null,
    warnings: null,
    greyed: false,
    pages: null,
    rangeText: '',
    rangeError: null,
    rangeMessage: null,
    shown: [],
  };

  const emit = (patch: Partial<PreviewState>): void => {
    state = {...state, ...patch};
    if (!disposed) deps.onState(state);
  };

  const applyRange = (): Partial<PreviewState> => {
    if (state.pages === null) return {shown: [], rangeMessage: null};
    const shown = pagesToShow(range, state.pages.count);
    return {shown: shown.pages, rangeMessage: shown.message};
  };

  const freeDocument = (): void => {
    const free = release;
    release = null;
    free?.();
  };

  const clearTimer = (): void => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };

  const endRunning = (): void => {
    const job = running;
    running = null;
    job?.cancel();
  };

  const fail = (message: string): void => {
    emit({
      status: 'error',
      error: message,
      greyed: state.pages !== null,
    });
  };

  const start = async (): Promise<void> => {
    if (target === null || disposed) return;
    const mine = ++counter;
    const path = target;
    endRunning();
    emit({status: 'compiling', error: null, hint: null, greyed: false});
    let prepared: PreparedPreview;
    try {
      prepared = await deps.prepare(path);
    } catch (error) {
      if (mine !== counter) return;
      const text = error instanceof Error ? error.message : String(error);
      fail(`Preview failed: ${text}`);
      return;
    }
    if (mine !== counter) return;
    if (!prepared.ok) {
      fail(prepared.error);
      return;
    }
    const job = deps.compile(prepared.request);
    running = job;
    let result: PreviewCompile;
    try {
      result = await job.result;
    } catch (error) {
      if (running === job) running = null;
      if (mine !== counter) return;
      const text = error instanceof Error ? error.message : String(error);
      fail(`Preview failed: ${text}`);
      return;
    }
    if (running === job) running = null;
    if (mine !== counter) {
      if (result.ok) result.release?.();
      return;
    }
    if (!result.ok) {
      fail(result.error);
      return;
    }
    freeDocument();
    release = result.release ?? null;
    state = {
      ...state,
      pages: {
        count: result.pageCount,
        document: result.document,
        aspect: aspectOf(result.pageSize),
        size: result.pageSize,
      },
    };
    emit({
      status: 'ready',
      error: null,
      hint: null,
      greyed: false,
      // US-028 AC-5 (decision 8): the fit warnings of this run count too.
      warnings:
        prepared.warnings +
        fitDecisionWarnings(result.fitDecisions ?? []).length,
      ...applyRange(),
    });
  };

  const due = (): void => {
    timer = null;
    if (exporting) waiting = true;
    else void start();
  };

  return {
    get state() {
      return state;
    },

    setNote(path) {
      if (path === null) {
        target = null;
        counter++;
        clearTimer();
        endRunning();
        freeDocument();
        state = {...state, pages: null};
        emit({
          status: 'no-note',
          note: null,
          noteName: null,
          error: null,
          hint: null,
          greyed: false,
          ...applyRange(),
        });
        return;
      }
      if (path === target) return;
      const first = target === null;
      target = path;
      if (first) {
        emit({note: path, noteName: nameOf(path)});
        if (exporting) waiting = true;
        else void start();
        return;
      }
      emit({
        note: path,
        noteName: nameOf(path),
        hint: 'Note changed; press Refresh',
        greyed: state.pages !== null,
      });
    },

    renamed(oldPath, newPath) {
      if (target !== oldPath) return;
      target = newPath;
      emit({note: newPath, noteName: nameOf(newPath)});
    },

    deleted(path) {
      if (target !== path) return;
      this.setNote(null);
    },

    refresh() {
      if (target === null) return;
      clearTimer();
      if (exporting) {
        waiting = true;
        return;
      }
      void start();
    },

    styleChanged() {
      if (target === null || disposed) return;
      counter++;
      clearTimer();
      timer = deps.setTimer(due, PREVIEW_DELAY_MS);
    },

    setRange(text) {
      const parsed = parsePageRange(text);
      if (!parsed.ok) {
        emit({rangeError: parsed.message || RANGE_MESSAGE});
        return;
      }
      range = parsed.range;
      emit({rangeText: text, rangeError: null, ...applyRange()});
    },

    exportStarted() {
      if (exporting) return;
      exporting = true;
      if (running !== null || state.status === 'compiling') waiting = true;
      counter++;
      endRunning();
      statusBeforeExport =
        state.status === 'compiling' ? 'ready' : state.status;
      emit({status: 'export'});
    },

    exportFinished() {
      if (!exporting) return;
      exporting = false;
      if (waiting) {
        waiting = false;
        void start();
        return;
      }
      emit({status: statusBeforeExport});
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      counter++;
      clearTimer();
      endRunning();
      freeDocument();
      state = {...state, pages: null};
    },
  };
}
