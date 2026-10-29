// US-028 AC-1 to AC-7, AC-10, AC-12 — images that stay with their text, in the
// core: the field `images.minScale`, which images the rule applies to, the two
// lines written per image (probe and call) with their arguments, the reserve
// of each container, no float before a page break, the helper and its names,
// the warnings made from the decisions read back after a compile, and today's
// output at 100. The pages are in tests/integration/us-028-image-fit-pdf.test.ts,
// the row and the preview in tests/plugin/us-028-image-rows.test.ts.
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import * as emit from '../../src/core/emit';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {PLUGIN_NAMES} from '../../src/core/template';
import {A5_PRINT, NOTE_PATH, SETTINGS, run} from '../support/convert';
import {readManifest, readSample} from '../support/sample';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const convertWith = (
  source: string,
  minScale: number,
  over: Partial<ConvertSettings> & Record<string, unknown> = {},
) =>
  run(source, {
    settings: {
      ...SETTINGS,
      ...over,
      images: {minScale},
    } as ConvertSettings,
  });

// AC-3 as amended (decision 11): the probe keeps the normal space above it.
const PROBE = (n: number) =>
  `#block(height: 0pt, below: 0pt, width: 100%)[] <o2t-fit-${n}>`;

/** The `#fit-flow(` lines of `typ`, in order. */
const calls = (typ: string): string[] =>
  typ
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#fit-flow('));

/** US-028 AC-5: the core function under its expected name (red until the code). */
type Decision = {d: string; line: number; name: string};
type Warning = {code: string; message: string; line: number};
function fitWarnings(decisions: unknown[]): Warning[] {
  const fn = (emit as unknown as Record<string, (d: unknown[]) => Warning[]>)[
    'fitDecisionWarnings'
  ];
  expect(typeof fn, 'fitDecisionWarnings').toBe('function');
  return (fn as (d: unknown[]) => Warning[])(decisions);
}

describe('US-028 AC-1 the field images.minScale', () => {
  it('US-028 AC-1: reads 10, 70 and 100; refuses others with the message of the story', () => {
    for (const value of [10, 70, 100]) {
      expect(errorOf('images:', `  minScale: ${value}`), `${value}`).toBeNull();
    }
    for (const value of ['9', '101', '70.5', '"70"', '0']) {
      expect(errorOf('images:', `  minScale: ${value}`), value).toBe(
        'images.minScale must be a whole number from 10 to 100 (line 4)',
      );
    }
  });

  it('US-028 AC-1: the Defaults may hold it; the built-in value is 100', () => {
    const ok = validateFields({images: {minScale: 50}});
    expect(ok.ok && ok.fields).toEqual({images: {minScale: 50}});
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(
      plain.ok &&
        (plain.settings as unknown as {images: {minScale: number}}).images,
    ).toEqual({minScale: 100});
  });

  it('US-028 AC-1: the Defaults value is in effect; a preset value beats it (SCAR-023)', () => {
    const imagesOf = (preset: number | undefined): unknown => {
      const fields = preset === undefined ? {} : {images: {minScale: preset}};
      const result = effectiveSettings(
        {fields, lines: {}},
        {images: {minScale: 50}},
        () => false,
      );
      return (
        result.ok &&
        (result.settings as unknown as {images: {minScale: number}}).images
      );
    };
    expect(imagesOf(undefined)).toEqual({minScale: 50});
    expect(imagesOf(70)).toEqual({minScale: 70});
  });
});

describe('US-028 AC-3 what is written', () => {
  // line 3 holds the image (frontmatter-free note)
  const SOURCE = 'Some text.\n\n![[map.png]]\n\nMore text.';

  it('US-028 AC-3: the probe line and the call, with path, label, source line and name (the example)', async () => {
    const {typ} = await convertWith(SOURCE, 70);
    expect(typ).toContain(
      `${PROBE(1)}\n#fit-flow("assets/map.png", <o2t-fit-1>, 3, "map.png", min: 0.7, sides: true, floats: true)`,
    );
  });

  it('US-028 AC-3: the labels are numbered in document order; two runs give the same text (rule 7)', async () => {
    const source = 'A.\n\n![[map.png]]\n\nB.\n\n![[other.png]]\n\nC.';
    const first = await convertWith(source, 70);
    const second = await convertWith(source, 70);
    expect(first.typ).toBe(second.typ);
    expect(first.typ).toContain(PROBE(1));
    expect(first.typ).toContain(PROBE(2));
    expect(calls(first.typ).map((c) => /<(o2t-fit-\d+)>/.exec(c)?.[1])).toEqual(
      ['o2t-fit-1', 'o2t-fit-2'],
    );
  });

  it('US-028 AC-3: a heading named like a generated label keeps its own label (SCAR-011)', async () => {
    const {typ} = await convertWith('# o2t-fit-1\n\n![[map.png]]', 70);
    expect(typ).toContain('<h-o2t-fit-1>');
    expect(typ.match(/<o2t-fit-1>/g)).toHaveLength(2); // the probe and the call
  });

  it('US-028 AC-3: facing pages off writes sides: false', async () => {
    const {typ} = await convertWith(SOURCE, 70, {
      page: {...A5_PRINT, facingPages: false},
    });
    expect(calls(typ)[0]).toContain('sides: false, floats: true');
  });

  it('US-028 AC-3: a caption and an Obsidian size are passed on (escaped as today, px × 0.75)', async () => {
    // The user's answer of 2026-10-29: the caption as today's figure writes
    // it (the parser's alt text drops `*`), and one that needs escaping.
    const source = 'Text.\n\n![A *bold* map|300x200](assets/map.png)\n\nMore.';
    const today = (await run(source)).typ;
    expect(today).toContain('caption: [A bold map]');
    const call = calls((await convertWith(source, 70)).typ)[0] ?? '';
    expect(call).toContain('width: 225pt, height: 150pt');
    expect(call).toContain('caption: [A bold map]');
    const escaped =
      calls(
        (
          await convertWith(
            'Text.\n\n![Price $5 #1](assets/map.png)\n\nMore.',
            70,
          )
        ).typ,
      )[0] ?? '';
    expect(escaped).toContain(
      `caption: [${emit.escapeMarkup('Price $5 #1', {atBlockStart: true})}]`,
    );
    expect(escaped).toContain('caption: [Price \\$5 \\#1]');
  });

  it('US-028 AC-3: the helper is written once and is a plugin name, as are its labels', async () => {
    const {typ} = await convertWith(
      'A.\n\n![[map.png]]\n\nB.\n\n![[other.png]]',
      70,
    );
    expect(typ.match(/^#let fit-flow\(/gm)).toHaveLength(1);
    expect(PLUGIN_NAMES).toContain('fit-flow');
  });

  it("US-028 AC-3 (decision 13): a floated figure is labelled and the room gets back its height on the probe's page", async () => {
    const {typ} = await convertWith('A.\n\n![[map.png]]\n\nB.', 70);
    const helper = typ.slice(typ.indexOf('#let fit-flow('));
    expect(helper).toContain(
      'place(top, float: true, clearance: 1em, [#fig(w) #label(str(at) + "-f")])',
    );
    expect(helper).toContain(
      '\n      let own = query(label(str(at) + "-f")).filter(e => e.location().page() == pos.page).len() > 0\n      if own { room = room + h + cap(w) + 1em.to-absolute() }\n',
    );
    // the correction comes after the room and before the first decision
    const room = helper.indexOf('let room =');
    const own = helper.indexOf('let own =');
    expect(room).toBeGreaterThan(0);
    expect(own).toBeGreaterThan(room);
    expect(helper.indexOf('if h + cap(w) <= room')).toBeGreaterThan(own);
  });

  it('US-028 AC-3 (decision 12): the helper writes its full-width block only where floats are off', async () => {
    const {typ} = await convertWith('A.\n\n![[map.png]]\n\nB.', 70);
    const helper = typ.slice(typ.indexOf('#let fit-flow('));
    const head = helper.split('\n')[0] ?? '';
    // the body is a plain context (V3 wrapped it: a float stayed in the block)
    expect(head).toMatch(/\) = \{$/);
    expect(helper).toContain('\n  let body = context {\n');
    expect(helper).toContain(
      '\n  if floats { body } else { block(above: 0pt, width: 100%, body) }\n}',
    );
    expect(
      helper.match(/block\(above: 0pt, width: 100%, body\)/g),
    ).toHaveLength(1);
  });
});

describe('US-028 AC-2, AC-6 which images, and the containers (decision 3)', () => {
  it('US-028 AC-6: a callout writes floats: false with its style inset + border (8.75pt)', async () => {
    const {typ} = await convertWith(
      '> [!note]\n> Text.\n>\n> ![[map.png]]',
      70,
    );
    // The user's answer of 2026-10-29: `sides` follows the facing pages
    // (on here) in a container too.
    expect(calls(typ)[0]).toMatch(
      /sides: true, floats: false, reserve: 8\.75pt\)$/,
    );
  });

  it('US-028 AC-6: a callout in a callout adds both reserves (17.5pt)', async () => {
    const {typ} = await convertWith(
      '> [!note]\n> Outer.\n>\n> > [!note]\n> > Inner.\n> >\n> > ![[map.png]]',
      70,
    );
    expect(calls(typ)[0]).toMatch(/reserve: 17\.5pt\)$/);
  });

  it('US-028 AC-6: a quote writes reserve: 2.4em, a list item reserve: 0pt', async () => {
    const quote = await convertWith('> Text.\n>\n> ![[map.png]]', 70);
    expect(calls(quote.typ)[0]).toMatch(/floats: false, reserve: 2\.4em\)$/);
    const list = await convertWith('- Item.\n\n  ![[map.png]]', 70);
    expect(calls(list.typ)[0]).toMatch(/floats: false, reserve: 0pt\)$/);
  });

  it('US-028 AC-2: not for an image in a table cell, a link, a heading or a footnote, nor a missing image', async () => {
    const source = [
      '| a |',
      '|--|',
      '| ![[map.png]] |',
      '',
      '[![[map.png]]](https://example.org)',
      '',
      '# Title ![[map.png]]',
      '',
      'Text[^1].',
      '',
      '![[missing.png]]',
      '',
      '[^1]: Note ![[map.png]]',
    ].join('\n');
    const {typ} = await convertWith(source, 70);
    expect(calls(typ)).toEqual([]);
    expect(typ).not.toContain('<o2t-fit-');
  });

  it('US-028 AC-2: not for the cover', async () => {
    const {typ} = await convertWith('![[map.png]]\n\n# One\n\nText.', 70, {
      cover: {...DEFAULT_COVER},
    });
    expect(calls(typ)).toEqual([]);
  });

  it('US-028 AC-4: before a heading with a page break the image never floats', async () => {
    const {typ} = await convertWith(
      'Text.\n\n![[map.png]]\n\n# Next\n\nMore.',
      70,
      {
        breakBefore: {h1: 'right'},
      },
    );
    expect(calls(typ)[0]).toContain('floats: false');
    const plain = await convertWith(
      'Text.\n\n![[map.png]]\n\n# Next\n\nMore.',
      70,
    );
    expect(calls(plain.typ)[0]).toContain('floats: true');
  });

  it('US-028 AC-4 (decision 10): the last image of the note never floats, also after a comment and before the end padding; with a block after it, it may', async () => {
    const last = async (source: string, over = {}) =>
      calls((await convertWith(source, 70, over)).typ)[0];
    expect(await last('Text.\n\n![[map.png]]')).toContain('floats: false');
    expect(await last('Text.\n\n![[map.png]]\n\n<!-- end -->')).toContain(
      'floats: false',
    );
    expect(
      await last('# Rules\n\nText.\n\n![[map.png]]', {book: {signature: 8}}),
    ).toContain('floats: false');
    expect(await last('Text.\n\n![[map.png]]\n\nMore.')).toContain(
      'floats: true',
    );
  });

  it('US-028 AC-4 (decision 5): text after the image in its paragraph may still fill the gap, so it may float (SCAR-023)', async () => {
    const {typ} = await convertWith(
      'Text.\n\n![[map.png]] More text.\n\n# Next\n\nMore.',
      70,
      {breakBefore: {h1: 'right'}},
    );
    expect(calls(typ)[0]).toContain('floats: true');
  });
});

describe('US-028 AC-5 the warnings from the decisions (decision 2)', () => {
  it('US-028 AC-5: float and move give their warning at the source line; full and shrink none', () => {
    const decisions: Decision[] = [
      {d: 'full', line: 3, name: 'a.png'},
      {d: 'shrink', line: 5, name: 'b.png'},
      {d: 'float', line: 12, name: 'map.png'},
      {d: 'move', line: 20, name: 'map.png'},
    ];
    expect(fitWarnings(decisions)).toEqual([
      {
        code: 'IMAGE_FLOATED',
        message:
          'Image "map.png" did not fit after its text; placed at the top of the next page',
        line: 12,
      },
      {
        code: 'IMAGE_MOVED',
        message:
          'Image "map.png" did not fit after its text; moved to the next page, the space before it stays empty',
        line: 20,
      },
    ]);
  });

  it('US-028 AC-5: a value of another shape is ignored (an old engine, a foreign label)', () => {
    expect(fitWarnings([null, 'move', {d: 'move'}, {line: 3}])).toEqual([]);
  });

  it('US-028 AC-3 (decision 9): an image written with a path passes the path as written', async () => {
    const {typ} = await convertWith(
      'Text.\n\n![A map](assets/map.png)\n\nMore.',
      70,
    );
    expect(calls(typ)[0]).toContain(', 3, "assets/map.png", min: 0.7');
  });

  it('US-028 AC-5: the name in the call goes through typstString', async () => {
    const {typ} = await run(
      'Text.\n\n![[ma"p.png]]',
      {
        settings: {...SETTINGS, images: {minScale: 70}} as ConvertSettings,
      },
      ['Sample/Rules.md', 'Sample/ma"p.png'],
    );
    expect(calls(typ)[0]).toContain(', "ma\\"p.png", min: 0.7');
  });
});

describe("US-028 AC-10 today's output at 100 (decision 1)", () => {
  it('US-028 AC-10: minScale 100 writes no fit-flow and no o2t-fit; the output is byte-identical to today', async () => {
    const source = 'Text.\n\n![[map.png]]\n\n> [!note]\n> ![[map.png]]\n\nEnd.';
    const today = (await run(source)).typ;
    const at100 = (await convertWith(source, 100)).typ;
    expect(at100).toBe(today);
    expect(today).not.toContain('fit-flow');
    expect(today).not.toContain('o2t-fit');
  });
});

describe('US-028 AC-12 settings at their values (SCAR-019)', () => {
  for (const [minScale, min] of [
    [10, '0.1'],
    [50, '0.5'],
    [70, '0.7'],
    [99, '0.99'],
  ] as const) {
    for (const facing of [true, false]) {
      it(`US-028 AC-12: minScale ${minScale}, facing pages ${facing ? 'on' : 'off'} writes min: ${min}`, async () => {
        // Text after the image: a last image never floats (decision 10).
        const {typ} = await convertWith(
          'Text.\n\n![[map.png]]\n\nMore.',
          minScale,
          {page: {...A5_PRINT, facingPages: facing}},
        );
        expect(calls(typ)[0]).toContain(
          `min: ${min}, sides: ${facing}, floats: true`,
        );
      });
    }
  }
});

describe('US-028 AC-6 reserves at other values (amendment 2026-10-29; measured)', () => {
  it('US-028 AC-6: a callout style at its bounds writes inset + border (0pt, 60pt)', async () => {
    const at = async (inset: number, width: number) =>
      calls(
        (
          await convertWith('> [!note]\n> Text.\n>\n> ![[map.png]]', 70, {
            callouts: {note: {inset, border: {width}}},
          })
        ).typ,
      )[0];
    expect(await at(0, 0)).toMatch(/floats: false, reserve: 0pt\)$/);
    expect(await at(50, 10)).toMatch(/floats: false, reserve: 60pt\)$/);
  });

  it('US-028 AC-6: nested containers add their reserves, pt and em parts apart (callout in a quote, quote in a callout, quote in a quote, quote in a list item)', async () => {
    const cases: [string, string][] = [
      [
        '> Quote.\n>\n> > [!note]\n> > Box.\n> >\n> > ![[map.png]]',
        '8.75pt + 2.4em',
      ],
      [
        '> [!note]\n> Box.\n>\n> > Quote.\n> >\n> > ![[map.png]]',
        '8.75pt + 2.4em',
      ],
      ['> Outer.\n>\n> > Inner.\n> >\n> > ![[map.png]]', '4.8em'],
      ['- Item.\n\n  > Quote.\n  >\n  > ![[map.png]]', '2.4em'],
    ];
    for (const [source, reserve] of cases) {
      expect(calls((await convertWith(source, 70)).typ)[0], source).toMatch(
        new RegExp(
          `floats: false, reserve: ${reserve.replace(/[.+]/g, '\\$&')}\\)$`,
        ),
      );
    }
  });
});

describe('US-028 AC-2, AC-3 the parts and the page breaks of US-026 and US-027 (decisions 5 to 7)', () => {
  const BOOK = {
    book: {colophonHeading: 'hidden', backNotesHeading: 'hidden'},
  } as const;

  it('US-028 AC-2 (decision 6): an image inside the colophon with text after it may float', async () => {
    const {typ} = await convertWith(
      '# Colophon\n\nPrinted.\n\n![[map.png]]\n\nMore colophon.\n\n# Rules\n\nText.',
      70,
      BOOK,
    );
    expect(calls(typ)).toHaveLength(1);
    expect(calls(typ)[0]).toContain('sides: true, floats: true)');
  });

  it("US-028 AC-3: the last block of the colophon, before the first chapter's break, never floats", async () => {
    const {typ} = await convertWith(
      '# Colophon\n\nPrinted.\n\n![[map.png]]\n\n# Rules\n\nText.',
      70,
      BOOK,
    );
    expect(calls(typ)[0]).toContain('floats: false');
  });

  it('US-028 AC-3: the last block of the body, before the back notes, never floats', async () => {
    const {typ} = await convertWith(
      '# Rules\n\nText.\n\n![[map.png]]\n\n# Back notes\n\nNote text.',
      70,
      BOOK,
    );
    expect(calls(typ)[0]).toContain('floats: false');
  });

  it('US-028 AC-2 (decision 7): an image inside the back notes shrinks or moves only (floats: false, reserve: 0pt)', async () => {
    const {typ} = await convertWith(
      '# Rules\n\nText.\n\n# Back notes\n\nNote text.\n\n![[map.png]]\n\nMore notes.',
      70,
      BOOK,
    );
    expect(calls(typ)).toHaveLength(1);
    expect(calls(typ)[0]).toMatch(/floats: false, reserve: 0pt\)$/);
  });

  it('US-028 AC-3: before contents placed in the body the image never floats; without them it may (US-027)', async () => {
    const source = '# Rules\n\nText.\n\n![[map.png]]\n\n# Lore\n\nMore.';
    const placed = await convertWith(source, 70, {
      toc: {depth: 2, heading: 'Lore', position: 'before'},
    });
    expect(calls(placed.typ)[0]).toContain('floats: false');
    const plain = await convertWith(source, 70);
    expect(calls(plain.typ)[0]).toContain('floats: true');
  });
});

describe('US-028 AC-8, AC-10 the help text and the sample vault', () => {
  it('US-028 AC-5, AC-8: both codes are in the registry; the help of IMAGE_FLOATED says the gap can stay at the tightest edge', () => {
    const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
    const row = (code: string) =>
      text.split('\n').find((line) => line.startsWith(`| \`${code}\` |`)) ?? '';
    expect(row('IMAGE_MOVED')).toContain('US-028');
    expect(row('IMAGE_FLOATED')).toContain('US-028');
    expect(row('IMAGE_FLOATED')).toMatch(/the gap can stay/);
  });

  it(
    "US-028 AC-10: the sample vault's Book.md at 100 is byte-identical to today with no fit-flow or o2t-fit; at 70 it has calls (the check reaches the rule)",
    {timeout: 60_000},
    async () => {
      const files = [
        NOTE_PATH,
        ...readManifest().images.files.map((f) => `Sample/${f}`),
      ];
      const source = readSample('Book.md');
      const settings = (minScale: number) =>
        ({...SETTINGS, images: {minScale}}) as ConvertSettings;
      const today = (await run(source, {}, files)).typ;
      const at100 = (await run(source, {settings: settings(100)}, files)).typ;
      expect(at100).toBe(today);
      expect(today).not.toMatch(/fit-flow|o2t-fit/);
      const at70 = (await run(source, {settings: settings(70)}, files)).typ;
      expect(calls(at70).length).toBeGreaterThan(0);
    },
  );
});
