// US-005 footnotes and task lists against the real compiler (integration,
// offline). Property (SCAR-009, SCAR-010): a footnote reference or inline note
// compiles and reads back as a footnote with the right text in every container,
// whatever follows it; task lists compile in both forms; the real file compiles.
import {describe, expect, it} from 'vitest';
import {blocks} from '../support/blocks';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {diagnose, plainText} from '../support/typst-node';

/** Compiles `md`; returns what Typst reads, with paragraph breaks as ¶. */
async function read(md: string, options?: Parameters<typeof blocks>[1]) {
  const {typ} = blocks(md, options);
  const errors = (await diagnose(`${typ}\n`)).filter(
    (d) => d.severity === 'error',
  );
  expect(
    errors.map((e) => e.message),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toEqual([]);
  return squash(await plainText(`\n${typ}`));
}
const squash = (s: string) =>
  s
    .replace(/<parbreak>/g, '¶')
    .replace(/\s*¶\s*/g, '¶')
    .replace(/\s+/g, ' ')
    // Blanks at the edge of a container are layout.
    .replace(/(<(?:footnote|quote|item|n\d+)>) /g, '$1')
    .replace(/ (<\/>)/g, '$1')
    .trim();
const fn = (body: string) => `<footnote>${body}</>`;
const NOTE = '\n\n[^1]: N';

describe('US-005 AC-4 / AC-4c join hazards: a footnote followed by anything (compiler)', () => {
  const FOLLOW = ['.', '.x', '(a)', '[a]', ';', ',', ' x', ')', '!'];

  it('US-005 AC-4: a reference followed by . ( [ ; and other text reads back as the footnote, then the text', async () => {
    // `[^1](a)` and `[^1][a]` are links to Markdown, not a note and text.
    for (const next of FOLLOW.filter((f) => f !== '(a)' && f !== '[a]')) {
      expect(await read(`a[^1]${next}${NOTE}`), JSON.stringify(next)).toBe(
        squash(`a${fn('N')}${next}`),
      );
    }
  });

  it('US-005 AC-4c: an inline note followed by . ( [ ; and other text reads back the same', async () => {
    for (const next of FOLLOW) {
      expect(await read(`a^[N]${next}`), JSON.stringify(next)).toBe(
        squash(`a${fn('N')}${next}`),
      );
    }
  });

  it('US-005 AC-4: two notes in a row and a note at the start of a paragraph compile', async () => {
    expect(await read(`a[^1][^1]${NOTE}`)).toBe(`a${fn('N')}${fn('N')}`);
    expect(await read(`[^1]${NOTE}`)).toBe(fn('N'));
  });
});

describe('US-005 AC-4 / AC-5 note bodies (compiler)', () => {
  const body = async (def: string, expected: string) =>
    expect(await read(`x[^a]\n\n[^a]: ${def}`), def).toBe(`x${fn(expected)}`);

  it('US-005 AC-5: formatting, links and wikilinks in a note read back', async () => {
    await body('*a* **b** `c`', '<emph>a</> <strong>b</> c');
  });

  it('US-005 AC-4: a note of several paragraphs, a list or code reads back', async () => {
    await body('p1\n\n    p2', 'p1¶p2');
    await body('p1\n\n    - a\n    - b', 'p1¶<item>a</> <item>b</>');
    await body('p1\n\n    ```\n    code\n    ```', 'p1¶code');
    await body('a\n    b', 'a b');
  });

  it('US-005 AC-4: markup characters at the start and inside a note stay text', async () => {
    await body('\\- a', '- a');
    await body('\\= a \\$ \\#b', '= a $ #b');
    await body('1\\. x', '1. x');
  });

  it('US-005 AC-5: a link inside a note reads as the link plus its address in parentheses', async () => {
    expect(await read('x[^a]\n\n[^a]: [S](https://x.org)')).toBe(
      'x<footnote><link "https://x.org">S</link> (<link "https://x.org">https://x.org</link>)</>',
    );
  });

  it('US-005 AC-5: a wikilink inside a note points at the heading', async () => {
    const text = await read('x[^a]\n\n# Tessera\n\n[^a]: See [[Tessera]]');
    expect(text).toContain('<footnote>See <link <h-tessera>>Tessera</link></>');
  });
});

describe('US-005 AC-5 footnotes in every container (compiler)', () => {
  const CASES: [string, string, string][] = [
    ['paragraph', 'a[^1] b', `a${fn('N')} b`],
    ['heading', '# H[^1]', `<heading>H${fn('N')}</>`],
    ['list item', '- a[^1]', `<item>a${fn('N')}</>`],
    ['numbered item', '1. a[^1]', `<n1>a${fn('N')}</>`],
    ['quote', '> q[^1]', `<quote>q${fn('N')}</>`],
    ['emphasis', '*a[^1]* b', `<emph>a${fn('N')}</> b`],
    ['strike', '~~a[^1]~~ b', `<strike>a${fn('N')}</> b`],
    ['table cell', '| a |\n|---|\n| x[^1] |', `<cell>a</><cell>x${fn('N')}</>`],
    [
      'table header',
      '| a[^1] |\n|---|\n| x |',
      `<cell>a${fn('N')}</><cell>x</>`,
    ],
    ['nested list', '- a\n  - b[^1]', '<item>a <item>b' + fn('N') + '</></>'],
  ];

  it('US-005 AC-5: a reference and an inline note read back as a footnote in every container', async () => {
    for (const [name, md, expected] of CASES) {
      expect(await read(`${md}${NOTE}`), `${name} (reference)`).toBe(
        squash(expected),
      );
      expect(await read(md.replace('[^1]', '^[N]')), `${name} (inline)`).toBe(
        squash(expected),
      );
    }
  });
});

describe('US-005 AC-4d nested notes and headings in notes (compiler)', () => {
  it('US-005 AC-4d: a nested reference is omitted and the document compiles', async () => {
    expect(await read('x[^a]\n\n[^a]: see[^b]\n[^b]: inner')).toBe(
      `x${fn('see')}`,
    );
    expect(await read('x[^a]\n\n[^a]: see^[inner]')).toBe(`x${fn('see')}`);
  });

  it('US-005 AC-4d: a heading in a note reads as a plain paragraph, not as a heading', async () => {
    const text = await read('x[^a]\n\n[^a]: # Head\n\n    para');
    expect(text).toBe(`x${fn('Head¶para')}`);
    expect(text).not.toContain('<heading>');
  });
});

describe('US-005 AC-6 task lists (compiler)', () => {
  const both = {fonts: {hasGlyph: () => true}};
  const md = '- [ ] a\n  - [x] b\n- c\n- [x] d **e**';

  it('US-005 AC-6: the glyph form compiles and reads as items with the glyphs', async () => {
    expect(await read(md, both)).toBe(
      '<item>☐ a <item>☒ b</></> <item>c</> <item>☒ d <strong>e</></>',
    );
  });

  it('US-005 AC-6: the plain form compiles and reads as items with [ ] and [x]', async () => {
    expect(await read(md)).toBe(
      '<item>[ ] a <item>[x] b</></> <item>c</> <item>[x] d <strong>e</></>',
    );
  });

  it('US-005 AC-6: task lists in a quote, a numbered list and next to a table compile', async () => {
    expect(await read('> - [ ] a\n> - [x] b', both)).toBe(
      '<quote><item>☐ a</> <item>☒ b</></>',
    );
    expect(await read('1. [ ] a\n2. [x] b', both)).toBe(
      '<n1>☐ a</> <n2>☒ b</>',
    );
  });
});

describe('US-005 the sample note', () => {
  const md = readSample('Book.md');
  const result = blocks(md);
  const {census} = readManifest();

  it('US-005 AC-4: converts the footnote of the sample note and its inline notes and the document compiles', async () => {
    expect(census.kinds['footnote-def']).toBe(1);
    expect(census.kinds['inline-footnote']).toBeGreaterThanOrEqual(15);
    expect(result.typ.match(/#footnote\[/g)?.length).toBeGreaterThanOrEqual(
      (census.kinds['inline-footnote'] ?? 0) + 1,
    );
    const errors = (
      await diagnose(`${withCalloutHarness(result.typ)}\n`)
    ).filter((d) => d.severity === 'error');
    expect(errors.map((e) => e.message)).toEqual([]);
    const codes = (code: string) =>
      result.warnings.filter((x) => x.code === code).length;
    expect(codes('FOOTNOTE_UNDEFINED')).toBe(0);
    expect(codes('FOOTNOTE_UNUSED')).toBe(0);
    expect(codes('FOOTNOTE_UNCLOSED')).toBe(0);
    expect(codes('FOOTNOTE_NESTED')).toBe(0);
  });
});
