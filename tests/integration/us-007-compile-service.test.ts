// US-007 AC-2, AC-4, AC-10 — the compile service with the real Typst compiler
// in Node (the worker logic runs in this process). Offline: every network
// entry point is instrumented and must stay unused.
import dns from 'node:dns';
import {readFileSync} from 'node:fs';
import net from 'node:net';
import {join} from 'node:path';
import tls from 'node:tls';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);

const attempts: string[] = [];
const restore: (() => void)[] = [];
beforeAll(() => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((...args: unknown[]) => {
    attempts.push(`fetch ${String(args[0])}`);
    return Promise.reject(new Error('network is blocked in this test'));
  }) as typeof fetch;
  restore.push(() => (globalThis.fetch = realFetch));
  const patch = (
    target: Record<string, unknown>,
    key: string,
    label: string,
  ) => {
    const real = target[key];
    target[key] = () => {
      attempts.push(label);
      throw new Error('network is blocked in this test');
    };
    restore.push(() => (target[key] = real));
  };
  patch(
    net.Socket.prototype as unknown as Record<string, unknown>,
    'connect',
    'net.connect',
  );
  patch(tls as unknown as Record<string, unknown>, 'connect', 'tls.connect');
  patch(dns as unknown as Record<string, unknown>, 'lookup', 'dns.lookup');
});
afterAll(() => restore.forEach((undo) => undo()));

const workers: LoopbackWorker[] = [];
const compiler = createTypstCompiler({
  createWorker: () => {
    const worker = new LoopbackWorker();
    workers.push(worker);
    return worker;
  },
  compilerWasm: async () => wasm,
});

const compile = (
  source: string,
  files: Record<string, Uint8Array> = {},
  file = 'doc.typ',
) => compiler.compile({file, source, files, fonts: []});

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('US-007 AC-1: the real compiler makes a PDF', () => {
  it('US-007 AC-1: a document compiles to a PDF that starts with %PDF- and ends with %%EOF', async () => {
    const result = await compile('= Title\nSome text, a list:\n- one\n- two\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(text(result.pdf.subarray(0, 5))).toBe('%PDF-');
    expect(text(result.pdf.subarray(-8))).toContain('%%EOF');
  }, 60_000);

  it('US-007 AC-1: an image from files and an imported template both resolve', async () => {
    const result = await compile(
      '#import "template.typ": accent\n#set text(fill: accent)\n#image("assets/x.png", width: 2cm)\n',
      {
        'assets/x.png': png(20, 20),
        'template.typ': new TextEncoder().encode('#let accent = red\n'),
      },
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  }, 60_000);

  it('US-007 AC-1: a name with blanks and non-ASCII letters is a valid main file', async () => {
    const result = await compile('Hello', {}, 'Größe v2.typ');
    expect(result.ok, JSON.stringify(result)).toBe(true);
  }, 60_000);
});

describe('US-007 AC-4: errors from the real compiler', () => {
  it('US-007 AC-4: an unknown variable gives Typst error at doc.typ:LINE:COL with the compiler text', async () => {
    const result = await compile('= Title\n\n#foo\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('typst');
    expect(result.error).toMatch(
      /^Typst error at doc\.typ:3:\d+: unknown variable: foo$/,
    );
  }, 60_000);

  it('US-007 AC-4: the error names the real main file, for example the note of an export', async () => {
    const result = await compile('#foo', {}, 'Rules.typ');
    expect(result.ok === false && result.error).toMatch(
      /^Typst error at Rules\.typ:1:2: unknown variable: foo$/,
    );
  }, 60_000);

  it('US-007 AC-4: an error inside the template names template.typ and its line', async () => {
    const result = await compile('#import "template.typ": *\nHello\n', {
      'template.typ': new TextEncoder().encode('#let a = 1\n#bar\n'),
    });
    expect(result.ok === false && result.error).toMatch(
      /^Typst error at template\.typ:2:\d+: unknown variable: bar$/,
    );
  }, 60_000);

  it('US-007 AC-4: a missing image is an error at the place of the image call', async () => {
    const result = await compile('#image("assets/missing.png")\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^Typst error at doc\.typ:1:\d+: /);
    expect(result.error).toContain('failed to load file');
  }, 60_000);

  it('US-007 AC-4: an error does not break the next export, which gets a fresh worker', async () => {
    const bad = await compile('#foo');
    const good = await compile('Fine');
    expect(bad.ok).toBe(false);
    expect(good.ok).toBe(true);
  }, 60_000);

  it('US-007 AC-3b: a file of one export is not visible in the next export (one worker per export)', async () => {
    const first = await compile('#image("assets/x.png")', {
      'assets/x.png': png(5, 5),
    });
    const second = await compile('#image("assets/x.png")');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  }, 60_000);

  it('US-007 AC-3b: every real compile terminated its worker once', async () => {
    await compile('x');
    expect(workers.length).toBeGreaterThan(0);
    expect(workers.every((worker) => worker.terminated === 1)).toBe(true);
  }, 60_000);
});

describe('US-007 AC-2 and AC-10: no network, no packages', () => {
  it('US-007 AC-10: a @preview package import fails with a compiler error that mentions the package', async () => {
    const result = await compile('#import "@preview/example:0.1.0": *\nText\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('typst');
    expect(result.error).toMatch(/^Typst error at doc\.typ:1:\d+: /);
    expect(result.error.toLowerCase()).toContain('package');
  }, 60_000);

  it('US-007 AC-10: compiling a document with an image and an import opens no network connection, also across the error and the package cases above', async () => {
    await compile('= T\n#image("assets/x.png", width: 1cm)', {
      'assets/x.png': png(10, 10),
    });
    await compile('#import "@preview/example:0.1.0": *');
    await compile('#foo');
    expect(attempts).toEqual([]);
  }, 60_000);

  it('US-007 AC-2: the compile needs no typst binary: it runs with an empty PATH', async () => {
    const before = process.env['PATH'];
    process.env['PATH'] = '';
    try {
      const result = await compile('= No binary needed');
      expect(result.ok).toBe(true);
    } finally {
      process.env['PATH'] = before;
    }
  }, 60_000);
});
