// US-034 AC-2 to AC-4, AC-7, AC-8 (word gaps added at G4 of #133) — the
// print checks reach the export: the print resolution check reaches the export and
// the preview: the export reads the pixel widths from the files it copies,
// adds `IMAGE_LOW_DPI` for the compile's `<o2t-image>` facts and the
// conversion's fixed-width images, and never stops on it (decision 1, also
// in strict mode); the worker queries `<o2t-image>` when a helper records it;
// the preview reads the pixel widths before its smaller copies.
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Added at G4 of #132 (2026-11-07).
import {readdirSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {readLayoutFacts} from '../../src/plugin/compiler/worker-core';
import {buildPreviewRequest} from '../../src/plugin/preview/request';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';

class FakeHost implements RunExportHost {
  readonly text = new Map<string, string>();
  notice(): void {}
  async writeExportFile(path: string, text: string): Promise<void> {
    this.text.set(path, text);
  }
  async writeExportBytes(): Promise<void> {}
  async writeVaultFile(): Promise<void> {}
}

const BYTES: Record<string, Uint8Array> = {
  'v/small.png': png(272, 20),
  'v/plate.png': png(272, 20),
  'v/icon.svg': new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  ),
};

function exportWith(more: Partial<RunExportOptions>) {
  const host = new FakeHost();
  const compiler: TypstCompiler = {
    fontInfo: () => Promise.resolve([]),
    compile: async (): Promise<CompileResult> => ({
      ok: true,
      pdf: new Uint8Array([37, 80, 68, 70]),
      settled: true,
      images: [
        {file: 'assets/small.png', widthMm: 20},
        {file: 'assets/small.png', widthMm: 50},
        {file: 'assets/icon.svg', widthMm: 50},
      ],
    }),
    dispose: () => undefined,
  };
  const options = {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: 'Body.\n',
    warnings: [] as Warning[],
    uses: [
      {from: 'v/small.png', to: 'assets/small.png'},
      {from: 'v/plate.png', to: 'assets/plate.png'},
      {from: 'v/icon.svg', to: 'assets/icon.svg'},
    ],
    readAsset: async (path: string) => BYTES[path] ?? new Uint8Array(0),
    template: null,
    exportDir: '/out/run1',
    settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    host,
    compiler,
    fonts: [],
    lock: createExportLock(),
    ...more,
  } as RunExportOptions;
  return {host, run: () => runExport(options)};
}
const report = (host: FakeHost) =>
  host.text.get('/out/run1/export-warnings.md') ?? '';

describe('US-034 AC-3, AC-4 the export reports low resolution', () => {
  it('US-034 AC-3, decision 1: one warning per file at its largest width, fixed images too; strict mode does not stop', async () => {
    const {host, run} = exportWith({
      minDpi: 300,
      fixedImages: [{file: 'assets/plate.png', widthMm: 100}],
    });
    expect((await run()).status).toBe('exported');
    const text = report(host);
    expect(text).toContain(
      '| IMAGE_LOW_DPI | "assets/small.png": 138 dpi at 50.0 mm (min 300) |',
    );
    expect(text).toContain(
      '| IMAGE_LOW_DPI | "assets/plate.png": 69 dpi at 100.0 mm (min 300) |',
    );
    expect(text).not.toContain('icon.svg');
    expect(text).toContain('| IMAGE_LOW_DPI | 2 |');
  });

  it('US-034 AC-1: minDpi 0 is off; unset is the built-in 300', async () => {
    const off = exportWith({minDpi: 0});
    await off.run();
    expect(report(off.host)).not.toContain('IMAGE_LOW_DPI');
    const built = exportWith({});
    await built.run();
    expect(report(built.host)).toContain('(min 300)');
  });
});

describe('US-034 AC-2 the worker and the preview', () => {
  it('US-034 AC-2: the worker queries <o2t-image> only when asked', async () => {
    const asked: string[] = [];
    const compiler = {
      runWithWorld: async <T>(
        _: {mainFilePath: string},
        cb: (w: {
          compile(x?: unknown): Promise<unknown>;
          query(x: {selector: string}): Promise<unknown>;
        }) => Promise<T>,
      ): Promise<T> =>
        cb({
          compile: async () => ({diagnostics: []}),
          query: async ({selector}) => {
            asked.push(selector);
            return JSON.stringify([{file: 'a.png', widthMm: 10}]);
          },
        }),
    };
    const facts = await readLayoutFacts(compiler, '/m.typ', false, false, true);
    expect(asked).toEqual(['<o2t-image>']);
    expect(facts.images).toEqual([{file: 'a.png', widthMm: 10}]);
    asked.length = 0;
    await readLayoutFacts(compiler, '/m.typ', false, false, false);
    expect(asked).toEqual([]);
  });

  it('US-034 AC-2, AC-4: the preview reads pixel widths before its smaller copies', async () => {
    const widths: Record<string, number> = {};
    await buildPreviewRequest({
      noteName: 'Rules',
      typ: '',
      uses: [
        {from: 'v/small.png', to: 'assets/small.png'},
        {from: 'v/icon.svg', to: 'assets/icon.svg'},
      ],
      template: null,
      fonts: [],
      readAsset: async (path) => BYTES[path] ?? new Uint8Array(0),
      downsample: async () => png(10, 1),
      pixelWidths: widths,
    });
    expect(widths).toEqual({'assets/small.png': 272});
  });
});

describe('US-034 AC-7, AC-8 the word-gap scan on export', () => {
  it('US-034 AC-7, AC-8, decision 1: the export scans the last PDF with the threshold and the entries\u2019 pages; strict mode does not stop', async () => {
    const calls: {maxWordGap: number; entries: unknown}[] = [];
    const host = new FakeHost();
    const compiler: TypstCompiler = {
      fontInfo: () => Promise.resolve([]),
      compile: async (): Promise<CompileResult> => ({
        ok: true,
        pdf: new Uint8Array([37, 80, 68, 70]),
        settled: true,
        entryPlaces: [
          {heading: 'Reed Cat', layout: 'page-portrait', size: 'page', page: 4},
        ],
        entryEnds: [{heading: 'Reed Cat', page: 5}],
      }),
      scanWordGaps: async (_pdf, options) => {
        calls.push(options);
        return [
          {
            code: 'TEXT_WIDE_GAP',
            message: '"Reed Cat": "Ut pariatur" (352 %)',
            line: 0,
          },
        ];
      },
      dispose: () => undefined,
    };
    const result = await runExport({
      noteName: 'Rules',
      source: {path: 'Sample/Rules.md', inVault: true},
      typ: 'Body.\n',
      warnings: [],
      uses: [],
      readAsset: async () => new Uint8Array(0),
      template: null,
      exportDir: '/out/run1',
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
      host,
      compiler,
      fonts: [],
      lock: createExportLock(),
      maxWordGap: 250,
    });
    expect(result.status).toBe('exported');
    expect(calls).toEqual([
      {maxWordGap: 250, entries: [{heading: 'Reed Cat', first: 4, last: 5}]},
    ]);
    expect(report(host)).toContain(
      '| TEXT_WIDE_GAP | "Reed Cat": "Ut pariatur" (352 %) |',
    );
  });

  it('US-034 AC-8: entries.maxWordGap 0 scans nothing; unset is the built-in 200', async () => {
    for (const [gap, want] of [
      [0, []],
      [undefined, [200]],
    ] as const) {
      const seen: number[] = [];
      const rig = exportWith({
        minDpi: 0,
        ...(gap === undefined ? {} : {maxWordGap: gap}),
        compiler: {
          fontInfo: () => Promise.resolve([]),
          compile: async () => ({ok: true, pdf: new Uint8Array([1])}),
          scanWordGaps: async (_pdf, o) => {
            seen.push(o.maxWordGap);
            return [];
          },
          dispose: () => undefined,
        },
      });
      await rig.run();
      expect(seen).toEqual(want);
    }
  });

  it('US-034 AC-8, AC-11: the worker scans without a compiler init; unreadable bytes give one TEXT_GAP_SCAN_FAILED', async () => {
    const compiler = createTypstCompiler({
      createWorker: () => new LoopbackWorker(),
      compilerWasm: async () => {
        throw new Error('a scan must not load the compiler');
      },
    });
    const warnings = await compiler.scanWordGaps(new Uint8Array([1, 2, 3]), {
      maxWordGap: 200,
      entries: [],
    });
    expect(warnings.map((w) => w.code)).toEqual(['TEXT_GAP_SCAN_FAILED']);
  });

  it('US-034 AC-8 (G0-C10): the preview never scans', () => {
    const dir = 'src/plugin/preview';
    for (const name of readdirSync(dir)) {
      expect(readFileSync(`${dir}/${name}`, 'utf8'), name).not.toMatch(
        /scanWordGaps|maxWordGap/,
      );
    }
    expect(readFileSync('src/plugin/main.ts', 'utf8')).not.toMatch(
      /scanWordGaps/,
    );
  });
});
