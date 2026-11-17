// US-042 AC-7 to AC-10 — the progress of an export: the headings of the steps and
// ends, the tab that opens only when a run is still going after the delay (fake
// timers), what it shows and when, cancel, and the tab's drawing with the fake
// DOM. The tab in Obsidian (focus, drawing in the background) was measured in
// M32; the look is checked by hand (AC-15). Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {describe, expect, it, vi} from 'vitest';
import type {Warning} from '../../src/core/emit';
import {
  createExportProgress,
  endHeading,
  endOf,
  stepHeading,
  type ProgressState,
} from '../../src/core/export-progress';
import {FakeEl} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const W = (code: string, line: number): Warning => ({
  code,
  message: `${code} message`,
  line,
});

describe('US-042 AC-7: the heading of each step', () => {
  it.each([
    [{kind: 'convert'}, 'Converting'],
    [{kind: 'compile', n: 1, limit: 8}, 'Compiling'],
    [{kind: 'compile', n: 2, limit: 8}, 'Compiling (2 of up to 8)'],
    [{kind: 'compile', n: 8, limit: 8}, 'Compiling (8 of up to 8)'],
    [{kind: 'write'}, 'Writing files'],
    [{kind: 'gaps'}, 'Checking word gaps'],
    [{kind: 'sheet'}, 'Compiling the encounter sheet'],
  ] as const)('%o → %s', (step, heading) => {
    expect(stepHeading(step)).toBe(heading);
  });
});

describe("US-042 AC-10: the heading of each end, and a run's status as an end", () => {
  it.each([
    ['exported', 'Exported'],
    ['failed', 'Export failed'],
    ['cancelled', 'Export cancelled'],
    ['aborted', 'Export aborted (strict mode)'],
  ] as const)('%s → %s', (end, heading) => {
    expect(endHeading(end)).toBe(heading);
  });

  it.each([
    ['exported', 'exported'],
    ['compile-error', 'failed'],
    ['compiler-failed', 'failed'],
    ['busy', 'failed'],
    ['aborted', 'aborted'],
    ['cancelled', 'cancelled'],
  ] as const)('status %s → %s', (status, end) => {
    expect(endOf(status)).toBe(end);
  });
});

/** A progress over fake timers; records each tab opened and every state it shows. */
function rig(delayMs = 2000) {
  vi.useFakeTimers();
  const shown: ProgressState[] = [];
  const tabs: (() => void)[] = [];
  const progress = createExportProgress({
    noteName: 'Book',
    delayMs,
    timers: {
      set: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clear: (id) => clearTimeout(id),
    },
    openTab: (cancel) => {
      tabs.push(cancel);
      return {show: (state) => void shown.push(structuredClone(state))};
    },
  });
  return {progress, shown, tabs};
}

describe('US-042 AC-7: the tab opens only if the run is still going after 2 s', () => {
  it('a run that ends before 2 s opens no tab, also not later', () => {
    const r = rig();
    r.progress.step({kind: 'convert'});
    vi.advanceTimersByTime(1999);
    r.progress.end('exported');
    vi.advanceTimersByTime(10_000);
    expect(r.tabs).toHaveLength(0);
    expect(r.shown).toEqual([]);
    vi.useRealTimers();
  });

  it("the rule is the progress's own: no tab after the end even if the timer still fires", () => {
    vi.useFakeTimers();
    const tabs: unknown[] = [];
    const progress = createExportProgress({
      noteName: 'Book',
      delayMs: 2000,
      // A timer whose clear does nothing: the end alone must keep the tab shut.
      timers: {
        set: (fn, ms) => setTimeout(fn, ms) as unknown as number,
        clear: () => undefined,
      },
      openTab: () => {
        tabs.push(1);
        return {show: () => undefined};
      },
    });
    progress.end('exported');
    vi.advanceTimersByTime(5000);
    expect(tabs).toEqual([]);
    vi.useRealTimers();
  });

  it('at 2 s the tab opens once and shows the state of now', () => {
    const r = rig();
    r.progress.step({kind: 'convert'});
    r.progress.step({kind: 'compile', n: 1, limit: 8});
    vi.advanceTimersByTime(1999);
    expect(r.tabs).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(r.tabs).toHaveLength(1);
    expect(r.shown).toEqual([
      {
        title: 'Exporting Book',
        heading: 'Compiling',
        warnings: [],
        running: true,
      },
    ]);
    vi.advanceTimersByTime(10_000);
    expect(r.tabs).toHaveLength(1);
    vi.useRealTimers();
  });

  it('the delay is the given one (the rule at other values, SCAR-019)', () => {
    const r = rig(500);
    vi.advanceTimersByTime(499);
    expect(r.tabs).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(r.tabs).toHaveLength(1);
    vi.useRealTimers();
  });

  it('before any step the heading is Converting', () => {
    const r = rig();
    vi.advanceTimersByTime(2000);
    expect(r.shown[0]?.heading).toBe('Converting');
    vi.useRealTimers();
  });
});

describe('US-042 AC-8, AC-10: after the tab opened, every change is shown at once', () => {
  it('steps, warnings as they come, and the end', () => {
    const r = rig();
    r.progress.warnings([W('LINK_UNRESOLVED', 12)]);
    vi.advanceTimersByTime(2000);
    expect(r.shown.at(-1)?.warnings.map((w) => w.code)).toEqual([
      'LINK_UNRESOLVED',
    ]);
    r.progress.step({kind: 'compile', n: 2, limit: 8});
    expect(r.shown.at(-1)?.heading).toBe('Compiling (2 of up to 8)');
    r.progress.warnings([W('IMAGE_FIT_OFF', 0), W('TEXT_GAP', 40)]);
    expect(r.shown.at(-1)?.warnings.map((w) => w.code)).toEqual([
      'LINK_UNRESOLVED',
      'IMAGE_FIT_OFF',
      'TEXT_GAP',
    ]);
    r.progress.end('exported');
    expect(r.shown.at(-1)).toEqual({
      title: 'Exporting Book',
      heading: 'Exported',
      warnings: [
        W('LINK_UNRESOLVED', 12),
        W('IMAGE_FIT_OFF', 0),
        W('TEXT_GAP', 40),
      ],
      running: false,
    });
    vi.useRealTimers();
  });

  it('a second end changes nothing', () => {
    const r = rig();
    vi.advanceTimersByTime(2000);
    r.progress.end('failed');
    const count = r.shown.length;
    r.progress.end('exported');
    r.progress.step({kind: 'write'});
    expect(r.shown).toHaveLength(count);
    expect(r.shown.at(-1)?.heading).toBe('Export failed');
    vi.useRealTimers();
  });
});

describe('US-042 AC-9: cancel', () => {
  it("the tab's cancel tells every listener once and marks the progress cancelled", () => {
    const r = rig();
    const heard: string[] = [];
    r.progress.onCancel(() => void heard.push('a'));
    const stop = r.progress.onCancel(() => void heard.push('b'));
    stop();
    vi.advanceTimersByTime(2000);
    expect(r.progress.cancelled).toBe(false);
    r.tabs[0]?.();
    r.tabs[0]?.();
    expect(r.progress.cancelled).toBe(true);
    expect(heard).toEqual(['a']);
    vi.useRealTimers();
  });

  it('cancel after the end does nothing', () => {
    const r = rig();
    const heard: string[] = [];
    r.progress.onCancel(() => void heard.push('a'));
    r.progress.end('exported');
    r.progress.cancel();
    expect(r.progress.cancelled).toBe(false);
    expect(heard).toEqual([]);
    vi.useRealTimers();
  });
});

describe('US-042 AC-7 to AC-10: the tab drawn', () => {
  async function draw(state: ProgressState) {
    const {drawProgress} = await import('../../src/plugin/progress/draw');
    const root = new FakeEl();
    const pressed: string[] = [];
    drawProgress(root as never, state, {
      cancel: () => void pressed.push('cancel'),
      close: () => void pressed.push('close'),
    });
    const all = root.descendants();
    const one = (cls: string) => all.filter((el) => el.classes.has(cls));
    const button = all.find((el) => el.tag === 'button');
    return {root, all, one, button, pressed};
  }

  it('while running: the heading, a bar without a value, Cancel', async () => {
    const d = await draw({
      title: 'Exporting Book',
      heading: 'Compiling (2 of up to 8)',
      warnings: [],
      running: true,
    });
    expect(d.one('o2t-progress-heading').map((e) => e.text)).toEqual([
      'Compiling (2 of up to 8)',
    ]);
    const bar = d.one('o2t-progress-bar');
    expect(bar.map((e) => e.tag)).toEqual(['progress']);
    expect(bar[0]?.attrs['value']).toBeUndefined();
    expect(d.button?.text).toBe('Cancel');
    d.button?.click();
    expect(d.pressed).toEqual(['cancel']);
  });

  it('after the end: no bar, Close', async () => {
    const d = await draw({
      title: 'Exporting Book',
      heading: 'Exported',
      warnings: [],
      running: false,
    });
    expect(d.one('o2t-progress-bar')).toEqual([]);
    expect(d.button?.text).toBe('Close');
    d.button?.click();
    expect(d.pressed).toEqual(['close']);
  });

  it('each warning: the code in bold, the message, its line', async () => {
    const d = await draw({
      title: 'Exporting Book',
      heading: 'Compiling',
      warnings: [W('LINK_UNRESOLVED', 412), W('IMAGE_FIT_OFF', 0)],
      running: true,
    });
    const items = d.one('o2t-progress-warning');
    expect(items).toHaveLength(2);
    expect(d.one('o2t-progress-warnings')).toHaveLength(1);
    const texts = (el: FakeEl) =>
      el.descendants().map((c) => [c.tag, c.text] as const);
    expect(texts(items[0] as FakeEl)).toEqual([
      ['strong', 'LINK_UNRESOLVED'],
      ['span', 'LINK_UNRESOLVED message'],
      ['span', 'line 412'],
    ]);
    // A warning without a line (0) has no line part.
    expect(texts(items[1] as FakeEl)).toEqual([
      ['strong', 'IMAGE_FIT_OFF'],
      ['span', 'IMAGE_FIT_OFF message'],
    ]);
  });

  it('a redraw replaces what was drawn (one heading, one list)', async () => {
    const {drawProgress} = await import('../../src/plugin/progress/draw');
    const root = new FakeEl();
    const state: ProgressState = {
      title: 'Exporting Book',
      heading: 'Converting',
      warnings: [W('A', 1)],
      running: true,
    };
    const buttons = {cancel: () => undefined, close: () => undefined};
    drawProgress(root as never, state, buttons);
    drawProgress(root as never, {...state, heading: 'Writing files'}, buttons);
    const headings = root
      .descendants()
      .filter((e) => e.classes.has('o2t-progress-heading'));
    expect(headings.map((e) => e.text)).toEqual(['Writing files']);
    expect(
      root.descendants().filter((e) => e.classes.has('o2t-progress-warning')),
    ).toHaveLength(1);
  });

  it("the styles: the warning border in Obsidian's yellow, in styles.css", async () => {
    const {readFileSync} = await import('node:fs');
    const css = readFileSync('styles.css', 'utf8');
    const rule = /\.o2t-progress-warning\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/border-left:\s*5px solid var\(--color-yellow\)/);
  });
});
