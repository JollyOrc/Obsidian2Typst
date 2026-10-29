// US-007 AC-3b, AC-9, AC-12 — the parts of the plugin that only Obsidian can
// run are checked here as far as text can show (the rest is the manual check
// M1 in docs/technical/manual-checks/M01.md).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {readCheck} from '../support/manual-checks';

const main = readFileSync('src/plugin/main.ts', 'utf8');
const manual = readCheck('M1');

describe('US-007 wiring in src/plugin/main.ts', () => {
  it('US-007 AC-3b: onunload disposes the compiler so that a running worker is terminated', () => {
    expect(main).toMatch(/onunload\(\)[^{]*\{[^}]*\.dispose\(\)/s);
  });

  it('US-007 AC-9: the developer command Check compiler (developer) is registered', () => {
    expect(main).toContain('Check compiler (developer)');
    expect(main).toMatch(/addCommand\(\{[^}]*id: 'check-compiler'/s);
  });

  it('US-007 AC-3: the worker is started from a Blob URL of the embedded worker source and the compiler WASM comes from the embedded copy', () => {
    const wiring = readFileSync('src/plugin/compiler/start-worker.ts', 'utf8');
    expect(wiring).toContain("from 'embedded:worker-source'");
    expect(wiring).toContain('URL.createObjectURL');
    expect(wiring).toContain('new Worker(');
    const wasm = readFileSync('src/plugin/compiler/embedded-wasm.ts', 'utf8');
    expect(wasm).toContain("from 'embedded:compiler-wasm'");
    expect(wasm).toContain('lazyWasm(');
  });
});

describe('US-007 AC-9: the manual procedure M1', () => {
  it('US-007 AC-9: M1 names the command, the limit of 100 ms, the offline run and the memory note', () => {
    expect(manual).toContain('# M1 — ');
    expect(manual).toContain('Obsidian2Typst: Check compiler (developer)');
    expect(manual).toContain('100 ms');
    expect(manual).toMatch(/Wi-?Fi (off|OFF)|offline/i);
    expect(manual).toContain('An export is already running');
  });
});
