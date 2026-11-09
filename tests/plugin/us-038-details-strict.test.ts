// US-038 AC-12 — a DETAIL warning of a real conversion stops a strict export
// (the warnings reach `finishExport` as every conversion warning does) and is
// listed in the report of a normal one, at its source line.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {
  DEFAULT_WARNING_SETTINGS,
  finishExport,
  type ExportHost,
} from '../../src/plugin/warning-flow';
import {details, runDetails} from '../support/details';

function fakeHost() {
  const out = {
    notices: [] as string[],
    files: new Map<string, string>(),
    notice: (t: string) => void out.notices.push(t),
    writeExportFile: async (p: string, t: string) => void out.files.set(p, t),
    writeVaultFile: async (p: string, t: string) => void out.files.set(p, t),
  };
  return out satisfies ExportHost;
}

const SOURCE = details('### Reed Weaving', ['pace: soon', 'kind: [a, b]']);
const source = {path: 'Notes/Rules.md', inVault: true} as never;

describe('US-038 AC-12 strict mode', () => {
  it('US-038 AC-12: with DETAIL warnings in strict mode the export aborts, nothing is written, the notice counts them', async () => {
    const {warnings} = await runDetails(SOURCE);
    expect(warnings.filter((w) => w.code.startsWith('DETAIL_'))).toHaveLength(
      2,
    );
    const host = fakeHost();
    let written = 0;
    const result = await finishExport({
      warnings,
      source,
      exportDir: '/out',
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
      host,
      writeOutput: async () => void written++,
    });
    expect(result.aborted).toBe(true);
    expect(written).toBe(0);
    expect(host.files.size).toBe(0);
    expect(host.notices[0]).toMatch(
      /^Export aborted: 2 warnings \(strict mode\)/,
    );
  });

  it('US-038 AC-12: without strict mode the report lists each DETAIL warning at its line', async () => {
    const {warnings} = await runDetails(SOURCE);
    const host = fakeHost();
    const result = await finishExport({
      warnings,
      source,
      exportDir: '/out',
      settings: DEFAULT_WARNING_SETTINGS,
      host,
      writeOutput: async () => undefined,
    });
    expect(result.aborted).toBe(false);
    const report = host.files.get('/out/export-warnings.md') ?? '';
    expect(report).toContain('DETAIL_VALUE_UNMAPPED');
    expect(report).toContain('DETAIL_VALUE_NOT_TEXT');
    // the summary row counts the code too (US-006 AC-8); the detail row has the text
    expect(report.split('"Reed Weaving": pace: soon').length - 1).toBe(1);
    expect(report.split('"Reed Weaving": kind').length - 1).toBe(1);
  });
});
