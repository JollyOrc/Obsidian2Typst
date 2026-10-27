// US-014 AC-3 to AC-6 — source lines, robustness, purity and composed cases
// (unit, pure core). Source of truth: docs/user-stories/US-014-markdown-parsing.md.
// The long note is the generated sample note (US-024), its counts from the
// generator's manifest.
import {readFileSync, readdirSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {parse, type TreeNode} from '../../src/core/parse';
import {
  all,
  chain,
  children,
  has,
  nodesOf,
  root,
  textOf,
} from '../support/tree';
import {readManifest, readSample} from '../support/sample';

const REAL = readSample('Book.md');
const MANIFEST = readManifest();
const prop = (n: TreeNode, key: string): unknown =>
  (n as unknown as Record<string, unknown>)[key];

describe('US-014 AC-3 source lines', () => {
  it('US-014 AC-3: a link on line 6 of a paragraph that starts on line 5 reports line 6, after a 3-line frontmatter', () => {
    const md = '---\ntitle: x\n---\n\nfirst line\nsecond [x](u) line';
    expect(nodesOf(md, 'paragraph')[0]?.line).toBe(5);
    expect(nodesOf(md, 'link')[0]?.line).toBe(6);
    expect(nodesOf(md, 'text').map((n) => n.line)).toEqual([5, 6, 6, 6]);
  });

  it('US-014 AC-3: blocks report their start line (heading, list items, quote, code, rule, table rows, footnote definition)', () => {
    const md = [
      '# H', // 1
      '', // 2
      '- a', // 3
      '- b', // 4
      '  - c', // 5
      '', // 6
      '> q', // 7
      '> r', // 8
      '', // 9
      '```', // 10
      'x', // 11
      '```', // 12
      '', // 13
      '---', // 14
      '', // 15
      '| a | b |', // 16
      '|---|---|', // 17
      '| 1 | 2 |', // 18
      '| 3 | 4 |', // 19
      '', // 20
      '[^n]: note', // 21
    ].join('\n');
    const lines = (kind: string) => nodesOf(md, kind).map((n) => n.line);
    expect(lines('heading')).toEqual([1]);
    expect(lines('item')).toEqual([3, 4, 5]);
    expect(lines('blockquote')).toEqual([7]);
    expect(lines('code')).toEqual([10]);
    expect(lines('thematic-break')).toEqual([14]);
    expect(lines('table')).toEqual([16]);
    expect(lines('row')).toEqual([16, 18, 19]);
    expect(lines('cell')).toEqual([16, 16, 18, 18, 19, 19]);
    expect(lines('footnote-def')).toEqual([21]);
  });

  it('US-014 AC-3: soft and hard breaks advance the inline line; inline nodes in table cells take the row line', () => {
    const md =
      'a  \nb\nc *d*\n\n| x | y^[n] <!-- c --> |\n|---|---|\n| 1 | [z](#q) |';
    expect(nodesOf(md, 'emph')[0]?.line).toBe(3);
    expect(nodesOf(md, 'inline-footnote')[0]?.line).toBe(5);
    expect(nodesOf(md, 'comment')[0]?.line).toBe(5);
    expect(nodesOf(md, 'link')[0]?.line).toBe(7);
  });

  it('US-014 AC-3: every anchor link, image and comment of the sample note reports the source line that contains it', () => {
    const lines = REAL.split('\n');
    let checked = 0;
    for (const n of all(parse(REAL).root)) {
      const text = lines[n.line - 1] ?? '';
      if (n.kind === 'link' && n.href.startsWith('#')) {
        expect(text, `anchor link on line ${n.line}`).toContain('](#');
        checked++;
      } else if (n.kind === 'image') {
        expect(text, `image on line ${n.line}`).toContain('![');
        checked++;
      } else if (n.kind === 'comment') {
        expect(text, `comment on line ${n.line}`).toContain('<!--');
        checked++;
      }
    }
    const {census} = MANIFEST;
    expect(checked).toBe(
      (census.hrefs['link:inline:anchor'] ?? 0) +
        MANIFEST.images.total +
        MANIFEST.comments.count,
    );
  });
});

describe('US-014 AC-4 robustness and no loss', () => {
  it('US-014 AC-4: parses the sample note without an exception and with the counts of its manifest', () => {
    const nodes = all(parse(REAL).root);
    const count = (kind: string, pred: (n: TreeNode) => boolean = () => true) =>
      nodes.filter((n) => n.kind === kind && pred(n)).length;
    const {census} = MANIFEST;
    const kind = (k: string): number => census.kinds[k] ?? 0;
    expect(count('heading')).toBe(
      Object.values(census.depths).reduce((a, b) => a + b, 0),
    );
    expect(count('table')).toBe(census.tables);
    expect(count('list')).toBe(census.lists.bullet + census.lists.ordered);
    expect(count('link')).toBe(kind('link'));
    expect(count('link', (n) => String(prop(n, 'href')).startsWith('#'))).toBe(
      census.hrefs['link:inline:anchor'],
    );
    expect(count('image')).toBe(MANIFEST.images.total);
    expect(count('comment')).toBe(MANIFEST.comments.count);
    expect(count('inline-footnote')).toBe(kind('inline-footnote'));
    expect(count('html-inline', (n) => prop(n, 'name') === 'br')).toBe(
      census.html['html-inline:br'],
    );
    expect(count('strong')).toBe(kind('strong'));
    expect(count('emph')).toBe(kind('emph'));
    expect(count('blockquote')).toBe(kind('blockquote'));
    expect(count('break')).toBe(kind('break'));
    expect(count('wikilink')).toBe(kind('wikilink'));
    expect(count('embed')).toBe(kind('embed'));
    expect(parse(REAL).frontmatter).toBeNull();
  });

  it('US-014 AC-4: empty input, frontmatter only and whitespace give an empty tree', () => {
    expect(parse('')).toEqual({frontmatter: null, root: []});
    expect(parse('\n\n  \n')).toEqual({frontmatter: null, root: []});
    expect(parse('---\na: 1\n---\n')).toEqual({frontmatter: 'a: 1', root: []});
    expect(parse('---\na: 1\n---')).toEqual({frontmatter: 'a: 1', root: []});
  });

  it('US-014 AC-4: malformed constructs become literal text and never throw', () => {
    const inputs = [
      'a **b',
      'a *b',
      'a ~~b',
      'a ==b',
      'a ^[b',
      'a ^[b [c]',
      'a [[b',
      'a ![[b',
      'a [^b',
      '[^b]:',
      'a <!-- b',
      '<!--',
      'a <u>b',
      '[x](',
      '[x](<a b',
      '![x](',
      '| a |\n|--',
      '```js\nunclosed',
      '> > > deep',
      '- [ ]',
      '- [x]no space',
      '\u0000\u0001 control',
      'a\r\nb\rc',
      '😀 **😀** [😀](😀)',
      'x'.repeat(200000),
      '[ '.repeat(5000),
      '*'.repeat(3000),
    ];
    for (const md of inputs) {
      expect(() => parse(md), JSON.stringify(md.slice(0, 40))).not.toThrow();
    }
    expect(textOf(root('a **b')[0] as TreeNode)).toBe('a **b');
    expect(textOf(root('a ^[b')[0] as TreeNode)).toBe('a ^[b');
    expect(has('a ^[b', 'inline-footnote')).toBe(false);
    expect(has('a [[b', 'wikilink')).toBe(false);
    expect(textOf(root('a [[b')[0] as TreeNode)).toBe('a [[b');
    expect(textOf(root('a ![[b')[0] as TreeNode)).toBe('a ![[b');
  });

  it('US-014 AC-4: the text of a paragraph is kept exactly, formatting removed', () => {
    const p = root('x **b** _i_ ~~d~~ ==m== `c` [l](u) ^[n] ![a](i.png) y')[0];
    expect(textOf(p as TreeNode)).toBe('x b i d m c l n a y');
  });

  it('US-014 AC-4: no word of the sample note is lost or invented', () => {
    const words = (s: string) =>
      s.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
    const tally = (ws: string[]) => {
      const m = new Map<string, number>();
      ws.forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
      return m;
    };
    const treeText = all(parse(REAL).root)
      .map((n) => {
        if (n.kind === 'text' || n.kind === 'code-inline' || n.kind === 'code')
          return n.value;
        if (n.kind === 'image') return n.alt;
        // The sample note has wikilinks and embeds (the real file had none):
        // their words are in the node's fields.
        if (n.kind === 'wikilink' || n.kind === 'embed')
          return [n.file, n.anchor ?? '', n.alias ?? ''].join(' ');
        return '';
      })
      .join(' ');
    // Source without markup that is not text: comments, link and image
    // destinations, html tags, footnote labels, table delimiter rows. Pure
    // digit words are ignored (list numbers belong to the markup).
    const source = REAL.replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\^[^\]]*\]/g, ' ')
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
      // task markers are markup too (the parser keeps them as `checked`)
      .replace(/^([\s>]*[-*+] )\[[ xX]\] /gm, '$1');
    const a = tally(words(source));
    const b = tally(words(treeText));
    const lost: string[] = [];
    const invented: string[] = [];
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      const d = (a.get(k) ?? 0) - (b.get(k) ?? 0);
      if (d > 0 && !/^\d+$/.test(k)) lost.push(`${k}:${d}`);
      if (d < 0) invented.push(`${k}:${-d}`);
    }
    expect(lost.slice(0, 10)).toEqual([]);
    expect(invented.slice(0, 10)).toEqual([]);
  });
});

describe('US-014 AC-5 purity and determinism', () => {
  it('US-014 AC-5: returns an equal tree for equal input, and the tree is plain data', () => {
    const a = parse(REAL);
    expect(a).toEqual(parse(REAL));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('US-014 AC-5: parsing one document does not change the next (no shared state between calls)', () => {
    const first = parse('[^1]: a\n\ntext[^1] ^[x]');
    parse('other[^1] ^[y]\n\n[^1]: b');
    expect(parse('[^1]: a\n\ntext[^1] ^[x]')).toEqual(first);
  });

  it('US-014 AC-5: core/parse imports only relative files and markdown-it packages', () => {
    const dir = 'src/core/parse';
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      const specs = [
        ...src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g),
      ].map((m) => m[1] as string);
      for (const s of specs) {
        expect(s, `${f} imports ${s}`).toMatch(/^(\.\.?\/|markdown-it)/);
      }
    }
  });
});

describe('US-014 AC-6 composed constructs', () => {
  it('US-014 AC-6: a link inside a heading has the parents heading > link', () => {
    expect(chain('## See [x](https://a.org)', 'link')).toEqual([
      'heading',
      'link',
    ]);
  });

  it('US-014 AC-6: a footnote reference inside a table cell has the parents table > row > cell', () => {
    const md = '| a[^1] | b |\n|---|---|\n| 1 | 2 |\n\n[^1]: n';
    expect(chain(md, 'footnote-ref')).toEqual([
      'table',
      'row',
      'cell',
      'footnote-ref',
    ]);
  });

  it('US-014 AC-6: emphasis inside a link label has the parents paragraph > link > emph', () => {
    expect(chain('[a *b* c](https://a.org)', 'emph')).toEqual([
      'paragraph',
      'link',
      'emph',
    ]);
  });

  it('US-014 AC-6: a list inside a blockquote inside a list item nests three levels', () => {
    const md = '- a\n  > - b\n  >   - c';
    expect(nodesOf(md, 'list')).toHaveLength(3);
    expect(chain(md, 'blockquote')).toEqual(['list', 'item', 'blockquote']);
    expect(nodesOf(md, 'list').at(-1)?.line).toBe(3);
  });

  it('US-014 AC-6: a task item in a nested list in a blockquote keeps checked and its line', () => {
    const md = '> - a\n>   - [x] b';
    const task = nodesOf(md, 'item').find((i) => prop(i, 'checked') === true);
    expect(task?.line).toBe(2);
    expect(textOf(task as TreeNode)).toBe('b');
  });

  it('US-014 AC-6: an inline footnote holds emphasis and a link; a comment sits inside a table cell and a list item', () => {
    const fn = nodesOf('a^[x *y* [z](u)]', 'inline-footnote')[0] as TreeNode;
    expect(children(fn).map((n) => n.kind)).toEqual([
      'text',
      'emph',
      'text',
      'link',
    ]);
    expect(chain('| a <!-- c --> |\n|---|\n| b |', 'comment')).toEqual([
      'table',
      'row',
      'cell',
      'comment',
    ]);
    expect(chain('- a <!-- c -->', 'comment')).toEqual([
      'list',
      'item',
      'paragraph',
      'comment',
    ]);
  });

  it('US-014 AC-6: a wikilink in a table cell may use an escaped pipe for its alias', () => {
    const md = '| [[A\\|b]] | c |\n|---|---|\n| 1 | 2 |';
    expect(nodesOf(md, 'wikilink')[0]).toMatchObject({file: 'A', alias: 'b'});
  });
});

describe('US-014 AC-6 hostile combinations (spike: remark failed two of these)', () => {
  it('US-014 AC-6: emphasis inside a wikilink alias still gives a wikilink, and mark may contain emphasis', () => {
    expect(has('a [[A|*b*]] c', 'wikilink')).toBe(true);
    expect(chain('==a *b* c==', 'emph')).toEqual(['paragraph', 'mark', 'emph']);
  });

  it('US-014 AC-6: wikilinks, marks and inline footnotes inside code spans and code blocks stay code, unchanged', () => {
    for (const code of ['[[A]]', '^[x]', '==x==', '[^1]', '![[a.png]]']) {
      const md = `a \`${code}\` c`;
      expect(
        children(root(md)[0] as TreeNode).map((n) => n.kind),
        code,
      ).toEqual(['text', 'code-inline', 'text']);
      expect(nodesOf(md, 'code-inline')[0]).toMatchObject({value: code});
      expect(root(`\`\`\`\n${code}\n\`\`\``)[0], code).toMatchObject({
        kind: 'code',
        value: code,
      });
    }
  });

  it('US-014 AC-6: nested brackets in an inline footnote; a wikilink inside a link label (known limit, nothing is lost)', () => {
    const fn = nodesOf('a^[b [c] d] e', 'inline-footnote')[0] as TreeNode;
    expect(textOf(fn)).toBe('b [c] d');
    // Known limit (CommonMark: a link cannot contain a link): a wikilink in a
    // link label breaks the outer link; everything stays visible as text.
    const md = '[see [[A]]](https://a.org)';
    expect(has(md, 'link', (n) => prop(n, 'markup') === 'inline')).toBe(false);
    expect(has(md, 'wikilink')).toBe(true);
    expect(textOf(root(md)[0] as TreeNode)).toBe('[see ' + '](https://a.org)');
  });
});
