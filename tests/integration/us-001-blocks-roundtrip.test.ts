// US-001 block emitter against the real compiler (integration, offline).
// Property: the Typst that `emitBlocks` writes compiles and reads back as the
// Markdown tree it came from, in every container and nesting that matters
// (SCAR-009, SCAR-010): lists with markers of different width, quotes, code
// with blank and indented lines, rules, soft and hard breaks at line starts;
// and the whole sample note compiles (AC-11 for the converter core so far).
import {describe, expect, it} from 'vitest';
import {EmitContext, emitBlocks} from '../../src/core/emit';
import {parse} from '../../src/core/parse';
import {blockReading, blocks, squashBlocks} from '../support/blocks';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {all} from '../support/tree';
import {diagnose, plainText} from '../support/typst-node';

// The Typst of a document starts at the beginning of a line; plainText wraps its
// argument in `[` ... `]`, so a newline is put first (a list marker one column to
// the right would change which lines continue an item).
const indent = (md: string, n: number): string =>
  md
    .split('\n')
    .map((l) => (l === '' ? l : ' '.repeat(n) + l))
    .join('\n');
/** `- ` + md, continuation lines indented by the marker width. */
const bullet = (md: string): string => `- ${indent(md, 2).slice(2)}`;
const ordered = (n: number) => (md: string) => {
  const marker = `${n}. `;
  return marker + indent(md, marker.length).slice(marker.length);
};
const quote = (md: string): string =>
  md
    .split('\n')
    .map((l) => (l === '' ? '>' : `> ${l}`))
    .join('\n');

const CONTAINERS: [string, (md: string) => string][] = [
  ['bullet', bullet],
  ['9.', ordered(9)],
  ['10.', ordered(10)],
  ['quote', quote],
];
const CONTENTS: string[] = [
  'x',
  'a\n= b',
  'a\n2020\\. b',
  'a\\\n/ b',
  'p\n\nq',
  'p\n- l1\n- l2',
  '```\n= x\n- y\n\n  z\n```',
  '```js\nlet a = `x`;\n```',
  '---',
  '~~s~~.t **b**(u) ==m==;',
  '2. a\n3. b',
  '> in\n> - l',
];

/** Parses, emits, compiles and compares with the tree's reading. */
async function roundTrip(md: string): Promise<void> {
  const tree = parse(md).root;
  const {typ} = blocks(md);
  let actual: string;
  try {
    actual = await plainText(`\n${typ}`);
  } catch (error) {
    throw new Error(
      `${JSON.stringify(md)} -> ${JSON.stringify(typ)}: ${(error as Error).message}`,
      {cause: error},
    );
  }
  expect(
    squashBlocks(actual),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toBe(squashBlocks(blockReading(tree)));
}

describe('US-001 AC-5b / AC-6b every container with every content (compiler)', () => {
  it('US-001 AC-5b: every content inside every container compiles and reads back as the tree', async () => {
    for (const [, wrap] of CONTAINERS) {
      for (const content of CONTENTS) {
        await roundTrip(wrap(content));
      }
    }
  }, 120_000);

  it('US-001 AC-6b: every content two containers deep compiles and reads back as the tree', async () => {
    for (const [, outer] of CONTAINERS) {
      for (const [, inner] of CONTAINERS) {
        for (const content of CONTENTS) {
          await roundTrip(outer(inner(content)));
        }
      }
    }
  }, 120_000);

  it('US-001 AC-6b: a selection three containers deep compiles and reads back as the tree', async () => {
    const some = ['x', 'a\n= b', '```\n= x\n\n  z\n```', '~~s~~.t **b**(u)'];
    for (const [, a] of CONTAINERS) {
      for (const [, b] of CONTAINERS) {
        for (const [, c] of CONTAINERS) {
          for (const content of some) await roundTrip(a(b(c(content))));
        }
      }
    }
  }, 120_000);

  it('US-001 AC-5b: items of a list with a paragraph, a nested list and a second paragraph read back', async () => {
    await roundTrip('- a\n  - b\n    1. c\n    2. d\n\n  e\n- f');
    await roundTrip('9. a\n   - x\n10. b\n    - y\n11. c');
    await roundTrip('- a\n\n* b\n\n1. c\n\n7. d');
  });
});

describe('US-001 AC-5b ordered numbers (compiler)', () => {
  it('US-001 AC-5b: every ordered item reads back with its own number', async () => {
    const read = async (md: string) =>
      squashBlocks(await plainText(`\n${blocks(md).typ}`));
    expect(await read('3. x\n5. y')).toBe('<n3>x</><n4>y</>');
    expect(await read('0. x\n1. y')).toBe('<n0>x</><n1>y</>');
    expect(await read('123456789. a\n1. b')).toBe(
      '<n123456789>a</><n123456790>b</>',
    );
    expect(await read('1. a\n\n7. b')).toBe('<n1>a</><n2>b</>');
  });
});

describe('US-001 AC-7b code text stays exact in containers (compiler)', () => {
  const CODES = [
    'x\n\n  y',
    '  lead\n    more',
    'a\n    b\nc',
    '```x```',
    '= x\n- y\n#z $',
    '',
  ];
  it('US-001 AC-7b: the text of a code block reads back exactly in every container', async () => {
    for (const code of CODES) {
      const fence = '`'.repeat(
        Math.max(3, (/`+/.exec(code)?.[0].length ?? 0) + 1),
      );
      const md = `${fence}\n${code}\n${fence}`;
      for (const [, wrap] of [['top', (m: string) => m], ...CONTAINERS] as [
        string,
        (m: string) => string,
      ][]) {
        const source = wrap(md);
        const tree = parse(source).root;
        const typ = blocks(source).typ;
        const read = await plainText(`\n${typ}`);
        const value = all(tree).find((n) => n.kind === 'code');
        expect(value?.kind).toBe('code');
        const text = value?.kind === 'code' ? value.value : '';
        expect(
          read,
          `${JSON.stringify(source)} -> ${JSON.stringify(typ)}`,
        ).toContain(text);
      }
    }
  });
});

describe('US-001 AC-11 the sample note compiles as Typst (compiler)', () => {
  const source = readSample('Book.md');
  const {comments} = readManifest();
  const tree = parse(source);

  it('US-001 AC-11: every block of the sample note converts to Typst that compiles with zero errors', async () => {
    const ctx = new EmitContext();
    const typ = emitBlocks(tree.root, ctx);
    expect(typ.length).toBeGreaterThan(100_000);
    // The sample note has callouts (US-016): the harness adds what the
    // pipeline's preamble defines for them.
    expect(typ).toContain('#callout(');
    const errors = (await diagnose(withCalloutHarness(typ))).filter(
      (d) => d.severity === 'error',
    );
    expect(errors.map((e) => e.message).slice(0, 5)).toEqual([]);
    const warnings = ctx.finish();
    expect(warnings.filter((x) => x.code === 'HTML_UNSUPPORTED')).toEqual([]);
    // every unsupported node is a kind that other stories convert
    const kinds = new Set(
      warnings
        .filter((x) => x.code === 'NODE_UNSUPPORTED')
        .map((x) => /No emitter for (.*); /.exec(x.message)?.[1]),
    );
    for (const kind of kinds) {
      expect([
        'heading',
        'table',
        'footnote-def',
        'task item',
        'link',
        'image',
        'wikilink',
        'embed',
        'footnote-ref',
        'inline-footnote',
      ]).toContain(kind);
    }
  }, 120_000);

  it('US-001 AC-15: reports the comments of the sample note in one warning with the line of the first', () => {
    const ctx = new EmitContext();
    emitBlocks(tree.root, ctx);
    const first = all(tree.root).find((n) => n.kind === 'comment');
    const summary = ctx.finish().find((x) => x.code === 'COMMENT_DROPPED');
    expect(summary).toEqual({
      code: 'COMMENT_DROPPED',
      message: `${comments.count} HTML comments dropped`,
      line: first?.line,
    });
    expect(first?.line).toBe(comments.firstLine);
  });

  it('US-001 AC-1d: the output has no empty paragraph and no run of more than one blank line', () => {
    const typ = emitBlocks(tree.root, new EmitContext());
    expect(typ).not.toMatch(/\n\n\n/);
    expect(typ.startsWith('\n')).toBe(false);
    expect(typ.endsWith('\n')).toBe(false);
  });
});
