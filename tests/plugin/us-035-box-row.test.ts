// US-035 AC-12 — the box row of the on-screen statblock stays inside the
// frame: `styles.css` gives it `minmax(0, 1fr)` columns in three groups of
// five with narrow gap columns, places boxes 6 and 11 of each row of 15 after
// those gap columns, and gives no box a margin. Measured in WebKit before the
// rules were written (story AC-12); this test pins the rules as written, so
// a change to them is a change of the story.
// Source of truth: docs/user-stories/US-035-entry-block-preview-in-obsidian.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

interface Rule {
  selectors: string[];
  decls: Map<string, string>;
}

/**
 * US-035 AC-12: reads the top-level rules of a plain CSS file.
 *
 * Removes comments, splits at `}` and `{`, splits selectors at `,` and
 * declarations at `;`, and collapses runs of white space to one blank.
 * Assumes no at-rules, nested rules or strings containing braces or
 * semicolons (the plugin's `styles.css` has none; checked below).
 */
function readRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  for (const chunk of text.split('}')) {
    if (chunk.trim() === '') continue;
    const [head, body] = chunk.split('{');
    if (head === undefined || body === undefined) throw new Error(chunk);
    const decls = new Map<string, string>();
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      decls.set(
        d.slice(0, i).trim(),
        d
          .slice(i + 1)
          .replace(/\s+/g, ' ')
          .trim(),
      );
    }
    const selectors = head.split(',').map((s) => s.replace(/\s+/g, ' ').trim());
    rules.push({selectors, decls});
  }
  return rules;
}

const css = readFileSync('styles.css', 'utf8');
const rules = readRules(css);
const only = (selector: string): Rule => {
  const found = rules.filter((r) => r.selectors.includes(selector));
  expect(found, selector).toHaveLength(1);
  return found[0] as Rule;
};
/** A selector naming the box itself (not `-boxrow`, `-boxes`, …). */
const BOX = /\.o2t-sb-box(?![\w-])/;
const GROUP = 'repeat(5, minmax(0, 1fr))';

describe('US-035 AC-12 the CSS reader of this test (SCAR-028)', () => {
  it('reads selectors, declarations and blanks of a known input', () => {
    const got = readRules(
      '/* a { b: c } */\n.x,\n.y:nth-child(2n + 1) {\n  a: 1;\n  b:\n    f(1, 2)  3;\n}\n.z { c: d }',
    );
    expect(got.map((r) => r.selectors)).toEqual([
      ['.x', '.y:nth-child(2n + 1)'],
      ['.z'],
    ]);
    expect([...(got[0] as Rule).decls]).toEqual([
      ['a', '1'],
      ['b', 'f(1, 2) 3'],
    ]);
    expect((got[1] as Rule).decls.get('c')).toBe('d');
  });
  it('styles.css has no at-rule and no nested rule (the reader would misread them)', () => {
    expect(css).not.toMatch(/@/);
    for (const r of rules)
      expect(r.selectors.join(','), 'nested').not.toMatch(/[{;]/);
  });
});

describe('US-035 AC-12 the box row stays inside the frame', () => {
  it('the box row gives the boxes a column that can shrink: auto minmax(0, 1fr)', () => {
    expect(only('.o2t-sb-boxrow').decls.get('grid-template-columns')).toBe(
      'auto minmax(0, 1fr)',
    );
  });
  it('the boxes have three groups of five shrinkable columns with a 0.2em column between them', () => {
    expect(only('.o2t-sb-boxes').decls.get('grid-template-columns')).toBe(
      `${GROUP} 0.2em ${GROUP} 0.2em ${GROUP}`,
    );
  });
  it('a box may shrink below its content: min-width 0', () => {
    expect(only('.o2t-sb-box').decls.get('min-width')).toBe('0');
  });
  it('boxes 6 and 11 of each row of 15 start the second and third group, after the gap columns', () => {
    // The gap columns are the tracks of the template that are not a group.
    const tracks = (
      only('.o2t-sb-boxes').decls.get('grid-template-columns') ?? ''
    )
      .split(GROUP)
      .flatMap((s, i, all) =>
        i < all.length - 1
          ? [s.trim(), ...Array<string>(5).fill('fr')]
          : [s.trim()],
      )
      .filter((t) => t !== '');
    expect(tracks).toHaveLength(17);
    const gaps = tracks.flatMap((t, i) => (t === 'fr' ? [] : [i + 1]));
    expect(gaps).toEqual([6, 12]);
    expect(
      only('.o2t-sb-box:nth-child(15n + 6)').decls.get('grid-column'),
    ).toBe(String((gaps[0] as number) + 1));
    expect(
      only('.o2t-sb-box:nth-child(15n + 11)').decls.get('grid-column'),
    ).toBe(String((gaps[1] as number) + 1));
  });
  it('no rule gives a box a margin (margins on 1fr columns pushed the row past the frame)', () => {
    const boxRules = rules.filter((r) => r.selectors.some((s) => BOX.test(s)));
    // Every selector naming the box was read (SCAR-023: count the places).
    const named = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\.o2t-sb-box(?![\w-])[^,{]*/g);
    expect(
      boxRules.flatMap((r) => r.selectors.filter((s) => BOX.test(s))),
    ).toHaveLength(named?.length ?? 0);
    expect(boxRules.length).toBeGreaterThan(0);
    for (const r of boxRules) {
      for (const key of r.decls.keys()) {
        expect(key, r.selectors.join(', ')).not.toMatch(/^margin/);
      }
    }
  });
});
