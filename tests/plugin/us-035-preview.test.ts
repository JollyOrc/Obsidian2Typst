// US-035 AC-1, AC-3 to AC-9, AC-11 — the `o2t-entry` preview in Obsidian:
// the processor's output, notices instead of a statblock, icons read once per
// path and recoloured, reads at render time, no click handlers, the drawing
// API, the time for 40 blocks, and the wiring in main.ts and styles.css.
// The processor and API are loaded at run time (they do not exist yet).
// Source of truth: docs/user-stories/US-035-entry-block-preview-in-obsidian.md.
// Red until US-035 is implemented (G2, 2026-11-06).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {ENTRIES, FEN_HARE_YAML} from '../support/entries';
import {FakeEl} from '../support/fake-obsidian';

const PROCESSOR = '../../src/plugin/entries/processor';
interface PreviewDeps {
  /** The active preset's effective settings, read when called; null without a valid preset. */
  settings(): Promise<{entries?: unknown; colorMode?: string} | null>;
  /** An icon file's text from the vault; null when missing. */
  readIcon(path: string): Promise<string | null>;
  /** The nearest heading above the block (from the section info), or null. */
  heading(ctx: unknown): string | null;
  /** The note's file name without `.md`. */
  fileName(ctx: unknown): string;
  /** True when the block sits in a quote or callout. */
  inContainer(ctx: unknown): boolean;
}
interface ProcessorModule {
  createEntryProcessor(deps: PreviewDeps): {
    handler: (source: string, el: unknown, ctx: unknown) => Promise<void>;
    clearIconCache(): void;
  };
  createEntriesApi(deps: PreviewDeps): {
    version: number;
    renderStatblock(
      el: unknown,
      data: Record<string, unknown>,
      options?: {heading?: string},
    ): Promise<{boxes: unknown[]; cells: unknown[]}>;
  };
}
const load = async (): Promise<ProcessorModule> => {
  const path: string = PROCESSOR;
  return (await import(/* @vite-ignore */ path)) as ProcessorModule;
};

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z" fill="#000"/></svg>';
const COLOUR = {
  ...ENTRIES,
  statblock: {
    ...ENTRIES.statblock,
    fill: '#fbe2c5',
    frame: {color: '#7a4a2e', width: 0.75},
  },
};

/** Fake dependencies that count their calls. */
function deps(over: Partial<PreviewDeps> = {}) {
  const calls = {settings: 0, icons: [] as string[]};
  let current: {entries?: unknown; colorMode?: string} | null = {
    entries: COLOUR,
  };
  const d: PreviewDeps = {
    settings: async () => {
      calls.settings++;
      return current;
    },
    readIcon: async (p) => {
      calls.icons.push(p);
      return ICON;
    },
    heading: () => 'Fen Hare',
    fileName: () => 'Rules',
    inContainer: () => false,
    ...over,
  };
  return {d, calls, set: (v: typeof current) => (current = v)};
}
const SOURCE = FEN_HARE_YAML.join('\n') + '\n';
const textOf = (el: FakeEl): string =>
  [el.text, ...el.descendants().map((x) => x.text)].join(' ');
const withClass = (el: FakeEl, cls: string): FakeEl[] =>
  el.descendants().filter((x) => x.classes.has(cls));

describe('US-035 AC-1 the processor draws the statblock', () => {
  it('US-035 AC-1: the example block shows band, 11 boxes, four labelled cells, attributes, attacks, skills, tags', async () => {
    const {createEntryProcessor} = await load();
    const el = new FakeEl();
    await createEntryProcessor(deps().d).handler(SOURCE, el, {});
    const text = textOf(el);
    for (const t of [
      'Fen Hare',
      'Might 4 · Wits 2 · Speed 5',
      'Kick',
      '2d6',
      'Skills: Quick Step, Keen Nose',
      'Beast',
    ]) {
      expect(text, t).toContain(t);
    }
    expect(withClass(el, 'o2t-sb-box')).toHaveLength(11);
    expect(
      withClass(el, 'o2t-sb-cell').map((c) => c.attrs['aria-label']),
    ).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
  });
});

describe('US-035 AC-3 look', () => {
  it('US-035 AC-3: colours as CSS custom properties; icons read through the vault and recoloured', async () => {
    const {createEntryProcessor} = await load();
    const {d, calls} = deps();
    const el = new FakeEl();
    await createEntryProcessor(d).handler(SOURCE, el, {});
    const root = withClass(el, 'o2t-sb')[0] ?? el;
    expect(Object.values(root.cssProps)).toEqual(
      expect.arrayContaining(['#fbe2c5', '#7a4a2e']),
    );
    expect(calls.icons.sort()).toEqual([
      'Icons/down.svg',
      'Icons/fine.svg',
      'Icons/gone.svg',
      'Icons/hurt.svg',
    ]);
    expect(textOf(el)).not.toContain('fill="#000"');
  });
});

describe('US-035 AC-4, AC-5, AC-9 notices instead of a statblock', () => {
  it('US-035 AC-4: no valid active preset → the code block with one notice', async () => {
    const {createEntryProcessor} = await load();
    const {d, set} = deps();
    set(null);
    const el = new FakeEl();
    await createEntryProcessor(d).handler(SOURCE, el, {});
    expect(textOf(el)).toContain(
      'No statblock: the active preset has no entries settings.',
    );
    expect(textOf(el)).toContain('vigour: 11');
    expect(withClass(el, 'o2t-sb-box')).toHaveLength(0);
  });

  it('US-035 AC-4: no stats and no attacks → the code block with its notice', async () => {
    const {createEntryProcessor} = await load();
    const el = new FakeEl();
    await createEntryProcessor(deps().d).handler('skills: [Swift]\n', el, {});
    expect(textOf(el)).toContain('No statblock: no stats or attacks.');
  });

  it('US-035 AC-5: invalid YAML → the raw block and ENTRY_YAML_INVALID with the line', async () => {
    const {createEntryProcessor} = await load();
    const el = new FakeEl();
    await createEntryProcessor(deps().d).handler(
      'might: 4\nvigour: [11\n',
      el,
      {},
    );
    expect(textOf(el)).toMatch(/ENTRY_YAML_INVALID \(line \d+\)/);
    expect(textOf(el)).toContain('vigour: [11');
  });

  it('US-035 AC-9: a block in a quote or callout → the raw block and ENTRY_BLOCK_IN_CONTAINER', async () => {
    const {createEntryProcessor} = await load();
    const el = new FakeEl();
    await createEntryProcessor(deps({inContainer: () => true}).d).handler(
      SOURCE,
      el,
      {},
    );
    expect(textOf(el)).toContain('ENTRY_BLOCK_IN_CONTAINER');
    expect(withClass(el, 'o2t-sb-box')).toHaveLength(0);
  });
});

describe('US-035 AC-6 not interactive', () => {
  it('US-035 AC-6: no box or cell has a click listener', async () => {
    const {createEntryProcessor} = await load();
    const el = new FakeEl();
    await createEntryProcessor(deps().d).handler(SOURCE, el, {});
    const marks = [
      ...withClass(el, 'o2t-sb-box'),
      ...withClass(el, 'o2t-sb-cell'),
    ];
    expect(marks.length).toBe(15);
    expect(marks.filter((m) => m.listenerCount('click') > 0)).toEqual([]);
  });
});

describe('US-035 AC-7 reads at render time (SCAR-016)', () => {
  it('US-035 AC-7: each render reads the settings again; a changed preset shows in the next render', async () => {
    const {createEntryProcessor} = await load();
    const {d, calls, set} = deps();
    const p = createEntryProcessor(d);
    const first = new FakeEl();
    await p.handler(SOURCE, first, {});
    set({
      entries: {...COLOUR, statblock: {...COLOUR.statblock, boxes: undefined}},
    });
    const second = new FakeEl();
    await p.handler(SOURCE, second, {});
    expect(calls.settings).toBe(2);
    expect(withClass(first, 'o2t-sb-box')).toHaveLength(11);
    expect(withClass(second, 'o2t-sb-box')).toHaveLength(0);
  });
});

describe('US-035 AC-8 time and icon reads', () => {
  it('US-035 AC-8 (SCAR-030): 40 blocks — icons read once per path, each render under 100 ms', async () => {
    const {createEntryProcessor} = await load();
    const {d, calls} = deps();
    const p = createEntryProcessor(d);
    let slowest = 0;
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      await p.handler(SOURCE, new FakeEl(), {});
      slowest = Math.max(slowest, performance.now() - t0);
    }
    expect(calls.icons).toHaveLength(4);
    expect(slowest).toBeLessThan(100);
    p.clearIconCache();
    await p.handler(SOURCE, new FakeEl(), {});
    expect(calls.icons).toHaveLength(8);
  });
});

describe('US-035 AC-11 the drawing API', () => {
  it('US-035 AC-11: version 1; renderStatblock returns the boxes and cells in order and adds no clicks', async () => {
    const {createEntriesApi} = await load();
    const api = createEntriesApi(deps().d);
    expect(api.version).toBe(1);
    const el = new FakeEl();
    const {boxes, cells} = await api.renderStatblock(
      el,
      {Vigour: 11, might: 4, attacks: ['Kick: 2d6']},
      {heading: 'Fen Hare'},
    );
    expect(boxes).toHaveLength(11);
    expect((cells as FakeEl[]).map((c) => c.attrs['aria-label'])).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Gone',
    ]);
    expect(
      [...(boxes as FakeEl[]), ...(cells as FakeEl[])].filter(
        (x) => x.listenerCount('click') > 0,
      ),
    ).toEqual([]);
    expect(textOf(el)).toContain('Fen Hare');
  });

  it('US-035 AC-11: without options.heading the band is data.name, else —', async () => {
    const {createEntriesApi} = await load();
    const api = createEntriesApi(deps().d);
    const a = new FakeEl();
    await api.renderStatblock(a, {
      name: 'Marsh Owl',
      might: 4,
      attacks: ['Kick: 2d6'],
    });
    expect(textOf(a)).toContain('Marsh Owl');
    const b = new FakeEl();
    await api.renderStatblock(b, {might: 4, attacks: ['Kick: 2d6']});
    expect(textOf(b)).toContain('◆ — ◆');
  });
});

describe('US-035 AC-1, AC-3, AC-7, AC-11 the wiring', () => {
  const main = readFileSync('src/plugin/main.ts', 'utf8');
  it('US-035 AC-1: main.ts registers the processor for o2t-entry', () => {
    expect(main).toMatch(/registerMarkdownCodeBlockProcessor\(\s*'o2t-entry'/);
  });
  it('US-035 AC-7 (decision 2): a preset change re-renders open reading views at once', () => {
    expect(main).toMatch(/previewMode\.rerender\(true\)/);
    expect(main).toMatch(/clearIconCache\(\)/);
  });
  it('US-035 AC-11: main.ts exposes the API as `api`', () => {
    expect(main).toMatch(/this\.api\s*=\s*createEntriesApi\(/);
  });
  it('US-035 AC-3: styles.css styles the o2t-sb- classes and loads nothing from the network', () => {
    const css = readFileSync('styles.css', 'utf8');
    expect(css).toMatch(/\.o2t-sb\b/);
    expect(css).toMatch(/\.o2t-sb-box\b/);
    expect(css).not.toMatch(/https?:\/\//);
  });
});
