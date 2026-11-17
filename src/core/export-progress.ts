// US-042 AC-7 to AC-10: the progress of an export as data: the headings of its
// steps and ends, and the controller that opens the progress tab only when a run
// is still going after the delay. Pure core: no Obsidian, Node or I/O imports;
// the timers and the tab are injected.
import type {Warning} from './emit';

/** US-042 AC-7: one step of an export. */
export type ExportStep =
  | {kind: 'convert'}
  | {kind: 'compile'; n: number; limit: number}
  | {kind: 'write'}
  | {kind: 'gaps'}
  | {kind: 'sheet'};

/** US-042 AC-10: how an export ended, as the tab says it. */
export type ExportEnd = 'exported' | 'failed' | 'cancelled' | 'aborted';

/** US-042 AC-7, AC-8, AC-10: what the progress tab shows. */
export interface ProgressState {
  title: string;
  heading: string;
  warnings: Warning[];
  running: boolean;
}

/** US-042 | AC-7: The heading of a step. */
export function stepHeading(step: ExportStep): string {
  switch (step.kind) {
    case 'convert':
      return 'Converting';
    case 'compile':
      return step.n <= 1
        ? 'Compiling'
        : `Compiling (${step.n} of up to ${step.limit})`;
    case 'write':
      return 'Writing files';
    case 'gaps':
      return 'Checking word gaps';
    case 'sheet':
      return 'Compiling the encounter sheet';
  }
}

/** US-042 | AC-10: The heading of an end. */
export function endHeading(end: ExportEnd): string {
  switch (end) {
    case 'exported':
      return 'Exported';
    case 'failed':
      return 'Export failed';
    case 'cancelled':
      return 'Export cancelled';
    case 'aborted':
      return 'Export aborted (strict mode)';
  }
}

/** US-042 | AC-10: A run's status as an end; a refused run (busy) failed. */
export function endOf(
  status:
    | 'exported'
    | 'aborted'
    | 'busy'
    | 'compile-error'
    | 'compiler-failed'
    | 'cancelled',
): ExportEnd {
  if (status === 'exported') return 'exported';
  if (status === 'aborted') return 'aborted';
  if (status === 'cancelled') return 'cancelled';
  return 'failed';
}

/** US-042 AC-7 to AC-9: what an export tells its progress. */
export interface ExportProgress {
  step(step: ExportStep): void;
  warnings(list: readonly Warning[]): void;
  end(end: ExportEnd): void;
  cancel(): void;
  readonly cancelled: boolean;
  /** Calls `listener` once on cancel; returns the function that stops it. */
  onCancel(listener: () => void): () => void;
}

export interface ExportProgressOptions {
  noteName: string;
  delayMs: number;
  timers: {set(fn: () => void, ms: number): number; clear(id: number): void};
  /** Opens (or reuses) the tab; its button calls `cancel` while running. */
  openTab(cancel: () => void): {show(state: ProgressState): void};
}

/**
 * US-042 | AC-7 to AC-10: The progress of one export.
 *
 * Starts a timer of `delayMs`; when it fires while the run has not ended, the
 * tab is opened once and shows the state of now; after that every step, every
 * warning list and the end are shown at once. An end before the timer clears
 * it, so a short run never opens a tab. Cancel marks the progress and calls
 * each listener once, only while running. After the end nothing changes.
 */
export function createExportProgress(
  options: ExportProgressOptions,
): ExportProgress {
  const state: ProgressState = {
    title: `Exporting ${options.noteName}`,
    heading: stepHeading({kind: 'convert'}),
    warnings: [],
    running: true,
  };
  let tab: {show(state: ProgressState): void} | null = null;
  let cancelled = false;
  const listeners = new Set<() => void>();
  const show = (): void => tab?.show(state);
  const progress: ExportProgress = {
    step(step) {
      if (!state.running) return;
      state.heading = stepHeading(step);
      show();
    },
    warnings(list) {
      if (!state.running) return;
      state.warnings = [...state.warnings, ...list];
      show();
    },
    end(end) {
      if (!state.running) return;
      options.timers.clear(timer);
      state.running = false;
      state.heading = endHeading(end);
      show();
    },
    cancel() {
      if (!state.running || cancelled) return;
      cancelled = true;
      for (const listener of [...listeners]) listener();
    },
    get cancelled() {
      return cancelled;
    },
    onCancel(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  const timer = options.timers.set(() => {
    if (!state.running || tab !== null) return;
    tab = options.openTab(() => progress.cancel());
    show();
  }, options.delayMs);
  return progress;
}
