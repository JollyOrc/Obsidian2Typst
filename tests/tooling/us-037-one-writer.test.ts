// US-037 AC-12 (SCAR-017) — one writer of `/PageLayout`: the name occurs in
// one file of `src` (`src/core/pdf/page-layout.ts`), and the export run is
// the only caller of `withTwoPageRight(`, once. The places checked are
// counted (SCAR-023): every `.ts` file below `src`.
// Source of truth: docs/user-stories/US-037-facing-pages-open-as-spreads.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

/** Every `.ts` file below `dir`, as paths from the project root, sorted. */
function sources(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return path.endsWith('.ts') ? [path] : [];
    })
    .sort();
}

describe('US-037 AC-12 one writer', () => {
  const files = sources('src');

  it('US-037 AC-12: the walk reads the whole source tree', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('src/plugin/run-export.ts');
    expect(files).toContain('src/core/pdf/reader.ts');
  });

  it('US-037 AC-12: `PageLayout` occurs only in src/core/pdf/page-layout.ts', () => {
    const hits = files.filter((f) =>
      readFileSync(f, 'utf8').includes('PageLayout'),
    );
    expect(hits).toEqual(['src/core/pdf/page-layout.ts']);
  });

  it('US-037 AC-12: `withTwoPageRight(` is defined in page-layout.ts and called once, in run-export.ts', () => {
    const calls = files.flatMap((f) =>
      (readFileSync(f, 'utf8').match(/\bwithTwoPageRight\(/g) ?? []).map(
        () => f,
      ),
    );
    expect(calls).toEqual([
      'src/core/pdf/page-layout.ts',
      'src/plugin/run-export.ts',
    ]);
    expect(readFileSync('src/core/pdf/page-layout.ts', 'utf8')).toMatch(
      /export function withTwoPageRight\(/,
    );
  });
});
