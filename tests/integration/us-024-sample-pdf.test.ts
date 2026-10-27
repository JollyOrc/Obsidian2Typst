// US-024 AC-6, AC-7 — the generated note as a PDF: its content, its fonts,
// its images, its length and its page edges.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {A5_PRINT, FakeIndex, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {readPdfPages, type PdfPage} from '../support/pdf';
import {
  SAMPLE_DIR,
  VAULT,
  listFiles,
  readManifest,
  readSample,
  type SampleManifest,
} from '../support/sample';

/** US-024 AC-7: pages of the real file in A5 print, measured 2026-10-27. */
const REAL_PAGES = 202;

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
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const compiler = createTypstCompiler({
  createWorker: () => new LoopbackWorker(),
  compilerWasm: async () => wasm,
});
afterAll(() => compiler.dispose());

const squeeze = (s: string): string => s.replace(/\s+/g, '');

interface Built {
  pdf: Uint8Array;
  pages: PdfPage[];
  ms: number;
  typ: string;
  files: Record<string, Uint8Array>;
}

/** Converts and compiles Book.md in A5 print with the real sample images. */
async function build(fonts: Uint8Array[]): Promise<Built> {
  const start = Date.now();
  const vault = listFiles(SAMPLE_DIR).map((f) => `${VAULT}/${f}`);
  const index = new FakeIndex(vault);
  const bytes = (path: string): Uint8Array =>
    new Uint8Array(
      readFileSync(join(SAMPLE_DIR, path.slice(VAULT.length + 1))),
    );
  for (const path of vault.filter((p) => p.includes('/assets/'))) {
    index.images.set(path, bytes(path));
  }
  const settings = {
    ...SETTINGS,
    page: A5_PRINT,
    fonts: structuredClone(DEFAULT_FONTS),
    callouts: {'rule-box': {fill: '#eeeeee'}},
    linkPageNumbers: true,
    linkPageLevel: 2,
    linkPageWord: 'p.',
    pageFurniture: {folios: true, runningHeader: true, runningHeaderLevel: 2},
  } as ConvertSettings;
  const result = await convert({
    source: readSample('Book.md'),
    noteName: 'Book',
    notePath: `${VAULT}/Book.md`,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) files[use.to] = bytes(use.from);
  const compiled = await compiler.compile({
    file: 'main.typ',
    source: result.typ,
    files,
    fonts,
  });
  if (!compiled.ok) throw new Error(String(compiled.error));
  return {
    pdf: compiled.pdf,
    pages: readPdfPages(compiled.pdf),
    ms: Date.now() - start,
    typ: result.typ,
    files,
  };
}

let book: Built;
let manifest: SampleManifest;
beforeAll(async () => {
  manifest = readManifest();
  book = await build(FONT_FILES);
}, 180_000);

/** The index of the first page whose text holds `text` (blanks ignored). */
const pageOf = (pages: PdfPage[], text: string): number =>
  pages.findIndex((p) => squeeze(p.text).includes(squeeze(text)));

describe('US-024 AC-6 content of the generated note', () => {
  it('US-024 AC-6: Book.md exports with zero compile errors in 30 s', () => {
    expect(book.pages.length).toBeGreaterThan(0);
    expect(book.ms).toBeLessThan(30_000);
  });

  it('US-024 AC-6: each known sentence is on its heading page or the next', () => {
    expect(manifest.sentences).toHaveLength(5);
    for (const {heading, text} of manifest.sentences) {
      const at = pageOf(book.pages, heading);
      expect(at, heading).toBeGreaterThanOrEqual(0);
      const near = squeeze(
        `${book.pages[at]?.text ?? ''}${book.pages[at + 1]?.text ?? ''}`,
      );
      expect(near.includes(squeeze(text)), heading).toBe(true);
    }
  });

  it('US-024 AC-6: the PDF embeds Libertinus Serif and DejaVu Sans Mono', () => {
    const pdf = Buffer.from(book.pdf).toString('latin1');
    expect(pdf).toMatch(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?LibertinusSerif/);
    expect(pdf).toMatch(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?DejaVuSansMono/);
  });

  it('US-024 AC-6: one image object per distinct image file the note uses', () => {
    // Measured 2026-10-27: Typst stores an image used twice once, and an
    // opaque PNG or JPEG has no soft mask; the generator writes opaque images.
    const pdf = Buffer.from(book.pdf).toString('latin1');
    expect(Object.keys(book.files).length).toBe(manifest.images.files.length);
    expect((pdf.match(/\/Subtype\s*\/Image/g) ?? []).length).toBe(
      manifest.images.files.length,
    );
  });

  it('US-024 AC-6: every glossary term is in the PDF', () => {
    const all = squeeze(book.pages.map((p) => p.text).join(''));
    expect(manifest.glossary.terms.length).toBeGreaterThanOrEqual(10);
    for (const term of manifest.glossary.terms) {
      expect(all.includes(squeeze(term)), term).toBe(true);
    }
  });

  it('US-024 AC-6: without fonts the PDF names no font (blank guard)', async () => {
    const blank = await build([]);
    const pdf = Buffer.from(blank.pdf).toString('latin1');
    expect(pdf).not.toMatch(/\/BaseFont/);
    expect(blank.pages.some((p) => p.text.trim() !== '')).toBe(false);
  }, 180_000);
});

describe('US-024 AC-7 pages and page edges', () => {
  it(`US-024 AC-7: at least ${REAL_PAGES} pages in A5 print`, () => {
    expect(book.pages.length).toBeGreaterThanOrEqual(REAL_PAGES);
  });

  it('US-024 AC-7: printed page numbers point to the same, the next and an earlier page', () => {
    // US-018 prints `(p. N)` after a link to a heading; the footer holds the
    // folio of the page the link is on (US-019).
    const relation = {same: 0, next: 0, earlier: 0};
    for (const page of book.pages) {
      const here = Number(page.footer.trim());
      for (const m of squeeze(page.text).matchAll(/\(p\.(\d+)\)/g)) {
        const there = Number(m[1]);
        if (there === here) relation.same++;
        else if (there === here + 1) relation.next++;
        else if (there < here) relation.earlier++;
      }
    }
    expect(relation.same).toBeGreaterThanOrEqual(1);
    expect(relation.next).toBeGreaterThanOrEqual(1);
    expect(relation.earlier).toBeGreaterThanOrEqual(1);
  });
});
