// US-028 AC-5 (decision 8) — the plugin side of the fit warnings: after a
// compile the export and the preview report `IMAGE_FLOATED` and `IMAGE_MOVED`
// from the decisions the compiler read back (`fitDecisions`); strict mode
// reports them but never stops on them; a compile without decisions (an old
// engine, a failed query) gives none and the export goes on. Fake host, fake
// compiler and fake timers, as in tests/plugin/us-007-export-run.test.ts and
// tests/plugin/us-012-controller.test.ts.
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {describe, expect, it} from 'vitest';
import type {CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import {statusLine} from '../../src/core/preview/status';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {readFitDecisions} from '../../src/plugin/compiler/worker-core';
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

const PDF = new Uint8Array([37, 80, 68, 70]);
const FLOAT = {d: 'float', line: 12, name: 'map.png'};
const MOVE = {d: 'move', line: 20, name: 'map.png'};
const SHRINK = {d: 'shrink', line: 5, name: 'b.png'};
const FLOATED =
  'Image "map.png" did not fit after its text; placed at the top of the next page';
const MOVED =
  'Image "map.png" did not fit after its text; moved to the next page, the space before it stays empty';

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

/** A compiler whose PDF result carries `decisions` (none: no field at all). */
function compilerWith(decisions?: unknown[]): TypstCompiler {
  return {
    fontInfo: () => Promise.resolve([]),
    compile: async (): Promise<CompileResult> =>
      ({
        ok: true,
        pdf: PDF,
        ...(decisions === undefined ? {} : {fitDecisions: decisions}),
      }) as CompileResult,
    dispose: () => undefined,
  };
}

function options(
  host: FakeHost,
  compiler: TypstCompiler,
  warnings: Warning[] = [],
  strictMode = false,
): RunExportOptions {
  return {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: '= Rules\n',
    warnings,
    uses: [],
    readAsset: async () => new Uint8Array(0),
    template: null,
    exportDir: '/out/run1',
    settings: {...DEFAULT_WARNING_SETTINGS, strictMode},
    host,
    compiler,
    fonts: [],
    lock: createExportLock(),
  };
}

const report = (host: FakeHost) =>
  host.text.get('/out/run1/export-warnings.md') ?? '';

describe('US-028 AC-5 the export reports the fit warnings', () => {
  it('US-028 AC-5: a float and a move become warnings at their lines, next to the conversion warnings; a shrink none', async () => {
    const host = new FakeHost();
    const result = await runExport(
      options(host, compilerWith([SHRINK, FLOAT, MOVE]), [
        {
          code: 'LINK_UNRESOLVED',
          message: 'No heading matches "[[X]]"',
          line: 15,
        },
      ]),
    );
    expect(result).toEqual({status: 'exported'});
    const text = report(host);
    expect(text).toContain('IMAGE_FLOATED');
    expect(text).toContain(FLOATED);
    expect(text).toContain('IMAGE_MOVED');
    expect(text).toContain(MOVED);
    expect(text).toContain('LINK_UNRESOLVED');
    expect(text).not.toContain('b.png');
    // in line order: 12, 15, 20 — by the messages, which only the details
    // table holds (the code also stands in the summary table above it; the
    // user's answer of 2026-10-29)
    const link = text.indexOf('No heading matches');
    expect(link).toBeGreaterThan(0);
    expect(text.indexOf(FLOATED)).toBeLessThan(link);
    expect(link).toBeLessThan(text.indexOf(MOVED));
    expect(host.notices.join(' ')).toMatch(/3 warnings/);
  });

  it('US-028 AC-5 (decision 8): strict mode reports a move and still writes the PDF', async () => {
    const host = new FakeHost();
    const result = await runExport(
      options(host, compilerWith([MOVE]), [], true),
    );
    expect(result).toEqual({status: 'exported'});
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF);
    expect(report(host)).toContain(MOVED);
  });

  it('US-028 AC-5: a compile without decisions (an old engine, a failed query) gives no fit warning and exports', async () => {
    const host = new FakeHost();
    const result = await runExport(options(host, compilerWith()));
    expect(result).toEqual({status: 'exported'});
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF);
    expect(report(host)).toBe('# Export warnings\n\nNo warnings.\n');
  });
});

class Job implements CompileJob {
  resolve!: (value: PreviewCompile) => void;
  readonly result = new Promise<PreviewCompile>((r) => (this.resolve = r));
  cancel(): void {}
}

describe('US-028 AC-5 the preview counts the fit warnings', () => {
  it('US-028 AC-5 (decision 8): the status line counts the conversion warnings and the fit warnings of that run', async () => {
    const jobs: Job[] = [];
    const ctl = createPreviewController({
      setTimer: () => 0,
      clearTimer: () => undefined,
      prepare: async () => ({
        ok: true,
        request: {file: 'Rules.typ', source: '= Rules', files: {}, fonts: []},
        warnings: 2,
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
      fitDecisions: [FLOAT, SHRINK],
    } as PreviewCompile);
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(statusLine(ctl.state)).toBe('Preview of: Rules · 3 warnings');
  });
});

describe('US-028 AC-5 the query in the worker', () => {
  /** A typst.ts compiler whose query gives `answer` (or throws it). */
  const queried = (answer: () => unknown) => {
    const asked: unknown[] = [];
    return {
      asked,
      compiler: {
        runWithWorld: async <T>(
          options: {mainFilePath: string},
          cb: (world: {
            compile(): Promise<unknown>;
            query(o: {selector: string; field?: string}): Promise<unknown>;
          }) => Promise<T>,
        ): Promise<T> =>
          cb({
            compile: async () => {
              asked.push(options.mainFilePath);
              return {};
            },
            query: async (o) => {
              asked.push(o);
              return answer();
            },
          }),
      },
    };
  };

  it('US-028 AC-5: a failed query (an old engine) gives no decisions and does not throw (SCAR-023)', async () => {
    const {compiler} = queried(() => {
      throw new Error('query is not supported');
    });
    await expect(readFitDecisions(compiler, '/Rules.typ')).resolves.toBe(
      undefined,
    );
  });

  it('US-028 AC-5: the values are read by the label and the field value, as a list (text or array); anything else gives none', async () => {
    const text = queried(() => JSON.stringify([FLOAT, MOVE]));
    await expect(
      readFitDecisions(text.compiler, '/Rules.typ'),
    ).resolves.toEqual([FLOAT, MOVE]);
    expect(text.asked).toEqual([
      '/Rules.typ',
      {selector: '<o2t-fit-decision>', field: 'value'},
    ]);
    const list = queried(() => [SHRINK]);
    await expect(readFitDecisions(list.compiler, '/R.typ')).resolves.toEqual([
      SHRINK,
    ]);
    const other = queried(() => ({d: 'move'}));
    await expect(readFitDecisions(other.compiler, '/R.typ')).resolves.toBe(
      undefined,
    );
  });
});
