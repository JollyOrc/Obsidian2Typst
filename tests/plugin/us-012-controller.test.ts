// US-012 AC-4, AC-5, AC-6, AC-8, AC-9, AC-11 — the preview controller: which
// note, when to compile, what is shown, what is discarded, who has priority.
// It runs with a fake timer and scripted compile jobs (the drawing and the real
// compile are checked by tests/integration/us-012-preview-equals-export.test.ts
// and the manual check M2 step 15). Source of truth:
// docs/user-stories/US-012-style-preview-panel.md.
import {beforeEach, describe, expect, it} from 'vitest';
import {RANGE_MESSAGE} from '../../src/core/preview/range';
import {statusLine} from '../../src/core/preview/status';
import {
  PREVIEW_DELAY_MS,
  createPreviewController,
  type CompileJob,
  type PreparedPreview,
  type PreviewCompile,
  type PreviewState,
} from '../../src/plugin/preview/controller';

const REQUEST = {file: 'Rules.typ', source: '= Title', files: {}, fonts: []};
const NOTE = 'Book/Rules.md';

/** A timer that moves only when the test says so. */
class Timers {
  now = 0;
  private next = 1;
  private readonly items = new Map<number, {at: number; fn: () => void}>();
  setTimer = (fn: () => void, ms: number): number => {
    const id = this.next++;
    this.items.set(id, {at: this.now + ms, fn});
    return id;
  };
  clearTimer = (id: unknown): void => void this.items.delete(id as number);
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.items.entries()]
        .filter(([, item]) => item.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined) break;
      this.items.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
    }
    this.now = end;
  }
  get pending(): number {
    return this.items.size;
  }
}

class Job implements CompileJob {
  cancelled = 0;
  resolve!: (value: PreviewCompile) => void;
  readonly result = new Promise<PreviewCompile>((r) => (this.resolve = r));
  cancel(): void {
    this.cancelled++;
  }
}

/** Tags of the documents that were released, in order. */
const released: string[] = [];

const pages = (
  count: number,
  width = 148,
  height = 210,
  tag = `doc-${count}`,
): PreviewCompile => ({
  ok: true,
  pageCount: count,
  pageSize: {width, height},
  document: tag,
  release: () => void released.push(tag),
});

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

interface Rig {
  timers: Timers;
  jobs: Job[];
  log: string[];
  prepared: string[];
  states: PreviewState[];
  prepareResult: {value: PreparedPreview | Error};
  ctl: ReturnType<typeof createPreviewController>;
  state: () => PreviewState;
  /** Resolves the newest job and lets the controller react. */
  finish: (value: PreviewCompile, job?: Job) => Promise<void>;
}

function rig(): Rig {
  const timers = new Timers();
  const jobs: Job[] = [];
  const log: string[] = [];
  const prepared: string[] = [];
  const states: PreviewState[] = [];
  const prepareResult: Rig['prepareResult'] = {
    value: {ok: true, request: REQUEST, warnings: 2},
  };
  const ctl = createPreviewController({
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    prepare: async (path) => {
      prepared.push(path);
      if (prepareResult.value instanceof Error) throw prepareResult.value;
      return prepareResult.value;
    },
    compile: () => {
      const job = new Job();
      jobs.push(job);
      log.push(`compile ${jobs.length}`);
      const cancel = job.cancel.bind(job);
      job.cancel = () => {
        log.push(`cancel ${jobs.indexOf(job) + 1}`);
        cancel();
      };
      return job;
    },
    onState: (state) => void states.push(state),
  });
  return {
    timers,
    jobs,
    log,
    prepared,
    states,
    prepareResult,
    ctl,
    state: () => ctl.state,
    finish: async (value, job = jobs[jobs.length - 1]) => {
      (job as Job).resolve(value);
      await flush();
    },
  };
}

let r: Rig;
beforeEach(() => {
  r = rig();
  released.length = 0;
});

/** The note is open and its first compile is done with `count` pages. */
async function shown(count = 263): Promise<void> {
  r.ctl.setNote(NOTE);
  await flush();
  await r.finish(pages(count));
}

describe('US-012 AC-4 which note is shown', () => {
  it('US-012 AC-4: with no note the panel says so and compiles nothing', async () => {
    r.ctl.setNote(null);
    r.ctl.refresh();
    await flush();
    expect(r.state().status).toBe('no-note');
    expect(statusLine(r.state())).toBe('Open a note to preview it');
    expect(r.prepared).toEqual([]);
    expect(r.jobs).toHaveLength(0);
  });

  it('US-012 AC-4: opening the panel with a note compiles it once, at once', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    expect(r.prepared).toEqual([NOTE]);
    expect(r.jobs).toHaveLength(1);
    expect(r.state().noteName).toBe('Rules');
    expect(statusLine(r.state()).startsWith('Preview of: Rules')).toBe(true);
    expect(r.timers.pending).toBe(0);
  });

  it('US-012 AC-4: another note becoming active shows its name and the hint, compiles nothing, greys the old pages', async () => {
    await shown();
    r.ctl.setNote('Book/Other.md');
    await flush();
    expect(r.state().noteName).toBe('Other');
    expect(r.state().hint).toBe('Note changed; press Refresh');
    expect(r.state().greyed).toBe(true);
    expect(r.state().pages?.document).toBe('doc-263');
    expect(r.prepared).toEqual([NOTE]);
    expect(r.jobs).toHaveLength(1);
    expect(statusLine(r.state())).toContain('Note changed; press Refresh');
  });

  it('US-012 AC-4: Refresh then compiles the new note and clears the hint and the grey', async () => {
    await shown();
    r.ctl.setNote('Book/Other.md');
    r.ctl.refresh();
    await flush();
    expect(r.prepared).toEqual([NOTE, 'Book/Other.md']);
    await r.finish(pages(10));
    expect(r.state().hint).toBeNull();
    expect(r.state().greyed).toBe(false);
    expect(r.state().pages?.count).toBe(10);
  });

  it('US-012 AC-4: the same note activated again changes nothing', async () => {
    await shown();
    r.ctl.setNote(NOTE);
    await flush();
    expect(r.state().hint).toBeNull();
    expect(r.jobs).toHaveLength(1);
  });

  it('US-012 AC-4: a renamed note stays the previewed one under its new name', async () => {
    await shown();
    r.ctl.renamed(NOTE, 'Book/Renamed.md');
    expect(r.state().noteName).toBe('Renamed');
    expect(r.state().hint).toBeNull();
    expect(r.state().greyed).toBe(false);
    expect(r.jobs).toHaveLength(1);
    r.ctl.refresh();
    await flush();
    expect(r.prepared[1]).toBe('Book/Renamed.md');
  });

  it('US-012 AC-4: a note that is deleted gives the no-note state; another deleted note does not', async () => {
    await shown();
    r.ctl.deleted('Book/Elsewhere.md');
    expect(r.state().status).not.toBe('no-note');
    r.ctl.deleted(NOTE);
    expect(r.state().status).toBe('no-note');
    expect(r.state().pages).toBeNull();
    expect(statusLine(r.state())).toBe('Open a note to preview it');
  });
});

describe('US-012 AC-5 refresh on a style change', () => {
  it('US-012 AC-5: the delay is 500 ms', () => {
    expect(PREVIEW_DELAY_MS).toBe(500);
  });

  it('US-012 AC-5: a second change at 300 ms removes the first timer (nothing starts at 500 ms)', async () => {
    await shown();
    r.ctl.styleChanged();
    r.timers.advance(300);
    r.ctl.styleChanged();
    r.timers.advance(300);
    await flush();
    expect(r.jobs).toHaveLength(1);
    r.timers.advance(200);
    await flush();
    expect(r.jobs).toHaveLength(2);
  });

  it('US-012 AC-5: changes at 0, 400 and 900 ms start one compile at 1400 ms', async () => {
    await shown();
    expect(r.jobs).toHaveLength(1);
    r.ctl.styleChanged();
    r.timers.advance(400);
    r.ctl.styleChanged();
    r.timers.advance(500);
    r.ctl.styleChanged();
    r.timers.advance(499);
    await flush();
    expect(r.jobs).toHaveLength(1);
    r.timers.advance(1);
    await flush();
    expect(r.jobs).toHaveLength(2);
    r.timers.advance(5000);
    await flush();
    expect(r.jobs).toHaveLength(2);
  });

  it('US-012 AC-5: Refresh compiles at once and cancels the waiting change', async () => {
    await shown();
    r.ctl.styleChanged();
    r.ctl.refresh();
    await flush();
    expect(r.jobs).toHaveLength(2);
    expect(r.timers.pending).toBe(0);
    r.timers.advance(1000);
    await flush();
    expect(r.jobs).toHaveLength(2);
  });

  it('US-012 AC-5: A5 to A4 changes the aspect ratio from 0.705 to 0.707 and the page count', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    await r.finish(pages(263, 148, 210));
    expect(r.state().pages?.aspect.toFixed(3)).toBe('0.705');
    expect(r.state().pages?.count).toBe(263);
    r.ctl.styleChanged();
    r.timers.advance(500);
    await flush();
    await r.finish(pages(177, 210, 297));
    expect(r.state().pages?.aspect.toFixed(3)).toBe('0.707');
    expect(r.state().pages?.count).toBe(177);
  });

  it('US-012 AC-5: a change with no note compiles nothing', async () => {
    r.ctl.setNote(null);
    r.ctl.styleChanged();
    r.timers.advance(1000);
    await flush();
    expect(r.prepared).toEqual([]);
  });
});

describe('US-012 AC-6 the page range in the controller', () => {
  it('US-012 AC-6: a range shows its pages and never compiles', async () => {
    await shown(263);
    expect(r.state().shown).toHaveLength(263);
    r.ctl.setRange('3-5');
    await flush();
    expect(r.state().shown).toEqual([3, 4, 5]);
    expect(r.state().rangeError).toBeNull();
    expect(r.jobs).toHaveLength(1);
    expect(r.prepared).toHaveLength(1);
    expect(r.timers.pending).toBe(0);
  });

  it('US-012 AC-6: a refused range keeps the previous one and gives the message, no compile', async () => {
    await shown(263);
    r.ctl.setRange('3-5');
    r.ctl.setRange('5-3');
    expect(r.state().rangeError).toBe(RANGE_MESSAGE);
    expect(r.state().shown).toEqual([3, 4, 5]);
    expect(r.jobs).toHaveLength(1);
    r.ctl.setRange('3-');
    expect(r.state().rangeError).toBe(RANGE_MESSAGE);
    r.ctl.setRange('3-5');
    expect(r.state().rangeError).toBeNull();
  });

  it('US-012 AC-6: a range behind the end gives the length of the document and no pages', async () => {
    await shown(263);
    r.ctl.setRange('300-310');
    expect(r.state().shown).toEqual([]);
    expect(r.state().rangeMessage).toBe('The document has 263 pages');
  });

  it('US-012 AC-6: the range is kept after a refresh and applied to the new page count', async () => {
    await shown(263);
    r.ctl.setRange('3-5');
    r.ctl.refresh();
    await flush();
    await r.finish(pages(4));
    expect(r.state().shown).toEqual([3, 4]);
  });

  it('US-012 AC-6: the range applies as soon as pages exist, also when set before the first result', async () => {
    r.ctl.setNote(NOTE);
    r.ctl.setRange('2-3');
    await flush();
    await r.finish(pages(10));
    expect(r.state().shown).toEqual([2, 3]);
  });
});

describe('US-012 AC-8 stale results', () => {
  it('US-012 AC-8: a newer compile ends the running one first; only its pages are shown', async () => {
    await shown();
    r.ctl.styleChanged();
    r.timers.advance(500);
    await flush(); // compile 2 runs
    r.ctl.styleChanged();
    r.timers.advance(500);
    await flush(); // compile 3 is due
    expect(r.log).toEqual(['compile 1', 'compile 2', 'cancel 2', 'compile 3']);
    await r.finish(pages(50, 148, 210, 'late'), r.jobs[1]);
    expect(r.state().pages?.document).not.toBe('late');
    await r.finish(pages(177, 210, 297, 'newest'), r.jobs[2]);
    expect(r.state().pages?.document).toBe('newest');
  });

  it('US-012 AC-8: a result that arrives after a newer request but before the newer compile starts is dropped', async () => {
    r.ctl.setNote(NOTE);
    await flush(); // compile 1 runs for the first time
    r.ctl.styleChanged();
    await r.finish(pages(263, 148, 210, 'old'), r.jobs[0]);
    expect(r.state().pages).toBeNull();
    r.timers.advance(500);
    await flush();
    await r.finish(pages(177, 210, 297, 'new'), r.jobs[1]);
    expect(r.state().pages?.document).toBe('new');
  });

  it('US-012 AC-8: A5 compile 1, at 600 ms the value is A4: compile 1 is ended, compile 2 runs', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    r.timers.advance(600);
    r.ctl.styleChanged();
    r.timers.advance(500);
    await flush();
    expect(r.jobs[0]?.cancelled).toBe(1);
    expect(r.jobs).toHaveLength(2);
    expect(r.jobs[1]?.cancelled).toBe(0);
  });

  it('US-012 AC-8: a finished compile is not cancelled by a later change', async () => {
    await shown();
    r.ctl.styleChanged();
    r.timers.advance(500);
    await flush();
    expect(r.jobs[0]?.cancelled).toBe(0);
  });

  it('US-012 AC-8: closing the panel (dispose) ends the running compile and the waiting timer', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    r.ctl.styleChanged();
    r.ctl.dispose();
    expect(r.jobs[0]?.cancelled).toBe(1);
    expect(r.timers.pending).toBe(0);
    await r.finish(pages(3), r.jobs[0]);
    expect(r.state().pages).toBeNull();
  });
});

describe('US-012 AC-9 export comes first', () => {
  it('US-012 AC-9: an export that starts ends the running preview compile and says so', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    r.ctl.exportStarted();
    expect(r.jobs[0]?.cancelled).toBe(1);
    expect(r.state().status).toBe('export');
    expect(
      statusLine(r.state()).endsWith(
        'Export running; the preview updates afterwards',
      ),
    ).toBe(true);
  });

  it('US-012 AC-9: a request due during the export waits and then runs once', async () => {
    await shown();
    r.ctl.exportStarted();
    r.ctl.styleChanged();
    r.timers.advance(1000);
    await flush();
    expect(r.jobs).toHaveLength(1);
    r.ctl.exportFinished();
    await flush();
    expect(r.jobs).toHaveLength(2);
    r.timers.advance(5000);
    await flush();
    expect(r.jobs).toHaveLength(2);
  });

  it('US-012 AC-9: the preview compile that was ended by the export runs again afterwards', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    r.ctl.exportStarted();
    r.ctl.exportFinished();
    await flush();
    expect(r.jobs).toHaveLength(2);
  });

  it('US-012 AC-9: an export with nothing waiting leaves the pages as they are and compiles nothing', async () => {
    await shown();
    r.ctl.exportStarted();
    r.ctl.exportFinished();
    await flush();
    expect(r.jobs).toHaveLength(1);
    expect(r.state().status).toBe('ready');
    expect(r.state().pages?.count).toBe(263);
  });

  it('US-012 AC-9: Refresh during an export waits too', async () => {
    await shown();
    r.ctl.exportStarted();
    r.ctl.refresh();
    await flush();
    expect(r.jobs).toHaveLength(1);
    r.ctl.exportFinished();
    await flush();
    expect(r.jobs).toHaveLength(2);
  });
});

describe('US-012 AC-11 errors, warnings and the status line', () => {
  const ERROR = 'Typst error at Rules.typ:41:8: unknown variable: foo';

  it('US-012 AC-11: a compile error replaces the pages by its message; the last good pages stay, greyed', async () => {
    await shown();
    r.ctl.refresh();
    await flush();
    await r.finish({ok: false, error: ERROR});
    expect(r.state().status).toBe('error');
    expect(r.state().error).toBe(ERROR);
    expect(r.state().greyed).toBe(true);
    expect(r.state().pages?.document).toBe('doc-263');
    const line = statusLine(r.state());
    expect(line.startsWith('Preview of: Rules')).toBe(true);
    expect(line.endsWith(ERROR)).toBe(true);
  });

  it('US-012 AC-11: an error without a last good result shows only the message', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    await r.finish({ok: false, error: ERROR});
    expect(r.state().pages).toBeNull();
    expect(r.state().error).toBe(ERROR);
    expect(r.state().greyed).toBe(false);
  });

  it('US-012 AC-11: the next successful compile clears the message and the grey', async () => {
    await shown();
    r.ctl.refresh();
    await flush();
    await r.finish({ok: false, error: ERROR});
    r.ctl.refresh();
    await flush();
    await r.finish(pages(12));
    expect(r.state().error).toBeNull();
    expect(r.state().greyed).toBe(false);
    expect(r.state().pages?.count).toBe(12);
  });

  it('US-012 AC-11: after a success the line ends with the warning count of that run', async () => {
    await shown();
    expect(statusLine(r.state())).toBe('Preview of: Rules · 2 warnings');
    for (const [count, text] of [
      [1, '1 warning'],
      [0, 'no warnings'],
    ] as const) {
      r.prepareResult.value = {ok: true, request: REQUEST, warnings: count};
      r.ctl.refresh();
      await flush();
      await r.finish(pages(5));
      expect(statusLine(r.state())).toBe(`Preview of: Rules · ${text}`);
    }
  });

  it('US-012 AC-11: while a compile runs the line shows Compiling… and the pages stay', async () => {
    await shown();
    r.ctl.refresh();
    await flush();
    expect(r.state().status).toBe('compiling');
    expect(statusLine(r.state())).toBe('Preview of: Rules · Compiling…');
    expect(r.state().pages?.document).toBe('doc-263');
    expect(r.state().greyed).toBe(false);
  });

  it('US-012 AC-11: a strict-mode stop or invalid preset from the preparation is shown like a compile error and compiles nothing', async () => {
    r.prepareResult.value = {
      ok: false,
      error: 'Export stopped: 2 warnings in strict mode',
    };
    r.ctl.setNote(NOTE);
    await flush();
    expect(r.jobs).toHaveLength(0);
    expect(r.state().status).toBe('error');
    expect(r.state().error).toBe('Export stopped: 2 warnings in strict mode');
  });

  it('US-012 AC-11: a preparation that throws is shown as a message, never left as an unhandled rejection', async () => {
    r.prepareResult.value = new Error('The vault is not readable');
    r.ctl.setNote(NOTE);
    await flush();
    expect(r.state().status).toBe('error');
    expect(r.state().error).toBe('Preview failed: The vault is not readable');
  });
});

describe('US-012 AC-8 release of documents (memory)', () => {
  it('US-012 AC-8: the document of a replaced result is released once, the shown one is not', async () => {
    await shown(263);
    expect(released).toEqual([]);
    r.ctl.refresh();
    await flush();
    await r.finish(pages(177, 210, 297, 'second'));
    expect(released).toEqual(['doc-263']);
    expect(r.state().pages?.document).toBe('second');
  });

  it('US-012 AC-8: a result that is dropped as stale is released at once', async () => {
    r.ctl.setNote(NOTE);
    await flush();
    r.ctl.styleChanged();
    await r.finish(pages(10, 148, 210, 'stale'), r.jobs[0]);
    expect(released).toEqual(['stale']);
  });

  it('US-012 AC-8: closing the panel (dispose) releases the shown document, once, also when called twice', async () => {
    await shown(263);
    r.ctl.dispose();
    r.ctl.dispose();
    expect(released).toEqual(['doc-263']);
  });

  it('US-012 AC-8: the last good document of an error state is kept, not released', async () => {
    await shown(263);
    r.ctl.refresh();
    await flush();
    await r.finish({ok: false, error: 'Typst error: x'});
    expect(released).toEqual([]);
  });

  it('US-012 AC-8: a deleted note releases its document', async () => {
    await shown(263);
    r.ctl.deleted(NOTE);
    expect(released).toEqual(['doc-263']);
  });
});
