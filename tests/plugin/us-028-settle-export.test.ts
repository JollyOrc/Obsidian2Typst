// US-028 AC-14 to AC-16 (amendment #116) — the plugin side of a layout that
// settles: the export compiles until the layout settles (seeded, then
// pinned, at most 8 compiles), then falls back to the note at
// `images.minScale: 100`; the warnings `LAYOUT_NOT_SETTLED` and
// `IMAGE_FIT_OFF`; the worker reads Typst's warnings from its world; the
// preview counts the non-convergence of its one compile. Fake host and fake
// compiler as in tests/plugin/us-028-fit-warnings.test.ts. New fields and
// functions are read by their expected names (red until the code).
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {describe, expect, it} from 'vitest';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import {statusLine} from '../../src/core/preview/status';
import type {TypstCompiler} from '../../src/plugin/compiler';
import * as workerCore from '../../src/plugin/compiler/worker-core';
import {
  createPreviewController,
  type CompileJob,
  type PreviewCompile,
} from '../../src/plugin/preview/controller';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';

const PDF = (n: number) => new Uint8Array([37, 80, 68, 70, n]);
const HINTS = '#let o2t-fit-hints = (:)\n#let o2t-fit-pinned = false';
const TYP = `#set page()\n${HINTS}\n#let fit-flow() = none\nBody.\n`;
const FALLBACK_TYP = '#set page()\nBody at 100.\n';
const NOT_SETTLED =
  'The layout did not settle; page numbers, running headers and image places may be wrong';
const FIT_OFF =
  'Image fit did not settle the layout in 8 compiles; exported without it (images.minScale 100)';

/** A decision as the helper writes it (AC-17). */
const dec = (n: number, d: string, r = 1, want = d, wr = r) => ({
  d,
  line: 10 * n,
  name: `img${n}.png`,
  key: `o2t-fit-${n}`,
  r,
  want,
  wr,
});

class FakeHost implements RunExportHost {
  readonly notices: string[] = [];
  readonly text = new Map<string, string>();
  readonly bytes = new Map<string, Uint8Array>();
  notice(text: string): void {
    this.notices.push(text);
  }
  async writeExportFile(path: string, text: string): Promise<void> {
    this.text.set(path, text);
  }
  async writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    this.bytes.set(path, data);
  }
  async writeVaultFile(): Promise<void> {}
}

type Scripted = {settled?: boolean; fitDecisions?: unknown[]};

/** A compiler that answers compile `i` with `script[i]` and records the sources. */
function scripted(script: Scripted[]) {
  const sources: string[] = [];
  const compiler: TypstCompiler = {
    fontInfo: () => Promise.resolve([]),
    compile: async (request: CompileRequest): Promise<CompileResult> => {
      sources.push(request.source);
      const answer = script[sources.length - 1] ?? {settled: true};
      return {ok: true, pdf: PDF(sources.length), ...answer} as CompileResult;
    },
    dispose: () => undefined,
  };
  return {compiler, sources};
}

function options(
  host: FakeHost,
  compiler: TypstCompiler,
  more: Record<string, unknown> = {},
): RunExportOptions {
  return {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: TYP,
    warnings: [] as Warning[],
    uses: [],
    readAsset: async () => new Uint8Array(0),
    template: null,
    exportDir: '/out/run1',
    settings: {...DEFAULT_WARNING_SETTINGS},
    host,
    compiler,
    fonts: [],
    lock: createExportLock(),
    ...more,
  } as RunExportOptions;
}

const report = (host: FakeHost) =>
  host.text.get('/out/run1/export-warnings.md') ?? '';
const fallbackNote = () => {
  const calls: number[] = [];
  return {
    calls,
    fallback: async () => {
      calls.push(1);
      return {
        typ: FALLBACK_TYP,
        warnings: [] as Warning[],
        uses: [],
      };
    },
  };
};

describe('US-028 AC-15 the export compiles until the layout settles', () => {
  it('US-028 AC-15: a note that settles at compile 1 is compiled once; its text is written as converted; the notice is "Compiling…"', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([
      {settled: true, fitDecisions: [dec(1, 'full')]},
    ]);
    const result = await runExport(options(host, compiler));
    expect(result).toEqual({status: 'exported'});
    expect(sources).toEqual([TYP]);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(TYP);
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF(1));
    expect(host.notices.filter((n) => n.startsWith('Compiling'))).toEqual([
      'Compiling…',
    ]);
    expect(report(host)).not.toContain('LAYOUT_NOT_SETTLED');
  });

  it('US-028 AC-15: seeded compiles until one settles (here compile 3); each later compile carries the decisions read before it; the result is written', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([
      {settled: false, fitDecisions: [dec(1, 'float'), dec(2, 'full')]},
      {settled: false, fitDecisions: [dec(1, 'move'), dec(2, 'full')]},
      {settled: true, fitDecisions: [dec(1, 'move'), dec(2, 'shrink', 0.8)]},
    ]);
    await runExport(options(host, compiler));
    expect(sources).toHaveLength(3);
    expect(sources[1]).toContain(
      '#let o2t-fit-hints = ("o2t-fit-1": (d: "float", r: 1.0), "o2t-fit-2": (d: "full", r: 1.0))\n#let o2t-fit-pinned = false',
    );
    expect(sources[2]).toContain(
      '#let o2t-fit-hints = ("o2t-fit-1": (d: "move", r: 1.0), "o2t-fit-2": (d: "full", r: 1.0))\n#let o2t-fit-pinned = false',
    );
    // AC-17: the .typ written is the one of the result, with its PDF
    expect(host.text.get('/out/run1/Rules.typ')).toBe(sources[2]);
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF(3));
    expect(host.notices.filter((n) => n.startsWith('Compiling'))).toEqual([
      'Compiling…',
      'Compiling… (2 of up to 8)',
      'Compiling… (3 of up to 8)',
    ]);
    // AC-5: the fit warnings are those of the result
    expect(report(host)).toContain('IMAGE_MOVED');
    expect(report(host)).not.toContain('IMAGE_FLOATED');
    expect(report(host)).not.toContain('LAYOUT_NOT_SETTLED');
  });

  it('US-028 AC-15: a seeded compile that changes nothing switches to pinned compiles to the wants, until one settles with every want met', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([
      {settled: false, fitDecisions: [dec(1, 'float')]},
      // the same decision again: a cycle
      {settled: false, fitDecisions: [dec(1, 'float', 1, 'full', 1)]},
      // pinned to full; settles, but the image wants a shrink
      {settled: true, fitDecisions: [dec(1, 'full', 1, 'shrink', 0.9)]},
      // pinned to the shrink: settles, nothing wants otherwise
      {settled: true, fitDecisions: [dec(1, 'shrink', 0.9)]},
    ]);
    await runExport(options(host, compiler));
    expect(sources).toHaveLength(4);
    expect(sources[2]).toContain(
      '#let o2t-fit-hints = ("o2t-fit-1": (d: "full", r: 1.0))\n#let o2t-fit-pinned = true',
    );
    expect(sources[3]).toContain(
      '#let o2t-fit-hints = ("o2t-fit-1": (d: "shrink", r: 0.9))\n#let o2t-fit-pinned = true',
    );
    expect(host.text.get('/out/run1/Rules.typ')).toBe(sources[3]);
    expect(report(host)).not.toContain('LAYOUT_NOT_SETTLED');
  });

  it('US-028 AC-15 guard: without fit-flow (no hints lines) the export compiles once, also when the layout does not settle, and reports it (AC-14)', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([{settled: false}]);
    const {fallback, calls} = fallbackNote();
    await runExport(options(host, compiler, {typ: '= Rules\n', fallback}));
    expect(sources).toEqual(['= Rules\n']);
    expect(calls).toEqual([]);
    expect(report(host)).toContain('LAYOUT_NOT_SETTLED');
    expect(report(host)).toContain(NOT_SETTLED);
  });

  it('US-028 AC-15 guard (mutant found): a text without the hints lines is compiled once even when its compile returns records of the helper (a template could write them)', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([
      {settled: false, fitDecisions: [dec(1, 'float', 1, 'full', 1)]},
      {settled: true},
    ]);
    await runExport(options(host, compiler, {typ: '= Rules\n'}));
    expect(sources).toEqual(['= Rules\n']);
    expect(report(host)).toContain('LAYOUT_NOT_SETTLED');
  });

  it('US-028 AC-14, AC-15: unread warnings (an old engine) end the loop after compile 1 without a warning', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([{fitDecisions: [dec(1, 'float')]}]);
    await runExport(options(host, compiler));
    expect(sources).toHaveLength(1);
    expect(report(host)).not.toContain('LAYOUT_NOT_SETTLED');
  });
});

describe('US-028 AC-16 the fallback', () => {
  const never = (n: number): Scripted[] =>
    Array.from({length: n}, (_, i) => ({
      settled: false,
      fitDecisions: [dec(1, i % 2 === 0 ? 'float' : 'move')],
    }));

  it('US-028 AC-16: after 8 compiles that do not settle, the note at 100 is compiled once and written; IMAGE_FIT_OFF instead of the fit warnings', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([...never(8), {settled: true}]);
    const {fallback, calls} = fallbackNote();
    const result = await runExport(options(host, compiler, {fallback}));
    expect(result).toEqual({status: 'exported'});
    expect(sources).toHaveLength(9);
    expect(calls).toEqual([1]);
    expect(sources[8]).toBe(FALLBACK_TYP);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(FALLBACK_TYP);
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF(9));
    const text = report(host);
    expect(text).toContain('IMAGE_FIT_OFF');
    expect(text).toContain(FIT_OFF);
    expect(text).not.toContain('IMAGE_FLOATED');
    expect(text).not.toContain('IMAGE_MOVED');
    expect(text).not.toContain('LAYOUT_NOT_SETTLED');
    expect(host.notices.filter((n) => n.startsWith('Compiling'))).toHaveLength(
      9,
    );
  });

  it('US-028 AC-15 step 5, AC-16 (decision 17): a stuck pinned compile falls back at once, not after compile 8', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([
      {settled: false, fitDecisions: [dec(1, 'float')]},
      // unchanged: the next is pinned
      {settled: false, fitDecisions: [dec(1, 'float')]},
      // pinned, every image wants its decision, still not settled: stuck
      {settled: false, fitDecisions: [dec(1, 'float')]},
      {settled: true},
    ]);
    const {fallback, calls} = fallbackNote();
    await runExport(options(host, compiler, {fallback}));
    expect(sources).toHaveLength(4);
    expect(calls).toEqual([1]);
    expect(sources[3]).toBe(FALLBACK_TYP);
    expect(report(host)).toContain('IMAGE_FIT_OFF');
  });

  it('US-028 AC-16: when the note at 100 does not settle either, LAYOUT_NOT_SETTLED as well', async () => {
    const host = new FakeHost();
    const {compiler} = scripted([...never(8), {settled: false}]);
    const {fallback} = fallbackNote();
    await runExport(options(host, compiler, {fallback}));
    expect(report(host)).toContain('IMAGE_FIT_OFF');
    expect(report(host)).toContain('LAYOUT_NOT_SETTLED');
  });

  it('US-028 AC-16, AC-18: an injected limit of 2 falls back after compile 2', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted([...never(2), {settled: true}]);
    const {fallback, calls} = fallbackNote();
    await runExport(options(host, compiler, {fallback, fitCompileLimit: 2}));
    expect(sources).toHaveLength(3);
    expect(calls).toEqual([1]);
    expect(host.notices.filter((n) => n.startsWith('Compiling'))).toEqual([
      'Compiling…',
      'Compiling… (2 of up to 2)',
      'Compiling…',
    ]);
  });

  it('US-028 AC-16 (decision E): strict mode reports IMAGE_FIT_OFF and LAYOUT_NOT_SETTLED and still writes the PDF', async () => {
    const host = new FakeHost();
    const {compiler} = scripted([...never(8), {settled: false}]);
    const {fallback} = fallbackNote();
    const result = await runExport(
      options(host, compiler, {
        fallback,
        settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
      }),
    );
    expect(result).toEqual({status: 'exported'});
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF(9));
    expect(report(host)).toContain('IMAGE_FIT_OFF');
  });

  it('US-028 AC-16 (mutant found): a fallback that cannot convert (null) keeps compile 8: LAYOUT_NOT_SETTLED, no IMAGE_FIT_OFF', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted(never(8));
    await runExport(options(host, compiler, {fallback: async () => null}));
    expect(sources).toHaveLength(8);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(sources[7]);
    expect(report(host)).toContain('LAYOUT_NOT_SETTLED');
    expect(report(host)).not.toContain('IMAGE_FIT_OFF');
  });

  it('US-028 AC-16: without a fallback (none given) the last compile is kept and LAYOUT_NOT_SETTLED is reported', async () => {
    const host = new FakeHost();
    const {compiler, sources} = scripted(never(8));
    await runExport(options(host, compiler));
    expect(sources).toHaveLength(8);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(sources[7]);
    expect(report(host)).toContain('LAYOUT_NOT_SETTLED');
  });
});

describe("US-028 AC-14 the worker reads Typst's warnings", () => {
  type Facts = {settled?: boolean; fitDecisions?: unknown[]};
  const read = (
    compiler: unknown,
    main: string,
    decisions: boolean,
  ): Promise<Facts> => {
    const f = (workerCore as unknown as Record<string, unknown>)[
      'readLayoutFacts'
    ];
    if (typeof f !== 'function')
      throw new Error('readLayoutFacts is not defined');
    return (f as (c: unknown, m: string, d: boolean) => Promise<Facts>)(
      compiler,
      main,
      decisions,
    );
  };
  /** A typst.ts compiler whose world compile gives `diagnostics`. */
  const world = (diagnostics: () => unknown, values: unknown = []) => {
    const asked: unknown[] = [];
    return {
      asked,
      compiler: {
        runWithWorld: async <T>(
          o: {mainFilePath: string},
          cb: (w: {
            compile(x?: unknown): Promise<unknown>;
            query(x: unknown): Promise<unknown>;
          }) => Promise<T>,
        ): Promise<T> =>
          cb({
            compile: async (x) => {
              asked.push([o.mainFilePath, x]);
              return {hasError: false, diagnostics: diagnostics()};
            },
            query: async (x) => {
              asked.push(x);
              return values;
            },
          }),
      },
    };
  };

  it("US-028 AC-14: the world compiles with diagnostics; Typst's non-convergence gives settled false, none gives true", async () => {
    const off = world(() => [
      ': warning: layout did not converge within 5 attempts, hints: check if any states or queries are updating themselves',
    ]);
    await expect(read(off.compiler, '/Rules.typ', false)).resolves.toEqual({
      settled: false,
    });
    expect(off.asked).toEqual([['/Rules.typ', {diagnostics: 'unix'}]]);
    const on = world(() => ['/t.typ:1:2: warning: unknown font family: nope']);
    await expect(read(on.compiler, '/Rules.typ', false)).resolves.toEqual({
      settled: true,
    });
  });

  it('US-028 AC-14, AC-5: with decisions asked, the same world also reads them (one world, one compile)', async () => {
    const both = world(() => [], [dec(1, 'float')]);
    await expect(read(both.compiler, '/R.typ', true)).resolves.toEqual({
      settled: true,
      fitDecisions: [dec(1, 'float')],
    });
    expect(both.asked).toEqual([
      ['/R.typ', {diagnostics: 'unix'}],
      {selector: '<o2t-fit-decision>', field: 'value'},
    ]);
  });

  it('US-028 AC-14 (AC-5): a thrown world gives nothing and does not throw', async () => {
    const broken = {
      runWithWorld: async () => {
        throw new Error('no world');
      },
    };
    await expect(read(broken, '/R.typ', true)).resolves.toEqual({});
  });
});

class Job implements CompileJob {
  resolve!: (value: PreviewCompile) => void;
  readonly result = new Promise<PreviewCompile>((r) => (this.resolve = r));
  cancel(): void {}
}

describe('US-028 AC-14 (decision C) the preview counts the non-convergence', () => {
  const preview = async (settled: boolean | undefined) => {
    const jobs: Job[] = [];
    const ctl = createPreviewController({
      setTimer: () => 0,
      clearTimer: () => undefined,
      prepare: async () => ({
        ok: true,
        request: {file: 'Rules.typ', source: '= Rules', files: {}, fonts: []},
        warnings: 1,
      }),
      compile: () => {
        const job = new Job();
        jobs.push(job);
        return job;
      },
      onState: () => undefined,
    });
    ctl.setNote('Book/Rules.md');
    await new Promise<void>((r) => setTimeout(r, 0));
    jobs.at(-1)?.resolve({
      ok: true,
      pageCount: 3,
      pageSize: {width: 148, height: 210},
      document: 'doc',
      ...(settled === undefined ? {} : {settled}),
    } as PreviewCompile);
    await new Promise<void>((r) => setTimeout(r, 0));
    return {ctl, jobs};
  };

  it('US-028 AC-14 (decision C): a preview compile that did not settle adds one warning to the count, in one compile', async () => {
    const {ctl, jobs} = await preview(false);
    expect(statusLine(ctl.state)).toBe('Preview of: Rules · 2 warnings');
    expect(jobs).toHaveLength(1);
  });

  it('US-028 AC-14 (decision C): settled or unread adds none', async () => {
    expect(statusLine((await preview(true)).ctl.state)).toBe(
      'Preview of: Rules · 1 warning',
    );
    expect(statusLine((await preview(undefined)).ctl.state)).toBe(
      'Preview of: Rules · 1 warning',
    );
  });
});
