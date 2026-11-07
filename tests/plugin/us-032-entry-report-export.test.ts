// US-032 AC-10, US-033 AC-13 — the entries' layout warnings reach the export and the
// worker reads the facts they come from: the export adds
// `entryLayoutWarnings` of the compile's `<o2t-entry>` / `<o2t-entry-end>`
// facts to its report, with the preset's `entries.emptyWarn`; the worker
// queries both labels when the document places entries.
// Source of truth: docs/user-stories/US-032-entry-fit-overflow-and-auto-layout.md.
// Added at G4 of #128 (2026-11-06): the plugin wiring had no G2 test.
import {describe, expect, it} from 'vitest';
import type {CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {readLayoutFacts} from '../../src/plugin/compiler/worker-core';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';

class FakeHost implements RunExportHost {
  readonly text = new Map<string, string>();
  notice(): void {}
  async writeExportFile(path: string, text: string): Promise<void> {
    this.text.set(path, text);
  }
  async writeExportBytes(): Promise<void> {}
  async writeVaultFile(): Promise<void> {}
}

const PLACES = [
  {
    heading: 'Marsh Owl',
    layout: 'page-landscape',
    size: 'page',
    page: 4,
    line: 12,
    auto: true,
  },
  {
    heading: 'Dragonet',
    layout: 'spread-text',
    size: 'spread',
    page: 6,
    line: 30,
  },
];
const ENDS = [
  {heading: 'Marsh Owl', page: 5, overflowLines: 3},
  {heading: 'Dragonet', page: 7, overflowLines: 0, rightEmpty: 85},
];

function exportWith(more: Record<string, unknown>) {
  const host = new FakeHost();
  const compiler: TypstCompiler = {
    fontInfo: () => Promise.resolve([]),
    compile: async (): Promise<CompileResult> =>
      ({
        ok: true,
        pdf: new Uint8Array([37, 80, 68, 70]),
        settled: true,
        entryPlaces: PLACES,
        entryEnds: ENDS,
        entrySections: [{section: 'Horrors', page: 9, introEnd: 10}],
      }) as CompileResult,
    dispose: () => undefined,
  };
  const options = {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: 'Body.\n',
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
  return {host, run: () => runExport(options)};
}
const report = (host: FakeHost) =>
  host.text.get('/out/run1/export-warnings.md') ?? '';

describe('US-032 AC-10 the export reports the entry facts', () => {
  it('US-032 AC-10: auto, overflow and the empty right page reach the report, at their lines', async () => {
    const {host, run} = exportWith({entryEmptyWarn: 50});
    await run();
    const text = report(host);
    expect(text).toContain('ENTRY_AUTO');
    expect(text).toContain('"Marsh Owl": page-landscape');
    expect(text).toContain('"Marsh Owl": page-landscape, about 3 lines over');
    expect(text).toContain('right page 85 % empty');
    // US-033 AC-13 (G4 #129): the openers' warnings too.
    expect(text).toContain('SECTION_INTRO_OVERFLOW');
  });

  it('US-032 AC-9: entries.emptyWarn 0 (off) gives no ENTRY_SPREAD_EMPTY', async () => {
    const {host, run} = exportWith({entryEmptyWarn: 0});
    await run();
    expect(report(host)).not.toContain('ENTRY_SPREAD_EMPTY');
    expect(report(host)).toContain('ENTRY_OVERFLOW');
  });
});

describe('US-032 AC-10 the worker reads the entry facts', () => {
  it('US-032 AC-10: with entries it queries <o2t-entry> and <o2t-entry-end>; without, neither', async () => {
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
            return JSON.stringify(selector === '<o2t-entry>' ? PLACES : ENDS);
          },
        }),
    };
    const facts = await readLayoutFacts(compiler, '/main.typ', false, true);
    // US-036 AC-3 (#135): the sheet page's facts too.
    expect(asked).toEqual([
      '<o2t-entry>',
      '<o2t-entry-end>',
      '<o2t-section>',
      '<o2t-sheet>',
    ]);
    expect(facts.entryPlaces).toEqual(PLACES);
    expect(facts.entryEnds).toEqual(ENDS);
    asked.length = 0;
    const none = await readLayoutFacts(compiler, '/main.typ', false, false);
    expect(asked).toEqual([]);
    expect(none.entryPlaces).toBeUndefined();
  });
});
