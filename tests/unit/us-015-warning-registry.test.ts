// US-015 AC-7 — the registry of warning codes: docs/technical/warning-codes.md
// and the codes that src/core can produce are compared by a test.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

interface Row {
  code: string;
  story: string;
  status: string;
}

/** The rows of the table of warning-codes.md. */
function listed(): Row[] {
  const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const match = /^`([A-Z_]+)`$/.exec(cells[1] ?? '');
    if (match === null) continue;
    rows.push({
      code: match[1] as string,
      story: cells[2] ?? '',
      status: cells[4] ?? '',
    });
  }
  return rows;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });
}

/** Every string literal in src/core that looks like a warning code. */
function used(): Set<string> {
  const codes = new Set<string>();
  for (const file of sources('src/core')) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/'([A-Z]{2,}(?:_[A-Z]+)+)'/g)) {
      codes.add(m[1] as string);
    }
  }
  return codes;
}

describe('US-015 AC-7 the registry of warning codes', () => {
  const rows = listed();

  it('US-015 AC-7: the file lists each code once, with a story and a status active or reserved', () => {
    expect(rows.length).toBeGreaterThanOrEqual(25);
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.story, row.code).toMatch(/US-\d{3}/);
      expect(['active', 'reserved'], row.code).toContain(row.status);
    }
  });

  it('US-015 AC-7: every code that src/core uses is listed', () => {
    const known = new Set(rows.map((r) => r.code));
    const unknown = [...used()].filter((code) => !known.has(code));
    expect(unknown).toEqual([]);
  });

  it('US-015 AC-7: every active code is used by src/core', () => {
    const inCode = used();
    const unused = rows
      .filter((r) => r.status === 'active' && !inCode.has(r.code))
      .map((r) => r.code);
    expect(unused).toEqual([]);
  });

  it('US-015 AC-7: a reserved code is not used yet; the story that uses it flips it to active', () => {
    const inCode = used();
    const early = rows
      .filter((r) => r.status === 'reserved' && inCode.has(r.code))
      .map((r) => r.code);
    expect(early).toEqual([]);
  });

  it('US-015 AC-7: the codes of stories that are not built yet are reserved', () => {
    const reserved = rows
      .filter((r) => r.status === 'reserved')
      .map((r) => r.code)
      .sort();
    expect(reserved).toEqual([]);
  });
});
