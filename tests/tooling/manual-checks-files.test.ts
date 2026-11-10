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
  expectedVersions,
  indexRows,
  runInPlaces,
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

// #158 C5 (SCAR-028): the sentence readers, on the forms the check files use
// (the bold phrase broken across a line, as in M3 and M6 to M27).
describe('#158 the readers of the Expected version and Run in sentences', () => {
  const real =
    '**Run in the scratch vault**\n(`spikes/typst-wasm/scratch-vault`). **Expected\nversion:** `0.14.0` (first line of the settings tab, also the plugin\nlist).';

  it('#158 C1: reads the version of the sentence when the phrase breaks across a line', () => {
    expect(expectedVersions(real)).toEqual(['0.14.0']);
  });

  it('#158 C1: reads the version on the next line after the phrase', () => {
    expect(expectedVersions('**Expected version:**\n`0.14.0-m28.1`.')).toEqual([
      '0.14.0-m28.1',
    ]);
  });

  it('#158 C1: reads the sentence, not a version elsewhere in the file', () => {
    expect(
      expectedVersions(
        '**Expected version:** `0.13.1` (first line).\n\nRecord: date, the build `0.14.0`, passed.',
      ),
    ).toEqual(['0.13.1']);
    expect(expectedVersions('Record: date, the build `0.14.0`.')).toEqual([]);
  });

  it('#158 C2: a sentence without a version gives null (the handover form)', () => {
    expect(
      expectedVersions(
        '**Expected version:** the one named in the handover; it is the first line of the settings tab.',
      ),
    ).toEqual([null]);
  });

  it('#158 C1: gives one entry per sentence', () => {
    expect(
      expectedVersions(
        '**Expected version:** `0.14.0`. Later: **Expected version:** `0.13.1`.',
      ),
    ).toEqual(['0.14.0', '0.13.1']);
  });

  it('#158 C3: reads the place of the Run in sentence, also across a line', () => {
    expect(runInPlaces(real)).toEqual(['the scratch vault']);
    expect(runInPlaces('**Run in the\nscratch vault** (`x`).')).toEqual([
      'the scratch vault',
    ]);
    expect(runInPlaces('**Run in the test vault**.')).toEqual([
      'the test vault',
    ]);
  });

  it('#158 C3: the place elsewhere in the text is not a Run in sentence', () => {
    expect(
      runInPlaces('the build is installed in the scratch vault (`npm run x`).'),
    ).toEqual([]);
  });

  it('#158 C1: a real check file with the version twice gives one sentence (M27)', () => {
    const m27 = readFileSync(join(CHECKS_DIR, 'M27.md'), 'utf8');
    expect(m27.match(/`\d+\.\d+\.\d+[^`]*`/g)?.length ?? 0).toBeGreaterThan(1);
    expect(expectedVersions(m27)).toHaveLength(1);
  });
});
