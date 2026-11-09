// US-038 AC-6, AC-7, AC-9, AC-11 (Typst side), AC-13 — the Typst the row
// becomes: the exact call and its place, escaping, links and page numbers,
// grayscale, the join with what follows, and no change without the group.
// The PDF itself is read in tests/integration/us-038-details-pdf.test.ts.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {escapeMarkup} from '../../src/core/emit/escape-markup';
import {
  DETAILS_HELPER,
  LONG_NEEDS,
  detailWarnings,
  details,
  detailsCalls,
  runDetails,
} from '../support/details';

const HEAD = '###### Reed Weaving';

/** The lines of the typ from the heading `Reed Weaving` on. */
function after(typ: string): string[] {
  const lines = typ.split('\n');
  const at = lines.findIndex((l) => /^=+ Reed Weaving/.test(l));
  expect(at, 'heading line').toBeGreaterThan(-1);
  return lines.slice(at);
}

describe('US-038 AC-7 the call and its place', () => {
  it('US-038 AC-7: the heading line, a blank line, the call, a blank line, the body', async () => {
    const {typ} = await runDetails(
      details(HEAD, ['pace: brisk', 'kind: craft', 'needs: Basket Knots']),
    );
    const lines = after(typ);
    expect(lines[0]).toMatch(/^={6} Reed Weaving <h-reed-weaving>$/);
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(
      /^#o2t-details\(\(color: rgb\("#7a4a2e"\), size: 9\.5pt, items: \(\(icon: "[^"]+", body: \[Brisk\]\), \(icon: "[^"]+", body: \[Craft\]\), \(icon: "[^"]+", body: \[Basket Knots\]\)\)\)\)$/,
    );
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('You weave reeds into mats, baskets and rope.');
  });

  it('US-038 AC-7: the icons are the three different files, once each, by their vault names', async () => {
    const {typ, assets} = await runDetails(
      details(HEAD, ['pace: brisk', 'kind: craft', 'needs: Basket Knots']),
    );
    const paths = [
      ...(detailsCalls(typ)[0] ?? '').matchAll(/icon: "([^"]+)"/g),
    ].map((m) => m[1] as string);
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(3);
    expect(assets.map((a) => a.from).sort()).toEqual([
      'Icons/brisk.svg',
      'Icons/kind.svg',
      'Icons/lock.svg',
    ]);
    for (const a of assets) expect(paths).toContain(a.to);
  });

  it('US-038 AC-7: a badge without an icon has `icon: none`; the helper is defined once', async () => {
    const {typ} = await runDetails(details(HEAD, ['pace: soon']));
    expect(detailsCalls(typ)[0]).toContain('(icon: none, body: [soon])');
    expect(typ.split(`#let ${DETAILS_HELPER}(`)).toHaveLength(2);
  });

  it('US-038 AC-7: a heading with a figure after it: the row comes after the figure', async () => {
    const source = details('### Reed Weaving ![[Sample/assets/map.png]]', [
      'pace: slow',
    ]);
    const {typ} = await runDetails(source, {}, [
      'Sample/Rules.md',
      'Sample/assets/map.png',
      'Icons/slow.svg',
    ]);
    const lines = typ.split('\n');
    const call = lines.findIndex((l) => l.startsWith(`#${DETAILS_HELPER}(`));
    const figure = lines.findIndex((l) => l.includes('map.png'));
    expect(figure).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(figure);
  });

  it('US-038 AC-7: labels and values go through the one escaping function', async () => {
    const value = 'a_b #c *d* [e]';
    const {typ} = await runDetails(details(HEAD, [`needs: "${value}"`]));
    // a value is typeset: `*d*` is emphasis, the rest is escaped as at a block start
    const body = /body: \[([^\n]*)\]\),?\)\)\)$/m.exec(
      detailsCalls(typ)[0] ?? '',
    )?.[1];
    expect(body).toContain('a\\_b \\#c');
    expect(body).not.toContain('a_b #c');
    // a label from the preset is plain text, escaped
    const labelled = await runDetails(details(HEAD, ['starter: true']), {
      details: {items: [{key: 'starter', label: 'Fast_ #1 *x*'}]},
    });
    expect(detailsCalls(labelled.typ)[0]).toContain(
      `body: [${escapeMarkup('Fast_ #1 *x*', {atBlockStart: true})}]`,
    );
  });

  it('US-038 AC-7: an icon file that is not found keeps the text and warns once', async () => {
    const {typ, warnings} = await runDetails(
      details(HEAD, ['pace: brisk', 'kind: craft']),
      {},
      ['Sample/Rules.md', 'Icons/kind.svg'],
    );
    expect(detailsCalls(typ)[0]).toContain('(icon: none, body: [Brisk])');
    const missing = warnings.filter((w) => w.code === 'ASSET_MISSING');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.message).toContain('brisk.svg');
  });
});

describe('US-038 AC-7 a badge with nothing to show is left out', () => {
  it('US-038 AC-7: a flag with only an icon whose file is missing draws no row and warns once', async () => {
    const {typ, warnings} = await runDetails(
      details(HEAD, ['starter: true']),
      {details: {items: [{key: 'starter', icon: 'Icons/nofile.svg'}]}},
      ['Sample/Rules.md'],
    );
    expect(detailsCalls(typ)).toEqual([]);
    expect(typ).not.toContain('o2t-detail-icon');
    expect(warnings.filter((w) => w.code === 'ASSET_MISSING')).toHaveLength(1);
  });

  it('US-038 AC-7: the other badges of the row stay when one is empty', async () => {
    const {typ} = await runDetails(
      details(HEAD, ['starter: true', 'pace: brisk']),
      {
        details: {
          items: [
            {key: 'starter', icon: 'Icons/nofile.svg'},
            {key: 'pace', labels: {brisk: 'Brisk'}},
          ],
        },
      },
      ['Sample/Rules.md'],
    );
    const call = detailsCalls(typ)[0] ?? '';
    expect(call).toContain('items: ((icon: none, body: [Brisk]),)');
  });
});

describe('US-038 AC-7 an icon file that is missing warns once per file', () => {
  it('US-038 AC-7: two rows that name the same missing icon give one ASSET_MISSING', async () => {
    const source = [
      details('### First', ['pace: brisk']),
      '',
      details('### Second', ['pace: brisk']),
    ].join('\n');
    const {typ, warnings} = await runDetails(source, {}, ['Sample/Rules.md']);
    expect(detailsCalls(typ)).toHaveLength(2);
    expect(warnings.filter((w) => w.code === 'ASSET_MISSING')).toHaveLength(1);
  });
});

describe('US-038 AC-6 the look in the call', () => {
  it('US-038 AC-6: the preset sets colour and size; grayscale wins over the colour', async () => {
    const set = {
      details: {
        color: '#112233',
        size: 14,
        items: [{key: 'pace', icon: 'Icons/slow.svg'}],
      },
    };
    const colour = await runDetails(details(HEAD, ['pace: soon']), set);
    expect(detailsCalls(colour.typ)[0]).toContain(
      '(color: rgb("#112233"), size: 14pt,',
    );
    const gray = await runDetails(details(HEAD, ['pace: soon']), {
      ...set,
      colorMode: 'grayscale',
    });
    expect(detailsCalls(gray.typ)[0]).toContain(
      '(color: rgb("#4d4d4d"), size: 14pt,',
    );
  });

  it('US-038 AC-6: the helper draws icons 0.95em, raised 0.15em, a 1.1em gap, 0.45em below, not justified, sticky', async () => {
    const {typ} = await runDetails(details(HEAD, ['pace: slow']));
    const def = typ.slice(typ.indexOf(`#let o2t-detail-icon(`));
    expect(def).toContain('width: 0.95em');
    expect(def).toContain('height: 0.95em');
    expect(def).toContain('baseline: 0.15em');
    expect(def).toContain('h(1.1em)');
    expect(def).toContain('below: 0.45em');
    expect(def).toContain('above: 0pt');
    expect(def).toContain('sticky: true');
    expect(def).toContain('justify: false');
    // icon and label are bound by a non-breaking space (measured at G1)
    expect(def).toContain('~');
  });
});

describe('US-038 AC-9 links in values', () => {
  const NOTE = [
    '# Book',
    '',
    '### Basket Knots',
    '',
    'Knots for baskets and more of the same text.',
    '',
    details(HEAD, ['needs: "[[#Basket Knots|Basket Knots]]"']),
  ].join('\n');

  it('US-038 AC-9: a wikilink value stays an in-book link', async () => {
    const {typ, warnings} = await runDetails(NOTE);
    expect(detailsCalls(typ)[0]).toContain(
      'body: [#link(<h-basket-knots>)[Basket Knots]]',
    );
    expect(detailWarnings(warnings)).toEqual([]);
    expect(warnings.map((w) => w.code)).not.toContain('LINK_UNRESOLVED');
  });

  it('US-038 AC-9: the page number follows under the body-text rule: switch, folios and level', async () => {
    const on = {
      linkPageNumbers: true,
      pageFurniture: {folios: true},
      linkPageLevel: 3,
    };
    const withRef = await runDetails(NOTE, on);
    expect(detailsCalls(withRef.typ)[0]).toContain(
      'body: [#link(<h-basket-knots>)[Basket Knots]#page-ref(<h-basket-knots>)]',
    );
    // the same link in body text gets one at this level; the rule is the same
    const body = await runDetails(
      NOTE.replace(/^```o2t-details[\s\S]*?```$/m, '').replace(
        'You weave',
        'See [[#Basket Knots|Basket Knots]]. You weave',
      ),
      on,
    );
    expect(body.typ).toContain(
      '#link(<h-basket-knots>)[Basket Knots]#page-ref(<h-basket-knots>)',
    );
    // a link to a heading deeper than the level gets none, in the row as in the text
    const deep = await runDetails(NOTE, {...on, linkPageLevel: 2});
    expect(detailsCalls(deep.typ)[0]).not.toContain('#page-ref');
    expect(detailsCalls(deep.typ)[0]).toContain(
      '#link(<h-basket-knots>)[Basket Knots]',
    );
    // without the switch none
    const off = await runDetails(NOTE, {
      pageFurniture: {folios: true},
      linkPageNumbers: false,
    });
    expect(detailsCalls(off.typ)[0]).not.toContain('#page-ref');
  });

  it('US-038 AC-9: a Markdown link value is read the same; an unresolved link warns as in body text and keeps its text', async () => {
    const md = await runDetails(
      NOTE.replace(
        'needs: "[[#Basket Knots|Basket Knots]]"',
        'needs: "[Knots](#Basket%20Knots)"',
      ),
    );
    expect(detailsCalls(md.typ)[0]).toContain('#link(<h-basket-knots>)[Knots]');
    const lost = await runDetails(
      NOTE.replace(
        '[[#Basket Knots|Basket Knots]]',
        '[[#No Such Heading|Gone Away]]',
      ),
    );
    expect(detailsCalls(lost.typ)[0]).toContain('Gone Away');
    expect(
      lost.warnings.filter((w) => w.code === 'LINK_UNRESOLVED'),
    ).toHaveLength(1);
  });

  it('US-038 AC-9: a value replaced by a label is plain text, never a link', async () => {
    const {typ} = await runDetails(NOTE, {
      details: {
        items: [{key: 'needs', icon: 'Icons/lock.svg', label: 'Requirement'}],
      },
    });
    expect(detailsCalls(typ)[0]).toContain('body: [Requirement]');
    expect(detailsCalls(typ)[0]).not.toContain('#link(');
  });

  it('US-038 AC-9: an image or an embed in a value prints its alt text or name, never an image', async () => {
    const image = await runDetails(
      details(HEAD, ['needs: "![A tall reed](Sample/assets/map.png)"']),
      {},
      ['Sample/Rules.md', 'Sample/assets/map.png', 'Icons/lock.svg'],
    );
    expect(detailsCalls(image.typ)[0]).toContain('body: [A tall reed]');
    expect(image.assets.map((a) => a.from)).not.toContain(
      'Sample/assets/map.png',
    );
    const embed = await runDetails(
      details(HEAD, ['needs: "![[Basket Knots]]"']),
    );
    expect(detailsCalls(embed.typ)[0]).toContain('body: [Basket Knots]');
  });
});

describe('US-038 AC-11 what the row joins (Typst text)', () => {
  const FOLLOWERS: [string, string[]][] = [
    ['a list', ['- one', '- two']],
    ['a table', ['| a | b |', '|---|---|', '| 1 | 2 |']],
    ['a quote', ['> quoted words']],
    ['a code block', ['```', 'code', '```']],
    ['a callout', ['> [!note] Title', '> body']],
  ];
  for (const [name, lines] of FOLLOWERS) {
    it(`US-038 AC-11: ${name} directly after the block: the row ends at its own line, the follower is intact`, async () => {
      const source = details(HEAD, ['pace: slow'], lines);
      const {typ} = await runDetails(source);
      const out = after(typ);
      expect(out[2]).toMatch(/^#o2t-details\(.*\)\)\)$/);
      expect(out[3]).toBe('');
      expect(out.slice(4).join('\n')).not.toContain('o2t-details(');
      expect(out.slice(4).join('\n').length).toBeGreaterThan(0);
    });
  }

  for (const [value, escaped] of [
    ['- x', '\\- x'],
    ['# x', '\\# x'],
    ['[x] y', '\\[x\\] y'],
    ['1. x', '1\\. x'],
    ['> x', '\\> x'],
  ] as const) {
    it(`US-038 AC-11: a value starting with ${JSON.stringify(value.slice(0, 2))} is text at the start of the badge`, async () => {
      const {typ} = await runDetails(details(HEAD, [`needs: "${value}"`]));
      expect(detailsCalls(typ)[0]).toContain(`body: [${escaped}]`);
    });
  }

  it('US-038 AC-11: bold in a value is typeset (the preview and the PDF read the same value)', async () => {
    const {typ} = await runDetails(details(HEAD, ['needs: "a **firm** hand"']));
    expect(detailsCalls(typ)[0]).toContain('body: [a *firm* hand]');
  });

  it('US-038 AC-11: two headings with a block each give two rows, in order', async () => {
    const source = [
      details('### First', ['pace: slow']),
      '',
      details('### Second', ['pace: swift']),
    ].join('\n');
    const {typ} = await runDetails(source);
    const calls = detailsCalls(typ);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('[Slow]');
    expect(calls[1]).toContain('[Swift]');
  });

  it('US-038 AC-11: the row is not a heading: the contents and outline are those of the note without the block', async () => {
    const withBlock = await runDetails(details(HEAD, ['pace: slow']), {
      toc: {depth: 6},
    });
    const without = await runDetails(
      details(HEAD, ['pace: slow']).replace(/```o2t-details[\s\S]*?```\n/, ''),
      {toc: {depth: 6}},
    );
    const headings = (t: string): string[] =>
      t.split('\n').filter((l) => /^=+ /.test(l));
    expect(headings(withBlock.typ)).toEqual(headings(without.typ));
    expect(detailsCalls(withBlock.typ)[0]).not.toMatch(/heading\(/);
  });
});

describe('US-038 AC-13 no change without the group or the blocks', () => {
  const NOTE = [
    '# Book',
    '',
    details('### Reed Weaving', ['pace: brisk', 'kind: craft']),
    '',
    'More text.',
  ].join('\n');
  const STRIPPED = NOTE.replace(/```o2t-details[\s\S]*?```\n/, '');

  it('US-038 AC-13: a preset without the group converts as the note with the blocks removed, byte for byte, no warning, no helper', async () => {
    const a = await runDetails(NOTE, {details: undefined});
    const b = await runDetails(STRIPPED, {details: undefined});
    expect(a.typ).toBe(b.typ);
    expect(a.typ).not.toContain('o2t-details');
    expect(a.typ).not.toContain('o2t-detail-icon');
    expect(detailWarnings(a.warnings)).toEqual([]);
    expect(a.assets).toEqual(b.assets);
  });

  it('US-038 AC-13: an empty items list draws nothing, and warns nothing', async () => {
    const a = await runDetails(NOTE, {details: {items: []}});
    const b = await runDetails(STRIPPED, {details: undefined});
    expect(a.typ).toBe(b.typ);
    expect(detailWarnings(a.warnings)).toEqual([]);
  });

  it('US-038 AC-13: a note without blocks has no helper in the preamble even with the group', async () => {
    const a = await runDetails(STRIPPED);
    expect(a.typ).not.toContain('o2t-details');
    expect(a.typ).not.toContain('o2t-detail-icon');
  });

  it('US-038 AC-13: a block that gives no row (all values empty) leaves no helper either', async () => {
    const a = await runDetails(
      details('### Reed Weaving', ['pace: ""', 'starter: false']),
    );
    expect(a.typ).not.toContain('o2t-detail-icon');
    expect(LONG_NEEDS.length).toBe(57);
  });
});
