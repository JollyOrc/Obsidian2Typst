// US-019 AC-3 to AC-9, AC-11 — folios and running headers with the real
// compiler: the helper text itself (measured, green before the code), the
// folio pages with and without a cover, the folio side and the header font,
// the header title page by page (AC-5), footnotes in a title (AC-7), the
// composed export with its guard (AC-9, SCAR-015) and the fixture.
// Source of truth: docs/user-stories/US-019-folios-and-running-headers.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {A5_PRINT, FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {
  FOOTER_FACING,
  HEADER,
  RUNNING_TEXT,
  RUNNING_TITLE,
} from '../support/furniture';
import {png} from '../support/images';
import {readManifest, readSample} from '../support/sample';
import {readPdfPages, type PdfPage} from '../support/pdf';

interface Furniture {
  folios: boolean;
  runningHeader: boolean;
  runningHeaderLevel: number;
}
const ON: Furniture = {
  folios: true,
  runningHeader: true,
  runningHeaderLevel: 2,
};
const OFF: Furniture = {...ON, folios: false, runningHeader: false};

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
const FILES = [NOTE_PATH, COVER_PATH];

let shared: ReturnType<typeof createTypstCompiler> | undefined;
const compiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
afterAll(() => shared?.dispose());

/** Compiles Typst source with the bundled fonts; throws on a compile error. */
async function compileTyp(
  source: string,
  files: Record<string, Uint8Array> = {},
): Promise<PdfPage[]> {
  const compiled = await compiler().compile({
    file: 'main.typ',
    source,
    files,
    fonts: FONT_FILES,
  });
  if (!compiled.ok) throw new Error(`${compiled.error}\n${source}`);
  return readPdfPages(compiled.pdf);
}

/** Converts `source` with furniture (and a cover, when asked) and compiles it. */
async function compile(
  source: string,
  furniture: Furniture | undefined,
  options: {cover?: 'none' | 'cover' | 'blank'; facingPages?: boolean} = {},
): Promise<{pages: PdfPage[]; typ: string}> {
  const index = new FakeIndex(FILES);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const cover = options.cover ?? 'none';
  const settings = {
    ...SETTINGS,
    page: {...A5_PRINT, facingPages: options.facingPages ?? true},
    fonts: structuredClone(DEFAULT_FONTS),
    cover:
      cover === 'none'
        ? undefined
        : {...DEFAULT_COVER, blankPageAfter: cover === 'blank'},
    pageFurniture: furniture,
  } as ConvertSettings;
  const body = cover === 'none' ? source : `![](assets/cover.png)\n\n${source}`;
  const result = await convert({
    source: body,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = IMAGES[use.from] as Uint8Array;
  }
  return {pages: await compileTyp(result.typ, files), typ: result.typ};
}

const filler = (n: number, word = 'Filler'): string =>
  Array.from({length: n}, (_, i) => `${word} line ${i} with some words.`).join(
    '\n\n',
  );

/** mm to pt. */
const pt = (mm: number): number => (mm / 25.4) * 72;

describe('US-019 the helper text with the real compiler (measured 2026-10-19; green before the code)', () => {
  const PREAMBLE = [
    '#set page(width: 154mm, height: 216mm, margin: (top: 21mm, bottom: 25mm, inside: 23mm, outside: 18mm))',
    '#set text(font: "Libertinus Serif", size: 10pt)',
    '#set heading(numbering: "1.1")',
    RUNNING_TEXT,
    RUNNING_TITLE,
    `#set page(numbering: "1", ${HEADER(2)}, ${FOOTER_FACING})`,
  ].join('\n');
  const typFiller = (n: number) =>
    Array.from({length: n}, (_, i) => `Filler line ${i} with some words.`).join(
      '\n\n',
    );
  const DOC = [
    PREAMBLE,
    '#page(margin: 0pt, header: none, footer: none, numbering: none)[#rect(width: 100%, height: 100%, fill: gray)]',
    '#counter(page).update(1)',
    'Intro before any heading.',
    '#pagebreak()',
    '= Reader Section',
    'Section intro.',
    typFiller(70),
    '== Tessera',
    typFiller(10),
    '== Prism',
    typFiller(30),
    '= Glossary',
    typFiller(5),
    '#pagebreak()',
    'More glossary text.',
    '== Footnoted *bold#footnote[inner]* chapter#footnote[fn]',
    'x',
    '#pagebreak()',
    'after.',
  ].join('\n\n');

  it('US-019 AC-3, AC-5, AC-7: headers, folios and labels page by page', async () => {
    const pages = await compileTyp(DOC);
    expect(pages.map((p) => p.header.replace(/\s+/g, ' ').trim())).toEqual([
      '',
      '',
      '',
      'Reader Section',
      'Tessera',
      'Prism',
      '',
      'Footnoted bold chapter',
      'Footnoted bold chapter',
    ]);
    expect(pages.map((p) => p.footer.trim())).toEqual([
      '',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    expect(pages.map((p) => p.labelShown)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    // AC-7: the two footnotes keep 1 and 2.
    expect(pages[7]?.text.replace(/\s+/g, ' ')).toMatch(/1 inner.*2 fn/);
  });

  it('US-019 AC-4: the folio is at the outside margin: left on even pages, right on odd pages', async () => {
    const pages = await compileTyp(DOC);
    const outside = pt(18);
    for (const [i, page] of pages.entries()) {
      if (page.footerX === null) continue;
      if ((i + 1) % 2 === 0)
        expect(page.footerX, String(i)).toBeCloseTo(outside, 0);
      else expect(page.footerX, String(i)).toBeGreaterThan(page.width / 2);
    }
  });

  it('US-019 AC-4: the header is set in the body font at 0.9 of its size', async () => {
    const pages = await compileTyp(DOC);
    const page = pages[4] as PdfPage;
    expect(page.headerFont).toBe(page.bodyFont);
    expect(page.headerSize).toBeCloseTo((page.bodySize ?? 0) * 0.9, 1);
  });

  it('US-019 AC-7 guard: without running-text the footnotes of a title are repeated in the headers and the real ones are numbered 3 and 4 (measured)', async () => {
    const plain = DOC.replace(
      'return running-text(starting.first().body)',
      'return starting.first().body',
    );
    const pages = await compileTyp(plain);
    expect(pages[7]?.header).toContain('1');
    expect(pages[7]?.text.replace(/\s+/g, ' ')).toMatch(/3 inner.*4 fn/);
  });
});

describe('US-019 AC-3 the folio pages', () => {
  const NOTE = `# Rules\n\n${filler(60)}`;

  it('US-019 AC-3: cover, no blank page: page 1 no folio, then 1, 2, …', async () => {
    const {pages} = await compile(NOTE, ON, {cover: 'cover'});
    expect(pages[0]?.footer).toBe('');
    expect(pages.slice(1).map((p) => p.footer.trim())).toEqual(
      pages.slice(1).map((_, i) => String(i + 1)),
    );
    expect(pages[0]?.labelShown).toBe(false);
  });

  it('US-019 AC-3: cover and blank page: pages 1 and 2 no folio, page 3 folio 1', async () => {
    const {pages} = await compile(NOTE, ON, {cover: 'blank'});
    expect(pages.slice(0, 3).map((p) => p.footer.trim())).toEqual([
      '',
      '',
      '1',
    ]);
    expect(pages.slice(0, 2).map((p) => p.labelShown)).toEqual([false, false]);
  });

  it('US-019 AC-3: no cover: page 1 folio 1', async () => {
    const {pages} = await compile(NOTE, ON);
    expect(pages[0]?.footer.trim()).toBe('1');
  });

  it('US-019 AC-4: single pages: every folio centred', async () => {
    const {pages} = await compile(NOTE, ON, {facingPages: false});
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.footerX ?? 0).toBeGreaterThan(page.width / 3);
      expect(page.footerX ?? page.width).toBeLessThan((page.width * 2) / 3);
    }
  });
});

describe('US-019 AC-5, AC-6 the header title from a note', () => {
  const NOTE = [
    'Intro.',
    '',
    '# Reader Section',
    '',
    filler(70, 'Player'),
    '',
    '## Tessera',
    '',
    filler(10, 'Tessera'),
    '',
    '## Prism *arts* `x`',
    '',
    filler(80, 'Prism'),
    '',
    '# Appendix',
    '',
    filler(80, 'Appendix'),
    '',
    '## Late chapter',
    '',
    filler(30, 'Late'),
  ].join('\n');

  it('US-019 AC-5: the five rules page by page (worked example)', async () => {
    const {pages} = await compile(NOTE, ON, {cover: 'cover'});
    const headers = pages.map((p) => p.header.replace(/\s+/g, ' ').trim());
    const pageOf = (part: string) =>
      pages.findIndex((p) => p.text.replace(/\s+/g, ' ').includes(part));
    const h1 = pageOf('1 Reader Section');
    const combat = pageOf('1.1 Tessera');
    const magic = pageOf('1.2 Prism');
    const appendix = pageOf('2 Appendix');
    const late = pageOf('2.1 Late chapter');
    // Each rule needs a page of its own between two heading starts.
    expect(combat - h1, 'pages between H1 and Tessera').toBeGreaterThanOrEqual(
      2,
    );
    expect(
      appendix - magic,
      'pages between Prism and Appendix',
    ).toBeGreaterThanOrEqual(2);
    expect(
      late - appendix,
      'pages between Appendix and Late',
    ).toBeGreaterThanOrEqual(2);
    expect(headers[0]).toBe('');
    expect(headers[pageOf('Intro.')]).toBe('');
    expect(headers[h1]).toBe('');
    expect(headers[h1 + 1]).toBe('Reader Section');
    expect(headers[combat]).toBe('Tessera');
    expect(headers[magic]).toMatch(/^Prism arts x$/);
    expect(headers[magic + 1]).toMatch(/^Prism arts x$/);
    expect(headers[appendix]).toBe('');
    expect(headers[appendix + 1]).toBe('Appendix');
    expect(headers[late]).toBe('Late chapter');
    expect(headers.every((h) => !/^\d/.test(h))).toBe(true);
  });

  it('US-019 AC-5: level 3 in a new H1 section shows the H1 title, never the old chapter (decided 2026-10-20)', async () => {
    const {pages} = await compile(
      `# Part\n\n${filler(30, 'Part')}\n\n## Chapter\n\n${filler(30, 'Chapter')}\n\n### Section\n\n${filler(30, 'Section')}\n\n# Appendix\n\n${filler(80, 'Appendix')}`,
      {...ON, runningHeaderLevel: 3},
    );
    const headers = pages.map((p) => p.header.replace(/\s+/g, ' ').trim());
    const appendix = pages.findIndex((p) =>
      p.text.replace(/\s+/g, ' ').includes('2 Appendix'),
    );
    expect(pages.length - appendix).toBeGreaterThanOrEqual(2);
    expect(headers[appendix]).toBe('');
    expect(headers.slice(appendix + 1)).toEqual(
      headers.slice(appendix + 1).map(() => 'Appendix'),
    );
  });

  it('US-019 AC-5: level 3 shows ### titles and falls back to the ## title', async () => {
    const {pages} = await compile(
      `# Part\n\n## Chapter\n\n${filler(50)}\n\n### Section\n\n${filler(50)}`,
      {...ON, runningHeaderLevel: 3},
    );
    const headers = pages.map((p) => p.header.replace(/\s+/g, ' ').trim());
    expect(headers).toContain('Chapter');
    expect(headers).toContain('Section');
  });

  it('US-019 AC-5: an H2 inside a callout counts; a glossary term never appears', async () => {
    const {pages} = await compile(
      `# Rules\n\n${filler(40)}\n\n> [!note] N\n> ## Boxed chapter\n> x\n\n${filler(40)}\n\n# Glossary\n\n## Term\n\nExplained.\n\n${filler(40)}`,
      ON,
    );
    const headers = pages.map((p) => p.header.replace(/\s+/g, ' ').trim());
    expect(headers).toContain('Boxed chapter');
    expect(headers).not.toContain('Term');
  });

  it('US-019 AC-6: a long title wraps and is not cut', async () => {
    const long =
      'A very long chapter title that does not fit on one line of the header of an A5 page at all';
    const {pages} = await compile(`# Rules\n\n## ${long}\n\n${filler(80)}`, ON);
    expect(pages[1]?.header.replace(/\s+/g, ' ').trim()).toBe(long);
  });
});

describe('US-019 AC-7, AC-9 the composed export has its content (SCAR-015)', () => {
  const NOTE = [
    '# Reader Section',
    '',
    filler(50),
    '',
    '## Tessera[^c]',
    '',
    filler(50),
    '',
    '> [!example] E',
    '> ## Boxed chapter',
    '> x',
    '',
    filler(50),
    '',
    '# Glossary',
    '',
    '## Gambit',
    '',
    'A thing.',
    '',
    filler(30),
    '',
    '[^c]: About combat.',
  ].join('\n');

  it('US-019 AC-9: folios 1 to n on pages 2 to n + 1, none on the cover', async () => {
    const {pages} = await compile(NOTE, ON, {cover: 'cover'});
    expect(pages[0]?.footer).toBe('');
    expect(pages.slice(1).map((p) => p.footer.trim())).toEqual(
      pages.slice(1).map((_, i) => String(i + 1)),
    );
  });

  it('US-019 AC-7, AC-9: the footnote mark appears once in the body, never in a header; no header shows a term', async () => {
    const {pages} = await compile(NOTE, ON, {cover: 'cover'});
    const headers = pages.map((p) => p.header.replace(/\s+/g, ' ').trim());
    expect(headers).toContain('Tessera');
    expect(headers).toContain('Boxed chapter');
    expect(headers).not.toContain('Gambit');
    expect(headers.every((h) => !/\d/.test(h))).toBe(true);
    const all = pages.map((p) => p.text).join(' ');
    expect(all.split('About combat.').length - 1).toBe(1);
  });

  it('US-019 AC-9 guard: with both switches off there is no folio and no header on any page', async () => {
    const {pages} = await compile(NOTE, OFF, {cover: 'cover'});
    expect(pages.every((p) => p.footer === '' && p.header === '')).toBe(true);
  });
});

describe('US-019 AC-11 the sample note', () => {
  const source = readSample('Book.md');
  const h1 = readManifest().headings['1'] ?? [];

  it('US-019 AC-11: folio on every page; no header where an H1 starts; ## titles in headers', async () => {
    const {pages} = await compile(source, ON);
    expect(pages.map((p) => p.footer.trim())).toEqual(
      pages.map((_, i) => String(i + 1)),
    );
    // Every H1 starts a page without a header (its number is its place).
    expect(h1.length).toBeGreaterThanOrEqual(8);
    for (const [n, title] of h1.map((t, i) => [i + 1, t] as const)) {
      const at = pages.findIndex((p) =>
        p.text.replace(/\s+/g, ' ').includes(`${n} ${title}`),
      );
      expect(at, title).toBeGreaterThanOrEqual(0);
      expect(pages[at]?.header, title).toBe('');
    }
    const headers = new Set(
      pages.map((p) => p.header.replace(/\s+/g, ' ').trim()).filter((h) => h),
    );
    expect(headers.size).toBeGreaterThan(30);
  }, 180_000);
});
