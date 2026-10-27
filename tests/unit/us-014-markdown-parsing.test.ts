// US-014 AC-1b and AC-2 — the tree shape and the constructs of the real input
// (unit, pure core). Source of truth: docs/user-stories/US-014-markdown-parsing.md
// and docs/technical/markdown-parser.md. Exact tree comparisons. Lines,
// robustness, purity and composed cases: us-014-parse-lines-robustness.test.ts.
import {describe, expect, it} from 'vitest';
import {parse, type TreeNode} from '../../src/core/parse';
import {chain, has, nodesOf, root, textOf} from '../support/tree';

const text = (line: number, value: string) => ({kind: 'text', line, value});

describe('US-014 AC-1b tree shape', () => {
  it('US-014 AC-1b: returns {frontmatter: null, root} for a document without frontmatter', () => {
    expect(parse('text')).toEqual({
      frontmatter: null,
      root: [{kind: 'paragraph', line: 1, children: [text(1, 'text')]}],
    });
  });

  it('US-014 AC-1b: strips frontmatter, returns it as a string and counts its lines', () => {
    const result = parse('---\ntitle: x\ntags: [a]\n---\n\ntext');
    expect(result.frontmatter).toBe('title: x\ntags: [a]');
    expect(result.root).toEqual([
      {kind: 'paragraph', line: 6, children: [text(6, 'text')]},
    ]);
    expect(parse('---\r\na: 1\r\n---\r\n\r\ntext').root[0]?.line).toBe(5);
  });

  it('US-014 AC-1b: inline formatting becomes nested nodes with the line of the block', () => {
    const wrap = (kind: string, value: string) => ({
      kind,
      line: 1,
      children: [text(1, value)],
    });
    expect(root('a **b** *c* ~~d~~ ==e== `f`')).toEqual([
      {
        kind: 'paragraph',
        line: 1,
        children: [
          text(1, 'a '),
          wrap('strong', 'b'),
          text(1, ' '),
          wrap('emph', 'c'),
          text(1, ' '),
          wrap('delete', 'd'),
          text(1, ' '),
          wrap('mark', 'e'),
          text(1, ' '),
          {kind: 'code-inline', line: 1, value: 'f'},
        ],
      },
    ]);
  });

  it('US-014 AC-1b: heading carries its depth; setext headings too', () => {
    expect(root('## Two\n\nThree\n=====')).toEqual([
      {kind: 'heading', line: 1, depth: 2, children: [text(1, 'Two')]},
      {kind: 'heading', line: 3, depth: 1, children: [text(3, 'Three')]},
    ]);
  });

  it('US-014 AC-1b: lists carry ordered and start; items carry checked and their blocks', () => {
    const item = (line: number, value: string) => ({
      kind: 'item',
      line,
      checked: null,
      children: [{kind: 'paragraph', line, children: [text(line, value)]}],
    });
    expect(root('3. a\n4. b')).toEqual([
      {
        kind: 'list',
        line: 1,
        ordered: true,
        start: 3,
        children: [item(1, 'a'), item(2, 'b')],
      },
    ]);
    const bullets = root('* a\n\ntext\n\n+ b\n\ntext\n\n- c');
    expect(bullets.filter((n) => n.kind === 'list')).toHaveLength(3);
    expect(bullets[0]).toMatchObject({ordered: false, start: null});
  });

  it('US-014 AC-1b: task items carry checked true or false and no checkbox text', () => {
    const items = nodesOf('- [ ] a\n- [x] b\n- [X] c\n- d', 'item');
    expect(items.map((i) => (i as {checked: boolean | null}).checked)).toEqual([
      false,
      true,
      true,
      null,
    ]);
    expect(items.map((i) => textOf(i))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('US-014 AC-1b: blockquote, fenced code, indented code and thematic break', () => {
    const md = '> q\n\n```js\nlet a = 1;\n\nb\n```\n\n    indented\n\n---';
    expect(root(md)).toEqual([
      {
        kind: 'blockquote',
        line: 1,
        children: [{kind: 'paragraph', line: 1, children: [text(1, 'q')]}],
      },
      {kind: 'code', line: 3, lang: 'js', value: 'let a = 1;\n\nb'},
      {kind: 'code', line: 9, lang: '', value: 'indented'},
      {kind: 'thematic-break', line: 11},
    ]);
  });

  it('US-014 AC-1b: a table has align per column, header and body rows, and cells with inline children', () => {
    const cell = (line: number, value: string) => ({
      kind: 'cell',
      line,
      children: [text(line, value)],
    });
    expect(root('| a | b |\n|:--:|--:|\n| 1 | 2 |')).toEqual([
      {
        kind: 'table',
        line: 1,
        align: ['center', 'right'],
        children: [
          {
            kind: 'row',
            line: 1,
            header: true,
            children: [cell(1, 'a'), cell(1, 'b')],
          },
          {
            kind: 'row',
            line: 3,
            header: false,
            children: [cell(3, '1'), cell(3, '2')],
          },
        ],
      },
    ]);
    const three = root('|a|b|c|\n|---|:--|--:|\n|1|2|3|')[0] as {
      align: unknown;
    };
    expect(three.align).toEqual([null, 'left', 'right']);
  });

  it('US-014 AC-1b: links carry href as written, title and markup (inline, autolink, linkify)', () => {
    const link = (md: string) => nodesOf(md, 'link')[0];
    expect(link('[x](../a%20b.md#Prism%20Variants "T")')).toEqual({
      kind: 'link',
      line: 1,
      href: '../a%20b.md#Prism%20Variants',
      title: 'T',
      markup: 'inline',
      children: [text(1, 'x')],
    });
    expect(link('<https://a.org>')).toMatchObject({
      href: 'https://a.org',
      markup: 'autolink',
      title: null,
    });
    expect(link('see https://a.org/x now')).toMatchObject({
      href: 'https://a.org/x',
      markup: 'linkify',
    });
    expect(link('[x](mailto:a@b.de)')).toMatchObject({href: 'mailto:a@b.de'});
    expect(link('[x](#anchor)')).toMatchObject({href: '#anchor'});
  });

  it('US-014 AC-1b: images carry src as written (no re-encoding), alt and title', () => {
    expect(nodesOf('![A *b*](assets/a%20b.png "T")', 'image')).toEqual([
      {kind: 'image', line: 1, src: 'assets/a%20b.png', alt: 'A b', title: 'T'},
    ]);
    expect(nodesOf('![a](<assets/ä b.png>)', 'image')[0]).toMatchObject({
      src: 'assets/ä b.png',
    });
    expect(nodesOf('![](x.png)', 'image')[0]).toMatchObject({
      alt: '',
      title: null,
    });
  });

  it('US-014 AC-1b: wikilink and embed carry file, anchor and alias (size for embeds)', () => {
    expect(nodesOf('a [[Tessera]] b', 'wikilink')[0]).toEqual({
      kind: 'wikilink',
      line: 1,
      file: 'Tessera',
      anchor: null,
      alias: null,
    });
    expect(nodesOf('[[Rules#Tessera|fighting]]', 'wikilink')[0]).toMatchObject({
      file: 'Rules',
      anchor: 'Tessera',
      alias: 'fighting',
    });
    expect(nodesOf('[[#Tessera]]', 'wikilink')[0]).toMatchObject({
      file: '',
      anchor: 'Tessera',
    });
    expect(nodesOf('![[a.png|300]]', 'embed')[0]).toEqual({
      kind: 'embed',
      line: 1,
      file: 'a.png',
      anchor: null,
      alias: '300',
    });
  });

  it('US-014 AC-1b: footnote references, definitions (at the position of the definition) and inline footnotes', () => {
    const tree = root('Text[^1] and^[inline *x*].\n\n[^1]: The note.\n\nlast');
    expect(tree.map((n) => n.kind)).toEqual([
      'paragraph',
      'footnote-def',
      'paragraph',
    ]);
    expect(nodesOf('Text[^1].', 'footnote-ref')[0]).toEqual({
      kind: 'footnote-ref',
      line: 1,
      label: '1',
    });
    expect(tree[1]).toEqual({
      kind: 'footnote-def',
      line: 3,
      label: '1',
      children: [
        {kind: 'paragraph', line: 3, children: [text(3, 'The note.')]},
      ],
    });
    expect(nodesOf('a^[inline *x*]', 'inline-footnote')[0]).toEqual({
      kind: 'inline-footnote',
      line: 1,
      children: [
        text(1, 'inline '),
        {kind: 'emph', line: 1, children: [text(1, 'x')]},
      ],
    });
  });

  it('US-014 AC-1b: unreferenced footnote definitions stay in the tree (US-005 reports FOOTNOTE_UNUSED)', () => {
    expect(nodesOf('text\n\n[^9]: never used', 'footnote-def')).toHaveLength(1);
  });

  it('US-014 AC-1b: comments (inline and block), html tags and breaks', () => {
    expect(root('a <!-- c --> b')[0]).toMatchObject({
      children: [
        {kind: 'text', value: 'a '},
        {kind: 'comment', line: 1, value: '<!-- c -->'},
        {kind: 'text', value: ' b'},
      ],
    });
    expect(root('<!-- c\nd -->\n\ntext')[0]).toEqual({
      kind: 'comment',
      line: 1,
      value: '<!-- c\nd -->',
    });
    const tag = (name: string, closing: boolean, value: string) => ({
      kind: 'html-inline',
      line: 1,
      name,
      closing,
      value,
    });
    expect(nodesOf('a <u>x</u><br>b', 'html-inline')).toEqual([
      tag('u', false, '<u>'),
      tag('u', true, '</u>'),
      tag('br', false, '<br>'),
    ]);
    expect(root('<div>\nx\n</div>')[0]).toEqual({
      kind: 'html-block',
      line: 1,
      value: '<div>\nx\n</div>',
    });
    expect(root('a  \nb\nc')[0]).toMatchObject({
      children: [
        {kind: 'text', value: 'a'},
        {kind: 'break', line: 1},
        {kind: 'text', value: 'b', line: 2},
        {kind: 'softbreak', line: 2},
        {kind: 'text', value: 'c', line: 3},
      ],
    });
  });

  it('US-014 AC-1b: escapes and entities become plain text, merged into one text node', () => {
    expect(root('a \\* b &amp; c')[0]).toEqual({
      kind: 'paragraph',
      line: 1,
      children: [text(1, 'a * b & c')],
    });
  });

  it('US-014 AC-1b: tags stay text and do not become headings', () => {
    expect(root('Needs #tessera and #prism/fire.')[0]).toEqual({
      kind: 'paragraph',
      line: 1,
      children: [text(1, 'Needs #tessera and #prism/fire.')],
    });
    expect(root('#tessera')[0]?.kind).toBe('paragraph');
  });
});

const prop = <K extends string>(n: TreeNode, key: K): unknown =>
  (n as unknown as Record<string, unknown>)[key];

describe('US-014 AC-2 constructs of the real input', () => {
  const FIXTURES: [string, string, (md: string) => boolean][] = [
    ['strong', '**a**', (m) => has(m, 'strong')],
    ['emph with star', '*a*', (m) => has(m, 'emph')],
    ['emph with underscore', '_a_', (m) => has(m, 'emph')],
    ['delete', '~~a~~', (m) => has(m, 'delete')],
    ['mark', '==a==', (m) => has(m, 'mark')],
    ['inline code', '`a`', (m) => has(m, 'code-inline')],
    ['link', '[x](https://a.org)', (m) => has(m, 'link')],
    [
      'autolink',
      '<https://a.org>',
      (m) => has(m, 'link', (n) => prop(n, 'markup') === 'autolink'),
    ],
    [
      'bare url',
      'see https://a.org/x now',
      (m) => has(m, 'link', (n) => prop(n, 'markup') === 'linkify'),
    ],
    ['wikilink', 'a [[A]] b', (m) => has(m, 'wikilink')],
    [
      'wikilink alias',
      'a [[A|b]] b',
      (m) => has(m, 'wikilink', (n) => prop(n, 'alias') === 'b'),
    ],
    [
      'wikilink anchor',
      'a [[A#B]] b',
      (m) => has(m, 'wikilink', (n) => prop(n, 'anchor') === 'B'),
    ],
    [
      'embed with size',
      '![[a.png|300]]',
      (m) => has(m, 'embed', (n) => prop(n, 'alias') === '300'),
    ],
    ['image', '![alt](a%20b.png)', (m) => has(m, 'image')],
    [
      'footnote reference and definition',
      'Text[^1].\n\n[^1]: The note.',
      (m) => has(m, 'footnote-ref') && has(m, 'footnote-def'),
    ],
    ['inline footnote', 'Text^[The *note*].', (m) => has(m, 'inline-footnote')],
    [
      'task item',
      '- [ ] a\n- [x] b',
      (m) =>
        nodesOf(m, 'item').length === 2 &&
        has(m, 'item', (n) => prop(n, 'checked') === true),
    ],
    [
      'star list',
      '* a\n* b',
      (m) => has(m, 'list', (n) => prop(n, 'ordered') === false),
    ],
    [
      'tab nested list of depth 3',
      '* a\n\t* b\n\t\t* c',
      (m) => nodesOf(m, 'list').length === 3,
    ],
    ['comment inline', 'Text <!-- c --> more', (m) => has(m, 'comment')],
    ['comment block', '<!-- c\nd -->\n\ntext', (m) => has(m, 'comment')],
    [
      'html u',
      'a <u>x</u> b',
      (m) => has(m, 'html-inline', (n) => prop(n, 'name') === 'u'),
    ],
    [
      'html br',
      'a<br>b',
      (m) => has(m, 'html-inline', (n) => prop(n, 'name') === 'br'),
    ],
    ['hard break', 'a  \nb', (m) => has(m, 'break')],
    [
      'table with alignment',
      '| a | b |\n|:--:|--:|\n| 1 | 2 |',
      (m) =>
        JSON.stringify(prop(nodesOf(m, 'table')[0] as TreeNode, 'align')) ===
        '["center","right"]',
    ],
    [
      'table with br',
      '| a<br>b | c |\n|---|---|\n| 1 | 2 |',
      (m) =>
        has(m, 'table') &&
        has(m, 'html-inline', (n) => prop(n, 'name') === 'br'),
    ],
    ['tag is text', 'Needs #tessera now', (m) => !has(m, 'heading')],
    [
      'heading',
      '## Spell *x*',
      (m) => has(m, 'heading', (n) => prop(n, 'depth') === 2),
    ],
    [
      'list in blockquote',
      '> - a\n>   - b',
      (m) => chain(m, 'list').join() === 'blockquote,list',
    ],
    [
      'frontmatter',
      '---\ntitle: x\n---\n\ntext',
      () => parse('---\ntitle: x\n---\n\ntext').frontmatter === 'title: x',
    ],
  ];

  for (const [label, md, check] of FIXTURES) {
    it(`US-014 AC-2: distinguishes ${label}`, () => {
      expect(check(md), JSON.stringify(md)).toBe(true);
    });
  }
});
