// US-010 AC-3, AC-8 — the fonts in a PDF made with the real compiler: the font
// information of real font files, the fonts that are embedded in the PDF
// (SCAR-015: content, not only counts), readable text, and that no font file is
// among the assets of the export. Source of truth:
// docs/user-stories/US-010-fonts.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {DEFAULT_FONTS, type FontsSettings} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createFontSet} from '../../src/plugin/fonts';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {VAULT_FAMILY, bundledFontFile, vaultTestFont} from '../support/fonts';
import {readPdfPages} from '../support/pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const BUNDLED = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
].map(bundledFontFile);

const compiler = () =>
  createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });

const VAULT_PATH = 'Layouting/Fonts/VaultTest.ttf';

/** The font set over the bundled fonts and one vault font. */
function fontSet(withVaultFont = true) {
  const c = compiler();
  return createFontSet({
    bundled: async () => BUNDLED,
    vault: {
      files: () => (withVaultFont ? [VAULT_PATH] : []),
      folderExists: async () => true,
      readBytes: async () => vaultTestFont(),
    },
    compiler: c,
  });
}

/** The base font names written in a PDF, without the subset prefix. */
function baseFonts(pdf: Uint8Array): string[] {
  const text = Buffer.from(pdf).toString('latin1');
  const names = new Set<string>();
  for (const m of text.matchAll(
    /\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/[\]<>]+)/g,
  )) {
    names.add(m[1] as string);
  }
  return [...names].sort();
}

const fonts = (over: Partial<FontsSettings> = {}): FontsSettings => ({
  ...structuredClone(DEFAULT_FONTS),
  ...over,
});

async function pdfOf(
  source: string,
  settings: FontsSettings,
  withVaultFont = true,
  pass: readonly Uint8Array[] | null = null,
) {
  const set = await fontSet(withVaultFont)(
    withVaultFont ? 'Layouting/Fonts' : null,
  );
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: {...SETTINGS, fonts: settings},
    assets: new FakeIndex([NOTE_PATH]),
    fonts: set.catalog,
  });
  const compiled = await compiler().compile({
    file: 'main.typ',
    source: result.typ,
    files: {},
    fonts: pass ?? [...BUNDLED, ...set.files],
  });
  if (!compiled.ok) throw new Error(compiled.error);
  return {pdf: compiled.pdf, result, set};
}

describe('US-010 AC-3 the font information of real font files', () => {
  it('US-010 AC-3: the compile service reads the family and the coverage of real fonts, and null for bytes that are no font', async () => {
    const c = compiler();
    const [libertinus, vault, garbage] = await c.fontInfo([
      bundledFontFile('LibertinusSerif-Regular.otf'),
      vaultTestFont(),
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    ]);
    expect(libertinus?.map((f) => f.family)).toContain('Libertinus Serif');
    expect(vault?.map((f) => f.family)).toEqual([VAULT_FAMILY]);
    expect(vault?.[0]?.coverage.length).toBeGreaterThan(0);
    expect(garbage).toBeNull();
  });

  it('US-010 AC-3: the font set finds the family of the vault font and the bundled families', async () => {
    const set = await fontSet()('Layouting/Fonts');
    expect(set.warnings).toEqual([]);
    expect(set.catalog.families()).toEqual(
      expect.arrayContaining([
        VAULT_FAMILY,
        'Libertinus Serif',
        'DejaVu Sans Mono',
      ]),
    );
    expect(set.catalog.hasGlyph('Libertinus Serif', 0x41)).toBe(true);
    expect(set.catalog.hasGlyph('Libertinus Serif', 0x2620)).toBe(false);
    expect(set.files).toHaveLength(1);
  });
});

describe('US-010 AC-8 the fonts in the PDF', () => {
  const SOURCE = '# Chapter\n\nBody text of the page.\n';

  it('US-010 AC-8: with the vault font as heading family the PDF embeds it, and the text is readable', async () => {
    const {pdf, result} = await pdfOf(
      SOURCE,
      fonts({heading: {family: VAULT_FAMILY, size: 18}}),
    );
    expect(result.warnings).toEqual([]);
    expect(baseFonts(pdf).some((n) => n.startsWith('DejaVuSansMono'))).toBe(
      true,
    );
    expect(baseFonts(pdf).some((n) => n.startsWith('LibertinusSerif'))).toBe(
      true,
    );
    const text = (readPdfPages(pdf)[0]?.text ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Chapter');
    expect(text).toContain('Body text of the page.');
  });

  it('US-010 AC-8 (guard): without the vault font file the heading falls back, the warning says so and the PDF has no mono font', async () => {
    const {pdf, result} = await pdfOf(
      SOURCE,
      fonts({heading: {family: VAULT_FAMILY, size: 18}}),
      false,
    );
    expect(result.warnings.map((w) => w.code)).toEqual(['FONT_MISSING']);
    expect(baseFonts(pdf).some((n) => n.startsWith('DejaVuSansMono'))).toBe(
      false,
    );
  });

  it('US-010 AC-8: the default fonts only give a PDF with the Libertinus faces and readable text', async () => {
    const {pdf, result} = await pdfOf(SOURCE, fonts(), false);
    expect(result.warnings).toEqual([]);
    expect(baseFonts(pdf).every((n) => n.startsWith('LibertinusSerif'))).toBe(
      true,
    );
    expect(readPdfPages(pdf)[0]?.text).toContain('Chapter');
  });

  it('US-010 AC-8: inline code is set in the code family', async () => {
    const {pdf} = await pdfOf('Text `code` here.\n', fonts(), false);
    expect(baseFonts(pdf).some((n) => n.startsWith('DejaVuSansMono'))).toBe(
      true,
    );
  });

  it('US-010 AC-8: no font file is among the assets of the export, and the Typst does not refer to one', async () => {
    const {result} = await pdfOf(
      SOURCE,
      fonts({heading: {family: VAULT_FAMILY, size: null}}),
    );
    expect(result.assets).toEqual([]);
    expect(result.typ).not.toMatch(/\.(ttf|otf)/i);
    expect(result.typ).not.toContain('font-path');
  });

  it('US-010 AC-8: a size of 12 pt for the body is the size of the text in the PDF', async () => {
    const small = await pdfOf('Text.\n', fonts(), false);
    const large = await pdfOf(
      'Text.\n',
      fonts({body: {family: null, size: 24}}),
      false,
    );
    const sizeOf = (pdf: Uint8Array): number => {
      const text = Buffer.from(pdf).toString('latin1');
      return text.length;
    };
    expect(sizeOf(large.pdf)).not.toBe(sizeOf(small.pdf));
    expect(large.result.typ).toContain('size: 24pt');
  });
});
