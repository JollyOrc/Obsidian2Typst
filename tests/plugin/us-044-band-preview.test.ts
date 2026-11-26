// US-044 AC-6, AC-8 — the filled band in the Obsidian preview (SCAR-046: the
// second form of the output). The fake DOM shows what the processor draws: a
// class on the statblock and two custom properties; the stylesheet holds the
// rules that paint them. How it looks is checked by hand in Obsidian
// (SCAR-045, the manual check of US-044). Without `bandFill` the drawing is the
// 0.17.0 drawing (pinned at G2 from 0.17.0).
// Source of truth: docs/user-stories/US-044-filled-statblock-band.md.
// Red until US-044 is implemented (G2, 2026-11-26).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {
  createEntryProcessor,
  type PreviewDeps,
} from '../../src/plugin/entries/processor';
import {ENTRIES} from '../support/entries';
import {FakeEl} from '../support/fake-obsidian';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z" fill="#000"/></svg>';
const SOURCE = 'vigour: 6\nmight: 4\nwits: 2\nattacks:\n  - "Kick: 2d6"\n';

function render(
  statblock: Record<string, unknown> = {},
  colorMode?: string,
): Promise<FakeEl> {
  const deps: PreviewDeps = {
    settings: async () => ({
      entries: {...ENTRIES, statblock: {...ENTRIES.statblock, ...statblock}},
      ...(colorMode === undefined ? {} : {colorMode}),
    }),
    readIcon: async () => ICON,
    heading: () => 'Fen Hare',
    fileName: () => 'Rules',
    inContainer: () => false,
  };
  const el = new FakeEl();
  return createEntryProcessor(deps)
    .handler(SOURCE, el, {})
    .then(() => el);
}
const root = (el: FakeEl): FakeEl =>
  el.descendants().find((x) => x.classes.has('o2t-sb'))!;

/** The drawing as text: tags, classes, texts and custom properties, depth first. */
function shape(el: FakeEl, depth = 0): string {
  const props = Object.entries(el.cssProps)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
  const line = `${'  '.repeat(depth)}${el.tag}.${[...el.classes].sort().join('.')} "${el.text}" {${props}}`;
  return [line, ...el.children.map((c) => shape(c, depth + 1))].join('\n');
}

const FILLED = {bandFill: '#8A4A2A', bandColor: '#F3EEE3'};

describe('US-044 AC-6 the preview draws the filled band', () => {
  it('US-044 AC-6: a filled band marks the statblock and sets the two colours', async () => {
    const r = root(await render(FILLED));
    expect(r.classes.has('o2t-sb-filled')).toBe(true);
    expect(r.cssProps['--o2t-sb-band-fill']?.toLowerCase()).toBe('#8a4a2a');
    expect(r.cssProps['--o2t-sb-band-color']?.toLowerCase()).toBe('#f3eee3');
    // the band itself is drawn as before (US-041 AC-6): mark, name, mark
    const band = r.children[0]!;
    expect(band.classes.has('o2t-sb-band')).toBe(true);
    expect(band.children.map((c) => c.text)).toEqual(['◆', 'Fen Hare', '◆']);
  });

  it('US-044 AC-6 (SCAR-019): without bandColor the text colour is the accent', async () => {
    const r = root(await render({bandFill: '#8A4A2A'}));
    expect(r.classes.has('o2t-sb-filled')).toBe(true);
    expect(r.cssProps['--o2t-sb-band-color']).toBe(
      r.cssProps['--o2t-sb-accent'],
    );
  });

  it('US-044 AC-5, AC-6: greyscale: #4d4d4d and white', async () => {
    const r = root(await render(FILLED, 'grayscale'));
    expect(r.classes.has('o2t-sb-filled')).toBe(true);
    expect(r.cssProps['--o2t-sb-band-fill']).toBe('#4d4d4d');
    expect(r.cssProps['--o2t-sb-band-color']).toBe('#ffffff');
  });

  it('US-044 AC-6: the stylesheet paints the band and drops the rule under it', () => {
    const css = readFileSync('styles.css', 'utf8').replace(/\s+/g, ' ');
    const block = (selector: string): string => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `a rule for ${selector}`).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf('}', at));
    };
    const band = block('.o2t-sb-filled > .o2t-sb-band');
    expect(band).toContain('background: var(--o2t-sb-band-fill)');
    expect(band).toContain('color: var(--o2t-sb-band-color)');
    const next = block('.o2t-sb-filled > .o2t-sb-band + *');
    expect(next).toContain('border-top: none');
  });
});

describe('US-044 AC-8 without bandFill the preview is the 0.17.0 preview', () => {
  for (const [what, statblock, mode] of [
    ['unset', {}, undefined],
    ['none', {bandFill: 'none', bandColor: '#F3EEE3'}, undefined],
    ['greyscale, unset', {}, 'grayscale'],
  ] as const) {
    it(`US-044 AC-8: ${what}`, async () => {
      const el = await render(statblock, mode);
      expect(shape(root(el))).toBe(
        mode === undefined ? SHAPE_0_17_0 : SHAPE_GRAY_0_17_0,
      );
    });
  }
});

const SHAPE_0_17_0 =
  'div.o2t-sb "" {--o2t-sb-accent=#000000;--o2t-sb-box-fill=#ffffff;--o2t-sb-fill=transparent;--o2t-sb-frame=#000000;--o2t-sb-frame-width=0.75pt;--o2t-sb-rule=#000000;--o2t-sb-rule-width=0.4pt;--o2t-sb-size-attacks=0.7143em;--o2t-sb-size-band=1.0952em;--o2t-sb-size-label=0.5238em;--o2t-sb-size-skills=0.8571em;--o2t-sb-size-text=0.6667em;--o2t-sb-size-value=1.0476em}\n  div.o2t-sb-band "" {}\n    span.o2t-sb-mark "\u25c6" {}\n    span.o2t-sb-name "Fen Hare" {}\n    span.o2t-sb-mark "\u25c6" {}\n  div.o2t-sb-boxrow "" {}\n    div.o2t-sb-boxlabel "" {}\n      span. "VIGOUR" {}\n      span.o2t-sb-boxvalue "" {}\n        span. "6" {}\n    div.o2t-sb-boxes "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n  div.o2t-sb-track "" {}\n    div.o2t-sb-tracklabel "" {}\n      span. "STATE" {}\n    div.o2t-sb-cells "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n  div.o2t-sb-attributes "" {}\n    span. "Might 4 \u00b7 Wits 2 \u00b7 Speed \u2014" {}\n  div.o2t-sb-attacks "" {}\n    div.o2t-sb-attack "" {}\n      span.o2t-sb-attackname "" {}\n        span. "Kick" {}\n      span.o2t-sb-dice "" {}\n        span. "2d6" {}';
const SHAPE_GRAY_0_17_0 =
  'div.o2t-sb "" {--o2t-sb-accent=#4d4d4d;--o2t-sb-box-fill=#ffffff;--o2t-sb-fill=transparent;--o2t-sb-frame=#4d4d4d;--o2t-sb-frame-width=0.75pt;--o2t-sb-rule=#4d4d4d;--o2t-sb-rule-width=0.4pt;--o2t-sb-size-attacks=0.7143em;--o2t-sb-size-band=1.0952em;--o2t-sb-size-label=0.5238em;--o2t-sb-size-skills=0.8571em;--o2t-sb-size-text=0.6667em;--o2t-sb-size-value=1.0476em}\n  div.o2t-sb-band "" {}\n    span.o2t-sb-mark "\u25c6" {}\n    span.o2t-sb-name "Fen Hare" {}\n    span.o2t-sb-mark "\u25c6" {}\n  div.o2t-sb-boxrow "" {}\n    div.o2t-sb-boxlabel "" {}\n      span. "VIGOUR" {}\n      span.o2t-sb-boxvalue "" {}\n        span. "6" {}\n    div.o2t-sb-boxes "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n      span.o2t-sb-box "" {}\n  div.o2t-sb-track "" {}\n    div.o2t-sb-tracklabel "" {}\n      span. "STATE" {}\n    div.o2t-sb-cells "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n      span.o2t-sb-cell "" {}\n        img.o2t-sb-icon "" {}\n  div.o2t-sb-attributes "" {}\n    span. "Might 4 \u00b7 Wits 2 \u00b7 Speed \u2014" {}\n  div.o2t-sb-attacks "" {}\n    div.o2t-sb-attack "" {}\n      span.o2t-sb-attackname "" {}\n        span. "Kick" {}\n      span.o2t-sb-dice "" {}\n        span. "2d6" {}';
