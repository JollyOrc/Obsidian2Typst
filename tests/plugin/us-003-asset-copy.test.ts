// US-003 AC-4 — copying the used assets into the export folder (plugin layer,
// fake vault file system). The list of used assets comes from the pure resolver;
// the copier only reads the source and writes the destination.
import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {createAssetResolver} from '../../src/core/assets';
import {copyAssets, type AssetFs} from '../../src/plugin/copy-assets';
import {HEAD, png} from '../support/images';

/** A vault and an export folder in memory. */
class FakeFs implements AssetFs {
  readonly files = new Map<string, Uint8Array>();
  readonly writes: string[] = [];
  readonly reads: string[] = [];
  constructor(initial: Record<string, Uint8Array>) {
    for (const [path, data] of Object.entries(initial)) {
      this.files.set(path, data);
    }
  }
  async read(path: string): Promise<Uint8Array> {
    this.reads.push(path);
    const data = this.files.get(path);
    if (data === undefined) throw new Error(`no such file: ${path}`);
    return data;
  }
  async write(path: string, data: Uint8Array): Promise<void> {
    this.writes.push(path);
    this.files.set(path, new Uint8Array(data));
  }
}

const hash = (data: Uint8Array | undefined) =>
  createHash('sha256')
    .update(data ?? new Uint8Array())
    .digest('hex');

const A = png(3, 3);
const B = png(4, 2);
const NOTE = 'Sample/compiledtext.md';
const VAULT = {
  'Sample/assets/crypt.png': A,
  'Other/x.png': B,
};
const heads = (fs: FakeFs) =>
  new Map(
    [...fs.files].map(([p, data]): [string, Uint8Array] => [
      p,
      data.subarray(0, 16),
    ]),
  );
const plan = (fs: FakeFs, targets: string[]) => {
  const resolver = createAssetResolver({notePath: NOTE, files: heads(fs)});
  targets.forEach((target, i) =>
    resolver.resolve({source: 'image', target, line: i + 1}),
  );
  return resolver.uses();
};

describe('US-003 AC-4 asset copying', () => {
  it('US-003 AC-4: copies assets/crypt.png to <export>/assets/crypt.png, mirroring the path relative to the note', async () => {
    const fs = new FakeFs(VAULT);
    await copyAssets(plan(fs, ['assets/crypt.png']), fs, 'Export/run1');
    expect(fs.files.get('Export/run1/assets/crypt.png')).toEqual(A);
  });

  it('US-003 AC-4: copies a ../x.png outside the note folder to <export>/assets/_external/x.png', async () => {
    const fs = new FakeFs(VAULT);
    await copyAssets(plan(fs, ['../Other/x.png']), fs, 'Export/run1');
    expect(fs.files.get('Export/run1/assets/_external/x.png')).toEqual(B);
  });

  it('US-003 AC-4: copies an asset referenced several times exactly once', async () => {
    const fs = new FakeFs(VAULT);
    const uses = plan(fs, [
      'assets/crypt.png',
      'assets/crypt.png',
      'assets/crypt.png',
    ]);
    const result = await copyAssets(uses, fs, 'Export/run1');
    expect(fs.writes).toEqual(['Export/run1/assets/crypt.png']);
    expect(fs.reads).toEqual(['Sample/assets/crypt.png']);
    expect(result).toEqual({copied: 1});
  });

  it('US-003 AC-4: never modifies or moves the source files (hash comparison)', async () => {
    const fs = new FakeFs(VAULT);
    const before = Object.fromEntries(
      Object.keys(VAULT).map((p) => [p, hash(fs.files.get(p))]),
    );
    await copyAssets(
      plan(fs, ['assets/crypt.png', '../Other/x.png']),
      fs,
      'Export/run1',
    );
    for (const [path, digest] of Object.entries(before)) {
      expect(fs.files.has(path), path).toBe(true);
      expect(hash(fs.files.get(path)), path).toBe(digest);
    }
    expect(fs.writes.every((p) => p.startsWith('Export/run1/'))).toBe(true);
  });

  it('US-003 AC-4: writes a copy that is byte for byte the source and not the same array', async () => {
    const fs = new FakeFs(VAULT);
    await copyAssets(plan(fs, ['assets/crypt.png']), fs, 'Export/run1');
    const copy = fs.files.get('Export/run1/assets/crypt.png');
    expect(hash(copy)).toBe(hash(A));
    expect(copy).not.toBe(A);
  });

  it('US-003 AC-4b: copies two sources with the same name to two destinations', async () => {
    const fs = new FakeFs({'a/x.png': A, 'b/x.png': B});
    await copyAssets(plan(fs, ['../a/x.png', '../b/x.png']), fs, 'E');
    expect(fs.files.get('E/assets/_external/x.png')).toEqual(A);
    expect(fs.files.get('E/assets/_external/x-2.png')).toEqual(B);
  });

  it('US-003 AC-4: copies a destination listed twice once', async () => {
    const fs = new FakeFs(VAULT);
    const use = {from: 'Sample/assets/crypt.png', to: 'assets/crypt.png'};
    expect(await copyAssets([use, use], fs, 'E')).toEqual({copied: 1});
    expect(fs.writes).toEqual(['E/assets/crypt.png']);
  });

  it('US-003 AC-4: accepts an export folder that ends with a slash', async () => {
    const fs = new FakeFs(VAULT);
    await copyAssets(plan(fs, ['assets/crypt.png']), fs, 'Export/run1/');
    expect(fs.writes).toEqual(['Export/run1/assets/crypt.png']);
  });

  it('US-003 AC-4: copies nothing for an export without images', async () => {
    const fs = new FakeFs(VAULT);
    expect(await copyAssets([], fs, 'E')).toEqual({copied: 0});
    expect(fs.writes).toEqual([]);
  });

  it('US-003 AC-5b: the content check and the copy use the same bytes (a file that passes is copied whole)', async () => {
    const fs = new FakeFs({'Sample/assets/crypt.png': A});
    const uses = plan(fs, ['assets/crypt.png']);
    expect(uses).toHaveLength(1);
    await copyAssets(uses, fs, 'E');
    expect(fs.files.get('E/assets/crypt.png')?.length).toBe(A.length);
    expect(HEAD.png).toEqual(A.subarray(0, 16));
  });
});
