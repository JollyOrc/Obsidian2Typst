// US-038 AC-14, AC-15 — the `o2t-details` preview in Obsidian and the drawing
// API: the processor's output, notices instead of a row, icons read once per
// path and recoloured, reads at render time, link values as Obsidian links,
// no click handlers, the API (`renderDetails`, `version` 1, one object with
// `renderStatblock`), and the wiring in main.ts and styles.css.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {DETAILS_E} from '../support/details';
import {FakeEl} from '../support/fake-obsidian';

const PROCESSOR = '../../src/plugin/details/processor';
interface DetailsDeps {
  settings(): Promise<{details?: unknown; colorMode?: string} | null>;
  readIcon(path: string): Promise<string | null>;
  heading(ctx: unknown): string | null;
  fileName(ctx: unknown): string;
  inContainer(ctx: unknown): boolean;
}
interface ProcessorModule {
  createDetailsProcessor(deps: DetailsDeps): {
    handler: (source: string, el: unknown, ctx: unknown) => Promise<void>;
    clearIconCache(): void;
  };
  createDetailsApi(deps: DetailsDeps): {
    renderDetails(
      el: unknown,
      data: Record<string, unknown>,
      options?: {heading?: string},
    ): Promise<{badges: unknown[]}>;
    clearIconCache(): void;
  };
  composeApi(
    entries: {
      version: number;
      renderStatblock: unknown;
      clearIconCache(): void;
    },
    details: {renderDetails: unknown; clearIconCache(): void},
  ): {
    version: number;
    renderStatblock: unknown;
    renderDetails: unknown;
    clearIconCache(): void;
  };
}
const load = async (): Promise<ProcessorModule> => {
  const path: string = PROCESSOR;
  return (await import(/* @vite-ignore */ path)) as ProcessorModule;
};

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z" fill="#000"/></svg>';

function deps(over: Partial<DetailsDeps> = {}) {
  const calls = {settings: 0, icons: [] as string[]};
  let current: {details?: unknown; colorMode?: string} | null = {
    details: DETAILS_E,
  };
  const d: DetailsDeps = {
    settings: async () => {
      calls.settings++;
      return current;
    },
    readIcon: async (p) => {
      calls.icons.push(p);
      return ICON;
    },
    heading: () => 'Reed Weaving',
    fileName: () => 'Rules',
    inContainer: () => false,
    ...over,
  };
  return {d, calls, set: (v: typeof current) => (current = v)};
}
const SOURCE = 'pace: brisk\nkind: craft\nneeds: Basket Knots\n';
const textOf = (el: FakeEl): string =>
  [el.text, ...el.descendants().map((x) => x.text)].join(' ');
const withClass = (el: FakeEl, cls: string): FakeEl[] =>
  el.descendants().filter((x) => x.classes.has(cls));

describe('US-038 AC-14 the processor draws the row', () => {
  it('US-038 AC-14: the example block shows three badges in the preset order, each with its icon', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    const {d} = deps();
    await createDetailsProcessor(d).handler(SOURCE, el, {});
    const items = withClass(el, 'o2t-dt-item');
    expect(items.map((i) => textOf(i).replace(/\s+/g, ' ').trim())).toEqual([
      'Brisk',
      'Craft',
      'Basket Knots',
    ]);
    for (const item of items) {
      const imgs = item.descendants().filter((x) => x.tag === 'img');
      expect(imgs).toHaveLength(1);
      expect(imgs[0]?.classes.has('o2t-dt-icon')).toBe(true);
    }
    expect(withClass(el, 'o2t-dt')).toHaveLength(1);
  });

  it('US-038 AC-14: colour and size are CSS custom properties; icons are read through the vault once per path and recoloured', async () => {
    const {createDetailsProcessor} = await load();
    const {d, calls, set} = deps();
    set({details: {...DETAILS_E, color: '#336699', size: 10.5}});
    const el = new FakeEl();
    const p = createDetailsProcessor(d);
    await p.handler(SOURCE, el, {});
    await p.handler(SOURCE, new FakeEl(), {});
    const root = withClass(el, 'o2t-dt')[0] ?? el;
    expect(Object.values(root.cssProps)).toEqual(
      expect.arrayContaining(['#336699', '1em']),
    );
    expect([...new Set(calls.icons)].sort()).toEqual([
      'Icons/brisk.svg',
      'Icons/kind.svg',
      'Icons/lock.svg',
    ]);
    expect(calls.icons).toHaveLength(3);
    const src = withClass(el, 'o2t-dt-icon')[0]?.attrs['src'] ?? '';
    expect(decodeURIComponent(src)).toContain('fill="#336699"');
    expect(decodeURIComponent(src)).not.toContain('fill="#000"');
  });

  it('US-038 AC-14: grayscale draws the row in #4d4d4d', async () => {
    const {createDetailsProcessor} = await load();
    const {d, set} = deps();
    set({details: DETAILS_E, colorMode: 'grayscale'});
    const el = new FakeEl();
    await createDetailsProcessor(d).handler(SOURCE, el, {});
    const root = withClass(el, 'o2t-dt')[0] ?? el;
    expect(Object.values(root.cssProps)).toContain('#4d4d4d');
  });

  it('US-038 AC-14: a link value is an Obsidian internal link, a Markdown link an external one; bold is typeset', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    await createDetailsProcessor(deps().d).handler(
      'needs: "[[#Basket Knots|Basket Knots]] and [site](https://example.org) and **firm**"\n',
      el,
      {},
    );
    const links = el.descendants().filter((x) => x.tag === 'a');
    expect(
      links.map((a) => [
        a.text,
        a.attrs['data-href'] ?? a.attrs['href'],
        a.classes.has('internal-link'),
      ]),
    ).toEqual([
      ['Basket Knots', '#Basket Knots', true],
      ['site', 'https://example.org', false],
    ]);
    expect(
      el.descendants().some((x) => x.tag === 'strong' && x.text === 'firm'),
    ).toBe(true);
  });

  it('US-038 AC-14: the value checks are a notice line under the row; a block with no badge draws nothing', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    await createDetailsProcessor(deps().d).handler(
      'pace: soon\nkind: [a, b]\n',
      el,
      {},
    );
    expect(textOf(el)).toContain('DETAIL_VALUE_UNMAPPED');
    expect(textOf(el)).toContain('DETAIL_VALUE_NOT_TEXT');
    expect(withClass(el, 'o2t-dt-item').map(textOf).join('|')).toContain(
      'soon',
    );
    const none = new FakeEl();
    await createDetailsProcessor(deps().d).handler('{}\n', none, {});
    expect(none.descendants()).toHaveLength(0);
    const flag = new FakeEl();
    await createDetailsProcessor(deps().d).handler(
      'starter: false\n',
      flag,
      {},
    );
    expect(flag.descendants()).toHaveLength(0);
  });
});

describe('US-038 AC-14 notices instead of a row', () => {
  it('US-038 AC-14: no valid active preset → the raw block with one notice', async () => {
    const {createDetailsProcessor} = await load();
    const {d, set} = deps();
    set(null);
    const el = new FakeEl();
    await createDetailsProcessor(d).handler(SOURCE, el, {});
    expect(textOf(el)).toContain(
      'No details row: the active preset has no details settings.',
    );
    expect(textOf(el)).toContain('pace: brisk');
    expect(withClass(el, 'o2t-dt')).toHaveLength(0);
  });

  it('US-038 AC-14: a preset without the group, or with empty items → the same notice', async () => {
    const {createDetailsProcessor} = await load();
    for (const details of [undefined, {items: []}]) {
      const {d, set} = deps();
      set({details});
      const el = new FakeEl();
      await createDetailsProcessor(d).handler(SOURCE, el, {});
      expect(textOf(el)).toContain('No details row:');
    }
  });

  it('US-038 AC-14: invalid YAML → the raw block with the code and the line', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    await createDetailsProcessor(deps().d).handler('a: 1\nb: [2\n', el, {});
    expect(textOf(el)).toMatch(/DETAIL_YAML_INVALID \(line \d+\)/);
    expect(textOf(el)).toContain('b: [2');
  });

  it('US-038 AC-14: a block in a quote or callout → the raw block with DETAIL_BLOCK_IN_CONTAINER', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    await createDetailsProcessor(deps({inContainer: () => true}).d).handler(
      SOURCE,
      el,
      {},
    );
    expect(textOf(el)).toContain('DETAIL_BLOCK_IN_CONTAINER');
    expect(withClass(el, 'o2t-dt')).toHaveLength(0);
  });
});

describe('US-038 AC-14 the preset is read each time a block is drawn', () => {
  it('US-038 AC-14: a change of the active preset shows at the next draw; the icon cache is cleared on request', async () => {
    const {createDetailsProcessor} = await load();
    const {d, calls, set} = deps();
    const p = createDetailsProcessor(d);
    await p.handler(SOURCE, new FakeEl(), {});
    set({details: {items: [{key: 'pace', labels: {brisk: 'Quick'}}]}});
    const el = new FakeEl();
    await p.handler(SOURCE, el, {});
    expect(withClass(el, 'o2t-dt-item').map(textOf).join('|')).toContain(
      'Quick',
    );
    expect(calls.settings).toBe(2);
    const before = calls.icons.length;
    set({details: DETAILS_E});
    await p.handler(SOURCE, new FakeEl(), {});
    expect(calls.icons.length).toBe(before);
    p.clearIconCache();
    await p.handler(SOURCE, new FakeEl(), {});
    expect(calls.icons.length).toBe(before + 3);
  });

  it('US-038 AC-14: no click handlers on the row', async () => {
    const {createDetailsProcessor} = await load();
    const el = new FakeEl();
    await createDetailsProcessor(deps().d).handler(SOURCE, el, {});
    for (const x of el.descendants()) expect(x.listenerCount('click')).toBe(0);
  });
});

describe('US-038 AC-15 the API', () => {
  it('US-038 AC-15: renderDetails draws the same row for a plain object (keys in any case) and returns the badges in drawn order', async () => {
    const {createDetailsApi} = await load();
    const el = new FakeEl();
    const api = createDetailsApi(deps().d);
    const out = await api.renderDetails(el, {
      Pace: 'brisk',
      KIND: 'craft',
      needs: 3,
      starter: true,
    });
    expect(out.badges).toHaveLength(4);
    expect(withClass(el, 'o2t-dt-item').map((i) => textOf(i).trim())).toEqual([
      'Brisk',
      'Craft',
      '3',
      'Known from the start',
    ]);
    for (const b of out.badges)
      expect((b as FakeEl).listenerCount('click')).toBe(0);
  });

  it('US-038 AC-15: without a details group it draws the notice and returns an empty list; a list value is left out with a notice', async () => {
    const {createDetailsApi} = await load();
    const {d, set} = deps();
    set({details: undefined});
    const el = new FakeEl();
    const none = await createDetailsApi(d).renderDetails(el, {pace: 'slow'});
    expect(none.badges).toEqual([]);
    expect(textOf(el)).toContain(
      'No details row: the active preset has no details settings.',
    );
    set({details: DETAILS_E});
    const el2 = new FakeEl();
    const out = await createDetailsApi(d).renderDetails(
      el2,
      {kind: ['a'], pace: 'slow'},
      {heading: 'Reed Weaving'},
    );
    expect(out.badges).toHaveLength(1);
    expect(textOf(el2)).toContain('DETAIL_VALUE_NOT_TEXT');
    expect(textOf(el2)).toContain('Reed Weaving');
  });

  it('US-038 AC-15: one api object: version 1, renderStatblock kept, renderDetails added, clearIconCache clears both', async () => {
    const {composeApi} = await load();
    let cleared = 0;
    const renderStatblock = () => 'sb';
    const renderDetails = () => 'dt';
    const api = composeApi(
      {version: 1, renderStatblock, clearIconCache: () => void cleared++},
      {renderDetails, clearIconCache: () => void cleared++},
    );
    expect(api.version).toBe(1);
    expect(api.renderStatblock).toBe(renderStatblock);
    expect(api.renderDetails).toBe(renderDetails);
    api.clearIconCache();
    expect(cleared).toBe(2);
  });
});

describe('US-038 AC-14, AC-16 the wiring', () => {
  const main = readFileSync('src/plugin/main.ts', 'utf8');
  const css = readFileSync('styles.css', 'utf8');

  it('US-038 AC-14: main.ts registers the processor for o2t-details with the same hand-over as the statblock', () => {
    expect(main).toContain(
      "this.registerMarkdownCodeBlockProcessor('o2t-details', (source, el, ctx) =>\n      this.detailsProcessor.handler(source, el, {ctx, el}),",
    );
  });

  it('US-038 AC-14, AC-16: main.ts only hands over: the api is composed by composeApi, the preset change clears both caches', () => {
    expect(main).toContain('this.api = composeApi(');
    expect(main).toMatch(/this\.detailsProcessor\.clearIconCache\(\)/);
    expect(main).not.toContain('renderDetails(');
  });

  it('US-038 AC-14: the styles name the row, its items and icons; the items wrap and the icon is 0.95em', () => {
    for (const cls of ['.o2t-dt ', '.o2t-dt-item', '.o2t-dt-icon']) {
      expect(css, cls).toContain(cls);
    }
    expect(css).toMatch(/\.o2t-dt\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.o2t-dt-icon\s*\{[^}]*0\.95em/);
    expect(css).toMatch(/\.o2t-dt\s*\{[^}]*column-gap:\s*1\.1em/);
  });
});
