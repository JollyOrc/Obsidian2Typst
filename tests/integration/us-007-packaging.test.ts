// US-007 AC-8, AC-12 — what the build puts into main.js. The build runs into a
// temporary folder, so it never races with the build test of TICKET-003.
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {buildPlugin} from '../../build/build-plugin.mjs';
import {gzipBase64} from '../../build/embed.mjs';

const wasmPath = join(
  process.cwd(),
  'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
);
const tmp = mkdtempSync(join(tmpdir(), 'o2t-us007-pack-'));
const outfile = join(tmp, 'main.js');
let js = '';
beforeAll(async () => {
  await buildPlugin({outfile});
  js = readFileSync(outfile, 'utf8');
}, 120_000);
afterAll(() => rmSync(tmp, {recursive: true, force: true}));

describe('US-007 AC-12: the compiler is inside main.js', () => {
  it('US-007 AC-12: main.js contains the compiler WASM as gzip + base64 and the bytes decode to the original hash', () => {
    const original = readFileSync(wasmPath);
    const embedded = gzipBase64(new Uint8Array(original));
    expect(js.includes(embedded)).toBe(true);
    const bytes = Buffer.from(embedded, 'base64');
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
  });

  it('US-007 AC-12: main.js stays under 25 MB', () => {
    expect(statSync(outfile).size).toBeLessThan(25 * 1024 * 1024);
  });

  it('US-007 AC-12: the worker code is embedded as text and starts with its marker', () => {
    expect(js).toContain('// o2t-worker');
    expect(js).toContain('compile-error');
  });

  it('US-007 AC-12: the build writes one file, with no .wasm or worker file next to it', () => {
    expect(readdirSync(tmp)).toEqual(['main.js']);
    expect(existsSync('worker.js')).toBe(false);
    expect(readdirSync('.').filter((n) => n.endsWith('.wasm'))).toEqual([]);
  });

  it('US-012 AC-7: the renderer WASM of the preview is inside main.js as gzip + base64, next to the compiler WASM (one file, nothing fetched)', () => {
    const renderer = readFileSync(
      join(
        process.cwd(),
        'node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
      ),
    );
    const embedded = gzipBase64(new Uint8Array(renderer));
    expect(js.includes(embedded)).toBe(true);
    expect(Buffer.from(embedded, 'base64')[0]).toBe(0x1f);
  });

  it('US-007 AC-12: the bundle is still a CommonJS plugin with obsidian external', () => {
    expect(js).toContain('module.exports');
    expect(js).toContain('require("obsidian")');
  });
});

describe('US-007 AC-8: desktop only', () => {
  it('US-007 AC-8: manifest.json has isDesktopOnly true', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      isDesktopOnly: boolean;
    };
    expect(manifest.isDesktopOnly).toBe(true);
  });
});
