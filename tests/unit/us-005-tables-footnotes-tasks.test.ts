// US-005 — tables, footnotes, task lists (unit, pure core). Source of truth:
// docs/user-stories/US-005-tables-footnotes-tasklists.md. Exact string
// comparison, real parser (US-014), real emitter. The output is proven against
// the compiler in tests/integration/us-005-*.test.ts.
import {describe, expect, it} from 'vitest';
import {
  EmitContext,
  FOOTNOTE_RESTART_RULE,
  emitBlocks,
  type FontInfo,
} from '../../src/core/emit';
import {parse, type BlockNode, type RowNode} from '../../src/core/parse';
import {blocks, typ} from '../support/blocks';
import {run} from '../support/convert';
import {index, labels} from '../support/headings';
import {findAll} from '../support/images';
import {nodesOf} from '../support/tree';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const none: never[] = [];
const table = (...lines: string[]) => lines.join('\n');
const call = (cols: number, align: string, rows: string[]) =>
  [
    '#table(',
    `  columns: ${cols},`,
    `  align: (${align}),`,
    ...rows.map((row) => `  ${row},`),
    ')',
  ].join('\n');
const U = '"https://x.org"';
const LONG1 = 'Row has 1 more cell than the header; it is cut';
const LONG2 = 'Row has 2 more cells than the header; they are cut';

describe('US-005 AC-1 tables with alignment', () => {
  it('US-005 AC-1: converts a two-column table with :--- and ---: alignment to #table(columns: 2, align: (left, right), table.header(...), ...)', () => {
    expect(
      blocks(table('| Name  | Cost |', '|:------|-----:|', '| Sword | 10   |')),
    ).toEqual({
      typ: call(2, 'left, right', [
        'table.header([Name], [Cost])',
        '[Sword], [10]',
      ]),
      warnings: none,
    });
  });

  it('US-005 AC-1: maps :---: to center and --- to left', () => {
    expect(typ(table('| a | b | c |', '|:-:|---|--:|', '| 1 | 2 | 3 |'))).toBe(
      call(3, 'center, left, right', [
        'table.header([a], [b], [c])',
        '[1], [2], [3]',
      ]),
    );
  });

  it('US-005 AC-1: writes the alignment of a single column as a one-element array', () => {
    expect(typ(table('| a |', '|---|', '| 1 |'))).toBe(
      call(1, 'left,', ['table.header([a])', '[1]']),
    );
  });

  it('US-005 AC-1: writes every body row on its own line, in order', () => {
    expect(typ(table('| a |', '|---|', '| 1 |', '| 2 |', '| 3 |'))).toBe(
      call(1, 'left,', ['table.header([a])', '[1]', '[2]', '[3]']),
    );
  });

  it('US-005 AC-1: separates a table from the blocks around it by one blank line', () => {
    expect(typ(`before\n\n${table('| a |', '|---|', '| 1 |')}\n\nafter`)).toBe(
      `before\n\n${call(1, 'left,', ['table.header([a])', '[1]'])}\n\nafter`,
    );
  });
});

describe('US-005 AC-1b tables in lists and quotes', () => {
  const inner = (pad: string) =>
    call(1, 'left,', ['table.header([x])', '[1]'])
      .split('\n')
      .map((line) => pad + line)
      .join('\n');

  it('US-005 AC-1b: indents a table inside a list item with the item content', () => {
    expect(typ('- a\n\n  | x |\n  |---|\n  | 1 |')).toBe(
      `- a\n\n${inner('  ')}`,
    );
  });

  it('US-005 AC-1b: indents a table inside a quote by two blanks', () => {
    expect(typ('> | x |\n> |---|\n> | 1 |')).toBe(
      `#quote(block: true)[\n${inner('  ')}\n]`,
    );
  });
});

describe('US-005 AC-2 cell content', () => {
  const one = (cell: string) => typ(table('| a |', '|---|', `| ${cell} |`));
  const body = (cell: string) => call(1, 'left,', ['table.header([a])', cell]);

  it("US-005 AC-2: converts a cell '**5** $' to [*5* \\$]", () => {
    expect(one('**5** $')).toBe(body('[*5* \\$]'));
  });

  it('US-005 AC-2: reads \\| in a cell as a literal pipe', () => {
    expect(one('x \\| y')).toBe(body('[x | y]'));
  });

  it('US-005 AC-2: escapes a closing bracket in a cell', () => {
    expect(one('x \\] y')).toBe(body('[x \\] y]'));
  });

  it('US-005 AC-2: keeps a link in a cell, with its footnote inside the cell', () => {
    expect(one('[Site](https://x.org)')).toBe(
      body(`[#link(${U})[Site]#footnote[#link(${U})]]`),
    );
  });

  it('US-005 AC-2: keeps a wikilink in a cell and points it at the heading', () => {
    const out = blocks(
      `# Tessera\n\n${table('| a |', '|---|', '| [[Tessera]] |')}`,
    );
    expect(out.typ).toContain('  [#link(<h-tessera>)[Tessera]],');
    expect(out.warnings).toEqual(none);
  });

  it('US-005 AC-2: reports an unresolved link of a cell with the line of its row', () => {
    const out = blocks(table('| a |', '|---|', '| [[Nope]] |'));
    expect(out.warnings).toEqual([
      w('LINK_UNRESOLVED', 'No heading matches "[[Nope]]"', 3),
    ]);
  });

  it('US-005 AC-2: keeps an image inside its cell (images by US-003)', () => {
    expect(
      blocks('| a |\n|---|\n| ![](a.png) |', {assets: findAll()}).typ,
    ).toBe(
      '#table(\n  columns: 1,\n  align: (left,),\n  table.header([a]),\n  [#fit-image("assets/a.png")],\n)',
    );
  });
});

describe('US-005 AC-2b line breaks in cells', () => {
  const row = (cells: string) =>
    typ(table('| a | b |', '|---|---|', `| ${cells} |`));
  const body = (cells: string) =>
    call(2, 'left, left', ['table.header([a], [b])', cells]);

  it('US-005 AC-2b: converts <br> and <br><br> in a table cell to #linebreak()', () => {
    expect(row('a<br>b | c<br><br>d')).toBe(
      body('[a#linebreak()b], [c#linebreak()#linebreak()d]'),
    );
  });

  it('US-005 AC-2b: accepts <br/> and <BR>', () => {
    expect(row('a<br/>b | c<BR>d')).toBe(
      body('[a#linebreak()b], [c#linebreak()d]'),
    );
  });

  it('US-005 AC-2b: separates #linebreak() from a following . ( [ or ; by a semicolon', () => {
    expect(row('a<br>.b | c<br>(d')).toBe(
      body('[a#linebreak();.b], [c#linebreak();(d]'),
    );
  });

  it('US-005 AC-2b: drops a break at the start or end of a cell', () => {
    expect(row('<br>a | b<br>')).toBe(body('[a], [b]'));
  });

  it('US-005 AC-2b: keeps emphasis around a break', () => {
    expect(row('**a<br>b** | c')).toBe(body('[*a#linebreak()b*], [c]'));
  });
});

describe('US-005 AC-3 ragged rows', () => {
  it('US-005 AC-3: pads a short row with empty cells []', () => {
    expect(typ(table('| a | b |', '|---|---|', '| 1 |'))).toBe(
      call(2, 'left, left', ['table.header([a], [b])', '[1], []']),
    );
  });

  it('US-005 AC-3: pads a short row of a hand-built tree', () => {
    const cell = (value: string) => ({
      kind: 'cell' as const,
      line: 1,
      children: [{kind: 'text' as const, line: 1, value}],
    });
    const row = (header: boolean, cells: string[]): RowNode => ({
      kind: 'row',
      line: 1,
      header,
      children: cells.map(cell),
    });
    const tree: BlockNode = {
      kind: 'table',
      line: 1,
      align: [null, null, null],
      children: [row(true, ['a', 'b', 'c']), row(false, ['1'])],
    };
    expect(emitBlocks([tree], new EmitContext())).toBe(
      call(3, 'left, left, left', [
        'table.header([a], [b], [c])',
        '[1], [], []',
      ]),
    );
  });

  it('US-005 AC-3: takes the column count from the header and cuts the cells of a hand-built row beyond it', () => {
    const cell = (value: string) => ({
      kind: 'cell' as const,
      line: 1,
      children: [{kind: 'text' as const, line: 1, value}],
    });
    const tree: BlockNode = {
      kind: 'table',
      line: 1,
      align: [],
      children: [
        {kind: 'row', line: 1, header: true, children: [cell('a'), cell('b')]},
        {
          kind: 'row',
          line: 2,
          header: false,
          children: [cell('1'), cell('2'), cell('3')],
        },
      ],
    };
    const ctx = new EmitContext();
    expect(emitBlocks([tree], ctx)).toBe(
      call(2, 'left, left', ['table.header([a], [b])', '[1], [2]']),
    );
    expect(ctx.finish()).toEqual([w('TABLE_ROW_LONG', LONG1, 2)]);
  });

  it('US-005 AC-3: truncates a long row and reports TABLE_ROW_LONG with the source line', () => {
    expect(
      blocks(table('| a | b |', '|---|---|', '| 1 | 2 | 3 | 4 |')),
    ).toEqual({
      typ: call(2, 'left, left', ['table.header([a], [b])', '[1], [2]']),
      warnings: [w('TABLE_ROW_LONG', LONG2, 3)],
    });
  });

  it('US-005 AC-3: words one extra cell in the singular', () => {
    expect(blocks(table('| a |', '|---|', '| 1 | 2 |')).warnings).toEqual([
      w('TABLE_ROW_LONG', LONG1, 3),
    ]);
  });

  it('US-005 AC-3: reports every long row with its own line', () => {
    expect(
      blocks(
        table('| a |', '|---|', '| 1 |', '| 1 | 2 |', '| 1 |', '| 1 | 2 | 3 |'),
      ).warnings,
    ).toEqual([w('TABLE_ROW_LONG', LONG1, 4), w('TABLE_ROW_LONG', LONG2, 6)]);
  });

  it('US-005 AC-3: counts the cells of a row without leading or trailing pipe', () => {
    expect(
      blocks(table('| a | b |', '|---|---|', '1 | 2 | 3')).warnings,
    ).toEqual([w('TABLE_ROW_LONG', LONG1, 3)]);
  });

  it('US-005 AC-3: does not count an escaped pipe or the outer pipes as cells', () => {
    expect(
      blocks(table('| a | b |', '|---|---|', '| 1 \\| x | 2 |')).warnings,
    ).toEqual(none);
  });

  it('US-005 AC-3: counts a pipe inside a code span as a cell border, like the parser does', () => {
    // GFM: a pipe splits cells even in a code span; `a|b` is two cells.
    expect(
      blocks(table('| a | b |', '|---|---|', '| x | `a|b` |')).warnings,
    ).toEqual([w('TABLE_ROW_LONG', LONG1, 3)]);
  });
});

describe('US-005 AC-3 parser reporting (US-014 tree)', () => {
  const rows = (md: string) => nodesOf(md, 'row') as RowNode[];

  it('US-005 AC-3: marks a long row with the number of cells that were cut', () => {
    const [header, short, long] = rows(
      table('| a | b |', '|---|---|', '| 1 |', '| 1 | 2 | 3 | 4 |'),
    ) as [RowNode, RowNode, RowNode];
    expect(header.extraCells).toBeUndefined();
    expect(short.extraCells).toBeUndefined();
    expect(long.extraCells).toBe(2);
    expect(long.children).toHaveLength(2);
  });

  it('US-005 AC-4c: marks the text of an unclosed ^[ and nothing else', () => {
    const flagged = (md: string) =>
      nodesOf(md, 'text').filter((t) => 'unclosedNote' in t);
    expect(flagged('a^[open')).toHaveLength(1);
    expect(flagged('a^[x]')).toHaveLength(0);
    expect(flagged('a \\^[x]')).toHaveLength(0);
  });
});

describe('US-005 AC-3b empty cells, header-only and wide tables', () => {
  it('US-005 AC-3b: emits an empty cell as [] and keeps its column', () => {
    expect(typ(table('| a | b |', '|---|---|', '| | x |'))).toBe(
      call(2, 'left, left', ['table.header([a], [b])', '[], [x]']),
    );
  });

  it('US-005 AC-3b: emits a table with a header row and no body rows with table.header only', () => {
    expect(typ(table('| A | B |', '|---|---|'))).toBe(
      call(2, 'left, left', ['table.header([A], [B])']),
    );
  });

  it('US-005 AC-3b: emits a table whose header cells are all empty with table.header', () => {
    expect(typ(table('| | |', '|-|-|', '| x | y |'))).toBe(
      call(2, 'left, left', ['table.header([], [])', '[x], [y]']),
    );
  });

  it('US-005 AC-3b: keeps columns: n for a wide table and raises no warning', () => {
    const n = 12;
    const cells = (f: (i: number) => string) =>
      `| ${Array.from({length: n}, (_, i) => f(i)).join(' | ')} |`;
    const out = blocks(
      table(
        cells((i) => `h${i}`),
        cells(() => '---'),
        cells((i) => `c${i}`),
      ),
    );
    expect(out.typ).toContain(`columns: ${n},`);
    expect(out.typ).toContain(`align: (${Array(n).fill('left').join(', ')}),`);
    expect(out.warnings).toEqual(none);
  });
});

describe('US-005 AC-4 footnotes', () => {
  it('US-005 AC-4: converts Text[^1] and its definition to Text#footnote[The note.]', () => {
    expect(blocks('Text[^1].\n\n[^1]: The note.')).toEqual({
      typ: 'Text#footnote[The note.];.',
      warnings: none,
    });
  });

  it('US-005 AC-4: accepts the definition anywhere in the file', () => {
    expect(typ('[^1]: The note.\n\nText[^1] more')).toBe(
      'Text#footnote[The note.] more',
    );
    expect(typ('a[^1]\n\nmiddle\n\n[^1]: N\n\nend')).toBe(
      'a#footnote[N]\n\nmiddle\n\nend',
    );
  });

  it('US-005 AC-4: emits the note text twice for two references to one definition', () => {
    expect(blocks('a[^1] b[^1]\n\n[^1]: N')).toEqual({
      typ: 'a#footnote[N] b#footnote[N]',
      warnings: none,
    });
  });

  it('US-005 AC-4: reports a warning of the note text only once for two references', () => {
    const out = blocks('a[^1] b[^1]\n\n[^1]: [[Nope]]');
    expect(out.warnings).toEqual([
      w('LINK_UNRESOLVED', 'No heading matches "[[Nope]]"', 3),
    ]);
  });

  it('US-005 AC-4: emits nothing and reports FOOTNOTE_UNDEFINED for a reference without definition', () => {
    expect(blocks('Text[^x]')).toEqual({
      typ: 'Text',
      warnings: [w('FOOTNOTE_UNDEFINED', 'Footnote "x" has no definition', 1)],
    });
  });

  it('US-005 AC-4: emits nothing and reports FOOTNOTE_UNUSED for a definition without reference', () => {
    expect(blocks('Text\n\n[^x]: N')).toEqual({
      typ: 'Text',
      warnings: [w('FOOTNOTE_UNUSED', 'Footnote "x" is never referenced', 3)],
    });
  });

  it('US-005 AC-4: separates the footnote call from a following . ( [ or ; by a semicolon', () => {
    // `[^1](a)` and `[^1][a]` would be links to Markdown; only . and ; here.
    for (const next of ['.', ';']) {
      expect(typ(`a[^1]${next}\n\n[^1]: N`)).toBe(`a#footnote[N];${next}`);
    }
    expect(typ('a^[N](a)')).toBe('a#footnote[N];(a)');
    // A `[` of the text is escaped, so it needs no separator.
    expect(typ('a^[N][a]')).toBe('a#footnote[N]\\[a\\]');
    expect(typ('a[^1], b\n\n[^1]: N')).toBe('a#footnote[N], b');
  });

  it('US-005 AC-4: writes a note of several blocks, a list or a line break in the block form', () => {
    expect(typ('x[^a]\n\n[^a]: p1\n\n    p2\n\n    - l')).toBe(
      'x#footnote[\n  p1\n\n  p2\n\n  - l\n]',
    );
    expect(typ('x[^a]\n\n[^a]: a\n    b')).toBe('x#footnote[\n  a\n  b\n]');
  });

  it('US-005 AC-4: escapes the text of a note like any other text', () => {
    expect(typ('x[^1]\n\n[^1]: a $ [b] #c')).toBe(
      'x#footnote[a \\$ \\[b\\] \\#c]',
    );
  });

  it('US-005 AC-4: starts the note text as the start of a block (a leading marker is escaped)', () => {
    expect(typ('x[^1]\n\n[^1]: \\- a')).toBe('x#footnote[\\- a]');
  });
});

describe('US-005 AC-4b footnote numbers restart per chapter', () => {
  it('US-005 AC-4b: provides the rule #show heading.where(level: 1): it => { counter(footnote).update(0); it }', () => {
    expect(FOOTNOTE_RESTART_RULE).toBe(
      '#show heading.where(level: 1): it => { counter(footnote).update(0); it }',
    );
  });

  it('US-005 AC-4b: the preamble of an export contains the rule (pipeline, US-015)', async () => {
    const {typ: text} = await run('# A\n\nx[^1]\n\n[^1]: n');
    const lines = text.split('\n');
    expect(lines.filter((line) => line === FOOTNOTE_RESTART_RULE)).toHaveLength(
      1,
    );
    expect(lines.indexOf(FOOTNOTE_RESTART_RULE)).toBeLessThan(
      lines.indexOf('= A <h-a>'),
    );
  });
});

describe('US-005 AC-4c inline footnotes', () => {
  it('US-005 AC-4c: converts ^[text] to #footnote with inline Markdown', () => {
    expect(blocks('Text^[The *note*].')).toEqual({
      typ: 'Text#footnote[The _note_];.',
      warnings: none,
    });
  });

  it('US-005 AC-4c: accepts balanced brackets in the text', () => {
    expect(typ('a^[x [y] z] b')).toBe('a#footnote[x \\[y\\] z] b');
  });

  it('US-005 AC-4c: treats an unclosed ^[ as literal text and reports FOOTNOTE_UNCLOSED', () => {
    expect(blocks('a^[open')).toEqual({
      typ: 'a^\\[open',
      warnings: [w('FOOTNOTE_UNCLOSED', 'Unclosed ^[ kept as text', 1)],
    });
  });

  it('US-005 AC-4c: reports an unclosed ^[ after a closed one with the line of the paragraph', () => {
    expect(blocks('x\n\na^[x [y] z]^[w')).toEqual({
      typ: 'x\n\na#footnote[x \\[y\\] z]^\\[w',
      warnings: [w('FOOTNOTE_UNCLOSED', 'Unclosed ^[ kept as text', 3)],
    });
  });

  it('US-005 AC-4c: does not report an escaped \\^[', () => {
    expect(blocks('a \\^[x] b')).toEqual({typ: 'a ^\\[x\\] b', warnings: none});
  });

  it('US-005 AC-4c: spells out an external address inside the note', () => {
    expect(typ('a^[see [Site](https://x.org)]')).toBe(
      `a#footnote[see #link(${U})[Site] (#link(${U}))]`,
    );
  });
});

describe('US-005 AC-4d nested notes, duplicates', () => {
  it('US-005 AC-4d: omits a footnote reference inside a note and reports FOOTNOTE_NESTED', () => {
    expect(blocks('x[^a]\n\n[^a]: see[^b]\n[^b]: inner')).toEqual({
      typ: 'x#footnote[see]',
      warnings: [w('FOOTNOTE_NESTED', 'Footnote inside a footnote omitted', 3)],
    });
  });

  it('US-005 AC-4d: omits an inline footnote inside a note and reports FOOTNOTE_NESTED', () => {
    expect(blocks('x[^a]\n\n[^a]: see^[inner]')).toEqual({
      typ: 'x#footnote[see]',
      warnings: [w('FOOTNOTE_NESTED', 'Footnote inside a footnote omitted', 3)],
    });
  });

  it('US-005 AC-4d: turns a heading inside a note into a plain paragraph', () => {
    expect(typ('x[^a]\n\n[^a]: # Head\n\n    para')).toBe(
      'x#footnote[\n  Head\n\n  para\n]',
    );
  });

  it('US-005 AC-4d: does not index a heading inside a footnote definition', () => {
    const md = '# Head\n\nx[^a]\n\n[^a]: # Head';
    expect(labels(md)).toEqual(['h-head']);
    expect(index(md).list).toHaveLength(1);
  });

  it('US-005 AC-4d: uses the first of two definitions and reports the later as unused', () => {
    expect(blocks('a[^1]\n\n[^1]: one\n\n[^1]: two')).toEqual({
      typ: 'a#footnote[one]',
      warnings: [
        w(
          'FOOTNOTE_UNUSED',
          'Footnote "1" is defined again; the later definition is not used',
          5,
        ),
      ],
    });
  });
});

describe('US-005 AC-5 composed', () => {
  it("US-005 AC-5: converts '*See* [[Tessera]]' inside a footnote to #footnote[_See_ #link(<h-tessera>)[Tessera]]", () => {
    expect(blocks('See[^1]\n\n# Tessera\n\n[^1]: *See* [[Tessera]]')).toEqual({
      typ: 'See#footnote[_See_ #link(<h-tessera>)[Tessera]]\n\n= Tessera <h-tessera>',
      warnings: none,
    });
  });

  it('US-005 AC-5: keeps a footnote inside a table cell, inside that cell', () => {
    expect(typ(table('| a |', '|---|', '| x[^1] |') + '\n\n[^1]: N')).toBe(
      call(1, 'left,', ['table.header([a])', '[x#footnote[N]]']),
    );
  });

  it('US-005 AC-5: keeps footnotes in headings, list items and quotes', () => {
    expect(typ('# H[^1]\n\n- a[^1]\n\n> q[^1]\n\n[^1]: N')).toBe(
      '= H#footnote[N] <h-h>\n\n- a#footnote[N]\n\n#quote(block: true)[\n  q#footnote[N]\n]',
    );
  });
});

const both: FontInfo = {hasGlyph: () => true};
const lacks = (...missing: number[]): FontInfo => ({
  hasGlyph: (_family, code) => !missing.includes(code),
});
const withFonts = (md: string, fonts: FontInfo | undefined): string =>
  blocks(md, fonts === undefined ? {} : {fonts}).typ;
const MSG = (code: string) =>
  `Font "Libertinus Serif" lacks ${code}; task lists use [ ] / [x]`;

describe('US-005 AC-6 task lists', () => {
  it('US-005 AC-6: emits glyphs for - [ ] a and - [x] b when the body font has U+2610 and U+2612', () => {
    expect(blocks('- [ ] a\n- [x] b', {fonts: both})).toEqual({
      typ: '- ☐ a\n- ☒ b',
      warnings: none,
    });
  });

  it('US-005 AC-6: emits \\[ \\] and \\[x\\] with one FONT_GLYPH_MISSING per export when the body font lacks a glyph', () => {
    expect(blocks('- [ ] a\n- [x] b', {fonts: lacks(0x2610)})).toEqual({
      typ: '- \\[ \\] a\n- \\[x\\] b',
      warnings: [w('FONT_GLYPH_MISSING', MSG('U+2610'), 1)],
    });
  });

  it('US-005 AC-6: names U+2612 when only that glyph is missing, and uses the plain form for both', () => {
    expect(blocks('- [ ] a\n- [x] b', {fonts: lacks(0x2612)})).toEqual({
      typ: '- \\[ \\] a\n- \\[x\\] b',
      warnings: [w('FONT_GLYPH_MISSING', MSG('U+2612'), 1)],
    });
  });

  it('US-005 AC-6: reports once per export with the line of the first task item', () => {
    const out = blocks('# T\n\n- [ ] a\n\ntext\n\n- [x] b\n  - [ ] c', {
      fonts: lacks(0x2610, 0x2612),
    });
    expect(out.warnings).toEqual([w('FONT_GLYPH_MISSING', MSG('U+2610'), 3)]);
  });

  it('US-005 AC-6: reports nothing when the export has no task item', () => {
    expect(blocks('- a\n- b', {fonts: lacks(0x2610, 0x2612)}).warnings).toEqual(
      none,
    );
  });

  it('US-005 AC-6: uses only the effective body font for the check (default family when no body font is set)', () => {
    const asked: string[] = [];
    const spy: FontInfo = {
      hasGlyph: (family) => {
        asked.push(family);
        return true;
      },
    };
    blocks('- [ ] a', {fonts: spy});
    expect(new Set(asked)).toEqual(new Set(['Libertinus Serif']));
    asked.length = 0;
    blocks('- [ ] a', {fonts: spy, bodyFamily: 'Charter'});
    expect(new Set(asked)).toEqual(new Set(['Charter']));
  });

  it('US-005 AC-6: names the body font in the message', () => {
    expect(
      blocks('- [ ] a', {fonts: lacks(0x2610), bodyFamily: 'Charter'})
        .warnings[0]?.message,
    ).toBe('Font "Charter" lacks U+2610; task lists use [ ] / [x]');
  });

  it('US-005 AC-6: uses the plain notation without a warning when no font information is injected', () => {
    expect(blocks('- [ ] a\n- [x] b')).toEqual({
      typ: '- \\[ \\] a\n- \\[x\\] b',
      warnings: none,
    });
  });

  it('US-005 AC-6: keeps nesting of task lists in both forms', () => {
    const md = '- [ ] a\n  - [x] b\n- c';
    expect(withFonts(md, both)).toBe('- ☐ a\n  - ☒ b\n- c');
    expect(withFonts(md, undefined)).toBe('- \\[ \\] a\n  - \\[x\\] b\n- c');
  });

  it('US-005 AC-6: keeps the numbers of an ordered list and mixes task and normal items', () => {
    expect(withFonts('1. [x] done\n2. todo\n3. [ ] open', both)).toBe(
      '1. ☒ done\n2. todo\n3. ☐ open',
    );
  });

  it('US-005 AC-6: formats the text of a task item like any other text', () => {
    expect(withFonts('- [ ] **a** b = c', both)).toBe('- ☐ *a* b = c');
    expect(withFonts('- [ ] = x', both)).toBe('- ☐ = x');
    expect(withFonts('- [ ] = x', undefined)).toBe('- \\[ \\] = x');
  });

  it('US-005 AC-6: gives a task item with no content only its glyph', () => {
    const tree: BlockNode = {
      kind: 'list',
      line: 1,
      ordered: false,
      start: null,
      children: [{kind: 'item', line: 1, checked: false, children: []}],
    };
    expect(emitBlocks([tree], new EmitContext(), {fonts: both})).toBe('- ☐');
  });

  it('US-005 AC-6: a task item reports no NODE_UNSUPPORTED any more', () => {
    expect(blocks('- [ ] a', {fonts: both}).warnings).toEqual(none);
    expect(blocks('- [ ] a').warnings).toEqual(none);
  });
});

describe('US-005 no node of these kinds is left without an emitter', () => {
  it('US-005 AC-1: reports no NODE_UNSUPPORTED for tables and footnote definitions', () => {
    const md = `${table('| a |', '|---|', '| 1 |')}\n\nx[^1]\n\n[^1]: N`;
    expect(blocks(md).warnings).toEqual(none);
  });

  it('US-005 AC-1: a table in the real parser output is emitted as #table', () => {
    const tree = parse(table('| a | b |', '|---|---|', '| 1 | 2 |')).root;
    expect(emitBlocks(tree, new EmitContext())).toMatch(/^#table\(/);
  });
});
