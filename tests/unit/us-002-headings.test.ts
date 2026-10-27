// US-002 — headings, numbering rule, labels (unit, pure core). Source of
// truth: docs/user-stories/US-002-headings-and-structure.md. Exact string
// comparison, real parser (US-014), real emitter. Numbering and label
// resolution are proven against the compiler in
// tests/integration/us-002-numbering-pdf.test.ts and
// tests/integration/us-002-labels-roundtrip.test.ts.
import {describe, expect, it} from 'vitest';
import {
  EmitContext,
  emitBlocks,
  headingNumberingRule,
} from '../../src/core/emit';
import {indexHeadings, parse, slug, visibleText} from '../../src/core/parse';
import {blocks, typ} from '../support/blocks';
import {index, labels} from '../support/headings';
import {inlineOf} from '../support/inline';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const skipped = (from: number, to: number, line: number) =>
  w('HEADING_LEVEL_SKIPPED', `Heading level jumps from ${from} to ${to}`, line);
const empty = (line: number) =>
  w('HEADING_EMPTY', 'Empty heading omitted', line);
const none: never[] = [];

describe('US-002 AC-1 levels', () => {
  it('US-002 AC-1: maps levels 1 to 6 to one to six = signs, each with a label', () => {
    expect(typ('# Title')).toBe('= Title <h-title>');
    expect(typ('###### Deep')).toBe('====== Deep <h-deep>');
    for (let n = 1; n <= 6; n++) {
      expect(blocks(`${'#'.repeat(n)} X`)).toEqual({
        typ: `${'='.repeat(n)} X <h-x>`,
        warnings: none,
      });
    }
  });

  it('US-002 AC-1: converts a document of six consecutive levels with one blank line between blocks', () => {
    const md = '# A\n## B\n### C\n#### D\n##### E\n###### F\n\ntext';
    expect(blocks(md)).toEqual({
      typ: [
        '= A <h-a>',
        '== B <h-b>',
        '=== C <h-c>',
        '==== D <h-d>',
        '===== E <h-e>',
        '====== F <h-f>',
        'text',
      ].join('\n\n'),
      warnings: none,
    });
  });
});

describe('US-002 AC-1b numbering rule', () => {
  it('US-002 AC-1b: emits #set heading(numbering: "1.1") by default', () => {
    expect(headingNumberingRule('1.1')).toBe('#set heading(numbering: "1.1")');
    expect(headingNumberingRule('a.1')).toBe('#set heading(numbering: "a.1")');
    expect(headingNumberingRule('(1.1)')).toBe(
      '#set heading(numbering: "(1.1)")',
    );
  });

  it('US-002 AC-1b: emits #set heading(numbering: none) when headingNumbering is none', () => {
    expect(headingNumberingRule('none')).toBe('#set heading(numbering: none)');
  });

  it('US-002 AC-1b: writes the pattern as a Typst string (quote and backslash escaped)', () => {
    expect(headingNumberingRule('a"b\\')).toBe(
      '#set heading(numbering: "a\\"b\\\\")',
    );
  });
});

describe('US-002 AC-1c every heading is numbered', () => {
  it('US-002 AC-1c: emits no numbering exclusions: every heading, including Imprint, goes through the same numbering', () => {
    const out = typ('# The Handbook\n\n# Imprint\n\n# Reader Section');
    expect(out).toBe(
      '= The Handbook <h-the-handbook>\n\n= Imprint <h-imprint>\n\n= Reader Section <h-reader-section>',
    );
    expect(out).not.toMatch(/numbering|#set|#show/);
  });
});

describe('US-002 AC-2 label slug', () => {
  const cases: [string, string][] = [
    ['1 Reader Section', 'h-1-reader-section'],
    ['Spells & Crafts (Tessera)', 'h-spells-crafts-tessera'],
    ['Night’s Echo', 'h-night-s-echo'],
    ['Wait, card-playing game?', 'h-wait-card-playing-game'],
    ['  A  ', 'h-a'],
    ['A--B', 'h-a-b'],
    ['2024', 'h-2024'],
    ['Über', 'h-ber'],
    ['日本', 'h-section'],
    ['???', 'h-section'],
    ['', 'h-section'],
  ];
  it.each(cases)('US-002 AC-2: builds the label of %j as %s', (text, label) => {
    expect(slug(text)).toBe(label);
  });

  it('US-002 AC-2: removes non-ASCII letters: Über becomes h-ber', () => {
    expect(labels('# Über')).toEqual(['h-ber']);
    expect(typ('# Über')).toBe('= Über <h-ber>');
  });

  it('US-002 AC-2: falls back to h-section when nothing remains (two such headings give h-section and h-section-2)', () => {
    expect(labels('# ???\n\n# 日本')).toEqual(['h-section', 'h-section-2']);
    expect(typ('# 日本')).toBe('= 日本 <h-section>');
  });

  it('US-002 AC-2: always gives a label of lower-case ASCII letters, digits and single hyphens', () => {
    const pool = [...'aZ09 -_&?!.,:;()[]{}<>#$%^*+=~`|/\\"\'’éÜß日本İ́‍😀\t\n'];
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let i = 0; i < 2000; i++) {
      const len = next() % 12;
      let text = '';
      for (let k = 0; k < len; k++) text += pool[next() % pool.length];
      expect(slug(text), JSON.stringify(text)).toMatch(
        /^h-([a-z0-9]+(-[a-z0-9]+)*)$/,
      );
    }
  });
});

describe('US-002 AC-2b slug is stable', () => {
  it('US-002 AC-2b: gives the same label for a combined and a separate accent', () => {
    expect(slug('café')).toBe('h-caf');
    expect(slug('café')).toBe('h-caf');
  });

  it('US-002 AC-2b: lower-cases only A-Z (İstanbul gives h-stanbul, Straße gives h-stra-e)', () => {
    expect(slug('İstanbul')).toBe('h-stanbul');
    expect(slug('Straße')).toBe('h-stra-e');
  });
});

describe('US-002 AC-2c label text', () => {
  it('US-002 AC-2c: builds the label from the visible text: wikilink alias counts, footnote does not', () => {
    expect(
      labels('## See [[Tessera#Initiative|the rules]]^[note] now'),
    ).toEqual(['h-see-the-rules-now']);
  });

  it('US-002 AC-2c: counts text, code, emphasis, link text and image alt', () => {
    expect(labels('## A *b* `c` [d](x) ![e](f.png)')).toEqual(['h-a-b-c-d-e']);
  });

  it('US-002 AC-2c: a wikilink without alias gives file#anchor; an embed, tags and comments give nothing', () => {
    expect(labels('## [[Tessera#Initiative]]')).toEqual([
      'h-tessera-initiative',
    ]);
    expect(labels('## A ![[pic.png]] <u>b</u> <!-- c -->')).toEqual(['h-a-b']);
  });

  it('US-002 AC-2c: counts a break as one space and a run of blanks as one', () => {
    expect(labels('a\nb\n===')).toEqual(['h-a-b']);
    expect(visibleText(inlineOf(parse('## a  \tb').root[0]))).toBe('a b');
    expect(visibleText(inlineOf(parse('## a<br>b').root[0]))).toBe('a b');
  });

  it('US-002 AC-2c: keeps the visible text in the index for links (US-004)', () => {
    expect(index('## See *the* rules').list[0]?.text).toBe('See the rules');
  });
});

describe('US-002 AC-3 duplicates', () => {
  it('US-002 AC-3: suffixes duplicate headings in document order: h-rules, h-rules-2, h-rules-3', () => {
    expect(blocks('## Rules\n\n## Rules\n\n## Rules')).toEqual({
      typ: '== Rules <h-rules>\n\n== Rules <h-rules-2>\n\n== Rules <h-rules-3>',
      warnings: none,
    });
  });

  it('US-002 AC-3: raises no warning for repeated titles', () => {
    expect(blocks('# A\n\n## Intro\n\n# B\n\n## Intro').warnings).toEqual(none);
  });

  it('US-002 AC-3: a different case or punctuation of the same title is a duplicate', () => {
    expect(labels('# Intro\n\n# INTRO!\n\n# intro')).toEqual([
      'h-intro',
      'h-intro-2',
      'h-intro-3',
    ]);
  });
});

describe('US-002 AC-3b suffix never clashes', () => {
  it('US-002 AC-3b: takes the first free suffix when a later title already looks like a suffixed label', () => {
    expect(labels('## Intro\n\n## Intro\n\n## Intro 2')).toEqual([
      'h-intro',
      'h-intro-2',
      'h-intro-2-2',
    ]);
  });

  it('US-002 AC-3b: takes the next free suffix when the suffixed title came first', () => {
    expect(labels('## Intro\n\n## Intro 2\n\n## Intro')).toEqual([
      'h-intro',
      'h-intro-2',
      'h-intro-3',
    ]);
  });

  it('US-002 AC-3b: gives every heading of a mixed document a different label, without a warning', () => {
    const md = [
      '# A',
      '# A',
      '# A 2',
      '# A 2',
      '# A 2 2',
      '# A',
      '# A 3',
      '# A 2',
    ].join('\n\n');
    const all = labels(md);
    expect(new Set(all).size).toBe(all.length);
    expect(blocks(md).warnings).toEqual(none);
  });
});

describe('US-002 AC-4 formatting in headings', () => {
  it('US-002 AC-4: converts a heading with emphasis and code and builds label h-the-great-hall', () => {
    expect(blocks('## The *Great* `Hall`')).toEqual({
      typ: '== The _Great_ `Hall` <h-the-great-hall>',
      warnings: none,
    });
  });

  it('US-002 AC-4: does not treat the first text of a heading as the start of a block', () => {
    // A `-` or `1.` at the start would be a list in a paragraph (escaped there);
    // after the heading marker it is text.
    expect(typ('# - x')).toBe('= - x <h-x>');
    expect(typ('# 1. x')).toBe('= 1. x <h-1-x>');
  });
});

describe('US-002 AC-4b one line', () => {
  it('US-002 AC-4b: writes a break in heading text as one space, in text and label', () => {
    expect(blocks('A\nB\n===')).toEqual({typ: '= A B <h-a-b>', warnings: none});
    expect(typ('A  \nB\n---')).toBe('== A B <h-a-b>');
    expect(typ('## A<br>B')).toBe('== A B <h-a-b>');
    expect(typ('## A <br> B')).toBe('== A B <h-a-b>');
  });

  it('US-002 AC-4b: a closing </br> is not a break (US-001 AC-9): it is dropped with its warning', () => {
    expect(blocks('## A</br>B')).toEqual({
      typ: '== AB <h-ab>',
      warnings: [w('HTML_UNSUPPORTED', 'Unpaired HTML tag </br> dropped', 1)],
    });
  });

  it('US-002 AC-4b: writes a break inside emphasis as one space', () => {
    expect(typ('## *A<br>B*')).toBe('== _A B_ <h-a-b>');
  });

  it('US-002 AC-4b: drops a break at the start or the end', () => {
    expect(typ('## <br>A<br>')).toBe('== A <h-a>');
  });

  it('US-002 AC-4b: leaves a break in a paragraph unchanged', () => {
    expect(typ('a<br>b')).toBe('a\\\nb');
  });
});

describe('US-002 AC-4c label follows the text', () => {
  it('US-002 AC-4c: separates the label from text that ends in any kind of markup by one blank', () => {
    expect(typ('## A #b')).toBe('== A \\#b <h-a-b>');
    expect(typ('## a ~~s~~')).toBe('== a #strike[s] <h-a-s>');
    expect(typ('## a `c`')).toBe('== a `c` <h-a-c>');
    expect(typ('## a *b*')).toBe('== a _b_ <h-a-b>');
    expect(typ('## a **b**')).toBe('== a *b* <h-a-b>');
  });

  it('US-002 AC-4c: keeps heading text that starts with a block marker as text', () => {
    expect(typ('## = x')).toBe('== = x <h-x>');
    expect(typ('## + x')).toBe('== + x <h-x>');
    expect(typ('## / x')).toBe('== / x <h-x>');
  });

  it('US-002 AC-4c: separates the label from a heading that ends in an address', () => {
    expect(blocks('## see https://x.y').typ).toBe(
      '== see #link("https://x.y") <h-see-https-x-y>',
    );
  });
});

describe('US-002 AC-5 composed', () => {
  it('US-002 AC-5: keeps level and unique label for a heading inside a blockquote (#quote content block)', () => {
    expect(blocks('> ## Inside')).toEqual({
      typ: '#quote(block: true)[\n  == Inside <h-inside>\n]',
      warnings: none,
    });
  });

  it('US-002 AC-5: keeps a heading inside a list item with the text of the item after it', () => {
    expect(blocks('- ## X\n  y')).toEqual({
      typ: '- == X <h-x>\n\n  y',
      warnings: none,
    });
    expect(typ('- p\n\n  ## X')).toBe('- p\n\n  == X <h-x>');
    expect(typ('1. ## X')).toBe('1. == X <h-x>');
  });

  it('US-002 AC-5: keeps labels unique document-wide when the same heading text occurs inside and outside a list item', () => {
    expect(blocks('## Rules\n\n- ## Rules\n\n> ## Rules\n\n## Rules').typ).toBe(
      [
        '== Rules <h-rules>',
        '- == Rules <h-rules-2>',
        '#quote(block: true)[\n  == Rules <h-rules-3>\n]',
        '== Rules <h-rules-4>',
      ].join('\n\n'),
    );
  });
});

describe('US-002 AC-6 skipped levels', () => {
  it("US-002 AC-6: keeps '#' followed by '###' as '=' and '===' and reports HEADING_LEVEL_SKIPPED once", () => {
    expect(blocks('# A\n\n### B')).toEqual({
      typ: '= A <h-a>\n\n=== B <h-b>',
      warnings: [skipped(1, 3, 3)],
    });
  });

  it("US-002 AC-6: reports two warnings, in order, for '# A', '### B', '##### C' (1 to 3, 3 to 5)", () => {
    expect(blocks('# A\n\n### B\n\n##### C').warnings).toEqual([
      skipped(1, 3, 3),
      skipped(3, 5, 5),
    ]);
  });

  it('US-002 AC-6: does not warn when the first heading of the document starts at level 3', () => {
    expect(blocks('### A').warnings).toEqual(none);
    expect(blocks('###### A\n\n###### B').warnings).toEqual(none);
  });

  it("US-002 AC-6: does not warn on a level drop ('###' followed by '#')", () => {
    expect(blocks('### A\n\n# B').warnings).toEqual(none);
    expect(blocks('##### A\n\n## B\n\n### C').warnings).toEqual(none);
  });

  it('US-002 AC-6: measures a jump of any size from the previous heading', () => {
    expect(blocks('# A\n\n#### B').warnings).toEqual([skipped(1, 4, 3)]);
    expect(blocks('### A\n\n# B\n\n### C').warnings).toEqual([
      skipped(1, 3, 5),
    ]);
  });

  it('US-002 AC-6: counts headings inside quotes and list items in document order', () => {
    expect(blocks('# A\n\n> ### B').warnings).toEqual([skipped(1, 3, 3)]);
    expect(blocks('# A\n\n- ### B\n\n## C').warnings).toEqual([
      skipped(1, 3, 3),
    ]);
  });
});

describe('US-002 AC-7 empty heading', () => {
  it('US-002 AC-7: emits no heading and reports HEADING_EMPTY with the source line for ## without text', () => {
    expect(blocks('##')).toEqual({typ: '', warnings: [empty(1)]});
    expect(blocks('a\n\n##\n\nb')).toEqual({
      typ: 'a\n\nb',
      warnings: [empty(3)],
    });
  });

  it('US-002 AC-7: an omitted heading does not change the previous level of AC-6', () => {
    expect(blocks('# A\n##\n### B')).toEqual({
      typ: '= A <h-a>\n\n=== B <h-b>',
      warnings: [empty(2), skipped(1, 3, 3)],
    });
  });

  it('US-002 AC-7: an omitted heading takes no label and no duplicate suffix', () => {
    expect(labels('## A\n\n##\n\n## A')).toEqual(['h-a', 'h-a-2']);
  });

  it('US-002 AC-7: a heading with only a comment, a tag or a break is empty (the comment is still counted)', () => {
    expect(blocks('## <!-- x -->')).toEqual({
      typ: '',
      warnings: [empty(1), w('COMMENT_DROPPED', '1 HTML comment dropped', 1)],
    });
    expect(blocks('## <br>')).toEqual({typ: '', warnings: [empty(1)]});
    expect(blocks('## <u></u>').typ).toBe('');
  });

  it('US-002 AC-7: a heading with only an embed, a footnote or an empty image is not empty (label h-section)', () => {
    for (const md of ['## ![[pic.png]]', '## ^[note]', '## ![](x.png)']) {
      expect(labels(md), md).toEqual(['h-section']);
      expect(
        blocks(md).warnings.some((x) => x.code === 'HEADING_EMPTY'),
        md,
      ).toBe(false);
    }
  });
});

describe('US-002 index of the whole document', () => {
  it('US-002 AC-3: lists the non-empty headings in document order with depth, line, text and label', () => {
    const list = index('# A\n\n> ## B\n\n- ### C\n\n##\n\n# A').list;
    expect(
      list.map((i) => [i.depth, i.line, i.text, i.label, i.skippedFrom]),
    ).toEqual([
      [1, 1, 'A', 'h-a', null],
      [2, 3, 'B', 'h-b', null],
      [3, 5, 'C', 'h-c', null],
      [1, 9, 'A', 'h-a-2', null],
    ]);
  });

  it('US-002 AC-6: records the level a heading jumped from', () => {
    expect(
      index('# A\n\n### B\n\n##### C\n\n# D').list.map((i) => i.skippedFrom),
    ).toEqual([null, 1, 3, null]);
  });

  it('US-002 AC-3: gives the same result for the same input and does not change the tree', () => {
    const tree = parse('# A\n\n## A\n\n### B\n\n##\n\n> # A').root;
    const before = JSON.stringify(tree);
    const first = indexHeadings(tree);
    const second = indexHeadings(tree);
    expect(JSON.stringify(tree)).toBe(before);
    expect(first.list).toEqual(second.list);
    expect(first.list.map((i) => i.label)).toEqual([
      'h-a',
      'h-a-2',
      'h-b',
      'h-a-3',
    ]);
  });

  it('US-002 AC-3: emitBlocks with a given index gives the same Typst as without', () => {
    const md = '# A\n\n## A\n\n> ### B\n\n- ## A';
    const tree = parse(md).root;
    const ctx = new EmitContext();
    const given = emitBlocks(tree, ctx, {headings: indexHeadings(tree)});
    expect(given).toBe(typ(md));
  });
});
