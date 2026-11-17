// US-042 AC-8, AC-9, AC-11 — the export run with a progress: each step in order,
// the warnings as they are known, a cancel during the compile (the compile ended,
// nothing more written, P4), the notices of the end (✅ / ❌), no `Compiling…`
// notice. Fake host and fake compiler, as in us-007-export-run. Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {describe, expect, it} from 'vitest';
import type {Warning} from '../../src/core/emit';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import type {ExportProgress, ExportStep} from '../../src/core/export-progress';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';

const PDF = new Uint8Array([37, 80, 68, 70]);
const PNG = new Uint8Array([137, 80, 78, 71, 1]);
const w = (code: string, line: number): Warning => ({
  code,
  message: `${code} message`,
  line,
});

class FakeHost implements RunExportHost {
  readonly notices: string[] = [];
  readonly written: string[] = [];
  readonly log: string[] = [];
  notice(text: string): void {
    this.notices.push(text);
    this.log.push(`notice:${text}`);
  }
  async writeExportFile(path: string): Promise<void> {
    this.written.push(path);
    this.log.push(`text:${path}`);
  }
  async writeExportBytes(path: string): Promise<void> {
    this.written.push(path);
    this.log.push(`bytes:${path}`);
  }
  async writeVaultFile(path: string): Promise<void> {
    this.written.push(path);
    this.log.push(`vault:${path}`);
  }
}

/** A compiler whose compile waits until the test lets it go (or it is disposed). */
class FakeCompiler implements TypstCompiler {
  readonly requests: CompileRequest[] = [];
  disposed = 0;
  private pending: ((r: CompileResult) => void)[] = [];
  constructor(
    private readonly log: string[],
    private readonly hold = false,
    private readonly answer: CompileResult = {ok: true, pdf: PDF},
    private readonly gaps: Warning[] | null = null,
  ) {}
  fontInfo(): Promise<never[]> {
    return Promise.resolve([]);
  }
  compile(request: CompileRequest): Promise<CompileResult> {
    this.log.push(`compile:${request.file}`);
    this.requests.push(request);
    if (!this.hold) return Promise.resolve(this.answer);
    return new Promise((resolve) => this.pending.push(resolve));
  }
  release(): void {
    for (const resolve of this.pending.splice(0)) resolve(this.answer);
  }
  dispose(): void {
    this.disposed++;
    this.log.push('dispose');
    for (const resolve of this.pending.splice(0)) {
      resolve({
        ok: false,
        kind: 'worker',
        error: 'Typst compiler failed: ended',
      });
    }
  }
  scanWordGaps?: TypstCompiler['scanWordGaps'];
  withGaps(): this {
    const gaps = this.gaps ?? [];
    this.scanWordGaps = async () => {
      this.log.push('gaps');
      return gaps;
    };
    return this;
  }
}

/** A progress that records steps, warnings and cancel listeners. */
function fakeProgress(log: string[]) {
  const listeners = new Set<() => void>();
  const warnings: Warning[][] = [];
  const steps: ExportStep[] = [];
  const progress: ExportProgress & {
    warningsSeen: Warning[][];
    stepsSeen: ExportStep[];
  } = {
    warningsSeen: warnings,
    stepsSeen: steps,
    cancelled: false,
    step(step) {
      steps.push(step);
      log.push(`step:${step.kind}`);
    },
    warnings(list) {
      warnings.push([...list]);
      log.push(`warnings:${list.length}`);
    },
    end() {
      throw new Error('the run never ends the progress; the command does');
    },
    cancel() {
      if (progress.cancelled) return;
      (progress as {cancelled: boolean}).cancelled = true;
      for (const l of [...listeners]) l();
    },
    onCancel(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return progress;
}

function setup(
  overrides: Partial<RunExportOptions> = {},
  compilerOptions: {
    hold?: boolean;
    answer?: CompileResult;
    gaps?: Warning[];
  } = {},
) {
  const host = new FakeHost();
  const compiler = new FakeCompiler(
    host.log,
    compilerOptions.hold ?? false,
    compilerOptions.answer,
    compilerOptions.gaps ?? null,
  );
  const progress = fakeProgress(host.log);
  const options: RunExportOptions = {
    noteName: 'Book',
    source: {path: 'Sample/Book.md', inVault: true},
    typ: '= Book\n',
    warnings: [],
    uses: [{from: 'Sample/assets/crypt.png', to: 'assets/crypt.png'}],
    readAsset: async () => PNG,
    template: null,
    exportDir: '/out/a5',
    settings: DEFAULT_WARNING_SETTINGS,
    host,
    compiler,
    fonts: [],
    lock: createExportLock(),
    progress,
    ...overrides,
  };
  return {host, compiler, progress, options};
}

describe('US-042 AC-7, AC-8: steps and warnings of a run', () => {
  it("the compile, then writing; the conversion's warnings first, the run's after", async () => {
    const s = setup({warnings: [w('LINK_UNRESOLVED', 3)], maxWordGap: 200});
    s.compiler.withGaps();
    expect(await runExport(s.options)).toEqual({status: 'exported'});
    const marks = s.host.log.filter(
      (l) => l.startsWith('step:') || l.startsWith('warnings:') || l === 'gaps',
    );
    expect(marks).toEqual([
      'warnings:1',
      'step:compile',
      'step:write',
      'step:gaps',
      'gaps',
      'warnings:0',
    ]);
    expect(s.progress.stepsSeen[0]).toEqual({kind: 'compile', n: 1, limit: 8});
    expect(s.progress.warningsSeen[0]).toEqual([w('LINK_UNRESOLVED', 3)]);
  });

  it("the run's own warnings reach the progress (here the word-gap scan's)", async () => {
    const s = setup({maxWordGap: 200}, {gaps: [w('TEXT_GAP_WIDE', 40)]});
    s.compiler.withGaps();
    await runExport(s.options);
    expect(s.progress.warningsSeen.at(-1)).toEqual([w('TEXT_GAP_WIDE', 40)]);
  });

  it('the encounter sheet is its own step, before the gap scan', async () => {
    const s = setup({sheetTyp: '= Sheet\n', maxWordGap: 200});
    s.compiler.withGaps();
    await runExport(s.options);
    expect(s.progress.stepsSeen.map((step) => step.kind)).toEqual([
      'compile',
      'write',
      'sheet',
      'gaps',
    ]);
  });

  it('a run without a progress works as before (the option is optional)', async () => {
    const s = setup({progress: undefined});
    expect(await runExport(s.options)).toEqual({status: 'exported'});
    expect(s.host.written).toContain('/out/a5/Book.pdf');
  });
});

describe('US-042 AC-11: the notices of a run', () => {
  it('no Compiling… notice; the finished notice with the PDF and the folder', async () => {
    const s = setup();
    await runExport(s.options);
    expect(s.host.notices).toEqual(['✅ Exported Book.pdf to /out/a5']);
  });

  it("with warnings: their count and the report's name", async () => {
    const s = setup({warnings: [w('A', 1), w('B', 2), w('C', 3)]});
    await runExport(s.options);
    expect(s.host.notices).toEqual([
      '✅ Exported Book.pdf to /out/a5, 3 warnings (see export-warnings.md)',
    ]);
  });

  it('the folder without its trailing slash', async () => {
    const s = setup({exportDir: '/out/a5/'});
    await runExport(s.options);
    expect(s.host.notices).toEqual(['✅ Exported Book.pdf to /out/a5']);
  });

  it('one warning: singular', async () => {
    const s = setup({warnings: [w('A', 1)]});
    await runExport(s.options);
    expect(s.host.notices).toEqual([
      '✅ Exported Book.pdf to /out/a5, 1 warning (see export-warnings.md)',
    ]);
  });

  it("a failed compile: ❌ with the compile's error", async () => {
    const s = setup(
      {},
      {answer: {ok: false, kind: 'typst', error: 'unknown variable: foo'}},
    );
    expect(await runExport(s.options)).toEqual({status: 'compile-error'});
    expect(s.host.notices).toEqual(['❌ Export failed: unknown variable: foo']);
  });

  it('strict mode: ❌ Export aborted with the count', async () => {
    const s = setup({
      warnings: [w('A', 1), w('B', 2), w('C', 3)],
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    });
    expect(await runExport(s.options)).toEqual({status: 'aborted'});
    expect(s.host.notices[0]?.split('\n')[0]).toBe(
      '❌ Export aborted: 3 warnings (strict mode)',
    );
  });

  it('busy: the refusal ends with a full stop', async () => {
    const s = setup();
    const release = s.options.lock.tryAcquire();
    expect(await runExport(s.options)).toEqual({status: 'busy'});
    expect(s.host.notices).toEqual(['An export is already running.']);
    release?.();
  });
});

describe('US-042 AC-9: cancel during the compile (P4)', () => {
  it('ends the compile, writes nothing more, no PDF, ❌ Export cancelled.', async () => {
    const s = setup({}, {hold: true});
    const running = runExport(s.options);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.compiler.requests).toHaveLength(1);
    const before = [...s.host.written];
    s.progress.cancel();
    expect(await running).toEqual({status: 'cancelled'});
    expect(s.compiler.disposed).toBe(1);
    expect(s.host.written).toEqual(before);
    expect(s.host.written).not.toContain('/out/a5/Book.pdf');
    expect(s.host.notices).toEqual(['❌ Export cancelled.']);
  });

  it('keeps the files written before the cancel: the .typ and the assets', async () => {
    const s = setup({}, {hold: true});
    const running = runExport(s.options);
    await new Promise((r) => setTimeout(r, 0));
    s.progress.cancel();
    await running;
    expect(s.host.written).toEqual([
      '/out/a5/Book.typ',
      '/out/a5/assets/crypt.png',
    ]);
  });

  it('a cancel after the run changes nothing (the listener is removed)', async () => {
    const s = setup();
    await runExport(s.options);
    s.progress.cancel();
    expect(s.compiler.disposed).toBe(0);
  });

  // Found at T1 (#175; G2 gaps, SCAR-002, SCAR-023): a cancel after the book's
  // PDF was written writes nothing more — during the encounter sheet's compile
  // (even when that compile still succeeds) and during the word-gap scan.
  it('a cancel during the encounter sheet: the book PDF stays, no sheet PDF, no report', async () => {
    const s = setup({sheetTyp: '= Sheet\n'});
    let n = 0;
    const realCompile = s.compiler.compile.bind(s.compiler);
    s.compiler.compile = (request) => {
      n += 1;
      if (n === 2) s.progress.cancel();
      return realCompile(request);
    };
    expect(await runExport(s.options)).toEqual({status: 'cancelled'});
    expect(s.host.written).toEqual([
      '/out/a5/Book.typ',
      '/out/a5/assets/crypt.png',
      '/out/a5/Book.pdf',
      '/out/a5/Book - Encounter Sheet.typ',
    ]);
    expect(s.host.notices).toEqual(['❌ Export cancelled.']);
  });

  it('a cancel during the word-gap scan: the book PDF stays, no report', async () => {
    const s = setup({maxWordGap: 200});
    s.compiler.scanWordGaps = async () => {
      s.progress.cancel();
      return [w('TEXT_GAP_WIDE', 4)];
    };
    expect(await runExport(s.options)).toEqual({status: 'cancelled'});
    expect(s.host.written).toEqual([
      '/out/a5/Book.typ',
      '/out/a5/assets/crypt.png',
      '/out/a5/Book.pdf',
    ]);
    expect(s.host.notices).toEqual(['❌ Export cancelled.']);
  });

  it('a cancel before the compile: no compile at all', async () => {
    const s = setup();
    s.progress.cancel();
    expect(await runExport(s.options)).toEqual({status: 'cancelled'});
    expect(s.compiler.requests).toHaveLength(0);
    expect(s.host.written).toEqual([]);
    expect(s.host.notices).toEqual(['❌ Export cancelled.']);
  });
});
