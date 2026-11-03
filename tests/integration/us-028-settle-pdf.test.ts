// US-028 AC-14 to AC-18 (amendment #116) — a layout that settles, with the
// real compiler: the test readers checked first (SCAR-028); the compiler
// service reports whether Typst settled; generated notes that do not settle
// in one compile settle through the export's loop, and the `.typ` it writes
// settles alone at a fixed point; the fallback at 100; the settings ranges
// (SCAR-019); the sample's Book.md is compiled once. The export runs through
// `runExport` with a fake host. New fields are read by their expected names
// (red until the code). Measured 2026-11-03 (scratch probes `bn/`).
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {afterAll, describe, expect, it} from 'vitest';
import type {CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {
  BOOK_FONTS,
  BOOK_IMAGES,
  convertBook,
  type BookOptions,
} from '../support/book';
import {LoopbackWorker} from '../support/fake-worker';
import {readPdfPages} from '../support/pdf';
import {disposeWorld, generatedNote, worldFacts} from '../support/settle';
import {readFileSync} from 'node:fs';

afterAll(() => disposeWorld());

const wasm = new Uint8Array(
  readFileSync(
    'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  ),
);
/** A compiler of its own per test: a panic was seen after many big compiles in one instance (#107). */
const freshCompiler = () =>
  createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });

const NO_CONVERGE =
  '#context if query(<m>).len() == 0 [#metadata(none) <m>]\nHello';

class Host implements RunExportHost {
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

/** What an export of `source` with `options` wrote and reported. */
interface Exported {
  typ: string;
  pages: ReturnType<typeof readPdfPages>;
  report: string;
  compiles: number;
  files: Record<string, Uint8Array>;
}

/**
 * Converts `source` with `options` (`extra.images.minScale`), exports it
 * through `runExport` with the real compiler, and hands the run the same
 * note at 100 as its fallback, as the export command does (AC-16).
 */
async function exportBook(
  source: string,
  options: BookOptions,
  more: Record<string, unknown> = {},
): Promise<Exported> {
  const result = await convertBook(source, options);
  const extra = (options.extra ?? {}) as Record<string, unknown>;
  const at100 = await convertBook(source, {
    ...options,
    extra: {...extra, images: {minScale: 100}},
  });
  const compiler = freshCompiler();
  const host = new Host();
  let compiles = 0;
  const counting = {
    ...compiler,
    compile: async (r: Parameters<typeof compiler.compile>[0]) => {
      compiles++;
      return compiler.compile(r);
    },
  };
  try {
    await runExport({
      noteName: 'Rules',
      source: {path: 'Sample/Rules.md', inVault: true},
      typ: result.typ,
      warnings: result.warnings as Warning[],
      uses: result.assets,
      readAsset: async (from: string) => BOOK_IMAGES[from] as Uint8Array,
      template: null,
      exportDir: '/out',
      settings: {...DEFAULT_WARNING_SETTINGS},
      host,
      compiler: counting,
      fonts: [...BOOK_FONTS],
      lock: createExportLock(),
      fallback: async () => ({
        typ: at100.typ,
        warnings: at100.warnings,
        uses: at100.assets,
      }),
      ...more,
    } as RunExportOptions);
  } finally {
    compiler.dispose();
  }
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = BOOK_IMAGES[use.from] as Uint8Array;
  }
  const pdf = host.bytes.get('/out/Rules.pdf');
  return {
    typ: host.text.get('/out/Rules.typ') ?? '',
    pages: pdf === undefined ? [] : readPdfPages(pdf),
    report: host.text.get('/out/export-warnings.md') ?? '',
    compiles,
    files,
  };
}

/** Every decision of a settled result wants what it got (AC-15 step 2). */
const atFixedPoint = (decisions: Record<string, unknown>[]): boolean =>
  decisions.every(
    (d) =>
      d.want === d.d &&
      typeof d.r === 'number' &&
      typeof d.wr === 'number' &&
      Math.abs(d.r - d.wr) <= 0.001,
  );

const fit = (minScale: number, more: Record<string, unknown> = {}) =>
  ({extra: {images: {minScale}, ...more}}) satisfies BookOptions;

// SCAR-030: 0.02 to 0.73 s per test under a full integration run (2026-11-03)
describe('US-028 AC-18 the test readers (SCAR-028)', {timeout: 30_000}, () => {
  it("US-028 AC-14: worldFacts reads Typst's non-convergence and a font warning (known inputs, measured)", async () => {
    const off = await worldFacts(NO_CONVERGE);
    expect(off.settled).toBe(false);
    expect(off.diagnostics.join('\n')).toContain(
      'layout did not converge within 5 attempts',
    );
    const font = await worldFacts('#text(font: "Nope")[x]');
    expect(font.settled).toBe(true);
    expect(font.diagnostics.join('\n')).toContain('unknown font family: nope');
    expect((await worldFacts('Hello')).diagnostics).toEqual([]);
  });

  it('US-028 AC-18: generatedNote is the same for a seed, a chapter every 10 images, 1 to 7 fillers before each image', () => {
    const note = generatedNote(1, 20);
    expect(generatedNote(1, 20)).toBe(note);
    expect(generatedNote(2, 20)).not.toBe(note);
    expect(note.match(/^# Chapter \d+$/gm)).toEqual([
      '# Chapter 1',
      '# Chapter 2',
    ]);
    const images = note.match(/^!\[\]\(assets\/(map|wide|tall)\.png\)$/gm);
    expect(images).toHaveLength(20);
    // every kind is drawn
    for (const kind of ['map', 'wide', 'tall']) {
      expect(note, kind).toContain(`assets/${kind}.png`);
    }
    for (let i = 0; i < 20; i++) {
      const count = note
        .split('\n')
        .filter((l) => l.startsWith(`S${i} `)).length;
      expect(count, `S${i}`).toBeGreaterThanOrEqual(1);
      expect(count, `S${i}`).toBeLessThanOrEqual(7);
    }
  });

  it('US-028 AC-18 guard (measured): a generated note of 60 images does not settle in one compile at 70 and settles at 100', async () => {
    for (const minScale of [70, 100]) {
      const result = await convertBook(generatedNote(1, 60), fit(minScale));
      const files: Record<string, Uint8Array> = {};
      for (const use of result.assets) {
        files[use.to] = BOOK_IMAGES[use.from] as Uint8Array;
      }
      expect((await worldFacts(result.typ, files)).settled, `${minScale}`).toBe(
        minScale === 100,
      );
    }
  });
});

describe(
  'US-028 AC-14 the compiler service says whether Typst settled',
  // SCAR-030: 0.05 s under a full integration run (2026-11-03)
  {timeout: 30_000},
  () => {
    const settledOf = (r: CompileResult) =>
      (r as unknown as {settled?: boolean}).settled;

    it('US-028 AC-14: settled false for a document that never settles, true for one that does', async () => {
      const compiler = freshCompiler();
      try {
        const off = await compiler.compile({
          file: 'main.typ',
          source: NO_CONVERGE,
          files: {},
          fonts: [...BOOK_FONTS],
        });
        expect(off.ok).toBe(true);
        expect(settledOf(off)).toBe(false);
        const on = await compiler.compile({
          file: 'main.typ',
          source: 'Hello',
          files: {},
          fonts: [...BOOK_FONTS],
        });
        expect(settledOf(on)).toBe(true);
      } finally {
        compiler.dispose();
      }
    });
  },
);

describe(
  'US-028 AC-15, AC-17 generated notes settle through the export',
  // SCAR-030: 0.34 to 1.42 s per test under a full integration run (2026-11-03)
  {timeout: 60_000},
  () => {
    // AC-15's examples (measured with the seeded helper of the probe)
    for (const [seed, more, compiles] of [
      [1, {}, 4],
      [3, {}, 6],
      [1, {breakBefore: {h1: 'right'}}, 2],
    ] as const) {
      it(`US-028 AC-15: seed ${seed}, 60 images, ${JSON.stringify(more)}: settles at compile ${compiles}; the written .typ settles alone at a fixed point`, async () => {
        const run = await exportBook(generatedNote(seed, 60), fit(70, more));
        expect(run.compiles).toBe(compiles);
        expect(run.report).not.toContain('LAYOUT_NOT_SETTLED');
        expect(run.report).not.toContain('IMAGE_FIT_OFF');
        expect(run.typ).toContain('#fit-flow(');
        const facts = await worldFacts(run.typ, run.files);
        expect(facts.settled).toBe(true);
        expect(facts.decisions).toHaveLength(60);
        expect(atFixedPoint(facts.decisions)).toBe(true);
        // SCAR-015: the content is there
        const all = run.pages.map((p) => p.text).join(' ');
        expect(all).toContain('S0 ');
        expect(all).toContain('End 1');
        expect(run.pages.filter((p) => p.hasImage).length).toBeGreaterThan(10);
      });
    }

    it('US-028 AC-17 (rule 7): two exports of the same note write the same .typ', async () => {
      const a = await exportBook(generatedNote(2, 30), fit(70));
      const b = await exportBook(generatedNote(2, 30), fit(70));
      expect(b.typ).toBe(a.typ);
    });
  },
);

describe(
  'US-028 AC-16 the fallback with the real compiler',
  // SCAR-030: 0.47 s under a full integration run (2026-11-03)
  {timeout: 60_000},
  () => {
    it('US-028 AC-16: with the limit 2, seed 3 falls back: the note at 100 is written, settles, and IMAGE_FIT_OFF is reported', async () => {
      const run = await exportBook(generatedNote(3, 60), fit(70), {
        fitCompileLimit: 2,
      });
      expect(run.compiles).toBe(3);
      expect(run.typ).not.toContain('fit-flow');
      expect(run.report).toContain('IMAGE_FIT_OFF');
      expect(run.report).not.toContain('LAYOUT_NOT_SETTLED');
      expect((await worldFacts(run.typ, run.files)).settled).toBe(true);
      expect(run.pages.map((p) => p.text).join(' ')).toContain('End 1');
    });
  },
);

describe(
  'US-028 AC-18 the settings ranges (SCAR-019)',
  // SCAR-030: 0.12 to 0.47 s per case under a full integration run (2026-11-03)
  {timeout: 60_000},
  () => {
    for (const minScale of [10, 50, 70, 99]) {
      for (const facingPages of [true, false]) {
        for (const breaks of [{}, {breakBefore: {h1: 'right'}}]) {
          it(`US-028 AC-18: minScale ${minScale}, facing ${facingPages}, ${JSON.stringify(breaks)}: the written .typ settles alone; IMAGE_FIT_OFF exactly when it has no fit-flow`, async () => {
            const run = await exportBook(generatedNote(2, 20), {
              facingPages,
              ...fit(minScale, breaks),
            });
            expect(run.compiles).toBeLessThanOrEqual(9);
            const facts = await worldFacts(run.typ, run.files);
            expect(facts.settled).toBe(true);
            const fellBack = !run.typ.includes('#fit-flow(');
            expect(run.report.includes('IMAGE_FIT_OFF')).toBe(fellBack);
            if (!fellBack) expect(atFixedPoint(facts.decisions)).toBe(true);
          });
        }
      }
    }
  },
);
