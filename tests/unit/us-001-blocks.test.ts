// US-001 — block elements (unit, pure core): paragraph spacing, lists,
// quotes, code, rules, HTML blocks, comments, frontmatter, and the fallback
// for blocks that other stories convert. Source of truth:
// docs/user-stories/US-001-convert-markdown-to-typst.md. Exact string
// comparison, real parser (US-014), real emitter. The layout is proven against
// the compiler in tests/integration/us-001-blocks-roundtrip.test.ts.
import {describe, expect, it} from 'vitest';
import {EmitContext, emitBlocks} from '../../src/core/emit';
import {parse} from '../../src/core/parse';
import {blocks, typ} from '../support/blocks';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const comment1 = (line: number) =>
  w('COMMENT_DROPPED', '1 HTML comment dropped', line);
const none: never[] = [];
const QUOTE = '#quote(block: true)[';

describe('US-001 blocks: spacing (AC-1, AC-1d)', () => {
  it('US-001 AC-1: separates paragraphs by exactly one blank line', () => {
    expect(typ('a\nb\n\nc')).toBe('a\nb\n\nc');
    expect(typ('a\n\n\n\nb')).toBe('a\n\nb');
    expect(blocks('a\n\nb\n\nc').typ).toBe('a\n\nb\n\nc');
  });

  it('US-001 AC-1d: leaves no blank line at the start or the end, and nothing for an empty document', () => {
    expect(typ('\n\na\n\n')).toBe('a');
    expect(blocks('')).toEqual({typ: '', warnings: none});
  });

  it('US-001 AC-1d: a block without output leaves no blank line behind', () => {
    expect(blocks('a\n\n<!-- c -->\n\nb')).toEqual({
      typ: 'a\n\nb',
      warnings: [comment1(3)],
    });
    expect(typ('> \n\ntext')).toBe('text');
    expect(typ('a\n\n**<!-- c -->**\n\nb')).toBe('a\n\nb');
    expect(typ('a\n\n<br>\n\nb')).toBe('a\n\nb');
  });
});

describe('US-001 blocks: lists (AC-5, AC-5b)', () => {
  it('US-001 AC-5: converts a three-level nested list of bullets and ordered items unchanged', () => {
    const md = '- a\n  - b\n    1. c\n    2. d';
    expect(typ(md)).toBe(md);
  });

  it("US-001 AC-5: keeps the start number of an ordered list ('3. x' stays '3. x')", () => {
    expect(typ('3. x\n4. y')).toBe('3. x\n4. y');
    expect(typ('0. x\n1. y')).toBe('0. x\n1. y');
  });

  it('US-001 AC-5: preserves nesting at 5 levels', () => {
    const md = '- a\n  - b\n    - c\n      - d\n        - e';
    expect(typ(md)).toBe(md);
  });

  it('US-001 AC-5: converts tab-indented nested lists and * markers', () => {
    expect(typ('* a\n\t* b')).toBe('- a\n  - b');
    expect(typ('+ a\n+ b')).toBe('- a\n- b');
  });

  it('US-001 AC-5b: numbers every ordered item from its start, whatever the source numbers say', () => {
    expect(typ('3. x\n5. y')).toBe('3. x\n4. y');
    expect(typ('1. a\n3. b')).toBe('1. a\n2. b');
    expect(typ('123456789. a\n1. b')).toBe('123456789. a\n123456790. b');
  });

  it('US-001 AC-5b: indents item content by the width of the marker', () => {
    expect(typ('1. a\n   - b')).toBe('1. a\n   - b');
    expect(typ('10. a\n\n    b')).toBe('10. a\n\n    b');
    expect(typ('9. a\n   - x\n10. b\n    - y')).toBe(
      '9. a\n   - x\n10. b\n    - y',
    );
  });

  it('US-001 AC-5b: separates the blocks of an item by a blank line, except a list right after a paragraph', () => {
    expect(typ('- a\n  - b\n\n  c')).toBe('- a\n  - b\n\n  c');
    expect(typ('- a\n\n  b')).toBe('- a\n\n  b');
    expect(typ('- a\n  b')).toBe('- a\n  b');
  });

  it('US-001 AC-5b: starts the first block of an item on the marker line', () => {
    expect(typ('- ```js\n  x\n  ```')).toBe('- ```js\n  x\n  ```');
    expect(typ('- - a\n  - b\n- c')).toBe('- - a\n  - b\n- c');
    expect(typ('- > q')).toBe(`- ${QUOTE}\n    q\n  ]`);
  });

  it('US-001 AC-5b: writes an empty item as the marker alone and writes no trailing blanks', () => {
    expect(typ('-\n- b')).toBe('-\n- b');
    const out = typ('- a\n\n  ```\n  x\n\n  y\n  ```');
    expect(out).toBe('- a\n\n  ```\n  x\n\n  y\n  ```');
    expect(out).not.toMatch(/[ \t]\n/);
  });

  it('US-001 AC-5b: puts no separator between two lists in a row', () => {
    expect(typ('- a\n\n* b')).toBe('- a\n\n- b');
    expect(typ('1. a\n\n- b')).toBe('1. a\n\n- b');
  });

  it('US-001 AC-5b: escapes a marker at the start of an item and after a soft or hard break in it', () => {
    expect(typ('- \\= x')).toBe('- \\= x');
    expect(typ('- a\n  2020\\. b')).toBe('- a\n  2020\\. b');
    expect(typ('- a\\\n  b')).toBe('- a\\\n  b');
  });

  it('US-001 AC-5b: writes a task item with its plain marker and no warning (US-005 AC-6 owns the glyphs)', () => {
    expect(blocks('- [ ] t\n- [x] u')).toEqual({
      typ: '- \\[ \\] t\n- \\[x\\] u',
      warnings: [],
    });
  });
});

describe('US-001 blocks: quotes (AC-6, AC-6b)', () => {
  it('US-001 AC-6: converts a blockquote with emphasis and a list into #quote(block: true)[...]', () => {
    expect(typ('> quoted *text*\n> - item')).toBe(
      `${QUOTE}\n  quoted _text_\n  - item\n]`,
    );
  });

  it('US-001 AC-6: emits one #quote per level for a quote in a quote and a quote in a list item', () => {
    expect(typ('> > deep')).toBe(`${QUOTE}\n  ${QUOTE}\n    deep\n  ]\n]`);
    expect(typ('- a\n\n  > q')).toBe(`- a\n\n  ${QUOTE}\n    q\n  ]`);
  });

  it('US-001 AC-6b: separates the blocks of a quote by a blank line, except a list right after a paragraph', () => {
    expect(typ('> a\n>\n> b')).toBe(`${QUOTE}\n  a\n\n  b\n]`);
    expect(typ('> - x\n>\n> > y')).toBe(
      `${QUOTE}\n  - x\n\n  ${QUOTE}\n    y\n  ]\n]`,
    );
  });

  it('US-001 AC-6b: indents a list, code and a rule inside a quote with the quote', () => {
    expect(typ('> ```\n> c\n> ```')).toBe(
      `${QUOTE}\n  \`\`\`\n  c\n  \`\`\`\n]`,
    );
    expect(typ('> a\n>\n> ---')).toBe(
      `${QUOTE}\n  a\n\n  #line(length: 100%)\n]`,
    );
    expect(typ('- a\n\n  > - b')).toBe(`- a\n\n  ${QUOTE}\n    - b\n  ]`);
  });

  it('US-001 AC-6b: drops an empty quote and a quote that only held a comment', () => {
    expect(blocks('>')).toEqual({typ: '', warnings: none});
    expect(blocks('> <!-- c -->')).toEqual({typ: '', warnings: [comment1(1)]});
  });
});

describe('US-001 blocks: code and rules (AC-7, AC-7b, AC-8)', () => {
  it('US-001 AC-7: keeps inline code and fenced block content verbatim, with the language tag', () => {
    expect(typ('```js\nlet a = `x`;\n```')).toBe('```js\nlet a = `x`;\n```');
    expect(typ('```\n= x\n- y\n#z $ _a_\n```')).toBe(
      '```\n= x\n- y\n#z $ _a_\n```',
    );
    expect(typ('a `b_c` d')).toBe('a `b_c` d');
  });

  it('US-001 AC-7: uses a fence of N+1 backticks when the content contains a run of N backticks (three becomes four)', () => {
    expect(typ('````\n```x```\n````')).toBe('````\n```x```\n````');
    expect(typ('~~~\nx\n~~~')).toBe('```\nx\n```');
  });

  it('US-001 AC-7: writes a language tag with other characters in the function form', () => {
    expect(typ('```c++\nint x;\n```')).toBe(
      '#raw(block: true, lang: "c++", "int x;")',
    );
  });

  it('US-001 AC-7b: writes an empty block, an indented block and the first word of the info string', () => {
    expect(typ('```\n```')).toBe('```\n\n```');
    expect(typ('    indented\n    code')).toBe('```\nindented\ncode\n```');
    expect(typ('```js title="x"\nlet a;\n```')).toBe('```js\nlet a;\n```');
  });

  it('US-001 AC-7b: indents every non-empty line of a block in an item or a quote and keeps empty lines empty', () => {
    expect(typ('1. a\n\n   ```\n   c\n\n     d\n   ```')).toBe(
      '1. a\n\n   ```\n   c\n\n     d\n   ```',
    );
    expect(typ('- a\n\n  > ```\n  > x\n  > ```')).toBe(
      `- a\n\n  ${QUOTE}\n    \`\`\`\n    x\n    \`\`\`\n  ]`,
    );
    expect(typ('- a\n\n  ```c++\n  x\n  ```')).toBe(
      '- a\n\n  #raw(block: true, lang: "c++", "x")',
    );
  });

  it("US-001 AC-8: turns '---' between paragraphs into #line(length: 100%)", () => {
    expect(typ('a\n\n---\n\nb')).toBe('a\n\n#line(length: 100%)\n\nb');
    expect(typ('- a\n\n  ***')).toBe('- a\n\n  #line(length: 100%)');
    expect(typ('---\n\na')).toBe('#line(length: 100%)\n\na');
  });
});

describe('US-001 blocks: HTML, comments, frontmatter (AC-9d, AC-10, AC-15b)', () => {
  it('US-001 AC-9d: keeps the text of an HTML block and reports each dropped tag with its line', () => {
    expect(blocks('<div>\nx <b>y</b>\n</div>')).toEqual({
      typ: 'x y',
      warnings: [
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag <div> dropped', 1),
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag <b> dropped', 2),
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag </b> dropped', 2),
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag </div> dropped', 3),
      ],
    });
  });

  it('US-001 AC-9d: handles <br>, <u>, <span> and comments inside an HTML block like inline HTML', () => {
    expect(blocks('<div>a<!-- c -->b</div>')).toEqual({
      typ: 'ab',
      warnings: [
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag <div> dropped', 1),
        w('HTML_UNSUPPORTED', 'Unsupported HTML tag </div> dropped', 1),
        comment1(1),
      ],
    });
    expect(typ('<br>\n\ntext')).toBe('text');
    expect(
      blocks('<section>\n<u>a</u> <span>b</span><br>c\n</section>').typ,
    ).toBe('#underline[a] b\\\nc');
  });

  it('US-001 AC-9d: reports the line of a tag that follows a tag or comment spanning several lines', () => {
    expect(
      blocks('<div\n class="a">\nx <b>y</b>\n<!-- c\nd -->\n<i>z</i>').warnings,
    ).toEqual([
      w('HTML_UNSUPPORTED', 'Unsupported HTML tag <div> dropped', 1),
      w('HTML_UNSUPPORTED', 'Unsupported HTML tag <b> dropped', 3),
      w('HTML_UNSUPPORTED', 'Unsupported HTML tag </b> dropped', 3),
      comment1(4),
      w('HTML_UNSUPPORTED', 'Unsupported HTML tag <i> dropped', 6),
      w('HTML_UNSUPPORTED', 'Unsupported HTML tag </i> dropped', 6),
    ]);
  });

  it('US-001 AC-10: removes a leading YAML frontmatter block without producing text', () => {
    const parsed = parse('---\ntitle: x\ntags: [a]\n---\n\ntext');
    const ctx = new EmitContext();
    expect(emitBlocks(parsed.root, ctx)).toBe('text');
    expect(ctx.finish()).toEqual([]);
    expect(typ('---\ntitle: x\n---\n')).toBe('');
  });

  it('US-001 AC-15b: drops a comment alone on its lines, also inside an item or a quote, and counts it', () => {
    expect(blocks('<!--\nmulti\nline\n-->')).toEqual({
      typ: '',
      warnings: [comment1(1)],
    });
    expect(blocks('- a\n\n  <!-- c -->\n\n  b')).toEqual({
      typ: '- a\n\n  b',
      warnings: [comment1(3)],
    });
    expect(blocks('> a\n>\n> <!-- c -->')).toEqual({
      typ: `${QUOTE}\n  a\n]`,
      warnings: [comment1(3)],
    });
  });

  it('US-001 AC-15: drops HTML comments (inline, multi-line, alone on a line) and reports one COMMENT_DROPPED with count and first line', () => {
    const {typ: out, warnings} = blocks(
      'one <!-- a -->\n\n<!-- b -->\n\n- two <!-- c -->',
    );
    expect(out).toBe('one \n\n- two ');
    expect(warnings).toEqual([
      w('COMMENT_DROPPED', '3 HTML comments dropped', 1),
    ]);
  });
});

describe('US-015 AC-12 block fallback (AC-16): blocks without an emitter keep their text', () => {
  it('US-015 AC-12: no longer falls back for a table or a footnote definition (US-005 converts them)', () => {
    expect(blocks('| a | b |\n|---|---|\n| c | d |').typ).toMatch(/^#table\(/);
    expect(blocks('[^1]: note text')).toEqual({
      typ: '',
      warnings: [
        {
          code: 'FOOTNOTE_UNUSED',
          message: 'Footnote "1" is never referenced',
          line: 1,
        },
      ],
    });
  });
});

describe('US-001 blocks: purity and determinism (AC-12)', () => {
  const md =
    '# t\n\n- a\n  - b\n\n  c\n\n> q\n>\n> ```js\n> x\n> ```\n\n---\n\n<div>x</div>\n\n<!-- c -->';

  it('US-001 AC-12: produces byte-identical output when the same input is converted twice with the same settings', () => {
    expect(blocks(md)).toEqual(blocks(md));
  });

  it('US-001 AC-12: never changes the tree it is given', () => {
    const tree = parse(md);
    const before = JSON.stringify(tree);
    emitBlocks(tree.root, new EmitContext());
    expect(JSON.stringify(tree)).toBe(before);
  });
});
