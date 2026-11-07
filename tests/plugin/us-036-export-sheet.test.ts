// US-036 AC-5 — the export writes the A4 encounter sheet: with the sheet's
// source given (the conversion makes it when `entries.encounterSheetFile`
// is on), the run writes `<name> - Encounter Sheet.typ`, compiles it as a
// second compile after the book's with the same files and fonts, and writes
// `<name> - Encounter Sheet.pdf`; without it nothing more is written; a
// failing sheet compile gives ENCOUNTER_SHEET_FAILED and the book's files
// as usual; the sheet's small boxes reach the report; the preview path
// never compiles it; the conversion makes the source with its icons copied.
// Source of truth: docs/user-stories/US-036-encounter-sheet.md.
// G2 addendum written first in #136 (2026-11-07), before its code (SCAR-003).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';
import {SETTINGS, NOTE_PATH, run} from '../support/convert';
import {ENTRIES, entry} from '../support/entries';

const PDF = new Uint8Array([37, 80, 68, 70]);
const SHEET_PDF = new Uint8Array([37, 80, 68, 70, 50]);

class FakeHost implements RunExportHost {
  readonly text = new Map<string, string>();
  readonly bytes = new Map<string, Uint8Array>();
  notice(): void {}
  async writeExportFile(path: string, text: string): Promise<void> {
    this.text.set(path, text);
  }
  async writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    this.bytes.set(path, data);
  }
  async writeVaultFile(): Promise<void> {}
}

const SHEET_TYP = '#o2t-sheet((look: (:)), form: "A4")\n';

function exportWith(
  more: Record<string, unknown>,
  sheet: (request: CompileRequest) => CompileResult = () => ({
    ok: true,
    pdf: SHEET_PDF,
  }),
) {
  const host = new FakeHost();
  const requests: CompileRequest[] = [];
  const compiler: TypstCompiler = {
    fontInfo: () => Promise.resolve([]),
    compile: async (request) => {
      requests.push(request);
      return request.file.includes('Encounter Sheet')
        ? sheet(request)
        : {ok: true, pdf: PDF};
    },
    dispose: () => undefined,
  };
  const options = {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: 'Body.\n',
    warnings: [] as Warning[],
    uses: [{from: 'Icons/fine.svg', to: 'assets/fine.svg'}],
    readAsset: async () => new TextEncoder().encode('<svg/>'),
    template: null,
    exportDir: '/out/run1',
    settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    host,
    compiler,
    fonts: [new Uint8Array([1])],
    lock: createExportLock(),
    minDpi: 0,
    maxWordGap: 0,
    ...more,
  } as RunExportOptions;
  return {host, requests, run: () => runExport(options)};
}
const report = (host: FakeHost) =>
  host.text.get('/out/run1/export-warnings.md') ?? '';

describe('US-036 AC-5 the export writes the A4 sheet', () => {
  it('US-036 AC-5: with the source, the .typ and the .pdf next to the book’s, compiled after the book with the same files and fonts', async () => {
    const {host, requests, run} = exportWith({sheetTyp: SHEET_TYP});
    expect((await run()).status).toBe('exported');
    expect(host.text.get('/out/run1/Rules - Encounter Sheet.typ')).toBe(
      SHEET_TYP,
    );
    expect(host.bytes.get('/out/run1/Rules - Encounter Sheet.pdf')).toEqual(
      SHEET_PDF,
    );
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF);
    expect(requests.map((r) => r.file)).toEqual([
      'Rules.typ',
      'Rules - Encounter Sheet.typ',
    ]);
    expect(Object.keys(requests[1]?.files ?? {})).toEqual(
      Object.keys(requests[0]?.files ?? {}),
    );
    expect(requests[1]?.fonts).toEqual(requests[0]?.fonts);
  });

  it('US-036 AC-5: without the source no sheet is compiled or written', async () => {
    const {host, requests, run} = exportWith({});
    await run();
    expect(requests).toHaveLength(1);
    expect(
      [...host.text.keys(), ...host.bytes.keys()].filter((k) =>
        k.includes('Encounter Sheet'),
      ),
    ).toEqual([]);
  });

  it('US-036 AC-5: a failing sheet compile gives ENCOUNTER_SHEET_FAILED; the book is written; strict mode does not stop', async () => {
    const {host, run} = exportWith({sheetTyp: SHEET_TYP}, () => ({
      ok: false,
      kind: 'typst',
      error: 'error: unknown variable',
    }));
    expect((await run()).status).toBe('exported');
    expect(host.bytes.get('/out/run1/Rules.pdf')).toEqual(PDF);
    expect(host.bytes.has('/out/run1/Rules - Encounter Sheet.pdf')).toBe(false);
    expect(report(host)).toContain('ENCOUNTER_SHEET_FAILED');
  });

  it('US-036 AC-3, AC-5: the A4 sheet’s small boxes reach the report', async () => {
    const {host, run} = exportWith({sheetTyp: SHEET_TYP}, () => ({
      ok: true,
      pdf: SHEET_PDF,
      sheets: [{form: 'A4', rows: 16, columns: 2, boxMm: 1.8}],
    }));
    await run();
    expect(report(host)).toContain('"A4": 1.8 mm (min 2.0)');
  });

  it('US-036 AC-5: the preview never compiles the A4 sheet', () => {
    for (const file of [
      'src/plugin/preview/request.ts',
      'src/plugin/preview/controller.ts',
    ]) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/sheetTyp/);
    }
  });
});

describe('US-036 AC-5 the conversion makes the source', () => {
  const source = [
    '# Menagerie',
    '',
    entry('### Fen Hare', ['might: 4'], ['A lede that is long enough.']),
  ].join('\n');

  it('US-036 AC-5: encounterSheetFile on → the A4 source with the copied icons; off → none', async () => {
    // The vault holds the note and the five icons.
    const files = [NOTE_PATH, ...ENTRIES.statblock.track.map((c) => c.icon)];
    const convertWith = (entries: unknown) =>
      run(
        source,
        {
          settings: {
            ...SETTINGS,
            headingRules: {Menagerie: 'entries'},
            entries,
          } as never,
        },
        files,
      );
    const on = await convertWith({...ENTRIES, encounterSheetFile: true});
    const typ = (on as unknown as {sheetTyp?: string}).sheetTyp ?? '';
    expect(typ).toContain('form: "A4"');
    const icons = on.assets.filter((a) => a.from.startsWith('Icons/'));
    expect(icons.map((a) => a.from).sort()).toEqual([
      'Icons/down.svg',
      'Icons/fading.svg',
      'Icons/fine.svg',
      'Icons/gone.svg',
      'Icons/hurt.svg',
    ]);
    for (const a of icons) expect(typ).toContain(`"${a.to}"`);
    const off = await convertWith(ENTRIES);
    expect((off as unknown as {sheetTyp?: string}).sheetTyp).toBeUndefined();
  });
});
