// US-001 inline emitter against the real compiler (integration, offline).
// Property: the Typst that `emitInline` writes compiles and reads back as the
// Markdown tree it came from, in every position that matters (SCAR-009):
// after calls, at line starts, next to every kind of neighbour, inside every
// mark; and every inline fragment of the sample note compiles (AC-11, inline part).
import {describe, expect, it} from 'vitest';
import {EmitContext, emitInline} from '../../src/core/emit';
import {parse, type InlineNode} from '../../src/core/parse';
import {emitNodes, inline, inlineOf, reading, squash} from '../support/inline';
import {readSample} from '../support/sample';
import {all} from '../support/tree';
import {diagnose, plainText} from '../support/typst-node';

const text = (value: string, line = 1): InlineNode => ({
  kind: 'text',
  line,
  value,
});

/** Parses `md`, emits it, compiles it and compares with the tree's reading. */
async function roundTrip(md: string): Promise<void> {
  const nodes = inlineOf(parse(md).root[0]);
  const {typ, warnings} = inline(md);
  expect(warnings, md).toEqual([]);
  const actual = await plainText(typ);
  expect(
    squash(actual),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toBe(squash(reading(nodes)));
}

describe('US-001 AC-1c text after a function form (compiler)', () => {
  const WRAPPERS = ['~~x~~', '==x==', 'a**x**', 'a*x*', '`a``b`'];
  const FOLLOWERS = ['.b', '(x)', ';', '[x]', ', x', '/', ' x', '; y', '.5'];

  it('US-001 AC-1c: every function form followed by every follower reads back as the Markdown tree', async () => {
    for (const wrapper of WRAPPERS) {
      for (const follower of FOLLOWERS) {
        await roundTrip(wrapper + follower);
      }
    }
  });

  it('US-001 AC-1c: <u> pairs and <br> followed by every follower read back', async () => {
    for (const follower of FOLLOWERS) {
      const {typ} = inline(`<u>x</u>${follower}`);
      expect(await plainText(typ), typ).toBe(`<underline>x</>${follower}`);
      const br = inline(`x<br>${follower}`).typ;
      expect(squash(await plainText(br)), br).toBe(squash(`x\n${follower}`));
    }
  });
});

describe('US-001 AC-4b line starts (compiler)', () => {
  const MARKERS = ['= x', '== x', '3\\. x', '\\+ x', '\\- x', '/ x', '\\= x'];
  const CONTEXTS = [
    (m: string) => `a\n${m}`,
    (m: string) => `a  \n${m}`,
    (m: string) => `a\\\n${m}`,
    (m: string) => `**a\n${m}**`,
    (m: string) => `x**a\n${m}**`,
    (m: string) => `_a\n${m}_`,
    (m: string) => `~~${m}~~`,
    (m: string) => `==a\n${m}==`,
    (m: string) => `~~a\n${m}~~`,
    (m: string) => `**${m}**`,
  ];

  it('US-001 AC-4b: a marker at the start of a paragraph, after a break, or at the start of a mark never becomes a heading, list or term', async () => {
    for (const make of CONTEXTS) {
      for (const marker of MARKERS) {
        await roundTrip(make(marker));
      }
    }
    for (const marker of MARKERS) await roundTrip(marker);
  });

  it('US-001 AC-4b: a marker split by a dropped comment or a span is escaped', async () => {
    for (const md of [
      '1986<!-- c -->. x',
      '<span>1986</span>. x',
      '=<!-- c --> x',
    ]) {
      const {typ} = inline(md);
      const read = await plainText(typ);
      expect(read, `${md} -> ${typ}`).not.toMatch(/<(heading|item|enum|term)/);
    }
    expect(squash(await plainText(inline('1986<!-- c -->. x').typ))).toBe(
      '1986. x',
    );
  });
});

describe('US-001 AC-2b neighbours (compiler)', () => {
  const PREV = [
    '',
    'a',
    '5',
    ' ',
    '(',
    '/',
    '.',
    ';',
    '日',
    '\\*',
    '\\_',
    '\\-',
    '\\\\',
    '\\#',
  ];
  const NEXT = [
    '',
    'a',
    '5',
    ' ',
    ')',
    '/',
    '.',
    ';',
    '(',
    '日',
    '\\*',
    '\\_',
    '\\[',
  ];
  const MARKS = ['**x**', '*x*', '~~x~~', '==x==', '`x`'];

  it('US-001 AC-2b: every mark between every kind of neighbour compiles and reads back as the tree', async () => {
    for (const mark of MARKS) {
      for (const prev of PREV) {
        for (const next of NEXT) {
          await roundTrip(`${prev}${mark}${next}`);
        }
      }
    }
  }, 120_000);

  it('US-001 AC-2b: nested marks next to word characters, slashes and each other read back', async () => {
    for (const md of [
      'a***x***b',
      '/***x***/',
      '**a _b_ c**d',
      'x_**a**_y',
      '**a**_b_**c**',
      '*a***b***c*',
      '~~**a**~~/',
      '/==_a_==',
      '**a**/',
      '/**a**',
    ]) {
      await roundTrip(md);
    }
  });
});

describe('US-001 AC-3 every printable character in every position (compiler)', () => {
  const printable = Array.from({length: 0x7e - 0x21 + 1}, (_, i) =>
    String.fromCharCode(0x21 + i),
  );
  const contexts: ((c: string) => InlineNode[])[] = [
    (c) => [text(c)],
    (c) => [text(`x ${c} y`)],
    (c) => [text('a'), {kind: 'softbreak', line: 1}, text(`${c} z`)],
    (c) => [text('a'), {kind: 'break', line: 1}, text(c)],
    (c) => [text('a'), {kind: 'strong', line: 1, children: [text(`${c} z`)]}],
    (c) => [
      text('a '),
      {kind: 'strong', line: 1, children: [text(`${c} z`)]},
      text(' b'),
    ],
    (c) => [{kind: 'mark', line: 1, children: [text(`${c} z`)]}],
    (c) => [{kind: 'delete', line: 1, children: [text(c)]}, text(`${c}x${c}`)],
  ];

  it('US-001 AC-3: a text node with any printable character in any of 8 positions compiles and reads back', async () => {
    for (const c of printable) {
      for (const make of contexts) {
        const nodes = make(c);
        const {typ, warnings} = emitNodes(nodes);
        expect(warnings).toEqual([]);
        const actual = await plainText(typ);
        expect(squash(actual), `${JSON.stringify(typ)}`).toBe(
          squash(reading(nodes)),
        );
      }
    }
  }, 120_000);
});

describe('US-001 AC-9b / AC-15 composed with marks (compiler)', () => {
  it('US-001 AC-9b: underline pairs inside and around marks compile and read back the text', async () => {
    const cases: [string, string][] = [
      ['**a<u>b</u>**', '<strong>a<underline>b</></>'],
      ['<u>**a**</u>x', '<underline><strong>a</></>x'],
      ['<u>a<span>b</span>c</u>', '<underline>abc</>'],
      ['x<u>a</u>.y', 'x<underline>a</>.y'],
      ['<u>a</u>(b)', '<underline>a</>(b)'],
      ['~~<u>a</u>~~', '<strike><underline>a</></>'],
    ];
    for (const [md, expected] of cases) {
      const {typ} = inline(md);
      expect(await plainText(typ), `${md} -> ${typ}`).toBe(expected);
    }
  });

  it('US-001 AC-15: a comment between two texts does not change how the text reads', async () => {
    expect(squash(await plainText(inline('a<!-- c -->b').typ))).toBe('ab');
    expect(squash(await plainText(inline('a *b*<!-- c -->c').typ))).toBe(
      'a <emph>b</>c',
    );
  });
});

describe('US-001 AC-11 inline fragments of the sample note compile (compiler)', () => {
  const source = readSample('Book.md');
  const tree = parse(source);
  const fragments = all(tree.root).filter(
    (n) => n.kind === 'paragraph' || n.kind === 'heading' || n.kind === 'cell',
  );

  it('US-001 AC-11: every paragraph, heading and table cell of the sample note compiles as inline content', async () => {
    const ctx = new EmitContext();
    const typs: string[] = [];
    for (const n of fragments) {
      if (n.kind !== 'paragraph' && n.kind !== 'heading' && n.kind !== 'cell') {
        continue;
      }
      typs.push(
        emitInline(n.children, ctx, {atBlockStart: n.kind !== 'heading'}),
      );
    }
    expect(typs.length).toBeGreaterThan(4000);
    const document = typs.map((t) => `#block[${t}]`).join('\n');
    const errors = (await diagnose(document)).filter(
      (d) => d.severity === 'error',
    );
    if (errors.length > 0) {
      // find the first fragments that fail on their own, for a readable message
      const failing: string[] = [];
      for (const t of typs) {
        const own = (await diagnose(`#block[${t}]`)).filter(
          (d) => d.severity === 'error',
        );
        if (own.length > 0) failing.push(`${own[0]?.message}: ${t}`);
        if (failing.length >= 5) break;
      }
      expect.fail(`compile errors:\n${failing.join('\n')}`);
    }
    const warnings = ctx.finish();
    expect(warnings.filter((x) => x.code === 'HTML_UNSUPPORTED')).toEqual([]);
    const comments = fragments
      .flatMap((f) => all([f]))
      .filter((n) => n.kind === 'comment').length;
    const summary = warnings.find((x) => x.code === 'COMMENT_DROPPED');
    // The comments of the sample note are block-level (later ticket): none
    // is inside a paragraph, heading or cell, so the inline emitter reports none.
    expect(comments).toBe(0);
    expect(summary).toBeUndefined();
  }, 120_000);
});
