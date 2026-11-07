// The release build script (build/release.mjs): it refuses a tree that is
// not ready to release, and it writes the release files, a zip of them that
// unpacks to the same bytes (the same zip each time) and their checksums.
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {
  RELEASE_FILES,
  assembleRelease,
  checkRelease,
  makeZip,
} from '../../build/release.mjs';

/** A tree with the version files of `version` and, unless left out, its notes. */
function tree(
  version: string,
  over: {
    pkg?: string;
    versions?: Record<string, string>;
    notes?: string | null;
    table?: boolean;
  } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), 'o2t-rel-'));
  const base = version.replace(/-.*$/, '');
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({version, minAppVersion: '1.5.0'}),
  );
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({version: over.pkg ?? version}),
  );
  writeFileSync(
    join(dir, 'versions.json'),
    JSON.stringify(over.versions ?? {[base]: '1.5.0'}),
  );
  mkdirSync(join(dir, 'releases'));
  if (over.notes !== null) {
    writeFileSync(
      join(dir, 'releases', `v${base}.md`),
      over.notes ??
        `# Obsidian2Typst v${base}\n\n**Release date:** 2026-11-07\n\nNotes.\n`,
    );
  }
  writeFileSync(
    join(dir, 'releases', 'RELEASES.md'),
    over.table === false
      ? '| Version |\n'
      : `| v${base} | [release notes](v${base}.md) |\n`,
  );
  return dir;
}

/** The files of a zip, read from its central directory and inflated. */
function unzip(zip: Buffer): Record<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const localName = zip.readUInt16LE(local + 26);
    const localExtra = zip.readUInt16LE(local + 28);
    const start = local + 30 + localName + localExtra;
    out[name] = inflateRawSync(zip.subarray(start, start + size));
    at +=
      46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return out;
}

describe('the release build: checks before building', () => {
  it('accepts a release with its notes and its row', () => {
    expect(checkRelease(tree('0.12.0'))).toEqual({
      version: '0.12.0',
      minAppVersion: '1.5.0',
    });
  });

  it('refuses a test build, mismatched versions, a missing map, notes without a date, a missing row', () => {
    expect(() => checkRelease(tree('0.12.0-m21.2'))).toThrow(
      /is not a release/,
    );
    expect(() => checkRelease(tree('0.12.0', {pkg: '0.11.1'}))).toThrow(
      /package.json has version 0.11.1/,
    );
    expect(() => checkRelease(tree('0.12.0', {versions: {}}))).toThrow(
      /versions.json does not map 0.12.0/,
    );
    expect(() =>
      checkRelease(tree('0.12.0', {notes: '# x\n\n**Release date:** —\n'})),
    ).toThrow(/has no release date/);
    expect(() => checkRelease(tree('0.12.0', {notes: null}))).toThrow(
      /is missing/,
    );
    expect(() => checkRelease(tree('0.12.0', {table: false}))).toThrow(
      /does not list v0.12.0/,
    );
  });

  it('accepts a test build with --test-build, without notes', () => {
    expect(
      checkRelease(tree('0.12.0-m21.2', {notes: null, table: false}), {
        testBuild: true,
      }).version,
    ).toBe('0.12.0-m21.2');
  });

  it('this repository is consistent: a release or a test build of the mapped version', () => {
    expect(() => checkRelease(process.cwd(), {testBuild: true})).not.toThrow();
  });
});

describe('the release build: the files', () => {
  it('the zip holds the five files byte for byte, in order, and is the same each time', () => {
    const entries = RELEASE_FILES.map((name, i) => ({
      name,
      data: Buffer.from(`${name} ${'x'.repeat(1000 * (i + 1))}`),
    }));
    const zip = makeZip(entries);
    const files = unzip(zip);
    expect(Object.keys(files)).toEqual([...RELEASE_FILES]);
    for (const e of entries)
      expect(files[e.name]?.equals(e.data), e.name).toBe(true);
    expect(makeZip(entries).equals(zip)).toBe(true);
  });

  it('assembles the files, the zip, SHA256SUMS.txt and the notes without their title', () => {
    const from = tree('0.12.0');
    for (const name of RELEASE_FILES)
      writeFileSync(join(from, name), `content of ${name}`);
    const out = join(from, 'dist', 'release', '0.12.0');
    const {zip, sums} = assembleRelease({from, out, version: '0.12.0'});
    expect(zip).toBe('artefact-v0.12.0.zip');
    expect(readdirSync(out).sort()).toEqual(
      [
        'SHA256SUMS.txt',
        'artefact-v0.12.0.zip',
        'notes.md',
        ...RELEASE_FILES,
      ].sort(),
    );
    const sum = (name: string) =>
      createHash('sha256')
        .update(readFileSync(join(out, name)))
        .digest('hex');
    for (const name of [zip, ...RELEASE_FILES])
      expect(sums[name]).toBe(sum(name));
    expect(readFileSync(join(out, 'SHA256SUMS.txt'), 'utf8')).toContain(
      `${sum(zip)}  ${zip}`,
    );
    expect(readFileSync(join(out, 'notes.md'), 'utf8')).toMatch(
      /^\*\*Release date:\*\* 2026-11-07/,
    );
    expect(Object.keys(unzip(readFileSync(join(out, zip))))).toEqual([
      ...RELEASE_FILES,
    ]);
  });
});
