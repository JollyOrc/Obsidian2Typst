// US-018 AC-3, AC-4, AC-7, AC-9 — page numbers after internal links with the
// real compiler: the helper text itself (measured, green before the code) with
// a cover, the join table (SCAR-010), the words, the same-page decision at a
// page edge, the composed export with its guard (SCAR-015) and the fixture.
// Source of truth: docs/user-stories/US-018-page-numbers-for-internal-links.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {A5_PRINT, FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {PAGE_REF} from '../support/page-refs';
import {readPdfPages, type PdfPage} from '../support/pdf';
import {readManifest, readSample} from '../support/sample';

/** US-018: the settings `convert` gets (absent today, so passed untyped). */
interface Refs {
  linkPageNumbers: boolean;
  linkPageLevel: number;
  linkPageWord: string;
}
const ON: Refs = {linkPageNumbers: true, linkPageLevel: 2, linkPageWord: 'p.'};

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const FONT_FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const COVER_PATH = 'Sample/assets/cover.png';
const IMAGES: Record<string, Uint8Array> = {[COVER_PATH]: png(40, 56)};

let shared: ReturnType<typeof createTypstCompiler> | undefined;
const compiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
afterAll(() => shared?.dispose());

/** Compiles Typst source with the bundled fonts; the error text on failure. */
async function compileTyp(
  source: string,
  files: Record<string, Uint8Array> = {},
): Promise<{pages: PdfPage[]; error: string | null}> {
  const compiled = await compiler().compile({
    file: 'main.typ',
    source,
    files,
    fonts: FONT_FILES,
  });
  return compiled.ok
    ? {pages: readPdfPages(compiled.pdf), error: null}
    : {pages: [], error: compiled.error};
}

/** Compiles `source`; throws on a compile error. */
async function pagesOf(source: string): Promise<PdfPage[]> {
  const {pages, error} = await compileTyp(source);
  if (error !== null) throw new Error(`${error}\n${source}`);
  return pages;
}

/** The page text with runs of white space as one blank. */
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Converts `source` (with a cover first) with folios and the running header
 * on and the page-reference fields `refs`, and compiles it.
 */
async function exportNote(
  source: string,
  refs: Partial<Refs> | undefined,
): Promise<{pages: PdfPage[]; typ: string}> {
  const index = new FakeIndex([NOTE_PATH, COVER_PATH]);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const settings = {
    ...SETTINGS,
    page: {...A5_PRINT, facingPages: true},
    fonts: structuredClone(DEFAULT_FONTS),
    cover: {...DEFAULT_COVER, blankPageAfter: true},
    pageFurniture: {folios: true, runningHeader: true, runningHeaderLevel: 2},
    ...refs,
  } as ConvertSettings;
  const result = await convert({
    source: `![](assets/cover.png)\n\n${source}`,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = IMAGES[use.from] as Uint8Array;
  }
  const {pages, error} = await compileTyp(result.typ, files);
  if (error !== null) throw new Error(`${error}\n${result.typ}`);
  return {pages, typ: result.typ};
}

const PREAMBLE = [
  '#set page(width: 148mm, height: 210mm, numbering: "1", footer: context align(center, counter(page).display()))',
  '#set text(font: "Libertinus Serif", size: 10pt)',
  PAGE_REF('p.'),
].join('\n');

/** A document whose target heading `Tessera` is on PDF page 3 (folio 3). */
const doc = (body: string, preamble = PREAMBLE): string =>
  `${preamble}\n${body}\n\n#pagebreak()\n#pagebreak()\n= Tessera <h-c>\n\nx\n`;

describe('US-018 the helper text with the real compiler (measured 2026-10-20 and 2026-10-21; green before the code)', () => {
  it('US-018 AC-4: after a cover and its blank page, a heading on PDF page 4 prints its folio 3', async () => {
    const source = [
      PREAMBLE,
      '#page(margin: 0pt, header: none, footer: none, numbering: none)[#rect(width: 100%, height: 100%, fill: gray)]',
      '#page(margin: 0pt, header: none, footer: none, numbering: none)[]',
      '#counter(page).update(1)',
      'See #link(<h-c>)[Tessera]#page-ref(<h-c>);.',
      '#pagebreak()',
      '#pagebreak()',
      '= Tessera <h-c>',
      'x',
    ].join('\n');
    const pages = await pagesOf(source);
    expect(pages).toHaveLength(5);
    expect(flat(pages[2]?.text ?? '')).toContain('Tessera (p. 3)');
    expect(pages[4]?.footer.trim()).toBe('3');
  });

  const JOIN: [string, string, string][] = [
    ['.', '#page-ref(<h-c>);.', 'Tessera (p. 3) .'],
    [',', '#page-ref(<h-c>), then', 'Tessera (p. 3) , then'],
    [')', '(see #link(<h-c>)[Tessera]#page-ref(<h-c>))', 'Tessera (p. 3) )'],
    [';', '#page-ref(<h-c>);; then', 'Tessera (p. 3) ; then'],
    ['a letter', '#page-ref(<h-c>)s here', 'Tessera (p. 3) s here'],
    ['(', '#page-ref(<h-c>);(y)', 'Tessera (p. 3) (y)'],
    ['\\[', '#page-ref(<h-c>)\\[y\\]', 'Tessera (p. 3) [y]'],
    ['a footnote', '#page-ref(<h-c>)#footnote[n]', 'Tessera (p. 3) 1'],
    ['a line break', '#page-ref(<h-c>)\\\nnext', 'Tessera (p. 3) next'],
    ['another link', '#page-ref(<h-c>)#link(<h-c>)[x]', 'Tessera (p. 3) x'],
  ];
  for (const [name, tail, shown] of JOIN) {
    it(`US-018 AC-3, SCAR-010: ${name} after the call compiles and prints after the number`, async () => {
      const call = tail.startsWith('(see')
        ? tail
        : `See #link(<h-c>)[Tessera]${tail}`;
      const pages = await pagesOf(doc(call));
      expect(flat(pages[0]?.text ?? '')).toContain(shown);
    });
  }

  it('US-018 AC-3, SCAR-010 guard: ( right after the call without ; fails', async () => {
    const {error} = await compileTyp(
      doc('See #link(<h-c>)[Tessera]#page-ref(<h-c>)(y) here.'),
    );
    expect(error).toContain('unknown variable: y');
  });

  it('US-018 AC-5: inside a mark the number is bold, after it plain (widths measured)', async () => {
    const pages = await pagesOf(
      doc(
        '#context { let w(c) = measure(c).width; [IN=#(w([*Tessera#page-ref(<h-c>)*]) == w([*Tessera (p.~3)*])) OUT=#(w([*Tessera*#page-ref(<h-c>)]) == w([*Tessera* (p.~3)]))] }',
      ),
    );
    expect(flat(pages[0]?.text ?? '')).toMatch(/IN= ?true OUT= ?true/);
  });

  it('US-018 AC-3: the word S. and an escaped word print as written', async () => {
    const words: [string, string][] = [
      ['S.', '(S. 3)'],
      ['p\\*', '(p* 3)'],
      ['\\@p', '(@p 3)'],
    ];
    for (const [escaped, shown] of words) {
      const preamble = PREAMBLE.replace(PAGE_REF('p.'), PAGE_REF(escaped));
      const pages = await pagesOf(
        doc('See #link(<h-c>)[Tessera]#page-ref(<h-c>);.', preamble),
      );
      expect(flat(pages[0]?.text ?? ''), escaped).toContain(`Tessera ${shown}`);
    }
  });

  it('US-018 AC-2 decision 3: at a page edge every number equals the folio of the target page (filler swept)', async () => {
    const line = (i: number) =>
      `Line ${i} of filler text that runs across the measure of the page here.`;
    for (let k = 22; k <= 27; k++) {
      const links = Array.from(
        {length: 8},
        () => '#link(<h-t>)[Target section]#page-ref(<h-t>);,',
      ).join(' ');
      const filler = Array.from({length: k}, (_, i) => line(i)).join('\n\n');
      const pages = await pagesOf(
        `${PREAMBLE}\n${filler}\n\n${links} end.\n\n== Target <h-t>\n\nzz\n`,
      );
      const target = pages.findIndex((p) => flat(p.text).includes('Target zz'));
      const folio = pages[target]?.footer.trim();
      const numbers = pages.flatMap((p) =>
        [...flat(p.text).matchAll(/\(p\. (\d+)\)/g)].map((m) => m[1]),
      );
      expect(numbers, `k=${k}`).toEqual(Array(8).fill(folio));
    }
  }, 60_000);
});

describe('US-018 AC-4, AC-7 the composed export (SCAR-015)', () => {
  const filler = (n: number, word: string): string =>
    Array.from(
      {length: n},
      (_, i) => `${word} line ${i} with some words.`,
    ).join('\n\n');
  const NOTE = [
    '# Rules',
    '',
    'MarkIntro. See [advance](#raising-a-banner) and [moss](#moss-rules).',
    '',
    filler(30, 'Intro'),
    '',
    '## Raising a Banner',
    '',
    'MarkADV.',
    '',
    filler(40, 'Advancing'),
    '',
    '### Moss Rules',
    '',
    'MarkFLINT.',
    '',
    filler(20, 'Moss'),
    '',
    '## See [rules](#rules)',
    '',
    'MarkSEE with a note[^1].',
    '',
    '[^1]: Footnote: see [advance](#raising-a-banner).',
    '',
    '# Glossary',
    '',
    '## Gambit',
    '',
    'An act; MarkGLOSS see [moss](#moss-rules) and [advance](#raising-a-banner).',
  ].join('\n');

  /** The folio of the page that holds `marker` (the paragraph after a heading). */
  const folioOf = (pages: PdfPage[], marker: string): string => {
    const page = pages.find((p) => p.text.includes(marker));
    if (page === undefined) throw new Error(`no page holds ${marker}`);
    return page.footer.trim();
  };
  /** The flat text of the page that holds `marker`. */
  const pageWith = (pages: PdfPage[], marker: string): string =>
    flat(pages.find((p) => p.text.includes(marker))?.text ?? '');

  it('US-018 AC-4, AC-7: each number is the folio of the page that holds its target; the cover is not counted', async () => {
    const {pages} = await exportNote(NOTE, ON);
    const adv = folioOf(pages, 'MarkADV');
    const moss = folioOf(pages, 'MarkFLINT');
    const rules = folioOf(pages, 'MarkIntro');
    expect(Number(adv)).toBeGreaterThan(Number(rules));
    expect(pageWith(pages, 'MarkIntro')).toContain(`advance (p. ${adv})`);
    // a ### target from the body: no number at level 2
    expect(pageWith(pages, 'MarkIntro')).toMatch(/moss and|moss \./);
    expect(pageWith(pages, 'MarkIntro')).not.toContain('moss (p.');
    // the glossary explanation numbers every link
    expect(pageWith(pages, 'MarkGLOSS')).toContain(
      `moss (p. ${moss}) and advance (p. ${adv})`,
    );
    // the footnote
    expect(pages.map((p) => flat(p.text)).join(' ')).toContain(
      `Footnote: see advance (p. ${adv})`,
    );
    // the first body page is folio 1, so the cover pages are not counted
    expect(rules).toBe('1');
  }, 60_000);

  it('US-018 AC-7: no number after the link in a heading and none in any running header', async () => {
    const {pages} = await exportNote(NOTE, ON);
    const all = pages.map((p) => flat(p.text)).join(' ');
    expect(all).toContain('See rules');
    expect(all).not.toContain('rules (p.');
    for (const page of pages) expect(page.header).not.toContain('(p.');
  }, 60_000);

  it('US-018 AC-7, SCAR-019: at linkPageLevel 3 the ### target is numbered in the body; at 1 only the glossary numbers', async () => {
    const three = (await exportNote(NOTE, {...ON, linkPageLevel: 3})).pages;
    const adv = folioOf(three, 'MarkADV');
    const moss = folioOf(three, 'MarkFLINT');
    expect(pageWith(three, 'MarkIntro')).toContain(
      `advance (p. ${adv}) and moss (p. ${moss})`,
    );
    const one = (await exportNote(NOTE, {...ON, linkPageLevel: 1})).pages;
    const all = one.map((p) => flat(p.text)).join(' ');
    expect(pageWith(one, 'MarkIntro')).toContain('See advance and moss');
    expect(all).toMatch(/Footnote: see advance ?\./);
    expect(pageWith(one, 'MarkGLOSS')).toMatch(
      /moss \(p\. \d+\) and advance \(p\. \d+\)/,
    );
  }, 60_000);

  it('US-018 AC-7: linkPageWord S. prints (S. N)', async () => {
    const {pages} = await exportNote(NOTE, {...ON, linkPageWord: 'S.'});
    const adv = folioOf(pages, 'MarkADV');
    expect(pageWith(pages, 'MarkIntro')).toContain(`advance (S. ${adv})`);
  }, 60_000);

  it('US-018 AC-7 guard: with linkPageNumbers false no (p. appears, and the links are there', async () => {
    const {pages} = await exportNote(NOTE, {...ON, linkPageNumbers: false});
    const all = pages.map((p) => flat(p.text)).join(' ');
    expect(all).toContain('See advance and moss');
    expect(all).not.toContain('(p.');
  }, 60_000);
});

describe('US-018 AC-9 the sample note', () => {
  const source = readSample('Book.md');
  const {numberedLinks} = readManifest();

  it('US-018 AC-9: compiles with the numbers of the manifest at the built-in values; none in a header', async () => {
    const {pages} = await exportNote(source, ON);
    const numbers = pages.flatMap((p) =>
      [...flat(p.text).matchAll(/\(p\. \d+\)/g)].map((m) => m[0]),
    );
    expect(numbers).toHaveLength(numberedLinks['2'] as number);
    for (const page of pages) expect(page.header).not.toContain('(p.');
  }, 180_000);
});
