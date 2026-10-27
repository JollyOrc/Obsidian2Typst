// US-008 AC-9, AC-11 — the template copy in the export folder, on a real disk
// (temporary folders) with the real disk writer and a fake compiler. Source of
// truth: docs/user-stories/US-008-presets-and-settings.md.
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import type {Warning} from '../../src/core/emit';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {createDiskWriter} from '../../src/plugin/disk-writer';
import {
  createExportLock,
  runExport,
  type RunExportHost,
} from '../../src/plugin/run-export';
import {DEFAULT_WARNING_SETTINGS} from '../../src/plugin/warning-flow';

const PDF = new Uint8Array([37, 80, 68, 70]);
const TEMPLATE_V1 = '#let accent = rgb("#336699")\n';
const TEMPLATE_V2 = '#let accent = rgb("#993366")\n';

let root: string;
let vault: string;
let out: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'o2t-us008-'));
  vault = join(root, 'vault');
  out = join(root, 'export');
  writeFileSync(join(root, 'marker'), '');
});
afterEach(() => rmSync(root, {recursive: true, force: true}));

class DiskHost implements RunExportHost {
  readonly notices: string[] = [];
  readonly writer = createDiskWriter(out);
  notice(text: string): void {
    this.notices.push(text);
  }
  writeExportFile(path: string, text: string): Promise<void> {
    return this.writer.writeText(path, text);
  }
  writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    return this.writer.writeBytes(path, data);
  }
  readonly vault = new Map<string, string>();
  async writeVaultFile(path: string, text: string): Promise<void> {
    this.vault.set(path, text);
  }
}

class FakeCompiler implements TypstCompiler {
  fontInfo(): Promise<never[]> {
    return Promise.resolve([]);
  }
  readonly requests: CompileRequest[] = [];
  async compile(request: CompileRequest): Promise<CompileResult> {
    this.requests.push(request);
    return {ok: true, pdf: PDF};
  }
  dispose(): void {}
}

const exportWith = async (
  template: string | null,
  warnings: readonly Warning[] = [],
  compiler = new FakeCompiler(),
) =>
  runExport({
    noteName: 'Rules',
    source: {path: 'Rules.md', inVault: true},
    typ: '= Rules\n',
    warnings,
    uses: [],
    readAsset: async () => new Uint8Array(),
    template,
    exportDir: out,
    settings: DEFAULT_WARNING_SETTINGS,
    host: new DiskHost(),
    compiler,
    fonts: [],
    lock: createExportLock(),
  });

const names = (): string[] => readdirSync(out).sort();
const read = (name: string): string => readFileSync(join(out, name), 'utf8');

describe('US-008 AC-9 the template copy', () => {
  it('US-008 AC-9: copies the vault template to <export>/template.typ and overwrites the copy on each export', async () => {
    const compiler = new FakeCompiler();
    expect(await exportWith(TEMPLATE_V1, [], compiler)).toEqual({
      status: 'exported',
    });
    expect(read('template.typ')).toBe(TEMPLATE_V1);
    expect(Object.keys(compiler.requests[0]?.files ?? {})).toContain(
      'template.typ',
    );

    writeFileSync(join(out, 'template.typ'), '// edited by hand\n');
    await exportWith(TEMPLATE_V2, [], compiler);
    expect(read('template.typ')).toBe(TEMPLATE_V2);
    expect(names()).toEqual([
      'Rules.pdf',
      'Rules.typ',
      'export-warnings.md',
      'template.typ',
    ]);
  });

  it('US-008 AC-9: never modifies the vault copy of the template', async () => {
    const path = join(vault, 'Styles', 'template.typ');
    const dir = join(vault, 'Styles');
    const {mkdirSync, statSync} = await import('node:fs');
    mkdirSync(dir, {recursive: true});
    writeFileSync(path, TEMPLATE_V1);
    const before = statSync(path).mtimeMs;
    await exportWith(readFileSync(path, 'utf8'));
    await exportWith(readFileSync(path, 'utf8'));
    expect(readFileSync(path, 'utf8')).toBe(TEMPLATE_V1);
    expect(statSync(path).mtimeMs).toBe(before);
    expect(readdirSync(dir)).toEqual(['template.typ']);
  });

  it('US-008 AC-9: a template named like the note is not overwritten by the typ (the note is written as template-note)', async () => {
    const compiler = new FakeCompiler();
    await runExport({
      noteName: 'Template',
      source: {path: 'Template.md', inVault: true},
      typ: '= T\n',
      warnings: [],
      uses: [],
      readAsset: async () => new Uint8Array(),
      template: TEMPLATE_V1,
      exportDir: out,
      settings: DEFAULT_WARNING_SETTINGS,
      host: new DiskHost(),
      compiler,
      fonts: [],
      lock: createExportLock(),
    });
    expect(read('template.typ')).toBe(TEMPLATE_V1);
    expect(read('template-note.typ')).toBe('= T\n');
  });
});

describe('US-008 AC-11 a missing template', () => {
  const missing: Warning = {
    code: 'TEMPLATE_MISSING',
    message:
      'Template "Styles/template.typ" does not exist; the export continues without it',
    line: 0,
  };

  it('US-008 AC-11: writes no template.typ and lists TEMPLATE_MISSING in export-warnings.md', async () => {
    expect(await exportWith(null, [missing])).toEqual({status: 'exported'});
    expect(names()).toEqual(['Rules.pdf', 'Rules.typ', 'export-warnings.md']);
    const report = read('export-warnings.md');
    expect(report).toContain('TEMPLATE_MISSING');
    expect(report).toContain('Styles/template.typ');
  });

  it('US-008 AC-11: a template copy of an earlier export is left in place (nothing is deleted)', async () => {
    await exportWith(TEMPLATE_V1);
    await exportWith(null, [missing]);
    expect(read('template.typ')).toBe(TEMPLATE_V1);
  });
});
