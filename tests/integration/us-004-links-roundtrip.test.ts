// US-004 links against the real compiler (integration, offline). Property
// (SCAR-009, SCAR-010): every link, wikilink and anchor compiles and reads back
// as a link to the right place with the right text, whatever follows it, in
// every container, inside emphasis, inside headings; every label it points to
// exists (a missing label is a compile error); the whole real file compiles.
import {describe, expect, it} from 'vitest';
import {blocks} from '../support/blocks';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {diagnose, plainText} from '../support/typst-node';

const U = 'https://x.org';
const link = (url: string, body: string) => `<link "${url}">${body}</link>`;
const note = `<footnote>${link(U, U)}</>`;

/** Compiles `md` (with the headings it needs) and returns what Typst reads. */
async function read(md: string, heads = ''): Promise<string> {
  const {typ} = blocks(heads === '' ? md : `${heads}\n\n${md}`);
  const errors = (await diagnose(`${typ}\n`)).filter(
    (d) => d.severity === 'error',
  );
  expect(
    errors.map((e) => e.message),
    `${JSON.stringify(md)} -> ${JSON.stringify(typ)}`,
  ).toEqual([]);
  const text = await plainText(`\n${typ}`);
  return heads === '' ? text : (text.split('<parbreak>').pop() ?? text);
}
const squash = (s: string) =>
  s
    .replace(/<parbreak>/g, '¶')
    .replace(/\s*¶\s*/g, '¶')
    .replace(/\s+/g, ' ')
    .trim();

describe('US-004 AC-1 / AC-1b join hazards: a link followed by anything (compiler)', () => {
  const FOLLOW: [string, string][] = [
    ['.', '.'],
    ['.x', '.x'],
    ['(a)', '(a)'],
    ['[a]', '[a]'],
    [';', ';'],
    [',', ','],
    [' x', ' x'],
    [')', ')'],
    ['!', '!'],
  ];
  const KINDS: [string, string, string][] = [
    ['external with footnote', `[Site](${U})`, link(U, 'Site') + note],
    ['bare address', `<${U}>`, link(U, U)],
    ['local file', '[Site](a.pdf)', 'Site<footnote>a.pdf</>'],
  ];
  it('US-004 AC-1: every link kind followed by . ( [ ; and other text reads back as the link, then the text', async () => {
    for (const [name, md, expected] of KINDS) {
      for (const [suffix, text] of FOLLOW) {
        const actual = squash(await read(md + suffix));
        expect(actual, `${name} + ${JSON.stringify(suffix)}`).toBe(
          squash(expected + text),
        );
      }
    }
  }, 120_000);

  it('US-004 AC-1: a wikilink and an anchor link followed by . ( [ ; read back as the link, then the text', async () => {
    for (const [suffix, text] of FOLLOW) {
      for (const md of ['[[A]]', '[x](#a)']) {
        const body = md === '[[A]]' ? 'A' : 'x';
        const actual = squash(await read(md + suffix, '# A'));
        expect(actual, `${md} + ${JSON.stringify(suffix)}`).toBe(
          squash(`<link <h-a>>${body}</link>${text}`),
        );
      }
    }
  }, 120_000);

  it('US-004 AC-1: text before a link does not change it (word, slash, punctuation)', async () => {
    for (const before of ['a', 'a ', '/', 'a/', '(', '*x*', '`c`']) {
      const md = `${before}[Site](${U})`;
      const actual = squash(await read(md));
      expect(actual, md).toContain(link(U, 'Site') + note);
    }
  }, 60_000);
});

describe('US-004 emphasis around links (compiler)', () => {
  it('US-004 AC-1b: a link inside strong, emphasis, strike and highlight compiles and keeps its link', async () => {
    for (const md of [
      `**<${U}>**`,
      `*<${U}>*`,
      `~~<${U}>~~`,
      `==<${U}>==`,
      `**[Site](${U})**`,
      `*see [Site](${U})*`,
      `[*Site*](${U})`,
      `[**Site** and \`c\`](${U})`,
      `a *<${U}>*.`,
    ]) {
      const actual = await read(md);
      expect(actual, md).toContain(`<link "${U}">`);
    }
  }, 60_000);

  it('US-004 AC-1e: formatted link text reads back with the formatting inside the link', async () => {
    expect(squash(await read(`[**Site**](${U})`))).toBe(
      squash(link(U, '<strong>Site</>') + note),
    );
  });
});

describe('US-004 AC-2 / AC-3 / AC-8 internal links resolve (compiler)', () => {
  it('US-004 AC-2: every kind of internal link points to an existing label', async () => {
    const heads = '# Tessera\n\n## Prism Variants\n\n## Prism';
    for (const md of [
      '[[Tessera]]',
      '[[Tessera|fighting]]',
      '[[#Tessera]]',
      '[[Rules#Tessera]]',
      '[x](#Prism%20Variants)',
      '[x](#prism-variants)',
      '[x](#1.3.2-prism)',
      '[x](../../Texts/1.3.2%20Prism.md#Prism%20Variants)',
      '[x](Texts/1.3.2%20Prism.md)',
      '[**x**](#prism)',
    ]) {
      expect(await read(md, heads), md).toMatch(/^<link <h-[a-z-]+>>/);
    }
  }, 60_000);

  it('US-004 AC-2: a link to a later heading resolves', async () => {
    expect(squash(await read('[[Later]]\n\n# Later'))).toBe(
      squash('<link <h-later>>Later</link>¶<heading>Later</>'),
    );
  });

  it('US-004 AC-5: a link inside a heading, a list item and a quote resolves', async () => {
    for (const md of [
      '# Tessera\n\n## See [[Tessera]]',
      '# Tessera\n\n- [[Tessera]]',
      '# Tessera\n\n> [[Tessera]]',
      '# Tessera\n\n> - [x](#tessera)',
      '# Tessera\n\n1. > [[Tessera]]',
    ]) {
      const {typ} = blocks(md);
      const errors = (await diagnose(`${typ}\n`)).filter(
        (d) => d.severity === 'error',
      );
      expect(
        errors.map((e) => e.message),
        md,
      ).toEqual([]);
    }
  }, 60_000);
});

describe('US-004 AC-4 / AC-7 / AC-9 text only (compiler)', () => {
  it('US-004 AC-4: unresolved links read back as their text, with formatting', async () => {
    expect(squash(await read('[[Nowhere]]'))).toBe('Nowhere');
    expect(squash(await read('[**Tessera**](#nowhere)'))).toBe(
      '<strong>Tessera</>',
    );
    expect(squash(await read('a [x]() b'))).toBe('a x b');
  });

  it('US-004 AC-7: a note embed reads back as its name', async () => {
    expect(squash(await read('![[Other Note]]'))).toBe('Other Note');
    expect(squash(await read('![[Other#Part|x]]'))).toBe('Other#Part');
  });

  it('US-004 AC-9: a local file link reads back as text plus the path in a footnote', async () => {
    expect(
      squash(
        await read('[Download](assets/roa_charactersheet_hex_skillmap.pdf).'),
      ),
    ).toBe('Download<footnote>assets/roa_charactersheet_hex_skillmap.pdf</>.');
  });
});

describe('US-004 the sample note (compiler)', () => {
  const md = readSample('Book.md');
  const {anchors, census} = readManifest();
  const external =
    (census.hrefs['link:inline:web'] ?? 0) +
    (census.hrefs['link:linkify:web'] ?? 0);
  it('US-004 AC-8: the whole sample note with its anchors, external links and file link compiles with zero errors', async () => {
    const {typ, warnings} = blocks(md);
    const errors = (await diagnose(`${withCalloutHarness(typ)}\n`)).filter(
      (d) => d.severity === 'error',
    );
    expect(errors.map((e) => e.message)).toEqual([]);
    // Unresolved anchors and the wikilinks [[Other]] and [[Missing]], and
    // the ambiguous anchors (US-024 AC-2c).
    expect(warnings.filter((w) => w.code.startsWith('LINK_')).length).toBe(
      anchors.unresolved + 2 + anchors.ambiguous,
    );
  }, 60_000);

  it('US-004 AC-1: every external link of the sample note has its address in a footnote unless its text is the address', () => {
    const {typ} = blocks(md);
    const calls = typ.match(/#link\("https?:/g)?.length ?? 0;
    const footnotes = typ.match(/#footnote\[#link\("https?:/g)?.length ?? 0;
    expect(external).toBeGreaterThanOrEqual(22);
    expect(calls).toBeGreaterThanOrEqual(external);
    expect(footnotes).toBeGreaterThan(0);
    expect(footnotes).toBeLessThanOrEqual(calls);
  });
});
