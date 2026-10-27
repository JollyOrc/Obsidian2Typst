// US-011 — the cover in the PDF, with the real compiler: the size of the cover
// page, what is on each page (SCAR-015: content, not only counts), the blank
// page, and the page counter of the first body page, also for every kind of
// first body block (SCAR-010). The first measurements are in the notes of the
// story. Source of truth: docs/user-stories/US-011-cover.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {DEFAULT_COVER, type CoverSettings} from '../../src/core/cover';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
  type PageGeometry,
} from '../../src/core/layout/page-setup';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {A5_PRINT, FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {mm, readPdfPages, type PdfPage} from '../support/pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const fonts = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const ASSETS = 'Sample/assets';
const IMAGES: Record<string, Uint8Array> = {
  [`${ASSETS}/cover.png`]: png(20, 30),
  [`${ASSETS}/map.png`]: png(30, 20),
  'Layouting/Cover/front.png': png(20, 30),
};
const FILES = [NOTE_PATH, ...Object.keys(IMAGES)];
const COVER_PNG = '![](assets/cover.png)\n\n';
const BODY = '# The Handbook\n\nSome text.\n';

const cover = (over: Partial<CoverSettings> = {}): CoverSettings => ({
  ...DEFAULT_COVER,
  ...over,
});

/** Converts `source` and compiles the `.typ` with the images of the vault. */
async function pdf(
  source: string,
  coverSettings: CoverSettings | undefined,
  page: PageGeometry = A5_PRINT,
  rewrite: (typ: string) => string = (typ) => typ,
): Promise<{pages: PdfPage[]; typ: string; warnings: string[]}> {
  const index = new FakeIndex(FILES);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: {...SETTINGS, page, cover: coverSettings},
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = IMAGES[use.from] as Uint8Array;
  }
  const compiler = createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });
  // Page numbers are on, as in a book; the cover pages switch them off for
  // their page (footer: none), so a number on them would show in the PDF.
  const typ = rewrite(
    result.typ.replace(
      '\n#set highlight',
      '\n#set page(numbering: "1")\n#set highlight',
    ),
  );
  const compiled = await compiler.compile({
    file: 'main.typ',
    source: typ,
    files,
    fonts,
  });
  compiler.dispose();
  if (!compiled.ok) throw new Error(compiled.error);
  return {
    pages: readPdfPages(compiled.pdf),
    typ,
    warnings: result.warnings.map((w) => w.code),
  };
}

describe('US-011 AC-4 the cover page', () => {
  it('US-011 AC-4: fills 154 × 216 mm with the image on page 1, and has no text on it', async () => {
    const {pages} = await pdf(`${COVER_PNG}${BODY}`, cover());
    const first = pages[0] as PdfPage;
    expect(mm(first.width)).toBe(154);
    expect(mm(first.height)).toBe(216);
    expect(first.hasImage).toBe(true);
    expect(first.hasText).toBe(false);
    expect([first.text, first.footer]).toEqual(['', '']);
  });

  it('US-011 AC-4: the body starts on page 2, with text and no image, and the cover image is on page 1 only', async () => {
    const {pages} = await pdf(`${COVER_PNG}${BODY}`, cover());
    expect(pages).toHaveLength(2);
    expect(pages[1]?.hasText).toBe(true);
    expect(pages[1]?.text).toBe('1 The Handbook Some text.');
    expect(pages[1]?.hasImage).toBe(false);
    expect(pages.filter((p) => p.hasImage)).toHaveLength(1);
  });

  it('US-011 AC-4: every page has the full size including bleed', async () => {
    const {pages} = await pdf(
      `${COVER_PNG}${BODY}`,
      cover({blankPageAfter: true}),
    );
    for (const page of pages) {
      expect([mm(page.width), mm(page.height)]).toEqual([154, 216]);
    }
  });

  it('US-011 AC-4: a page without bleed (A4 digital) is covered edge to edge at 210 × 297 mm', async () => {
    const a4 = resolvePageSetup(BUILTIN_PAGE_PRESETS['A4 digital']);
    if (!a4.ok) throw new Error('valid');
    const {pages} = await pdf(`${COVER_PNG}${BODY}`, cover(), a4.value);
    expect([mm(pages[0]?.width ?? 0), mm(pages[0]?.height ?? 0)]).toEqual([
      210, 297,
    ]);
    expect(pages[0]?.hasImage).toBe(true);
  });

  it('US-011 AC-4: a note that is only the cover gives a PDF of one page', async () => {
    const {pages} = await pdf(COVER_PNG, cover());
    expect(pages).toHaveLength(1);
    expect(pages[0]?.hasImage).toBe(true);
  });

  it('US-011 AC-4: mode none makes no cover page: the first page has the text, the image is in the body', async () => {
    const {pages} = await pdf(`${COVER_PNG}${BODY}`, cover({mode: 'none'}));
    expect(pages[0]?.hasText).toBe(true);
  });
});

describe('US-011 AC-5 the blank page and the page counter', () => {
  it('US-011 AC-5: with blankPageAfter false the first body page is page 2 and has counter value 1', async () => {
    const {pages} = await pdf(`${COVER_PNG}${BODY}`, cover());
    expect(pages).toHaveLength(2);
    expect(pages[1]?.hasText).toBe(true);
    expect(pages[1]?.footer).toBe('1');
  });

  it('US-011 AC-5: with blankPageAfter true page 2 is blank (no text, no image, no number) and the body starts on page 3 with counter value 1', async () => {
    const {pages} = await pdf(
      `${COVER_PNG}${BODY}`,
      cover({blankPageAfter: true}),
    );
    expect(pages).toHaveLength(3);
    expect(pages[0]).toMatchObject({hasImage: true, hasText: false});
    expect(pages[1]).toMatchObject({
      hasImage: false,
      hasText: false,
      text: '',
      footer: '',
    });
    expect(pages[2]).toMatchObject({hasText: true, footer: '1'});
    expect(pages[2]?.text).toContain('Some text.');
  });

  it('US-011 AC-5 guard: the counter reset placed before the blank page gives the first body page the value 2', async () => {
    const wrong = (typ: string): string =>
      typ.replace(
        /(#page\(margin: 0pt, header: none, footer: none\)\[\]\n)(#counter\(page\)\.update\(1\))/,
        '$2\n$1',
      );
    const {pages, typ} = await pdf(
      `${COVER_PNG}${BODY}`,
      cover({blankPageAfter: true}),
      A5_PRINT,
      wrong,
    );
    expect(typ).toMatch(
      /#counter\(page\)\.update\(1\)\n#page\(margin: 0pt, header: none, footer: none\)\[\]/,
    );
    expect(pages[2]?.footer).toBe('2');
  });

  it('US-011 AC-5: with facing pages the cover is page 1, the blank page page 2 and the body page 3 with counter value 1', async () => {
    const facing = resolvePageSetup({
      ...BUILTIN_PAGE_PRESETS['A5 print'],
      facingPages: true,
    });
    if (!facing.ok) throw new Error('valid');
    const {pages} = await pdf(
      `${COVER_PNG}${BODY}`,
      cover({blankPageAfter: true}),
      facing.value,
    );
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.hasImage)).toEqual([true, false, false]);
    expect(pages.map((p) => p.hasText)).toEqual([false, false, true]);
    expect(pages[2]?.footer).toBe('1');
  });

  it('US-011 AC-5: a note that is the cover and the blank page only gives two pages', async () => {
    const {pages} = await pdf(COVER_PNG, cover({blankPageAfter: true}));
    expect(pages.map((p) => [p.hasImage, p.hasText])).toEqual([
      [true, false],
      [false, false],
    ]);
  });
});

describe('US-011 AC-8 cover file, blank page and body', () => {
  it('US-011 AC-8: has the cover, a blank page and the body in that order and reports one COVER_CROPPED', async () => {
    const {pages, warnings} = await pdf(
      `![](assets/map.png)\n\n${BODY}`,
      cover({
        mode: 'file',
        file: 'Layouting/Cover/front.png',
        blankPageAfter: true,
      }),
    );
    // 20 × 30 px on a 154 × 216 mm page: 6.5% cropped, above the threshold 5.
    expect(warnings).toEqual(['COVER_CROPPED']);
    expect(pages.map((p) => [p.hasImage, p.hasText])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(pages[2]?.footer).toBe('1');
  });
});

describe('US-011 AC-4 the first block of the body next to the cover', () => {
  // Piece x neighbour (SCAR-010): whatever the body starts with, the cover adds
  // exactly one page (two with the blank page) and nothing else.
  const STARTS: Record<string, string> = {
    heading: '# Title\n\ntext\n',
    paragraph: 'Plain text.\n',
    image: '![A map](assets/map.png)\n\ntext\n',
    table: '| a | b |\n|---|---|\n| 1 | 2 |\n',
    list: '- one\n- two\n',
    code: '```\ncode\n```\n',
    quote: '> quoted\n',
    footnote: 'Text[^1]\n\n[^1]: Note.\n',
  };

  for (const [name, body] of Object.entries(STARTS)) {
    it(`US-011 AC-4: a body that starts with a ${name} follows the cover without an extra page`, async () => {
      const plain = await pdf(body, cover({mode: 'none'}));
      const withCover = await pdf(`${COVER_PNG}${body}`, cover());
      const withBlank = await pdf(
        `${COVER_PNG}${body}`,
        cover({blankPageAfter: true}),
      );
      expect(withCover.pages).toHaveLength(plain.pages.length + 1);
      expect(withBlank.pages).toHaveLength(plain.pages.length + 2);
      expect(withCover.pages[1]?.footer).toBe('1');
      expect(withBlank.pages[2]?.footer).toBe('1');
      expect(withCover.pages.slice(1).map((p) => p.hasText)).toEqual(
        plain.pages.map((p) => p.hasText),
      );
    });
  }
});
