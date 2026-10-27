// US-007 AC-6 — the sample note (US-024) goes through the whole export (the
// conversion of US-015, the export run of US-007, the real compiler in Node)
// with zero compile errors within 30 s. Images are stand-ins. Source of truth:
// docs/user-stories/US-007-in-plugin-typst-compilation.md.
import {mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createDiskWriter} from '../../src/plugin/disk-writer';
import {
  createExportLock,
  runExport,
  type RunExportHost,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {FakeIndex, run, standIn} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {readPdfPages} from '../support/pdf';
import {
  SAMPLE_DIR,
  VAULT,
  listFiles,
  readManifest,
  readSample,
} from '../support/sample';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);

const FONTS = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const vault = listFiles(SAMPLE_DIR).map((f) => `${VAULT}/${f}`);

const out = mkdtempSync(join(tmpdir(), 'o2t-ac6-'));
afterAll(() => rmSync(out, {recursive: true, force: true}));

describe('US-007 AC-6 the sample note', () => {
  it('US-007 AC-6: the sample note exports with zero compile errors in 30 s, and its text is in the PDF', async () => {
    const converted = await run(
      readSample('Book.md'),
      {
        noteName: 'Book',
        notePath: `${VAULT}/Book.md`,
        assets: new FakeIndex(vault),
      },
      vault,
    );
    const writer = createDiskWriter(out);
    const notices: string[] = [];
    const host: RunExportHost = {
      notice: (text) => void notices.push(text),
      writeExportFile: (path, text) => writer.writeText(path, text),
      writeExportBytes: (path, data) => writer.writeBytes(path, data),
      writeVaultFile: async () => undefined,
    };
    const compiler = createTypstCompiler({
      createWorker: () => new LoopbackWorker(),
      compilerWasm: async () => wasm,
    });
    const started = Date.now();
    const result = await runExport({
      noteName: 'Book',
      source: {path: `${VAULT}/Book.md`, inVault: true},
      typ: converted.typ,
      warnings: converted.warnings,
      uses: converted.assets,
      readAsset: async (path) => standIn(path),
      template: null,
      exportDir: out,
      settings: DEFAULT_WARNING_SETTINGS,
      host,
      compiler,
      fonts: FONTS,
      lock: createExportLock(),
    });
    const seconds = (Date.now() - started) / 1000;
    expect(notices.filter((n) => /error/i.test(n))).toEqual([]);
    expect(result).toEqual({status: 'exported'});
    expect(seconds).toBeLessThan(30);
    const pdf = readFileSync(join(out, 'Book.pdf'));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(statSync(join(out, 'Book.pdf')).size).toBeGreaterThan(1000);
    // SCAR-015: the PDF has text; the blank result names no font at all.
    const text = pdf.toString('latin1');
    expect(text).toMatch(/LibertinusSerif/);
    expect(text).toMatch(/DejaVuSansMono/);
    // US-024 AC-6: the content, not only the container: the first known
    // sentence of the manifest is in the PDF text (blanks ignored).
    const squeeze = (t: string): string => t.replace(/\s+/g, '');
    const all = squeeze(
      readPdfPages(new Uint8Array(pdf))
        .map((p) => p.text)
        .join(''),
    );
    expect(all).toContain(squeeze(readManifest().sentences[0]?.text ?? '?'));
  }, 60_000);
});
