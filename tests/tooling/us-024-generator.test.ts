// US-024 AC-1, AC-1b — the sample vault generator: deterministic, and the
// committed vault is what it writes.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {SAMPLE_DIR, listFiles, loadGenerator} from '../support/sample';

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, {recursive: true, force: true});
});
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'o2t-us024-'));
  temps.push(dir);
  return dir;
};

/** SHA-256 of every file below `dir`, by relative path. */
function checksums(dir: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(dir).map((f) => [
      f,
      createHash('sha256')
        .update(readFileSync(join(dir, f)))
        .digest('hex'),
    ]),
  );
}

/**
 * US-024 AC-1b: the difference between a generated and a committed vault,
 * as `<file> differs`, `<file> missing` or `<file> extra`, sorted.
 */
function differences(generated: string, committed: string): string[] {
  const want = checksums(generated);
  const have = checksums(committed);
  const out: string[] = [];
  for (const [file, sum] of Object.entries(want)) {
    if (!(file in have)) out.push(`${file} missing`);
    else if (have[file] !== sum) out.push(`${file} differs`);
  }
  for (const file of Object.keys(have)) {
    if (!(file in want)) out.push(`${file} extra`);
  }
  return out.sort();
}

describe('US-024 AC-1 the generator', () => {
  it('US-024 AC-1: `npm run fixtures` runs the generator', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['fixtures']).toMatch(/tests\/fixtures\/generate\.ts/);
  });

  it('US-024 AC-1: writes Book.md, Other.md, presets/Sample.md, images and manifest.json', async () => {
    const out = temp();
    await (await loadGenerator()).generateSample(out);
    const files = listFiles(out);
    for (const name of [
      'Book.md',
      'Other.md',
      'presets/Sample.md',
      'manifest.json',
    ]) {
      expect(files).toContain(name);
    }
    const images = files.filter((f) => f.startsWith('assets/'));
    expect(images.some((f) => f.endsWith('.png'))).toBe(true);
    expect(images.some((f) => f.endsWith('.jpg'))).toBe(true);
    expect(images.some((f) => f.endsWith('.jpeg'))).toBe(true);
    expect(images.some((f) => f.endsWith('.pdf'))).toBe(true);
    const preset = readFileSync(join(out, 'presets/Sample.md'), 'utf8');
    expect(preset).toMatch(/^---\n[\s\S]*\brule-box:/);
  });

  it('US-024 AC-1: two runs write byte-identical files', () => {
    // Two separate processes, as `npm run fixtures` twice: a seed taken at
    // module load (the clock) differs between them (changed while coding
    // TICKET-069: one import ran both times and could not see it).
    const first = temp();
    const second = temp();
    for (const dir of [first, second]) {
      const run = spawnSync('node', ['tests/fixtures/generate.ts', dir], {
        encoding: 'utf8',
      });
      expect(run.status, run.stderr).toBe(0);
    }
    const sums = checksums(first);
    expect(Object.keys(sums).length).toBeGreaterThan(4);
    expect(checksums(second)).toEqual(sums);
  });

  it('US-024 AC-1: the manifest lists every file of the vault but itself', async () => {
    const out = temp();
    await (await loadGenerator()).generateSample(out);
    const manifest = JSON.parse(
      readFileSync(join(out, 'manifest.json'), 'utf8'),
    ) as {files: string[]};
    expect(manifest.files).toEqual(
      listFiles(out).filter((f) => f !== 'manifest.json'),
    );
  });
});

describe('US-024 AC-1b the committed vault is current', () => {
  it('US-024 AC-1b: the committed vault equals a fresh run', async () => {
    const out = temp();
    await (await loadGenerator()).generateSample(out);
    expect(differences(out, SAMPLE_DIR)).toEqual([]);
  });

  it('US-024 AC-1b: a changed, a missing and an extra file are named', () => {
    // The comparison itself, on two small folders (guard for the test above).
    const a = temp();
    const b = temp();
    for (const dir of [a, b]) {
      writeFileSync(join(dir, 'Book.md'), 'lorem ipsum\n');
      writeFileSync(join(dir, 'Other.md'), 'dolor\n');
    }
    writeFileSync(join(b, 'Book.md'), 'lorem ipsum dolor\n');
    unlinkSync(join(b, 'Other.md'));
    writeFileSync(join(b, 'stray.md'), 'x\n');
    expect(differences(a, b)).toEqual([
      'Book.md differs',
      'Other.md missing',
      'stray.md extra',
    ]);
    expect(differences(a, a)).toEqual([]);
  });
});
