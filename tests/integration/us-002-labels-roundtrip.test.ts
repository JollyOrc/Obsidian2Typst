// US-002 labels and heading text against the real compiler (integration,
// offline). Property (SCAR-009, SCAR-010): every heading, in every container
// and with every kind of text start and end, compiles, reads back as the tree,
// and its label attaches to it (a link to the label resolves); labels of a
// whole document are unique. The real file is checked as a whole.
import {describe, expect, it} from 'vitest';
import {parse} from '../../src/core/parse';
import {blockReading, blocks, squashBlocks} from '../support/blocks';
import {index} from '../support/headings';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {diagnose, plainText} from '../support/typst-node';

const indent = (md: string, n: number): string =>
  md
    .split('\n')
    .map((l) => (l === '' ? l : ' '.repeat(n) + l))
    .join('\n');
const bullet = (md: string): string => `- ${indent(md, 2).slice(2)}`;
const ordered = (md: string): string => `10. ${indent(md, 4).slice(4)}`;
const quote = (md: string): string =>
  md
    .split('\n')
    .map((l) => (l === '' ? '>' : `> ${l}`))
    .join('\n');
const CONTAINERS: [string, (md: string) => string][] = [
  ['top', (md) => md],
  ['bullet', bullet],
  ['10.', ordered],
  ['quote', quote],
];

// Heading sources: text that starts or ends with every kind of markup.
const HEADINGS: string[] = [
  '# x',
  '# a *b*',
  '# *a* b',
  '# a **b**',
  '# a ~~s~~',
  '# ~~s~~ a',
  '# a `c`',
  '# a \\\\',
  '# a \\#',
  '# a #b',
  '# = x',
  '# - x',
  '# + x',
  '# / x',
  '# 1. x',
  '# $x$',
  '# @x',
  '# a//b',
  '# ~~s~~(x)',
  '# a ==m==',
  '# ==m==.x',
  '# a<br>b',
  '# *a<br>b*',
  '# a ~~b~~<br>c',
  'a\nb\n===',
  '### a b',
];

/** Compiles `md`'s Typst with a link to every label; reads it back as the tree. */
async function roundTrip(md: string): Promise<void> {
  const tree = parse(md).root;
  const {typ} = blocks(md);
  const links = index(md)
    .list.map((i) => `#link(<${i.label}>)[x]`)
    .join(' ');
  const errors = (await diagnose(`${typ}\n\n${links}\n`)).filter(
    (d) => d.severity === 'error',
  );
  expect(
    errors.map((e) => e.message),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toEqual([]);
  const actual = await plainText(`\n${typ}`);
  expect(
    squashBlocks(actual),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toBe(squashBlocks(blockReading(tree)));
}

describe('US-002 AC-4b / AC-4c / AC-5 every heading in every container (compiler)', () => {
  it('US-002 AC-4c: every kind of heading text compiles, reads back as the tree and its label resolves', async () => {
    for (const h of HEADINGS) await roundTrip(h);
  }, 120_000);

  it('US-002 AC-5: every kind of heading text inside every container compiles, reads back and resolves', async () => {
    for (const [, wrap] of CONTAINERS) {
      for (const h of HEADINGS) await roundTrip(wrap(h));
    }
  }, 120_000);

  it('US-002 AC-5: a heading after a paragraph, before a list and inside two containers reads back', async () => {
    await roundTrip('- p\n\n  ## X\n\n  - l');
    await roundTrip('> p\n>\n> ## X\n>\n> text');
    await roundTrip('- > ## X\n  > y');
    await roundTrip('> - ## X\n>   y');
    await roundTrip('1. a\n2. ## B\n   c');
  });

  it('US-002 AC-4b: a heading that spans lines in Markdown is one heading in Typst', async () => {
    const {typ} = blocks('A\nB\n===\n\nnext');
    expect(squashBlocks(await plainText(`\n${typ}`))).toBe(
      '<heading>AB</>next',
    );
  });
});

describe('US-002 AC-3 / AC-3b labels are unique and attach (compiler)', () => {
  it('US-002 AC-3: three equal headings and a suffix-like title all resolve (a clash would fail at the link)', async () => {
    const md = '# A\n\n# A\n\n# A 2\n\n# A\n\n## A 2 2\n\n- ## A';
    const labels = index(md).list.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
    await roundTrip(md);
  });

  it('US-002 AC-3b: the guard: two equal labels do fail when something links to them', async () => {
    const errors = (
      await diagnose('= A <h-a>\n\n= B <h-a>\n\n#link(<h-a>)[x]\n')
    ).filter((d) => d.severity === 'error');
    expect(errors.map((e) => e.message).join()).toMatch(/multiple times/);
  });
});

describe('US-002 the sample note (compiler)', () => {
  const md = readSample('Book.md');
  const {headings, repeatedTitles} = readManifest();
  const total = Object.values(headings).reduce((n, l) => n + l.length, 0);

  it('US-002 AC-3: gives every heading of the sample note its own valid label and no warning, also for repeated titles and a natural twin', () => {
    const list = index(md).list;
    expect(list).toHaveLength(total);
    // The note repeats titles (and has a title of the suffixed shape), so
    // the counter of AC-3 is reached (SCAR-011).
    expect(repeatedTitles.extra).toBeGreaterThan(0);
    const labels = list.map((i) => i.label);
    expect(new Set(labels).size).toBe(total);
    for (const label of labels) {
      expect(label).toMatch(/^h-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(
      blocks(md).warnings.filter((w) => w.code.startsWith('HEADING_')),
    ).toEqual([]);
  });

  it('US-002 AC-3: every label of the sample note resolves in the compiled document', async () => {
    const {typ} = blocks(md);
    const links = index(md)
      .list.map((i) => `#link(<${i.label}>)[x]`)
      .join(' ');
    const errors = (
      await diagnose(`${withCalloutHarness(typ)}\n\n${links}\n`)
    ).filter((d) => d.severity === 'error');
    expect(errors.map((e) => e.message)).toEqual([]);
  }, 60_000);
});
