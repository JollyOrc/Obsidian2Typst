// US-009 AC-5, AC-9 — the margins in a PDF made with the real compiler: the x
// position of the first text line of every page is read from the PDF
// (SCAR-015: the output, not only the `#set page` line). Source of truth:
// docs/user-stories/US-009-page-setup.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  BUILTIN_PAGE_PRESETS,
  emitPageSetup,
  resolvePageSetup,
  type PageSettingsInput,
} from '../../src/core/layout/page-setup';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {LoopbackWorker} from '../support/fake-worker';
import {bundledFontFile} from '../support/fonts';
import {mm, readPdfPages} from '../support/pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);

/** The pages of a four-page document set up with `input`. */
async function pagesOf(input: PageSettingsInput) {
  const geometry = resolvePageSetup(input);
  if (!geometry.ok) throw new Error(JSON.stringify(geometry.errors));
  const source = [
    emitPageSetup(geometry.value),
    '#set text(font: "Libertinus Serif")',
    '#for i in range(4) [Page text #i #if i < 3 [#pagebreak()]]',
  ].join('\n');
  const compiled = await createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }).compile({
    file: 'main.typ',
    source,
    files: {},
    fonts: [bundledFontFile('LibertinusSerif-Regular.otf')],
  });
  if (!compiled.ok) throw new Error(compiled.error);
  return readPdfPages(compiled.pdf);
}

/** The first-line distances from the left edge of every page, in mm. */
const lefts = (pages: Awaited<ReturnType<typeof pagesOf>>): number[] =>
  pages.map((p) => mm(p.firstLineX ?? Number.NaN));

describe('US-009 margins in the PDF', () => {
  it('US-009 AC-5: starts the first text line 23 mm from the left on pages 1 and 3 and 18 mm on pages 2 and 4 (tolerance 0.5 mm)', async () => {
    const pages = await pagesOf(BUILTIN_PAGE_PRESETS['A5 print']);
    expect(pages).toHaveLength(4);
    // The text is really there (SCAR-015), on the page size of AC-3.
    expect(pages.every((p) => p.text.includes('Page text'))).toBe(true);
    expect(mm(pages[0]!.width)).toBeCloseTo(154, 0);
    expect(mm(pages[0]!.height)).toBeCloseTo(216, 0);
    const [p1, p2, p3, p4] = lefts(pages) as [number, number, number, number];
    expect(Math.abs(p1 - 23)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p3 - 23)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p2 - 18)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p4 - 18)).toBeLessThanOrEqual(0.5);
  });

  it('US-009 AC-5: starts the first text line 20 mm from the left on all pages for single pages', async () => {
    const pages = await pagesOf(BUILTIN_PAGE_PRESETS['A4 digital']);
    expect(pages).toHaveLength(4);
    expect(pages.every((p) => p.text.includes('Page text'))).toBe(true);
    for (const x of lefts(pages))
      expect(Math.abs(x - 20)).toBeLessThanOrEqual(0.5);
  });

  it('US-009 AC-9: with slug 5 the first line starts 28 mm from the left on pages 1 and 3 and 23 mm on pages 2 and 4', async () => {
    const pages = await pagesOf({...BUILTIN_PAGE_PRESETS['A5 print'], slug: 5});
    expect(mm(pages[0]!.width)).toBeCloseTo(164, 0);
    const [p1, p2, p3, p4] = lefts(pages) as [number, number, number, number];
    expect(Math.abs(p1 - 28)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p3 - 28)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p2 - 23)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(p4 - 23)).toBeLessThanOrEqual(0.5);
  });

  it('US-009 AC-5: guard — the reader returns null for a page without text, so a blank page cannot pass', async () => {
    const compiled = await createTypstCompiler({
      createWorker: () => new LoopbackWorker(),
      compilerWasm: async () => wasm,
    }).compile({
      file: 'main.typ',
      source: '#rect(width: 10mm)',
      files: {},
      fonts: [],
    });
    if (!compiled.ok) throw new Error(compiled.error);
    expect(readPdfPages(compiled.pdf)[0]!.firstLineX).toBeNull();
  });
});
