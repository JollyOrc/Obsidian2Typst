// US-007 AC-3b: a compiler WASM that cannot start. In its own file because
// typst.ts keeps the first loaded WASM for the whole process: here the broken
// one must be the first, as it is in a fresh worker.
import {describe, expect, it} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {LoopbackWorker} from '../support/fake-worker';

describe('US-007 AC-3b: a compiler that cannot start', () => {
  it('US-007 AC-3b: a broken compiler WASM gives Typst compiler failed, not an error of the document', async () => {
    const broken = createTypstCompiler({
      createWorker: () => new LoopbackWorker(),
      compilerWasm: async () => new Uint8Array([1, 2, 3, 4]),
    });
    const result = await broken.compile({
      file: 'doc.typ',
      source: 'Hello',
      files: {},
      fonts: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('worker');
    expect(result.error).toMatch(/^Typst compiler failed: /);
  }, 60_000);
});
