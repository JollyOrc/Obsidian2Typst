// US-001 — inline text conversion (unit, pure core) and test stubs for the
// block elements that follow in later tickets. Source of truth:
// docs/user-stories/US-001-convert-markdown-to-typst.md. Exact string
// comparison, real parser (US-014), real emitter. The rules are proven against
// the compiler in tests/integration/us-001-inline-roundtrip.test.ts.
// Titles start with the AC id so that the AC-coverage check can map them.
import {describe, expect, it} from 'vitest';
import {EmitContext, emitInline} from '../../src/core/emit';
import type {InlineNode} from '../../src/core/parse';
import {parse} from '../../src/core/parse';
import {typ as blockTyp} from '../support/blocks';
import {SETTINGS, run} from '../support/convert';
import {emitNodes, inline, inlineOf, paragraphs, typ} from '../support/inline';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const unsupported = (kind: string, line = 1) =>
  w('NODE_UNSUPPORTED', `No emitter for ${kind}; its text is kept`, line);
const none: never[] = [];

describe('US-001 inline emitter: marks (AC-1, AC-1c, AC-2, AC-2b)', () => {
  it('US-001 AC-1: converts **bold**, *italic*, _italic_, `code`, ~~gone~~, ==marked== to *bold*, _italic_, _italic_, `code`, #strike[gone], #highlight[marked]', () => {
    expect(
      inline('**bold**, *italic*, _italic_, `code`, ~~gone~~, ==marked=='),
    ).toEqual({
      typ: '*bold*, _italic_, _italic_, `code`, #strike[gone], #highlight[marked]',
      warnings: none,
    });
  });

  it('US-001 AC-1c: separates a call from a following . ( or ; and leaves other followers alone', () => {
    expect(typ('~~gone~~.Next')).toBe('#strike[gone];.Next');
    expect(typ('==x==(see p. 3)')).toBe('#highlight[x];(see p. 3)');
    expect(typ('~~a~~; b')).toBe('#strike[a];; b');
    expect(typ('~~a~~, b')).toBe('#strike[a], b');
    expect(typ('x**y**(z)')).toBe('x#strong[y];(z)');
    expect(typ('a/**b**')).toBe('a/#strong[b]');
  });

  it('US-001 AC-1c: a call at the end of its parent needs no separator and a call before a blank none either', () => {
    expect(typ('~~a~~')).toBe('#strike[a]');
    expect(typ('~~a~~ b')).toBe('#strike[a] b');
    expect(typ('**~~a~~**')).toBe('*#strike[a]*');
  });

  it('US-001 AC-2: preserves two-level nesting: **bold and _italic inside_ it** becomes *bold and _italic inside_ it*', () => {
    expect(typ('**bold and _italic inside_ it**')).toBe(
      '*bold and _italic inside_ it*',
    );
  });

  it('US-001 AC-2: converts ***both*** to _*both*_ (the parser nests emphasis around strong; empty text nodes are ignored)', () => {
    expect(typ('***both***')).toBe('_*both*_');
    expect(typ('~~**a**~~')).toBe('#strike[*a*]');
    expect(typ('==_a_ and **b**==')).toBe('#highlight[_a_ and *b*]');
  });

  it('US-001 AC-2b: uses delimiter form next to spaces, punctuation and boundaries', () => {
    expect(typ('a *b* c, (*b*), *b*.')).toBe('a _b_ c, (_b_), _b_.');
    expect(typ('_(inner **x**)_')).toBe('_(inner *x*)_');
  });

  it('US-001 AC-2b: uses #emph/#strong for a*b*c and **word**s', () => {
    expect(typ('a*b*c')).toBe('a#emph[b]c');
    expect(typ('**word**s and x**y**')).toBe('#strong[word]s and x#strong[y]');
  });

  it('US-001 AC-2b: uses the function form when the emphasis ends in an address or link', () => {
    expect(inline('**https://example.org**')).toEqual({
      typ: '#strong[https:\\/\\/example.org]',
      warnings: [unsupported('link')],
    });
    expect(inline('**see [x](https://a.org)**')).toEqual({
      typ: '#strong[see x]',
      warnings: [unsupported('link')],
    });
    // not at the end: the link inside does not force the function form
    expect(typ('**[x](https://a.org) and more**')).toBe('*x and more*');
  });

  it('US-001 AC-2b: decides per mark from what is really next to it, ignoring dropped comments and unwrapped spans', () => {
    expect(typ('a<!-- c -->*b*')).toBe('a#emph[b]');
    expect(typ('*b*<span>c</span>')).toBe('#emph[b]c');
    expect(typ('<span>a</span>*b*<span> c</span>')).toBe('a#emph[b] c');
  });

  it('US-001 AC-2b: uses the function form when the content starts or ends with a blank', () => {
    const nodes: InlineNode[] = [
      {
        kind: 'strong',
        line: 1,
        children: [
          {
            kind: 'html-inline',
            line: 1,
            name: 'span',
            closing: false,
            value: '',
          },
          {kind: 'text', line: 1, value: ' x '},
          {
            kind: 'html-inline',
            line: 1,
            name: 'span',
            closing: true,
            value: '',
          },
        ],
      },
    ];
    expect(emitNodes(nodes).typ).toBe('#strong[ x ]');
  });

  it('US-001 AC-2b: drops emphasis whose content is empty after dropped tags and comments', () => {
    expect(inline('a **<!-- c -->** b').typ).toBe('a  b');
    expect(typ('a ~~<span></span>~~ b')).toBe('a  b');
  });
});

describe('US-001 inline emitter: escaping (AC-3, AC-4, AC-4b, AC-14)', () => {
  it('US-001 AC-3: escapes $ # @ < > [ ] ~ in literal text: Price: $5 for item #3 @ home, see \\<here> and [there] ~ ok', () => {
    expect(
      typ('Price: $5 for item #3 @ home, see \\<here> and [there] ~ ok'),
    ).toBe(
      'Price: \\$5 for item \\#3 \\@ home, see \\<here\\> and \\[there\\] \\~ ok',
    );
  });

  it('US-001 AC-3: escapes backslash, asterisk, underscore, backtick, and turns // into \\/\\/', () => {
    expect(typ('a\\\\b \\* \\_ \\` x // y')).toBe(
      'a\\\\b \\* \\_ \\` x \\/\\/ y',
    );
  });

  it("US-001 AC-4: escapes a paragraph starting with '= ' as '\\= 5 apples'", () => {
    expect(typ('= 5 apples')).toBe('\\= 5 apples');
  });

  it("US-001 AC-4: escapes a leading '+ ', '- ', '/ ' that was not a list in the Markdown", () => {
    expect(typ('\\+ x')).toBe('\\+ x');
    expect(typ('\\- x')).toBe('\\- x');
    expect(typ('/ x')).toBe('\\/ x');
    expect(typ('1\\. x')).toBe('1\\. x');
    expect(typ('2020\\. A year')).toBe('2020\\. A year');
  });

  it("US-001 AC-4: keeps '--', '---' and '...' unescaped (Typst typography is kept)", () => {
    expect(typ('wait -- what --- really...')).toBe(
      'wait -- what --- really...',
    );
  });

  it("US-001 AC-4: escapes the sequence '-?' as '\\-?'", () => {
    expect(typ('a-?b')).toBe('a\\-?b');
  });

  it('US-001 AC-4: never alters text inside inline code or code blocks', () => {
    expect(typ('`a_b *c* #d $e`')).toBe('`a_b *c* #d $e`');
    expect(typ('`a``b`')).toBe('#raw("a``b")');
    expect(typ('`` a`b ``')).toBe('#raw("a`b")');
  });

  it('US-001 AC-4b: escapes a marker after a soft or hard break', () => {
    expect(typ('first\n1986. A year')).toBe('first\n1986\\. A year');
    expect(typ('first\n= x')).toBe('first\n\\= x');
    expect(typ('a  \n/ term')).toBe('a\\\n\\/ term');
    expect(typ('a\\\n= b')).toBe('a\\\n\\= b');
  });

  it('US-001 AC-4b: applies the line start inside delimiter and function forms, not right after the opening *', () => {
    expect(typ('**a\n= b**')).toBe('*a\n\\= b*');
    expect(typ('x**a\n= b**')).toBe('x#strong[a\n\\= b]');
    expect(typ('~~- x~~')).toBe('#strike[\\- x]');
    expect(typ('**- x**')).toBe('*- x*');
    expect(typ('==a\n2. b==')).toBe('#highlight[a\n2\\. b]');
  });

  it('US-001 AC-4b: a marker that is split over nodes by a dropped comment or span is still escaped', () => {
    expect(typ('1986<!-- c -->. x')).toBe('1986\\. x');
    expect(typ('<span>1986</span>. x')).toBe('1986\\. x');
    expect(typ('=<!-- c --> x')).toBe('\\= x');
  });

  it('US-001 AC-14: escapes #tags as literal text, including inside table cells', () => {
    expect(inline('Needs #tessera and #prism/fire.')).toEqual({
      typ: 'Needs \\#tessera and \\#prism/fire.',
      warnings: none,
    });
    const table = parse('| #a | b |\n|---|---|\n| #c | d |').root[0];
    const cell = (table as {children: {children: unknown[]}[]}).children[0]
      ?.children[0] as {children: InlineNode[]};
    expect(emitNodes(cell.children).typ).toBe('\\#a');
  });
});

describe('US-001 inline emitter: breaks (AC-8, AC-8c)', () => {
  it('US-001 AC-8: turns two trailing spaces and a trailing backslash into backslash + newline', () => {
    expect(typ('a  \nb')).toBe('a\\\nb');
    expect(typ('a\\\nb')).toBe('a\\\nb');
  });

  it('US-001 AC-8c: keeps a soft break as a line break', () => {
    expect(typ('line one\nline two')).toBe('line one\nline two');
  });

  it('US-001 AC-8c: drops a break at the start or the end and a soft break right after another break', () => {
    const t = (value: string, line = 1): InlineNode => ({
      kind: 'text',
      line,
      value,
    });
    const soft = (line = 1): InlineNode => ({kind: 'softbreak', line});
    const hard = (line = 1): InlineNode => ({kind: 'break', line});
    const comment = (line = 1): InlineNode => ({
      kind: 'comment',
      line,
      value: '<!-- c -->',
    });
    expect(emitNodes([soft(), t('a'), hard()]).typ).toBe('a');
    expect(emitNodes([t('a'), hard(), soft(), t('b')]).typ).toBe('a\\\nb');
    expect(emitNodes([t('a'), soft(), comment(2), soft(2), t('b')]).typ).toBe(
      'a\nb',
    );
    expect(emitNodes([t('a'), hard(), hard(), t('b')]).typ).toBe('a\\\n\\\nb');
  });
});

describe('US-001 inline emitter: HTML (AC-9, AC-9b, AC-9c)', () => {
  it('US-001 AC-9: converts <u>x</u> to #underline[x], unwraps <span>x</span>, converts <br> to a line break', () => {
    expect(inline('<u>x</u>')).toEqual({typ: '#underline[x]', warnings: none});
    expect(inline('a <span>x</span> b')).toEqual({
      typ: 'a x b',
      warnings: none,
    });
    expect(inline('a<br>b')).toEqual({typ: 'a\\\nb', warnings: none});
  });

  it('US-001 AC-9: drops any other HTML tag, keeps its inner text, and reports one HTML_UNSUPPORTED warning', () => {
    expect(inline('a <font color="red">b</font> c')).toEqual({
      typ: 'a b c',
      warnings: [
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag <font> dropped', 1),
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag </font> dropped', 1),
      ],
    });
  });

  it('US-001 AC-9: converts the colophon link [<u><span>https://...</span></u>](...) to #link(...)[#underline[...]] (label part; the link itself is US-004)', () => {
    expect(
      inline(
        '[<u><span>https://example.org/a</span></u>](https://example.org/a)',
      ),
    ).toEqual({
      typ: '#underline[https:\\/\\/example.org/a]',
      warnings: [unsupported('link')],
    });
  });

  it('US-001 AC-9b: pairs <u>…</u> within one parent and keeps Markdown formatting inside the pair', () => {
    expect(typ('<u>**b**</u>')).toBe('#underline[*b*]');
    expect(typ('<u>a<span>b</span>c</u>')).toBe('#underline[abc]');
    expect(typ('<u>a <u>b</u> c</u>')).toBe('#underline[a #underline[b] c]');
    expect(typ('**a<u>b</u>**')).toBe('*a#underline[b]*');
    expect(typ('<u>**a**</u>x')).toBe('#underline[*a*]x');
  });

  it('US-001 AC-9b: drops an unclosed open tag and a closing tag without opener, keeps the text, reports one HTML_UNSUPPORTED per unpaired tag with its line', () => {
    expect(inline('a <u>b c')).toEqual({
      typ: 'a b c',
      warnings: [w('HTML_UNSUPPORTED', 'Unpaired HTML tag <u> dropped', 1)],
    });
    expect(inline('a b</u> c')).toEqual({
      typ: 'a b c',
      warnings: [w('HTML_UNSUPPORTED', 'Unpaired HTML tag </u> dropped', 1)],
    });
    expect(inline('x</br>y')).toEqual({
      typ: 'xy',
      warnings: [w('HTML_UNSUPPORTED', 'Unpaired HTML tag </br> dropped', 1)],
    });
    expect(inline('l1\nl2 <span>b').warnings).toEqual([
      w('HTML_UNSUPPORTED', 'Unpaired HTML tag <span> dropped', 2),
    ]);
  });

  it('US-001 AC-9b: pairs by nesting: tags that cross leave the inner tag unpaired and lose no text', () => {
    expect(inline('<u>a<span>b</u>c</span>')).toEqual({
      typ: '#underline[ab]c',
      warnings: [
        w('HTML_UNSUPPORTED', 'Unpaired HTML tag <span> dropped', 1),
        w('HTML_UNSUPPORTED', 'Unpaired HTML tag </span> dropped', 1),
      ],
    });
  });

  it('US-001 AC-9b: counts an open tag and a close tag in different paragraphs as two unpaired tags', () => {
    expect(paragraphs('<u>a\n\nb</u>')).toEqual({
      typs: ['a', 'b'],
      warnings: [
        w('HTML_UNSUPPORTED', 'Unpaired HTML tag <u> dropped', 1),
        w('HTML_UNSUPPORTED', 'Unpaired HTML tag </u> dropped', 3),
      ],
    });
  });

  it('US-001 AC-9b: a pair that crosses other formatting is not defined; the output keeps all text', () => {
    const {typ: out, warnings} = inline('<u>a *b</u> c*');
    for (const word of ['a', 'b', 'c']) expect(out).toContain(word);
    expect(warnings.map((x) => x.code)).toEqual([
      'HTML_UNSUPPORTED',
      'HTML_UNSUPPORTED',
    ]);
  });

  it('US-001 AC-9c: ignores attributes and case, and reads <br/> and <br /> as line breaks', () => {
    expect(inline('<u class="a">x</u>')).toEqual({
      typ: '#underline[x]',
      warnings: none,
    });
    expect(typ('<U>x</U> <SPAN>y</SPAN>')).toBe('#underline[x] y');
    expect(typ('x<BR/>y')).toBe('x\\\ny');
    expect(typ('x<br />y')).toBe('x\\\ny');
  });

  it('US-001 AC-9c: keeps markup that is not a tag as literal escaped text without a warning', () => {
    expect(inline('a <?x?> b')).toEqual({typ: 'a \\<?x?\\> b', warnings: none});
    expect(inline('a <![CDATA[x]]> b')).toEqual({
      typ: 'a \\<!\\[CDATA\\[x\\]\\]\\> b',
      warnings: none,
    });
  });
});

describe('US-001 inline emitter: comments (AC-15)', () => {
  it('US-001 AC-15: drops HTML comments (inline, multi-line, alone on a line) and reports one COMMENT_DROPPED with count and first line', () => {
    expect(inline('Text <!-- TBLFM: $3=$1*2 --> more')).toEqual({
      typ: 'Text  more',
      warnings: [w('COMMENT_DROPPED', '1 HTML comment dropped', 1)],
    });
    expect(inline('a <!-- x\ny --> b').typ).toBe('a  b');
    expect(
      paragraphs('one <!-- a -->\n\ntwo <!-- b -->\n\nthree <!-- c -->'),
    ).toEqual({
      typs: ['one ', 'two ', 'three '],
      warnings: [w('COMMENT_DROPPED', '3 HTML comments dropped', 1)],
    });
  });

  it('US-001 AC-15: reports the line of the first comment and sorts the summary among other warnings by line', () => {
    const {warnings} = paragraphs('a <u>b\n\nc <!-- x -->\n\nd</u> <!-- y -->');
    expect(warnings).toEqual([
      w('HTML_UNSUPPORTED', 'Unpaired HTML tag <u> dropped', 1),
      w('COMMENT_DROPPED', '2 HTML comments dropped', 3),
      w('HTML_UNSUPPORTED', 'Unpaired HTML tag </u> dropped', 5),
    ]);
  });

  it('US-001 AC-15: reports nothing when there is no comment and finish() can be called twice', () => {
    const ctx = new EmitContext();
    emitInline(inlineOf(parse('a <!-- c --> b').root[0]), ctx);
    expect(ctx.finish()).toEqual(ctx.finish());
    expect(new EmitContext().finish()).toEqual([]);
  });
});

describe('US-015 AC-12 inline fallback: nodes without an emitter keep their text', () => {
  it('US-015 AC-12: keeps the text of a link, an image, wikilinks, an embed and footnotes and reports NODE_UNSUPPORTED once per node', () => {
    expect(inline('see [x *y*](https://a.org) now')).toEqual({
      typ: 'see x _y_ now',
      warnings: [unsupported('link')],
    });
    expect(inline('![alt *b*](x.png)')).toEqual({
      typ: 'alt b',
      warnings: [unsupported('image')],
    });
    expect(inline('[[Note#H|Alias]] and [[Note#H]]')).toEqual({
      typ: 'Alias and Note\\#H',
      warnings: [unsupported('wikilink'), unsupported('wikilink')],
    });
    expect(inline('![[a.png|300]]')).toEqual({
      typ: 'a.png',
      warnings: [unsupported('embed')],
    });
    expect(inline('x[^1]')).toEqual({
      typ: 'x\\[1\\]',
      warnings: [unsupported('footnote-ref')],
    });
    expect(inline('a ^[b *c*]')).toEqual({
      typ: 'a b _c_',
      warnings: [unsupported('inline-footnote')],
    });
  });

  it('US-015 AC-12: reports the line of a node on a later line of the paragraph', () => {
    expect(inline('a\nb [x](u)').warnings).toEqual([unsupported('link', 2)]);
  });
});

describe('US-001 inline emitter: purity and determinism (AC-12)', () => {
  it('US-001 AC-12: produces byte-identical output when the same input is converted twice with the same settings', () => {
    const md =
      '**a** ~~b~~ <u>c</u> `d` e*f*g\n= h <!-- x --> [i](j) 1986. k <font>l</font>';
    expect(inline(md)).toEqual(inline(md));
  });

  it('US-001 AC-12: never changes the tree it is given', () => {
    const nodes = inlineOf(
      parse('**a** <u>b</u> <span>c</span> <!-- x --> d\ne <br> f').root[0],
    );
    const before = JSON.stringify(nodes);
    emitNodes(nodes);
    expect(JSON.stringify(nodes)).toBe(before);
  });

  it('US-001 AC-12: contexts are independent: one export does not leak warnings into the next', () => {
    const a = new EmitContext();
    emitInline(inlineOf(parse('a <!-- c --> <u>x').root[0]), a);
    expect(new EmitContext().finish()).toEqual([]);
    expect(a.finish()).toHaveLength(2);
  });
});

// ---- needs other stories: stubs ---------------------------------------------
// Replace each `it.todo` with a real test BEFORE writing its code (SCAR-003).
describe('US-001 inline pieces that need other stories', () => {
  it('US-001 AC-13: emits #set highlight(fill: rgb("#ffeb3b")) by default', async () => {
    const {typ: text} = await run('==marked==');
    expect(text.split('#set highlight(fill: rgb("#ffeb3b"))\n').length).toBe(2);
    expect(text).toContain('#highlight[marked]');
  });
  it('US-001 AC-13: emits the configured highlightColor #a5d6a7 and still produces #highlight[marked]', async () => {
    const {typ: text} = await run('==marked==', {
      settings: {...SETTINGS, highlightColor: '#a5d6a7'},
    });
    expect(text).toContain('#set highlight(fill: rgb("#a5d6a7"))');
    expect(text).not.toContain('#ffeb3b');
    expect(text).toContain('#highlight[marked]');
  });
  // `convert` rejects the colour (US-015 AC-3); keeping the previous value is
  // the settings store (US-008).
});

describe('US-001 inline pieces that US-004 and US-005 completed', () => {
  it('US-001 AC-2b: emits the link rows of the table (*#link(...)*, *see #link(...)[x]#footnote[...]*)', () => {
    // A link is a call, so the delimiter form is safe around it (compiler:
    // tests/integration/us-004-links-roundtrip.test.ts, emphasis around links).
    expect(blockTyp('**https://example.org**')).toBe(
      '*#link("https://example.org")*',
    );
    expect(blockTyp('**see [x](https://a.org)**')).toBe(
      '*see #link("https://a.org")[x]#footnote[#link("https://a.org")]*',
    );
  });

  it('US-001 AC-14: escapes #tags inside table cells', () => {
    expect(blockTyp('| #a | b |\n|---|---|\n| #c/d | e |')).toBe(
      [
        '#table(',
        '  columns: 2,',
        '  align: (left, left),',
        '  table.header([\\#a], [b]),',
        '  [\\#c/d], [e],',
        ')',
      ].join('\n'),
    );
  });
});

describe('US-001 AC-9 colophon link with the link emitted (US-004)', () => {
  it('US-001 AC-9: converts the colophon link [<u><span>https://...</span></u>](...) to #link(...)[#underline[...]] with the link emitted', () => {
    expect(
      blockTyp(
        '[<u><span>https://example.org</span></u>](https://example.org)',
      ),
    ).toBe('#link("https://example.org")[#underline[https:\\/\\/example.org]]');
  });
});
