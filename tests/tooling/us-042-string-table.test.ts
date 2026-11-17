// US-042 AC-14 — one string table: no file of `src/plugin` but `strings.ts` passes
// a string literal (quoted or a template) to `setName`, `setDesc`,
// `setButtonText`, `setTooltip`, `setText`, `new Notice` or a `notice(` call. A
// text check over the sources (SCAR-017: every place listed by the check itself).
// Source of truth: docs/user-stories/US-042-ui-standard.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const ROOT = 'src/plugin';
const TABLE = join(ROOT, 'strings.ts');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** A call of a text sink whose first argument starts with a literal. */
const SINK =
  /(?:\.(?:setName|setDesc|setButtonText|setTooltip|setText)|new Notice|\bnotice)\(\s*['"`]/g;

/** `file:line: the call` for each literal handed to a sink. */
function findings(path: string, text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(SINK)) {
    const line = text.slice(0, match.index).split('\n').length;
    const shown = text
      .slice(match.index, (match.index ?? 0) + 60)
      .split('\n')[0];
    out.push(`${path}:${line}: ${shown}`);
  }
  return out;
}

describe('US-042 AC-14: one string table', () => {
  it('the table exists', () => {
    expect(() => statSync(TABLE)).not.toThrow();
  });

  it('no literal reaches a text sink outside strings.ts', () => {
    const found = files(ROOT)
      .filter((path) => path !== TABLE)
      .flatMap((path) => findings(path, readFileSync(path, 'utf8')));
    expect(found).toEqual([]);
  });

  // The check checks itself (SCAR-023): it finds each kind of sink, in each quote.
  it.each([
    [".setName('Export')"],
    ['.setDesc("Text")'],
    ['.setButtonText(`Reset`)'],
    [".setTooltip('Copy debug info')"],
    [".setText('Exported')"],
    ["new Notice('Debug info copied.')"],
    ['deps.notice(`❌ Export failed: ${m}`)'],
    ["host.notice(\n  'An export is already running.')"],
  ])('finds %s', (call) => {
    expect(findings('x.ts', call)).toHaveLength(1);
  });

  it.each([
    ['.setName(STRINGS.export)'],
    ['.setDesc(text.desc)'],
    ['new Notice(message)'],
    ['host.notice(failedNotice(error))'],
    ['announce(`x`)'],
  ])('does not find %s', (call) => {
    expect(findings('x.ts', call)).toEqual([]);
  });
});
