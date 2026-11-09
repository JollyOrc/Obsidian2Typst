// US-037 AC-4 to AC-9 — the export run writes the book's PDF with the update
// when facing pages are on, and as compiled otherwise; the encounter sheet is
// always written as compiled; the kept compile of the image fit (and its
// fallback) is the one updated; the word-gap scan reads the written bytes; a
// PDF that cannot be updated is written as compiled with one
// PDF_PAGE_LAYOUT_FAILED, also in strict mode; the export command hands the
// effective `page.facingPages` to the run. Fake compiler and host; the
// compiled PDF is the story's AC-1 example (Typst's form).
// Source of truth: docs/user-stories/US-037-facing-pages-open-as-spreads.md.
import {describe, expect, it} from 'vitest';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import {FIT_HINT_LINES} from '../../src/core/emit';
import type {Warning} from '../../src/core/emit';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {
  exportCurrentNote,
  type ExportRequest,
} from '../../src/plugin/export-command';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {COMPOSED_NOTE, standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';
import {readPdfCatalog} from '../support/pdf-structure';
import {AC1_TYPST, AC1_UPDATE, bytes, text, typstPdf} from '../support/spreads';

const BOOK = bytes(AC1_TYPST);
const UPDATED = AC1_TYPST + AC1_UPDATE;
const SHEET = bytes(typstPdf('<<\n  /Type /Catalog\n  /Pages 1 0 R\n>>'));

class FakeHost implements RunExportHost {
  readonly text = new Map<string, string>();
  readonly bytes = new Map<string, Uint8Array>();
  notice(): void {}
  async writeExportFile(path: string, value: string): Promise<void> {
    this.text.set(path, value);
  }
  async writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    this.bytes.set(path, data);
  }
  async writeVaultFile(): Promise<void> {}
}

/** A fit decision record (US-028 AC-15) of image `n`. */
const dec = (n: number, d: string) => ({
  key: `o2t-fit-${n}`,
  d,
  r: 1,
  want: d,
  wr: 1,
});

const report = (host: FakeHost): string =>
  host.text.get('/out/run1/export-warnings.md') ?? '';

function exportWith(
  more: Partial<RunExportOptions>,
  compile: (request: CompileRequest) => CompileResult = (request) => ({
    ok: true,
    pdf: request.file.includes('Encounter Sheet') ? SHEET : BOOK,
  }),
) {
  const host = new FakeHost();
  const scanned: Uint8Array[] = [];
  const compiler: TypstCompiler = {
    fontInfo: () => Promise.resolve([]),
    compile: async (request) => compile(request),
    scanWordGaps: async (pdf) => {
      scanned.push(pdf);
      return [];
    },
    dispose: () => undefined,
  };
  const options: RunExportOptions = {
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
    minDpi: 0,
    ...more,
  };
  return {host, scanned, run: () => runExport(options)};
}

describe('US-037 AC-4 facing pages only', () => {
  it('US-037 AC-4: facingPages true — the book’s PDF is Typst’s bytes followed by the update', async () => {
    const {host, run} = exportWith({facingPages: true});
    expect((await run()).status).toBe('exported');
    const written = host.bytes.get('/out/run1/Rules.pdf');
    expect(text(written ?? new Uint8Array())).toBe(UPDATED);
    expect(readPdfCatalog(written ?? new Uint8Array()).pageLayout).toBe(
      'TwoPageRight',
    );
    expect(report(host)).not.toContain('PDF_PAGE_LAYOUT_FAILED');
  });

  it('US-037 AC-4: facingPages false — the compiled bytes, byte for byte', async () => {
    const {host, run} = exportWith({facingPages: false});
    await run();
    expect(host.bytes.get('/out/run1/Rules.pdf')).toBe(BOOK);
  });

  it('US-037 AC-4: facingPages absent (a caller without the setting) — as compiled', async () => {
    const {host, run} = exportWith({});
    await run();
    expect(host.bytes.get('/out/run1/Rules.pdf')).toBe(BOOK);
  });
});

describe('US-037 AC-5 the encounter sheet', () => {
  it('US-037 AC-5: with facing pages on, the A4 sheet is written as compiled and the book updated', async () => {
    const {host, run} = exportWith({
      facingPages: true,
      sheetTyp: '#o2t-sheet((look: (:)), form: "A4")\n',
    });
    await run();
    expect(host.bytes.get('/out/run1/Rules - Encounter Sheet.pdf')).toBe(SHEET);
    expect(
      text(host.bytes.get('/out/run1/Rules.pdf') ?? new Uint8Array()),
    ).toBe(UPDATED);
  });
});

describe('US-037 AC-6 composed exports', () => {
  it('US-037 AC-6: after the image fit’s compiles, the kept compile’s PDF is the one updated, once', async () => {
    // Three compiles: two that do not settle, a third that settles; each
    // gives a PDF of its own (the catalog names the compile).
    let n = 0;
    const pdfs: Uint8Array[] = [];
    const {host, run} = exportWith(
      {facingPages: true, typ: `${FIT_HINT_LINES}Body.\n`},
      () => {
        n++;
        const pdf = bytes(
          typstPdf(`<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /Lang (c${n})\n>>`),
        );
        pdfs.push(pdf);
        const d = ['float', 'move', 'move'][n - 1] ?? 'move';
        return {ok: true, pdf, settled: n >= 3, fitDecisions: [dec(1, d)]};
      },
    );
    await run();
    expect(pdfs).toHaveLength(3);
    const written = host.bytes.get('/out/run1/Rules.pdf') ?? new Uint8Array();
    const kept = text(pdfs[pdfs.length - 1] ?? new Uint8Array());
    expect(text(written).startsWith(kept)).toBe(true);
    expect(text(written).match(/\/PageLayout/g)).toHaveLength(1);
  });

  it('US-037 AC-6: the fallback at 100 is the PDF updated', async () => {
    const fallbackPdf = bytes(
      typstPdf('<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /Lang (fallback)\n>>'),
    );
    const {host, run} = exportWith(
      {
        facingPages: true,
        typ: `${FIT_HINT_LINES}Body.\n`,
        fitCompileLimit: 1,
        fallback: async () => ({typ: 'At 100.\n'}),
      },
      (request) =>
        request.source === 'At 100.\n'
          ? {ok: true, pdf: fallbackPdf}
          : {
              ok: true,
              pdf: BOOK,
              settled: false,
              fitDecisions: [dec(1, 'float')],
            },
    );
    await run();
    const written = text(
      host.bytes.get('/out/run1/Rules.pdf') ?? new Uint8Array(),
    );
    expect(written.startsWith(text(fallbackPdf))).toBe(true);
    expect(written).toContain('/PageLayout /TwoPageRight');
  });

  it('US-037 AC-6, AC-9: strict mode — a PDF that cannot be updated does not stop the export', async () => {
    const {host, run} = exportWith(
      {
        facingPages: true,
        settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
      },
      () => ({ok: true, pdf: bytes('%PDF-1.7\nnot Typst\n')}),
    );
    expect((await run()).status).toBe('exported');
    expect(host.bytes.has('/out/run1/Rules.pdf')).toBe(true);
  });
});

describe('US-037 AC-8 the word-gap scan reads what is written', () => {
  it('US-037 AC-8: with facing pages on, the scan gets the written (updated) bytes', async () => {
    const {host, scanned, run} = exportWith({
      facingPages: true,
      maxWordGap: 200,
    });
    await run();
    expect(scanned).toHaveLength(1);
    expect(scanned[0]).toBe(host.bytes.get('/out/run1/Rules.pdf'));
    expect(text(scanned[0] ?? new Uint8Array())).toBe(UPDATED);
  });

  it('US-037 AC-8: with facing pages off, the scan gets the compiled bytes', async () => {
    const {scanned, run} = exportWith({facingPages: false, maxWordGap: 200});
    await run();
    expect(scanned[0]).toBe(BOOK);
  });
});

describe('US-037 AC-9 when the update cannot be made', () => {
  it('US-037 AC-9: the PDF as compiled and exactly one PDF_PAGE_LAYOUT_FAILED with its reason in the report', async () => {
    const odd = bytes(AC1_TYPST.replace('startxref\n178', 'startxref\n75'));
    const {host, run} = exportWith({facingPages: true}, () => ({
      ok: true,
      pdf: odd,
    }));
    expect((await run()).status).toBe('exported');
    expect(host.bytes.get('/out/run1/Rules.pdf')).toBe(odd);
    const log = report(host);
    // Once: the summary row counts 1 and one detail row follows (US-006 AC-8).
    expect(log).toContain('| PDF_PAGE_LAYOUT_FAILED | 1 |');
    expect(log.match(/\| PDF_PAGE_LAYOUT_FAILED \| The PDF/g)).toHaveLength(1);
    expect(log).toContain(
      '| PDF_PAGE_LAYOUT_FAILED | The PDF could not be set to open as spreads (no xref table); it is written as compiled |',
    );
  });

  it('US-037 AC-10: a catalog that already has /PageLayout is written as compiled, without a warning', async () => {
    const set = bytes(
      typstPdf(
        '<<\n  /PageLayout /OneColumn\n  /Type /Catalog\n  /Pages 1 0 R\n>>',
      ),
    );
    const {host, run} = exportWith({facingPages: true}, () => ({
      ok: true,
      pdf: set,
    }));
    await run();
    expect(host.bytes.get('/out/run1/Rules.pdf')).toBe(set);
    expect(report(host)).not.toContain('PDF_PAGE_LAYOUT_FAILED');
  });
});

describe('US-037 AC-4 the export command hands over page.facingPages', () => {
  const FOLDER = 'Obsidian2Typst/presets';
  const NOTE = 'Sample/Rules.md';

  async function requestFor(
    presets: Record<string, string>,
    active: string,
    defaults: PluginData['defaults'] = {},
  ): Promise<ExportRequest> {
    const vault = new FakeVault(presets, [FOLDER]);
    const data = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)) as PluginData;
    data.activePreset = active;
    data.defaults = defaults;
    const store = createPresetStore({
      vault,
      folder: () => data.presetsFolder,
      defaults: () => data.defaults,
      notify: () => undefined,
    });
    await store.load();
    const requests: ExportRequest[] = [];
    const files = [NOTE, 'Sample/assets/map.png', 'Sample/assets/other.png'];
    await exportCurrentNote({
      notes: {activePath: () => NOTE, read: async () => COMPOSED_NOTE},
      vault: {
        files: () => files,
        readHead: async (path, length = 16) =>
          standIn(path).subarray(0, length),
        readBytes: async (path) => standIn(path),
        readText: async () => null,
      },
      presets: store,
      settings: {
        get data() {
          return data;
        },
        setLastExportFolder: async () => undefined,
      },
      chooseFolder: async () => '/out',
      run: async (request) => {
        requests.push(request);
        return {status: 'exported'};
      },
      notice: () => undefined,
    });
    const request = requests[0];
    if (request === undefined) throw new Error('no export was started');
    return request;
  }

  it('US-037 AC-4: built-in A5 print → true, A4 digital → false', async () => {
    const presets = {
      [`${FOLDER}/A5 print.md`]: BUILTIN_PRESET_TEXTS['A5 print'],
      [`${FOLDER}/A4 digital.md`]: BUILTIN_PRESET_TEXTS['A4 digital'],
    };
    expect((await requestFor(presets, 'A5 print')).facingPages).toBe(true);
    expect((await requestFor(presets, 'A4 digital')).facingPages).toBe(false);
  });

  it('US-037 AC-4 (SCAR-019): a preset that turns it on over Defaults that have it off, and one without the field that follows the Defaults', async () => {
    const presets = {
      [`${FOLDER}/On.md`]:
        '---\nschemaVersion: 1\npage:\n  facingPages: true\n---\n',
      [`${FOLDER}/Plain.md`]: '---\nschemaVersion: 1\n---\n',
    };
    const off = {page: {facingPages: false}} as PluginData['defaults'];
    expect((await requestFor(presets, 'On', off)).facingPages).toBe(true);
    expect((await requestFor(presets, 'Plain', off)).facingPages).toBe(false);
    expect((await requestFor(presets, 'Plain')).facingPages).toBe(true);
  });

  it('US-037 AC-4: a preset that turns it off over Defaults that have it on', async () => {
    const presets = {
      [`${FOLDER}/Off.md`]:
        '---\nschemaVersion: 1\npage:\n  facingPages: false\n---\n',
    };
    const on = {page: {facingPages: true}} as PluginData['defaults'];
    expect((await requestFor(presets, 'Off', on)).facingPages).toBe(false);
  });
});
