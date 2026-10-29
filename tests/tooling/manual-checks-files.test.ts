// SCAR-029 — every manual check is a file of its own and the index links each
// file once: the index rows and the files match one to one, in number order,
// and each file starts with its own heading and links back to the index. The
// reader of tests/support/manual-checks.ts is tested on known inputs first
// (SCAR-028).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  CHECKS_DIR,
  checkFile,
  checkFiles,
  indexRows,
} from '../support/manual-checks';

describe('SCAR-029 the reader of the manual checks', () => {
  it('SCAR-029: an id maps to a two-digit file name', () => {
    expect(checkFile('M1')).toBe('M01.md');
    expect(checkFile('M9')).toBe('M09.md');
    expect(checkFile('M16')).toBe('M16.md');
    expect(checkFile('M100')).toBe('M100.md');
    expect(() => checkFile('m1')).toThrow(/not a check id/);
    expect(() => checkFile('M')).toThrow(/not a check id/);
  });

  it('SCAR-029: the index reader takes table rows only, in their order', () => {
    const index = [
      '# Manual checks',
      '',
      'See [M3](manual-checks/M03.md) in a sentence.',
      '| Check | Title | Covers |',
      '|-------|-------|--------|',
      '| [M2](manual-checks/M02.md) | Two | US-1 |',
      '| [M10](manual-checks/M10.md) | Ten | US-2 |',
      '| M11 | not a link | |',
    ].join('\n');
    expect(indexRows(index)).toEqual([
      {id: 'M2', file: 'M02.md'},
      {id: 'M10', file: 'M10.md'},
    ]);
  });
});

describe('SCAR-029 one file per manual check', () => {
  const rows = indexRows();
  const files = checkFiles();

  it('SCAR-029: the index has a row for each file and a file for each row, in number order', () => {
    expect(rows.length).toBeGreaterThanOrEqual(16);
    expect(rows.map((r) => r.file)).toEqual(files);
    expect(rows.map((r) => checkFile(r.id))).toEqual(files);
    const numbers = rows.map((r) => Number(r.id.slice(1)));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it('SCAR-029: each file starts with the heading of its check and links back to the index', () => {
    for (const {id, file} of rows) {
      const text = readFileSync(join(CHECKS_DIR, file), 'utf8');
      expect(text.startsWith(`# ${id} — `), file).toBe(true);
      expect(text, file).toContain('](../manual-checks.md)');
      expect(text.match(/^# /gm), file).toHaveLength(1);
    }
  });
});
