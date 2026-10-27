// US-007 AC-12 — the embedded compiler: gzip + base64, decoded on first use.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {decodeWasm, lazyWasm} from '../../src/plugin/compiler/wasm-codec';
import {gzipBase64} from '../../build/embed.mjs';

const wasmPath = join(
  process.cwd(),
  'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
);
const sha = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

describe('US-007 AC-12: decoding the embedded compiler', () => {
  it('US-007 AC-12: decodes gzip + base64 back to the exact bytes, for empty, tiny and binary input', async () => {
    for (const bytes of [
      new Uint8Array(0),
      new Uint8Array([0]),
      new Uint8Array([0, 255, 1, 254, 13, 10]),
      Uint8Array.from({length: 70_000}, (_, i) => (i * 7) % 256),
    ]) {
      const decoded = await decodeWasm(gzipBase64(bytes));
      expect([...decoded]).toEqual([...bytes]);
    }
  });

  it('US-007 AC-12: the build-time encoder produces standard gzip in standard base64 without line breaks', () => {
    const bytes = Uint8Array.from(
      {length: 200_000},
      (_, i) => ((i * i) >> 5) % 251,
    );
    const text = gzipBase64(bytes);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(
      Buffer.from(text, 'base64').equals(gzipSync(bytes, {level: 9})),
    ).toBe(true);
  });

  it('US-007 AC-12: the real compiler WASM decodes to the same hash and is smaller embedded than raw', async () => {
    const original = new Uint8Array(readFileSync(wasmPath));
    const embedded = gzipBase64(original);
    const decoded = await decodeWasm(embedded);
    expect(decoded.length).toBe(original.length);
    expect(sha(decoded)).toBe(sha(original));
    expect(embedded.length).toBeLessThan(original.length * 0.7);
  }, 60_000);

  it('US-007 AC-12: input that is not gzip is refused with an error', async () => {
    await expect(decodeWasm('AAAA')).rejects.toThrow();
    await expect(decodeWasm('not base64 !!')).rejects.toThrow();
  });
});

describe('US-007 AC-12: decoded on first use only', () => {
  it('US-007 AC-12: lazyWasm decodes nothing until it is called, then decodes once and returns the same bytes each time', async () => {
    let decodes = 0;
    const get = lazyWasm('payload', async (text) => {
      decodes++;
      return new Uint8Array([text.length]);
    });
    expect(decodes).toBe(0);
    const [a, b] = await Promise.all([get(), get()]);
    const c = await get();
    expect(decodes).toBe(1);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect([...a]).toEqual([7]);
  });

  it('US-007 AC-12: a decode that failed is tried again on the next call', async () => {
    let calls = 0;
    const get = lazyWasm('x', async () => {
      calls++;
      if (calls === 1) throw new Error('first time fails');
      return new Uint8Array([1]);
    });
    await expect(get()).rejects.toThrow('first time fails');
    expect([...(await get())]).toEqual([1]);
    expect(calls).toBe(2);
  });
});
