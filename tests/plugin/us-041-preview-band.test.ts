// US-041 AC-6 — the band in the Obsidian preview: three parts in a row (the left
// mark, the name, the right mark), the band's text content still `◆ name ◆`, and
// the CSS that puts the marks level with the middle of the name block. The fake
// DOM has no layout, so the drawing's look is checked by hand in Obsidian (the
// manual check M30, SCAR-045); here the structure and the stylesheet's
// declarations are checked, each whole rule (SCAR-023). Names are invented
// (SCAR-035). Source of truth: docs/user-stories/US-041-statblock-band-marks.md.
// Red until US-041 is implemented (G2, 2026-11-16).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ENTRIES, FEN_HARE_YAML} from '../support/entries';
import {FakeEl} from '../support/fake-obsidian';

const PROCESSOR = '../../src/plugin/entries/processor';
interface PreviewDeps {
  settings(): Promise<{entries?: unknown; colorMode?: string} | null>;
  readIcon(path: string): Promise<string | null>;
  heading(ctx: unknown): string | null;
  fileName(ctx: unknown): string;
  inContainer(ctx: unknown): boolean;
}
interface ProcessorModule {
  createEntryProcessor(deps: PreviewDeps): {
    handler: (source: string, el: unknown, ctx: unknown) => Promise<void>;
  };
  createEntriesApi(deps: PreviewDeps): {
    renderStatblock(
      el: unknown,
      data: Record<string, unknown>,
      options?: {heading?: string},
    ): Promise<unknown>;
  };
}
const load = async (): Promise<ProcessorModule> => {
  const path: string = PROCESSOR;
  return (await import(/* @vite-ignore */ path)) as ProcessorModule;
};
const deps = (heading: string | null = 'Fen Hare'): PreviewDeps => ({
  settings: async () => ({entries: ENTRIES}),
  readIcon: async () => null,
  heading: () => heading,
  fileName: () => 'Rules',
  inContainer: () => false,
});
const SOURCE = FEN_HARE_YAML.join('\n') + '\n';
const withClass = (el: FakeEl, cls: string): FakeEl[] =>
  el.descendants().filter((x) => x.classes.has(cls));
const textOf = (el: FakeEl): string =>
  [el.text, ...el.descendants().map((x) => x.text)].join(' ');

async function bandOf(heading: string | null): Promise<FakeEl> {
  const {createEntryProcessor} = await load();
  const el = new FakeEl();
  await createEntryProcessor(deps(heading)).handler(SOURCE, el, {});
  const bands = withClass(el, 'o2t-sb-band');
  expect(bands, 'one band').toHaveLength(1);
  return bands[0] as FakeEl;
}

describe('US-041 AC-6 the preview draws the band as three parts', () => {
  it('Fen Hare: the band row holds the left mark, the name and the right mark, in this order', async () => {
    const band = await bandOf('Fen Hare');
    expect(
      band.children.map((c) => [c.tag, [...c.classes].sort(), c.text]),
    ).toEqual([
      ['span', ['o2t-sb-mark'], '◆'],
      ['span', ['o2t-sb-name'], 'Fen Hare'],
      ['span', ['o2t-sb-mark'], '◆'],
    ]);
  });

  it('the band reads `◆ Fen Hare ◆` as before (the text of its parts, in order)', async () => {
    const band = await bandOf('Fen Hare');
    expect(textOf(band)).toContain('◆ Fen Hare ◆');
  });

  it('a long name stays one name element (the browser wraps it between the marks)', async () => {
    const band = await bandOf('Old Marsh Dragon of the Grey Reaches');
    const name = withClass(band, 'o2t-sb-name');
    expect(name).toHaveLength(1);
    expect((name[0] as FakeEl).text).toBe(
      'Old Marsh Dragon of the Grey Reaches',
    );
    expect(withClass(band, 'o2t-sb-mark')).toHaveLength(2);
  });

  it('the name is set as text, not as markup (a name with angle brackets stays text)', async () => {
    const band = await bandOf('<b>Fen</b> & Hare');
    const name = withClass(band, 'o2t-sb-name')[0] as FakeEl;
    expect(name.text).toBe('<b>Fen</b> & Hare');
    expect(name.children).toEqual([]);
  });

  it('the drawing API: a statblock without a name shows `◆ — ◆` in the same three parts', async () => {
    const {createEntriesApi} = await load();
    const api = createEntriesApi(deps());
    const el = new FakeEl();
    await api.renderStatblock(el, {might: 4, attacks: ['Kick: 2d6']});
    const band = withClass(el, 'o2t-sb-band')[0] as FakeEl;
    expect(band.children.map((c) => c.text)).toEqual(['◆', '—', '◆']);
    expect(textOf(band)).toContain('◆ — ◆');
  });
});

/** The declarations of the rule whose selector is exactly `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const own = rules.filter((r) =>
    (r[1] as string)
      .split(',')
      .map((s) => s.trim())
      .includes(selector),
  );
  expect(own.length, `a rule for ${selector}`).toBeGreaterThan(0);
  const out = new Map<string, string>();
  for (const r of own)
    for (const d of (r[2] as string).split(';')) {
      const at = d.indexOf(':');
      if (at > 0) out.set(d.slice(0, at).trim(), d.slice(at + 1).trim());
    }
  return out;
}

describe('US-041 AC-6 the stylesheet puts the marks level with the name block', () => {
  const css = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

  it('.o2t-sb-band is a centred flex row whose items are centred vertically, with a quarter-em gap', () => {
    const d = declarations(css, '.o2t-sb-band');
    expect(d.get('display')).toBe('flex');
    expect(d.get('align-items')).toBe('center');
    expect(d.get('justify-content')).toBe('center');
    expect(d.get('column-gap')).toBe('0.25em');
    // the band's look is kept
    expect(d.get('color')).toBe('var(--o2t-sb-accent)');
    expect(d.get('font-family')).toBe('var(--o2t-sb-font-band, inherit)');
    expect(d.get('font-size')).toBe('var(--o2t-sb-size-band, 1.1em)');
  });

  it('.o2t-sb-name centres its lines and may shrink so that it wraps between the marks', () => {
    const d = declarations(css, '.o2t-sb-name');
    expect(d.get('text-align')).toBe('center');
    expect(d.get('min-width')).toBe('0');
    expect(d.get('flex')).toBe('0 1 auto');
  });

  it('.o2t-sb-mark keeps its size (it does not shrink)', () => {
    const d = declarations(css, '.o2t-sb-mark');
    expect(d.get('flex')).toBe('none');
  });
});
