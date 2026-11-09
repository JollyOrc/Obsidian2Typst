// US-037 AC-2, AC-4, AC-6, AC-7, AC-8, AC-11 — with the bundled compiler: what
// Typst 0.14.2 writes (no /PageLayout, a classic xref table, one trailer,
// `%%EOF` without a line end; the guard of the story's assumptions), and the
// export run on real PDFs: a facing book with a cover, the blank page after
// it and roman front matter is written as Typst's bytes plus one catalog
// revision whose keys are Typst's with `PageLayout` first; every reader gives
// the same pages, bookmarks and links; the word-gap scan of the written file
// gives the warnings of the compiled one; a single-sided book is written as
// compiled. Time limit: each compile of these books takes well under a
// second alone (spike 2026-11-09); 120 s as the other compiling files
// (SCAR-030), measured again under the full run at G4.
// Source of truth: docs/user-stories/US-037-facing-pages-open-as-spreads.md.
import {afterAll, describe, expect, it} from 'vitest';
import {scanWordGaps} from '../../src/core/checks/word-gaps';
import type {CompileResult} from '../../src/core/compile';
import {latin1} from '../../src/core/pdf/reader';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {
  createExportLock,
  runExport,
  type RunExportHost,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {
  BOOK_FONTS,
  BOOK_IMAGES,
  bookCompiler,
  compileBook,
  convertBook,
  disposeBookCompiler,
  type BookOptions,
} from '../support/book';
import {readPdfBookmarks, readPdfLinks, readPdfPages} from '../support/pdf';
import {readPdfCatalog, walkXref} from '../support/pdf-structure';

afterAll(() => disposeBookCompiler());

const WORDS = ['lorem', 'tavik', 'sunder', 'mobra', 'quell', 'farrow', 'ist'];
/** A synthetic book: chapters with links between them, long paragraphs. */
function note(): string {
  let seed = 7;
  const word = (): string => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return WORDS[seed % WORDS.length] as string;
  };
  const para = (n: number): string =>
    `${Array.from({length: n}, word).join(' ')}.`;
  const out = ['# Colophon', '', 'Printed in 2026.', ''];
  for (let c = 1; c <= 4; c++) {
    out.push(`# Chapter ${c}`, '', para(140), '');
    out.push(`See [[#Chapter ${(c % 4) + 1}]].`, '');
    out.push(`## Part ${c}`, '', para(160), '');
  }
  return out.join('\n');
}

const COVERED: BookOptions = {
  cover: 'blank',
  facingPages: true,
  extra: {book: {romanFrontMatter: true}},
};

class MemoryHost implements RunExportHost {
  readonly text = new Map<string, string>();
  readonly bytes = new Map<string, Uint8Array>();
  notice(): void {}
  async writeExportFile(path: string, value: string): Promise<void> {
    this.text.set(path, value);
  }
  async writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    this.bytes.set(path, data);
  }
  async writeVaultFile(): Promise<void> {}
}

/**
 * Converts `source` with `options`, runs the export with the real compiler
 * (the facing flag from `options`), and returns the PDF the compiler gave,
 * the PDF written and the warnings report.
 */
async function exportBook(
  source: string,
  options: BookOptions,
  more: {prefix?: string; maxWordGap?: number} = {},
): Promise<{compiled: Uint8Array; written: Uint8Array; report: string}> {
  const converted = await convertBook(source, options);
  const base = bookCompiler();
  const compiled: Uint8Array[] = [];
  const compiler: TypstCompiler = {
    ...base,
    compile: async (request): Promise<CompileResult> => {
      const result = await base.compile(request);
      if (result.ok) compiled.push(result.pdf);
      return result;
    },
  };
  const host = new MemoryHost();
  const result = await runExport({
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: `${more.prefix ?? ''}${converted.typ}`,
    warnings: [],
    uses: converted.assets,
    readAsset: async (path) => BOOK_IMAGES[path] as Uint8Array,
    template: null,
    exportDir: '/out',
    settings: {...DEFAULT_WARNING_SETTINGS},
    host,
    compiler,
    fonts: BOOK_FONTS,
    lock: createExportLock(),
    minDpi: 0,
    maxWordGap: more.maxWordGap ?? 0,
    facingPages: options.facingPages ?? true,
  });
  expect(result.status).toBe('exported');
  const written = host.bytes.get('/out/Rules.pdf');
  const last = compiled[compiled.length - 1];
  if (written === undefined || last === undefined) {
    throw new Error('no PDF was written');
  }
  return {
    compiled: last,
    written,
    report: host.text.get('/out/export-warnings.md') ?? '',
  };
}

describe('US-037 AC-11 what Typst writes (guard)', {timeout: 120_000}, () => {
  for (const facingPages of [true, false]) {
    it(`US-037 AC-11: facingPages ${facingPages} — no /PageLayout, one classic xref table, one trailer without /Prev or /Encrypt, %%EOF at the very end`, async () => {
      const {pdf} = await compileBook(note(), {...COVERED, facingPages});
      const text = latin1(pdf);
      expect(text).not.toMatch(/\/PageLayout/);
      expect(text).not.toMatch(/\/Type\s*\/(XRef|ObjStm)\b/);
      expect(text.endsWith('%%EOF')).toBe(true);
      expect(text.match(/\btrailer\b/g)).toHaveLength(1);
      expect(text.match(/\bstartxref\b/g)).toHaveLength(1);
      const walk = walkXref(pdf);
      expect(walk.problems).toEqual([]);
      expect(walk.sections).toHaveLength(1);
      expect(walk.checked).toBeGreaterThan(50);
      expect(walk.sections[0]?.trailer).not.toMatch(/\/Prev|\/Encrypt/);
      expect(walk.sections[0]?.trailer).toMatch(/\/Root \d+ 0 R/);
      expect(walk.sections[0]?.trailer).toMatch(/\/Size \d+/);
    });
  }
});

describe(
  'US-037 AC-2, AC-6, AC-7 the export of a facing book',
  {timeout: 120_000},
  () => {
    it('US-037 AC-2, AC-6: Typst’s bytes, then one catalog revision with PageLayout first and every key kept; the xref walks', async () => {
      const {compiled, written, report} = await exportBook(note(), COVERED);
      expect(latin1(written.subarray(0, compiled.length))).toBe(
        latin1(compiled),
      );
      expect(written.length).toBeGreaterThan(compiled.length);
      const before = readPdfCatalog(compiled);
      const after = readPdfCatalog(written);
      expect(after.object).toBe(before.object);
      expect(after.pageLayout).toBe('TwoPageRight');
      expect(after.keys).toEqual(['PageLayout', ...before.keys]);
      expect(before.keys).toEqual(
        expect.arrayContaining(['PageLabels', 'Outlines', 'ViewerPreferences']),
      );
      expect(after.dict).toContain(
        '/ViewerPreferences <<\n    /Direction /L2R\n  >>',
      );
      const walkBefore = walkXref(compiled);
      const walk = walkXref(written);
      expect(walk.problems).toEqual([]);
      expect(walk.sections).toHaveLength(2);
      expect(walk.checked).toBe(walkBefore.checked + 1);
      const size = (t: string) => /\/Size (\d+)/.exec(t)?.[1];
      expect(size(walk.sections[0]?.trailer ?? '')).toBe(
        size(walkBefore.sections[0]?.trailer ?? ''),
      );
      expect(report).not.toContain('PDF_PAGE_LAYOUT_FAILED');
    });

    it('US-037 AC-7, AC-6: every reader gives the same result; page 1 is the cover, then the blank page, roman folios', async () => {
      const {compiled, written} = await exportBook(note(), COVERED);
      // The equalities below mean something only on the updated file.
      expect(readPdfCatalog(written).pageLayout).toBe('TwoPageRight');
      const pages = readPdfPages(written);
      expect(pages).toEqual(readPdfPages(compiled));
      expect(readPdfBookmarks(written)).toEqual(readPdfBookmarks(compiled));
      expect(readPdfLinks(written)).toEqual(readPdfLinks(compiled));
      expect(pages.length).toBeGreaterThan(6);
      expect(readPdfBookmarks(written).length).toBeGreaterThan(5);
      expect(readPdfLinks(written).length).toBeGreaterThan(3);
      expect(pages[0]?.hasImage).toBe(true);
      expect(pages[0]?.hasText).toBe(false);
      expect(pages[1]?.hasText).toBe(false);
      expect(pages[2]?.text).toContain('Printed in 2026.');
      expect(pages[2]?.footer).toBe('iii');
    });

    it('US-037 AC-7, AC-8: the word-gap scan of the written file gives the warnings of the compiled one', async () => {
      const {compiled, written, report} = await exportBook(note(), COVERED, {
        prefix: '#set par(justify: true)\n',
        maxWordGap: 120,
      });
      expect(readPdfCatalog(written).pageLayout).toBe('TwoPageRight');
      const expected = scanWordGaps(compiled, {maxWordGap: 120});
      expect(scanWordGaps(written, {maxWordGap: 120})).toEqual(expected);
      expect(expected.lines.length).toBeGreaterThan(50);
      expect(expected.warnings.length).toBeGreaterThan(5);
      // The report's summary row counts the code (US-006 AC-8).
      expect(report).toContain(
        `| TEXT_WIDE_GAP | ${expected.warnings.length} |`,
      );
      expect(report).not.toContain('TEXT_GAP_SCAN_FAILED');
    });
  },
);

describe('US-037 AC-4 a single-sided book', {timeout: 120_000}, () => {
  it('US-037 AC-4: facingPages false — the written PDF is the compiled one, byte for byte', async () => {
    const {compiled, written} = await exportBook(note(), {
      ...COVERED,
      facingPages: false,
    });
    expect(latin1(written)).toBe(latin1(compiled));
    expect(readPdfCatalog(written).pageLayout).toBeNull();
  });
});
