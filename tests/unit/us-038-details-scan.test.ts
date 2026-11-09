// US-038 AC-1 to AC-3, AC-9 — the scan, the reader and the plan of the details
// block, tested on their own (SCAR-028: a test per syntax rule): the place of
// a block, the fence forms, the containers, the entry block's transparency,
// the YAML read, the plan's drops, and `keepLinks`. The same cases through
// the whole conversion are in us-038-details-block.test.ts.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
import {describe, expect, it} from 'vitest';
import {
  DETAILS_BLOCK_LANG,
  keepLinks,
  planDetails,
  readDetailsBlock,
  scanDetailsBlocks,
} from '../../src/core/markers';
import {parse, parseInline, type HeadingNode} from '../../src/core/parse';

const scan = (source: string) => scanDetailsBlocks(parse(source).root);
const lines = (...l: string[]): string => l.join('\n');
const BLOCK = ['```o2t-details', 'pace: slow', '```'];

describe('US-038 AC-1 the place of a block', () => {
  it('US-038 AC-1: the language is o2t-details', () => {
    expect(DETAILS_BLOCK_LANG).toBe('o2t-details');
  });

  it('US-038 AC-1: right under a heading of each level 1 to 6, blank lines between: found, taken out', () => {
    for (let level = 1; level <= 6; level++) {
      const result = scan(
        lines(`${'#'.repeat(level)} Reed`, '', '', ...BLOCK, 'Text.'),
      );
      expect(result.found, `h${level}`).toHaveLength(1);
      expect(result.found[0]?.heading.depth).toBe(level);
      expect(result.warnings).toEqual([]);
      expect(result.root.map((b) => b.kind)).toEqual(['heading', 'paragraph']);
    }
  });

  it('US-038 AC-1: a four-backtick fence and a tilde fence are the same block', () => {
    for (const [open, close] of [
      ['````', '````'],
      ['~~~', '~~~'],
    ] as const) {
      const result = scan(
        lines('### Reed', `${open}o2t-details`, 'pace: slow', close),
      );
      expect(result.found).toHaveLength(1);
      expect(result.found[0]?.block.value).toContain('pace: slow');
    }
  });

  it('US-038 AC-1: another language is not a details block and stays in the tree', () => {
    const result = scan(
      lines(
        '### Reed',
        '```o2t-detail',
        'a: 1',
        '```',
        '```yaml',
        'a: 1',
        '```',
      ),
    );
    expect(result.found).toEqual([]);
    expect(result.root.map((b) => b.kind)).toEqual(['heading', 'code', 'code']);
  });

  it('US-038 AC-1: an o2t-entry block between the heading and the block does not move the place; it stays for the entry scan', () => {
    const result = scan(
      lines(
        '### Fen Hare',
        '```o2t-entry',
        'might: 4',
        '```',
        ...BLOCK,
        'Text.',
      ),
    );
    expect(result.found).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.root.map((b) => b.kind)).toEqual([
      'heading',
      'code',
      'paragraph',
    ]);
    const detailsFirst = scan(
      lines(
        '### Fen Hare',
        ...BLOCK,
        '```o2t-entry',
        'might: 4',
        '```',
        'Text.',
      ),
    );
    expect(detailsFirst.found).toHaveLength(1);
    expect(detailsFirst.root.map((b) => b.kind)).toEqual([
      'heading',
      'code',
      'paragraph',
    ]);
  });
});

describe('US-038 AC-3 the places that are not read', () => {
  it('US-038 AC-3: orphan (no heading above; text between), each at the block line', () => {
    const none = scan(lines('Words.', ...BLOCK));
    expect(none.warnings).toEqual([
      expect.objectContaining({code: 'DETAIL_ORPHAN_BLOCK', line: 2}),
    ]);
    const between = scan(lines('### Reed', 'Words.', ...BLOCK));
    expect(between.warnings).toEqual([
      expect.objectContaining({code: 'DETAIL_ORPHAN_BLOCK', line: 3}),
    ]);
    expect(between.found).toEqual([]);
    expect(between.root.map((b) => b.kind)).toEqual(['heading', 'paragraph']);
  });

  it('US-038 AC-3: a second block under one heading is TWICE; the first counts', () => {
    const result = scan(
      lines('### Reed', ...BLOCK, '```o2t-details', 'pace: swift', '```'),
    );
    expect(result.found).toHaveLength(1);
    expect(result.found[0]?.block.value).toContain('slow');
    expect(result.warnings).toEqual([
      {code: 'DETAIL_BLOCK_TWICE', message: '"Reed"', line: 5},
    ]);
  });

  it("US-038 AC-3: in a quote, a callout, a nested quote and a list item's quote: IN_CONTAINER, not found, taken out", () => {
    const cases = [
      lines('> ### Reed', ...BLOCK.map((l) => `> ${l}`)),
      lines('> [!note] T', ...BLOCK.map((l) => `> ${l}`)),
      lines(...BLOCK.map((l) => `> > ${l}`)),
      lines('- item', ...BLOCK.map((l) => `  > ${l}`)),
    ];
    for (const source of cases) {
      const result = scan(source);
      expect(result.found, source).toEqual([]);
      expect(
        result.warnings.map((w) => w.code),
        source,
      ).toEqual(['DETAIL_BLOCK_IN_CONTAINER']);
      expect(JSON.stringify(result.root)).not.toContain('o2t-details');
    }
  });

  it('US-038 AC-3: a container without a block keeps its identity; one with a block is copied', () => {
    const tree = parse(
      lines('> quoted', '', '> ```o2t-details', '> a: 1', '> ```'),
    ).root;
    const plain = parse('> quoted').root;
    expect(scanDetailsBlocks(plain).root[0]).toBe(plain[0]);
    expect(tree.map((b) => b.kind)).toEqual(['blockquote', 'blockquote']);
    expect(scanDetailsBlocks(tree).root[0]).toBe(tree[0]);
    expect(scanDetailsBlocks(tree).root[1]).not.toBe(tree[1]);
  });

  it('US-038 AC-3: the tree given is never changed', () => {
    const tree = parse(lines('### Reed', ...BLOCK)).root;
    const before = JSON.stringify(tree);
    scanDetailsBlocks(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('US-038 AC-2 the YAML', () => {
  const read = (...yaml: string[]) => {
    const result = scan(lines('### Reed', '```o2t-details', ...yaml, '```'));
    const found = result.found[0];
    if (found === undefined) throw new Error('no block');
    return readDetailsBlock(found);
  };

  it('US-038 AC-2: an empty block and a flow mapping are mappings; keys are lower-cased, the first of a case pair wins', () => {
    expect(read().data?.fields.size).toBe(0);
    expect(read('{}').data?.fields.size).toBe(0);
    const r = read('Pace: slow', 'pace: swift', 'KIND: lore');
    expect([...(r.data?.fields ?? [])]).toEqual([
      ['pace', 'slow'],
      ['kind', 'lore'],
    ]);
    expect(r.data?.text).toBe('Reed');
    expect(r.data?.line).toBe(2);
  });

  it('US-038 AC-2: a flow list, other quoting and other key orders read the same', () => {
    const a = read('pace: "slow"', 'kind: lore');
    const b = read("kind: 'lore'", 'pace: slow');
    expect(Object.fromEntries(a.data?.fields ?? [])).toEqual(
      Object.fromEntries(b.data?.fields ?? []),
    );
  });

  it('US-038 AC-2: a parse error, a list and plain text give YAML_INVALID at the first line and no data', () => {
    for (const yaml of [['pace: [slow'], ['- a', '- b'], ['just text']]) {
      const r = read(...yaml);
      expect(r.data, yaml.join('/')).toBeNull();
      expect(r.warnings).toEqual([
        {code: 'DETAIL_YAML_INVALID', message: '"Reed"', line: 2},
      ]);
    }
  });
});

describe('US-038 AC-3 the plan', () => {
  const reads = (source: string) =>
    scan(source).found.map((f) => readDetailsBlock(f));
  const SOURCE = lines(
    '### A',
    ...BLOCK,
    '### B',
    '```o2t-details',
    'pace: [',
    '```',
    '### C',
    ...BLOCK,
  );
  const heading = (r: ReturnType<typeof reads>[number]): HeadingNode =>
    r.found.heading;

  it('US-038 AC-3: with no entry and no glossary every readable block is a row, in order; an invalid block keeps its warning only', () => {
    const rs = reads(SOURCE);
    const plan = planDetails(rs, {
      hasEntry: () => false,
      inGlossary: () => false,
    });
    expect([...plan.rows.values()].map((d) => d.text)).toEqual(['A', 'C']);
    expect(plan.warnings.map((w) => w.code)).toEqual(['DETAIL_YAML_INVALID']);
  });

  it('US-038 AC-3: a heading with an entry drops the block (WITH_ENTRY, at the block line); a glossary heading too (IN_GLOSSARY); their own warnings are dropped', () => {
    const rs = reads(SOURCE);
    const plan = planDetails(rs, {
      hasEntry: (h) => h === heading(rs[0] as never),
      inGlossary: (h) => h === heading(rs[1] as never),
    });
    expect([...plan.rows.values()].map((d) => d.text)).toEqual(['C']);
    expect(plan.warnings).toEqual([
      {code: 'DETAIL_BLOCK_WITH_ENTRY', message: '"A"', line: 2},
      {code: 'DETAIL_IN_GLOSSARY', message: '"B"', line: 6},
    ]);
  });

  it('US-038 AC-3: the entry wins over the glossary when both apply', () => {
    const rs = reads(lines('### A', ...BLOCK));
    const plan = planDetails(rs, {
      hasEntry: () => true,
      inGlossary: () => true,
    });
    expect(plan.warnings.map((w) => w.code)).toEqual([
      'DETAIL_BLOCK_WITH_ENTRY',
    ]);
  });
});

describe('US-038 AC-9 keepLinks', () => {
  const kinds = (value: string) =>
    keepLinks(parseInline(value, 1)).map((n) => n.kind);

  it('US-038 AC-9: links and wikilinks stay; images and embeds become their text; bold keeps its link', () => {
    expect(kinds('[[#H|t]] and [x](#H)')).toEqual(['wikilink', 'text', 'link']);
    const image = keepLinks(parseInline('![A reed](a.png)', 1));
    expect(image).toEqual([
      expect.objectContaining({kind: 'text', value: 'A reed'}),
    ]);
    const embed = keepLinks(parseInline('![[Basket Knots]]', 1));
    expect(embed).toEqual([
      expect.objectContaining({kind: 'text', value: 'Basket Knots'}),
    ]);
    const aliased = keepLinks(parseInline('![[Note|shown]]', 1));
    expect(aliased).toEqual([
      expect.objectContaining({kind: 'text', value: 'shown'}),
    ]);
    const strong = keepLinks(parseInline('**[[#H|t]]**', 1)).find(
      (n) => n.kind === 'strong',
    );
    expect(strong).toEqual(
      expect.objectContaining({
        children: [expect.objectContaining({kind: 'wikilink'})],
      }),
    );
  });

  it('US-038 AC-9: an image inside a link text becomes text, the link stays', () => {
    const out = keepLinks(parseInline('[![alt text](a.png)](#H)', 1));
    expect(out).toEqual([
      expect.objectContaining({
        kind: 'link',
        children: [expect.objectContaining({kind: 'text', value: 'alt text'})],
      }),
    ]);
  });
});
