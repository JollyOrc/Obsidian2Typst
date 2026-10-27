// US-006 — notices, strict mode and side effects (plugin layer, fake notice
// sink and fake file systems). The pure texts are tested in
// tests/unit/us-006-warnings.test.ts.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {Warning} from '../../src/core/emit';
import {buildReport} from '../../src/core/report';
import {
  DEFAULT_WARNING_SETTINGS,
  finishExport,
  gotoTarget,
  handleGoto,
  type ExportHost,
  type WarningSettings,
} from '../../src/plugin/warning-flow';

const w = (code: string, message: string, line: number): Warning => ({
  code,
  message,
  line,
});
const SOURCE = {path: 'Sample/compiledtext.md', inVault: true};
const TWO = [
  w('LINK_UNRESOLVED', 'No heading matches "[[Nowhere]]"', 412),
  w('ASSET_MISSING', 'Image file not found: assets/crypt.png', 977),
];

/** A notice sink and two file systems in memory, with a log of every call. */
class FakeHost implements ExportHost {
  readonly notices: string[] = [];
  readonly exportFiles = new Map<string, string>();
  readonly vaultFiles = new Map<string, string>();
  readonly log: string[] = [];
  notice(text: string): void {
    this.notices.push(text);
    this.log.push(`notice`);
  }
  async writeExportFile(path: string, text: string): Promise<void> {
    this.exportFiles.set(path, text);
    this.log.push(`export:${path}`);
  }
  async writeVaultFile(path: string, text: string): Promise<void> {
    this.vaultFiles.set(path, text);
    this.log.push(`vault:${path}`);
  }
}

/** Runs the flow with a recording `writeOutput`. */
async function run(
  warnings: readonly Warning[],
  settings: WarningSettings = DEFAULT_WARNING_SETTINGS,
  host = new FakeHost(),
  source = SOURCE,
) {
  const outputs: string[] = [];
  const result = await finishExport({
    warnings,
    source,
    exportDir: 'Export/run1',
    settings,
    host,
    writeOutput: async () => {
      outputs.push('output');
      host.log.push('output');
    },
  });
  return {host, outputs, result};
}
const strict: WarningSettings = {...DEFAULT_WARNING_SETTINGS, strictMode: true};

describe('US-006 AC-4 strict mode', () => {
  it('US-006 AC-4: has strict mode off on a fresh install', () => {
    expect(DEFAULT_WARNING_SETTINGS).toEqual({
      strictMode: false,
      warningsNoteFolder: '',
    });
  });

  it('US-006 AC-4: exports with warnings when strict mode is off', async () => {
    const {outputs, result, host} = await run(TWO);
    expect(outputs).toEqual(['output']);
    expect(result).toEqual({aborted: false});
    expect(host.exportFiles.size).toBe(1);
  });

  it('US-006 AC-4: aborts before writing any file when strict mode is on and there is a warning; export folder unchanged', async () => {
    const host = new FakeHost();
    host.exportFiles.set('Export/run1/old.typ', 'old');
    host.exportFiles.set('Export/run1/export-warnings.md', 'stale');
    host.vaultFiles.set('compiledtext export warnings.md', 'stale note');
    const before = [new Map(host.exportFiles), new Map(host.vaultFiles)];
    const {outputs, result} = await run(TWO, strict, host);
    expect(result).toEqual({aborted: true});
    expect(outputs).toEqual([]);
    expect(host.log).toEqual(['notice']);
    expect(host.exportFiles).toEqual(before[0]);
    expect(host.vaultFiles).toEqual(before[1]);
  });

  it("US-006 AC-4: shows 'Export aborted: 2 warnings (strict mode)' with the first five warnings as 'line 412: LINK_UNRESOLVED'", async () => {
    const {host} = await run(TWO, strict);
    expect(host.notices).toEqual([
      'Export aborted: 2 warnings (strict mode)\nline 412: LINK_UNRESOLVED\nline 977: ASSET_MISSING',
    ]);
  });

  it('US-006 AC-4: has no per-code exceptions in strict mode', async () => {
    const table = readFileSync('docs/technical/warning-codes.md', 'utf8');
    const codes = [...table.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(20);
    for (const code of codes) {
      const {outputs, result} = await run([w(code, 'm', 3)], strict);
      expect(result, code).toEqual({aborted: true});
      expect(outputs, code).toEqual([]);
    }
  });

  it('US-006 AC-4: lets an export without warnings through in strict mode', async () => {
    const {outputs, result} = await run([], strict);
    expect(outputs).toEqual(['output']);
    expect(result).toEqual({aborted: false});
  });
});

describe('US-006 AC-2 / AC-2b / AC-3 what a finished export writes', () => {
  it('US-006 AC-2: writes export-warnings.md into the export folder, after the output', async () => {
    const {host} = await run(TWO);
    expect(host.exportFiles.get('Export/run1/export-warnings.md')).toBe(
      buildReport(TWO),
    );
    expect(host.log.slice(0, 2)).toEqual([
      'output',
      'export:Export/run1/export-warnings.md',
    ]);
  });

  it('US-006 AC-2: accepts an export folder that ends with a slash', async () => {
    const host = new FakeHost();
    await finishExport({
      warnings: TWO,
      source: SOURCE,
      exportDir: 'Export/run1/',
      settings: DEFAULT_WARNING_SETTINGS,
      host,
      writeOutput: async () => {},
    });
    expect([...host.exportFiles.keys()]).toEqual([
      'Export/run1/export-warnings.md',
    ]);
  });

  it('US-006 AC-2: overwrites a stale report with No warnings. when there are none', async () => {
    const host = new FakeHost();
    host.exportFiles.set('Export/run1/export-warnings.md', 'stale');
    await run([], DEFAULT_WARNING_SETTINGS, host);
    expect(host.exportFiles.get('Export/run1/export-warnings.md')).toBe(
      '# Export warnings\n\nNo warnings.\n',
    );
  });

  it("US-006 AC-2b: writes the vault note into the configured 'Warnings note folder' (default: vault root)", async () => {
    const root = (await run(TWO)).host;
    expect([...root.vaultFiles.keys()]).toEqual([
      'compiledtext export warnings.md',
    ]);
    const folder = (
      await run(TWO, {
        ...DEFAULT_WARNING_SETTINGS,
        warningsNoteFolder: 'Reports',
      })
    ).host;
    expect([...folder.vaultFiles.keys()]).toEqual([
      'Reports/compiledtext export warnings.md',
    ]);
  });

  it('US-006 AC-2b: writes the vault note with clickable lines, overwriting an old one', async () => {
    const host = new FakeHost();
    host.vaultFiles.set('compiledtext export warnings.md', 'stale');
    await run(TWO, DEFAULT_WARNING_SETTINGS, host);
    expect(host.vaultFiles.get('compiledtext export warnings.md')).toBe(
      buildReport(TWO, {linkFile: SOURCE.path}),
    );
    expect(host.vaultFiles.get('compiledtext export warnings.md')).toContain(
      '[412](obsidian://obsidian2typst-goto?file=Sample%2Fcompiledtext.md&line=412)',
    );
  });

  it('US-006 AC-2b: shows plain numbers when the source file is outside the vault', async () => {
    const {host} = await run(TWO, DEFAULT_WARNING_SETTINGS, new FakeHost(), {
      path: '/Users/me/books/compiledtext.md',
      inVault: false,
    });
    const note = host.vaultFiles.get('compiledtext export warnings.md');
    expect(note).toBe(buildReport(TWO, {linkFile: null}));
    expect(note).not.toContain('obsidian2typst-goto');
  });

  it("US-006 AC-2b: overwrites the vault note with 'No warnings.' when there are none", async () => {
    const host = new FakeHost();
    host.vaultFiles.set('compiledtext export warnings.md', 'stale');
    await run([], DEFAULT_WARNING_SETTINGS, host);
    expect(host.vaultFiles.get('compiledtext export warnings.md')).toBe(
      '# Export warnings\n\nNo warnings.\n',
    );
  });

  it('US-006 AC-2b: does not write the vault note in a strict-mode abort', async () => {
    const {host} = await run(TWO, strict);
    expect(host.vaultFiles.size).toBe(0);
    expect(host.exportFiles.size).toBe(0);
  });

  it("US-006 AC-3: shows 'Exported with 2 warnings' and, for one warning, '1 warning', with the report path", async () => {
    expect((await run(TWO)).host.notices).toEqual([
      'Exported with 2 warnings. Report: Export/run1/export-warnings.md',
    ]);
    expect((await run([TWO[0]!])).host.notices).toEqual([
      'Exported with 1 warning. Report: Export/run1/export-warnings.md',
    ]);
  });

  it('US-006 AC-3: shows no notice without warnings, and shows it last', async () => {
    expect((await run([])).host.notices).toEqual([]);
    const {host} = await run(TWO);
    expect(host.log).toEqual([
      'output',
      'export:Export/run1/export-warnings.md',
      'vault:compiledtext export warnings.md',
      'notice',
    ]);
  });
});

describe('US-006 AC-7 the source is never written', () => {
  const hash = (text: string) =>
    createHash('sha256').update(text).digest('hex');

  it('US-006 AC-7: leaves the source note, its folder and all source assets byte-identical (hash check)', async () => {
    const source = new Map([
      ['Sample/compiledtext.md', '# Rules\n\ntext\n'],
      ['Sample/assets/crypt.png', 'png bytes'],
      ['Sample/other.md', 'other'],
    ]);
    const before = new Map([...source].map(([p, t]) => [p, hash(t)]));
    // A host whose file systems are the vault itself: every write is recorded
    // against the source, so a write to a source path would change its hash.
    const host = new FakeHost();
    host.writeVaultFile = async (path, text) => {
      source.set(path, text);
    };
    host.writeExportFile = async (path, text) => {
      source.set(path, text);
    };
    await run(TWO, DEFAULT_WARNING_SETTINGS, host);
    for (const [path, digest] of before) {
      expect(hash(source.get(path) ?? ''), path).toBe(digest);
    }
    expect([...source.keys()].filter((p) => !before.has(p)).sort()).toEqual([
      'Export/run1/export-warnings.md',
      'compiledtext export warnings.md',
    ]);
  });

  it('US-006 AC-7: writes only below the export folder and the warnings note folder', async () => {
    const {host} = await run(TWO, {
      ...DEFAULT_WARNING_SETTINGS,
      warningsNoteFolder: 'Reports',
    });
    expect(
      [...host.exportFiles.keys()].every((p) => p.startsWith('Export/run1/')),
    ).toBe(true);
    expect(
      [...host.vaultFiles.keys()].every((p) => p.startsWith('Reports/')),
    ).toBe(true);
  });
});

describe('US-006 AC-2b the obsidian2typst-goto handler', () => {
  it('US-006 AC-2b: reads file and line from the link', () => {
    expect(gotoTarget({file: 'Sample/compiledtext.md', line: '412'})).toEqual({
      file: 'Sample/compiledtext.md',
      line: 412,
    });
  });

  it('US-006 AC-2b: opens the note at line 1 when the line is missing or not a whole number of at least 1', () => {
    for (const line of [undefined, '', '0', '-3', 'abc', '4.5', '1e3', ' 7']) {
      expect(gotoTarget({file: 'a.md', line}), String(line)).toEqual({
        file: 'a.md',
        line: 1,
      });
    }
  });

  it('US-006 AC-2b: does nothing when the file is missing or empty', () => {
    expect(gotoTarget({line: '4'})).toBeNull();
    expect(gotoTarget({file: '', line: '4'})).toBeNull();
    const opened: [string, number][] = [];
    handleGoto({line: '4'}, (file, line) => opened.push([file, line]));
    expect(opened).toEqual([]);
  });

  it('US-006 AC-2b: opens the note at the line of the report link, whatever the file name', () => {
    const opened: [string, number][] = [];
    for (const file of ['Sample/compiledtext.md', 'ü & x=1/a b#c.md']) {
      const url = new URL(
        `obsidian://obsidian2typst-goto?file=${encodeURIComponent(file)}&line=412`,
      );
      handleGoto(Object.fromEntries(url.searchParams), (f, l) =>
        opened.push([f, l]),
      );
    }
    expect(opened).toEqual([
      ['Sample/compiledtext.md', 412],
      ['ü & x=1/a b#c.md', 412],
    ]);
  });
});

describe('US-006 AC-9 the report builder and the flow stay free of the host', () => {
  const imports = (path: string): string[] =>
    [...readFileSync(path, 'utf8').matchAll(/from '([^']+)'/g)].map(
      (m) => m[1]!,
    );

  it('US-006 AC-9: core/report imports only the warning type of core/emit', () => {
    expect(imports('src/core/report/index.ts')).toEqual(['../emit']);
  });

  it('US-006 AC-9: the flow imports no Obsidian or Node module', () => {
    for (const module of imports('src/plugin/warning-flow.ts')) {
      expect(module, module).toMatch(/^\.\.?\//);
    }
  });
});
