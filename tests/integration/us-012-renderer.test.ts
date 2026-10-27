// US-012 AC-7, AC-8: the page renderer with the real compiler and renderer WASM:
// page sizes, bounds, release, one load of the WASM.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {RenderSession} from '@myriaddreamin/typst-ts-renderer';
import {describe, expect, it, vi} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createPageRenderer} from '../../src/plugin/preview/renderer';
import {LoopbackWorker} from '../support/fake-worker';
import {bundledFontFile} from '../support/fonts';

const modules = join(process.cwd(), 'node_modules/@myriaddreamin');
const read = (path: string) =>
  new Uint8Array(readFileSync(join(modules, path)));
const compiler = createTypstCompiler({
  createWorker: () => new LoopbackWorker(),
  compilerWasm: async () =>
    read('typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'),
});

const SOURCE =
  '#set page(width: 100pt, height: 200pt)\nOne\n#pagebreak()\nTwo\n#pagebreak()\nThree';

describe('US-012 AC-7 the page renderer', () => {
  it('US-012 AC-7: three pages of 100 × 200 pt are counted and measured (pages count from 1)', async () => {
    const vector = await compiler.compileVector({
      file: 'a.typ',
      source: SOURCE,
      files: {},
      fonts: [bundledFontFile('LibertinusSerif-Regular.otf')],
    });
    if (!vector.ok) throw new Error(vector.error);
    let loads = 0;
    const renderer = createPageRenderer({
      rendererWasm: async () => {
        loads++;
        return read('typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm');
      },
    });
    const doc = await renderer.open(vector.vector);
    const second = await renderer.open(vector.vector);
    expect(loads).toBe(1);
    expect(doc.pageCount).toBe(3);
    expect(doc.pageSize(1)).toEqual({width: 100, height: 200});
    expect(doc.pageSize(3)).toEqual({width: 100, height: 200});
    expect(() => doc.pageSize(0)).toThrow('The document has no page 0');
    expect(() => doc.pageSize(4)).toThrow('The document has no page 4');
    expect(() => doc.pageSize(1.5)).toThrow('no page 1.5');
    doc.dispose();
    expect(() => doc.pageSize(1)).toThrow('released');
    doc.dispose();
    expect(second.pageSize(2).height).toBe(200);
    second.dispose();
  }, 60_000);

  it('US-012 AC-8: cancel ends a running vector compile at once and the result is a failure', async () => {
    const job = compiler.startVector({
      file: 'a.typ',
      source: SOURCE,
      files: {},
      fonts: [],
    });
    job.cancel();
    const result = await job.result;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('cancelled');
  });

  it('US-012 AC-13: a Typst error in a vector compile has the same shape as the export error', async () => {
    const result = await compiler.compileVector({
      file: 'a.typ',
      source: '#unknownfunction()',
      files: {},
      fonts: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('typst');
      expect(result.error).toContain('unknown variable');
    }
  });

  it('US-012 AC-8: dispose frees the renderer session once, however often it is called', async () => {
    const vector = await compiler.compileVector({
      file: 'a.typ',
      source: SOURCE,
      files: {},
      fonts: [],
    });
    if (!vector.ok) throw new Error(vector.error);
    const free = vi.spyOn(RenderSession.prototype, 'free');
    const renderer = createPageRenderer({
      rendererWasm: async () =>
        read('typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'),
    });
    const doc = await renderer.open(vector.vector);
    expect(free).not.toHaveBeenCalled();
    doc.dispose();
    doc.dispose();
    expect(free).toHaveBeenCalledTimes(1);
    free.mockRestore();
  }, 60_000);

  it('US-012 AC-7: a failed load of the renderer WASM is tried again on the next open', async () => {
    const vector = await compiler.compileVector({
      file: 'a.typ',
      source: SOURCE,
      files: {},
      fonts: [],
    });
    if (!vector.ok) throw new Error(vector.error);
    let calls = 0;
    const renderer = createPageRenderer({
      rendererWasm: async () => {
        calls++;
        if (calls === 1) throw new Error('not decoded');
        return read('typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm');
      },
    });
    await expect(renderer.open(vector.vector)).rejects.toThrow('not decoded');
    const doc = await renderer.open(vector.vector);
    expect(doc.pageCount).toBe(3);
    doc.dispose();
  }, 60_000);
});
