// US-007 AC-13 (SCAR-015) — with the real compiler: without fonts the PDF has
// no font (the blank result the tester saw); with the default fonts it names
// them. Source of truth: docs/user-stories/US-007-in-plugin-typst-compilation.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {LoopbackWorker} from '../support/fake-worker';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
];
const fonts = FILES.map(
  (n) => new Uint8Array(readFileSync(join('assets/fonts', n))),
);

async function pdfText(source: string, withFonts: boolean): Promise<string> {
  const compiler = createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });
  const result = await compiler.compile({
    file: 'main.typ',
    source,
    files: {},
    fonts: withFonts ? fonts : [],
  });
  compiler.dispose();
  if (!result.ok) throw new Error(result.error);
  return Buffer.from(result.pdf).toString('latin1');
}

const SOURCE = [
  '= Title',
  'Plain text, *bold text* and _italic text_.',
  '```',
  'code line',
  '```',
].join('\n\n');

describe('US-007 AC-13 the PDF has fonts', () => {
  it('US-007 AC-13 guard: compiled with no font the PDF names no font (the blank result)', async () => {
    const pdf = await pdfText(SOURCE, false);
    expect(pdf).not.toMatch(/LibertinusSerif/);
    expect(pdf).not.toMatch(/DejaVuSansMono/);
    expect(pdf).not.toMatch(/\/FontFile/);
  }, 60_000);

  it('US-007 AC-13: compiled with the default fonts the PDF embeds Libertinus Serif for text and DejaVu Sans Mono for code', async () => {
    const pdf = await pdfText(SOURCE, true);
    expect(pdf).toMatch(/LibertinusSerif/);
    expect(pdf).toMatch(/DejaVuSansMono/);
    expect(pdf).toMatch(/\/FontFile/);
  }, 60_000);

  it('US-007 AC-13: bold and italic use their own faces', async () => {
    const pdf = await pdfText(SOURCE, true);
    expect(pdf).toMatch(/LibertinusSerif-Bold/);
    expect(pdf).toMatch(/LibertinusSerif-Italic/);
  }, 60_000);
});
