// US-005 tables against the real compiler (integration, offline). Property
// (SCAR-009, SCAR-010): every table shape in every container compiles and reads
// back with the cells the Markdown tree has, in order; alignment and column
// count reach the compiled table; the whole real file compiles.
import {describe, expect, it} from 'vitest';
import {parse, type TableNode} from '../../src/core/parse';
import {blockReading, blocks, squashBlocks} from '../support/blocks';
import {all} from '../support/tree';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {decodeTypstString, diagnose, plainText} from '../support/typst-node';

/** Compiles the Typst of `md`; returns its errors. */
async function errors(typ: string): Promise<string[]> {
  return (await diagnose(`${typ}\n`))
    .filter((d) => d.severity === 'error')
    .map((d) => d.message);
}

/** What Typst reads from `md`, after compiling it without error. */
async function read(md: string): Promise<string> {
  const {typ} = blocks(md);
  expect(await errors(typ), `${JSON.stringify(md)} -> ${typ}`).toEqual([]);
  return (await plainText(`\n${typ}`)).trim();
}

/** Value of Typst code over the first table `t` of the compiled `md`. */
async function ask(md: string, expression: string): Promise<string> {
  const {typ} = blocks(md);
  const source = `${typ}\n#context { let t = query(table).first(); assert.eq(${expression}, "@@") }\n`;
  const first = (await diagnose(source)).find((d) => d.severity === 'error');
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first?.message ?? '',
    );
  if (match === null) throw new Error(`compile: ${first?.message ?? 'none'}`);
  return decodeTypstString(match[1] as string);
}

const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
const SEP: Record<string, string> = {
  default: '---',
  left: ':---',
  center: ':---:',
  right: '---:',
};
/** A table of `aligns.length` columns with the given body rows. */
function make(aligns: string[], head: string[], body: string[][]): string {
  return [
    row(head),
    row(aligns.map((a) => SEP[a] as string)),
    ...body.map(row),
  ].join('\n');
}

const CELLS = [
  'plain',
  '**bold** and *it*',
  '`code`',
  'a<br>b',
  'a<br><br>b',
  'cost $5 #1',
  'x \\| y',
  'a ] b [ c',
  '~~gone~~ ==hot==',
  '1. one',
  '- dash',
  '= eq',
  '(a).',
  '',
];

describe('US-005 AC-1 / AC-2 / AC-2b cell contents and shapes (compiler)', () => {
  const SHAPES: [string, string[]][] = [
    ['one column', ['left']],
    ['two columns', ['left', 'right']],
    ['four columns', ['default', 'center', 'right', 'left']],
  ];
  const CONTAINERS: [string, (t: string) => string][] = [
    ['top level', (t) => t],
    [
      'list item',
      (t) =>
        `- item\n\n${t
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n')}`,
    ],
    [
      'quote',
      (t) =>
        t
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n'),
    ],
  ];

  it('US-005 AC-2: every cell content in every table shape and container compiles and reads back as the tree says', async () => {
    for (const [shape, aligns] of SHAPES) {
      for (const [container, wrap] of CONTAINERS) {
        // Every content in every column position, in a row of its own.
        const body = CELLS.map((content, i) =>
          aligns.map((_, c) => (c === i % aligns.length ? content : `c${c}`)),
        );
        const md = wrap(
          make(
            aligns,
            aligns.map((_, c) => `h${c}`),
            body,
          ),
        );
        const tree = parse(md).root;
        const tables = all(tree).filter((n) => n.kind === 'table');
        expect(tables, `${shape} in ${container}`).toHaveLength(1);
        const expected = squashBlocks(blockReading(tree));
        expect(squashBlocks(await read(md)), `${shape} in ${container}`).toBe(
          expected,
        );
      }
    }
  });

  it('US-005 AC-2b: a break reads as a line break and two as an empty line', async () => {
    const text = await read('| a |\n|---|\n| x<br><br>y<br>z |');
    expect(text).toBe('<cell>a</><cell>x\n\ny\nz</>');
  });

  it('US-005 AC-2b: a break before . ( [ and ; keeps its text', async () => {
    const text = await read('| a |\n|---|\n| x<br>.y<br>(z<br>[w<br>;v |');
    expect(text).toBe('<cell>a</><cell>x\n.y\n(z\n[w\n;v</>');
  });

  it('US-005 AC-2: a link in a cell reads as the link plus its footnote', async () => {
    const text = await read('| a |\n|---|\n| [S](https://x.org) |');
    expect(text).toBe(
      '<cell>a</><cell><link "https://x.org">S</link><footnote><link "https://x.org">https://x.org</link></></>',
    );
  });

  it('US-005 AC-2: a link followed by text in a cell keeps the text', async () => {
    const text = await read('| a |\n|---|\n| [S](https://x.org).(b) |');
    expect(text).toContain('</>.(b)</>');
  });
});

describe('US-005 AC-1 alignment and columns reach the compiled table', () => {
  it('US-005 AC-1: gives the table the columns and alignment of the Markdown', async () => {
    const md = make(
      ['left', 'right', 'center', 'default'],
      ['a', 'b', 'c', 'd'],
      [['1', '2', '3', '4']],
    );
    expect(await ask(md, 'repr(t.align)')).toBe('(left, right, center, left)');
    expect(await ask(md, 'repr(t.columns.len())')).toBe('4');
  });

  it('US-005 AC-1: a one-column table keeps one column with its alignment', async () => {
    const md = make(['right'], ['a'], [['1']]);
    expect(await ask(md, 'repr(t.columns.len())')).toBe('1');
    expect(await ask(md, 'repr(t.align)')).toBe('(right,)');
  });
});

describe('US-005 AC-3 / AC-3b shapes (compiler)', () => {
  it('US-005 AC-3: a padded short row and a cut long row compile and keep the header width', async () => {
    const md = '| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |\n| x | y |';
    expect(await read(md)).toBe(
      '<cell>a</><cell>b</><cell>1</><cell></><cell>1</><cell>2</><cell>x</><cell>y</>',
    );
    expect(await ask(md, 'repr(t.columns.len())')).toBe('2');
  });

  it('US-005 AC-3b: a header-only table and an empty header compile', async () => {
    expect(await read('| A | B |\n|---|---|')).toBe('<cell>A</><cell>B</>');
    expect(await read('| | |\n|-|-|\n| x | y |')).toBe(
      '<cell></><cell></><cell>x</><cell>y</>',
    );
  });

  it('US-005 AC-3b: a wide table with a long unbroken word compiles', async () => {
    const heads = Array.from({length: 14}, (_, i) => `h${i}`);
    const long = 'x'.repeat(200);
    const md = make(
      heads.map(() => 'default'),
      heads,
      [heads.map(() => long)],
    );
    expect(await errors(blocks(md).typ)).toEqual([]);
  });

  it('US-005 AC-3: tables one after the other and between paragraphs compile', async () => {
    const t = make(['left'], ['a'], [['1']]);
    const md = `before\n\n${t}\n\nbetween\n\n${t}\n\nafter`;
    expect(await errors(blocks(md).typ)).toEqual([]);
  });
});

describe('US-005 the sample note', () => {
  const md = readSample('Book.md');
  const result = blocks(md);
  const {census, longRows} = readManifest();

  it('US-005 AC-1: converts every table of the sample note and the whole document compiles without error', async () => {
    const tables = all(parse(md).root).filter(
      (n): n is TableNode => n.kind === 'table',
    );
    expect(tables).toHaveLength(census.tables);
    expect(census.tables).toBeGreaterThanOrEqual(261);
    // A table inside a callout is indented with the callout's body.
    expect(result.typ.match(/^ *#table\(/gm)).toHaveLength(census.tables);
    expect(result.typ.match(/^ *table\.header\(/gm)).toHaveLength(
      census.tables,
    );
    expect(await errors(withCalloutHarness(result.typ))).toEqual([]);
  });

  it('US-005 AC-2b: keeps the line breaks of the cells of the sample note', () => {
    const breaks = census.html['html-inline:br'] ?? 0;
    expect(breaks).toBeGreaterThanOrEqual(59);
    expect(result.typ.match(/#linebreak\(\)/g)?.length).toBe(breaks);
  });

  it('US-005 AC-3: reports TABLE_ROW_LONG only for rows that really have more cells', () => {
    const long = result.warnings.filter((x) => x.code === 'TABLE_ROW_LONG');
    expect(long).toHaveLength(longRows);
  });

  it('US-005 AC-1: leaves no node without an emitter in the sample note', () => {
    // Images (US-003) are still unsupported; tables, rows, cells and notes not.
    const left = result.warnings
      .filter((x) => x.code === 'NODE_UNSUPPORTED')
      .filter((x) => /table|row|cell|footnote|item/.test(x.message));
    expect(left).toEqual([]);
  });
});
