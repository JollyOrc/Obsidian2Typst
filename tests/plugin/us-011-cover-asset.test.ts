// US-011 AC-9 — the cover image is copied once into the export folder (plugin
// layer, fake file system), and the vault reader gives the larger head that the
// size check needs. Source of truth: docs/user-stories/US-011-cover.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {copyAssets, type AssetFs} from '../../src/plugin/copy-assets';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {png} from '../support/images';

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

const COVER = 'Sample/assets/cover.png';
const VAULT = {[COVER]: png(20, 30), [NOTE_PATH]: new Uint8Array(0)};

describe('US-011 AC-9 asset copy', () => {
  it('US-011 AC-9: copies the cover image once to the export folder, even when it also appears later in the body', async () => {
    const fs = new FakeFs(VAULT);
    const index = new FakeIndex(Object.keys(VAULT));
    index.images.set(COVER, png(20, 30));
    const result = await convert({
      source: '![](assets/cover.png)\n\n# T\n\n![Again](assets/cover.png)\n',
      noteName: 'Rules',
      notePath: NOTE_PATH,
      settings: {...SETTINGS, cover: {...DEFAULT_COVER}},
      assets: index,
    });
    const copied = await copyAssets(result.assets, fs, 'Export/run1');
    expect(copied).toEqual({copied: 1});
    expect(fs.writes).toEqual(['Export/run1/assets/cover.png']);
    expect(fs.reads).toEqual([COVER]);
    expect(fs.files.get('Export/run1/assets/cover.png')).toEqual(png(20, 30));
  });
});

describe('US-011 AC-6 the vault reader', () => {
  const access = readFileSync('src/plugin/obsidian/vault-access.ts', 'utf8');

  it('US-011 AC-6: readHead of the vault takes a length and cuts the file to it', () => {
    expect(access).toMatch(/readHead:\s*async\s*\(path,\s*length\s*=\s*16\)/);
    expect(access).toContain('.subarray(0, length)');
  });
});
