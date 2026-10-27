// US-007 AC-1 — writing the export folder on disk (real files in a temporary
// folder).
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {createDiskWriter} from '../../src/plugin/disk-writer';

const tmp = mkdtempSync(join(tmpdir(), 'o2t-us007-disk-'));
afterAll(() => rmSync(tmp, {recursive: true, force: true}));
let n = 0;
const fresh = () => {
  const dir = join(tmp, `case-${n++}`, 'out');
  return dir;
};

describe('US-007 AC-1: the disk writer', () => {
  it('US-007 AC-1: writes text and bytes and creates missing folders, also several levels deep', async () => {
    const root = fresh();
    const writer = createDiskWriter(root);
    await writer.writeText(`${root}/Rules.typ`, '= Rules\n');
    await writer.writeBytes(
      `${root}/assets/deep/er/x.png`,
      new Uint8Array([0, 255, 10, 13]),
    );
    expect(readFileSync(`${root}/Rules.typ`, 'utf8')).toBe('= Rules\n');
    expect([...readFileSync(`${root}/assets/deep/er/x.png`)]).toEqual([
      0, 255, 10, 13,
    ]);
  });

  it('US-007 AC-1: writes UTF-8 without a byte order mark', async () => {
    const root = fresh();
    await createDiskWriter(root).writeText(`${root}/a.typ`, 'Größe ✓');
    const bytes = readFileSync(`${root}/a.typ`);
    expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toBe('Größe ✓');
  });

  it('US-007 AC-1: overwrites a file that is already there and leaves every other file untouched', async () => {
    const root = fresh();
    mkdirSync(`${root}/assets`, {recursive: true});
    writeFileSync(`${root}/Rules.typ`, 'old');
    writeFileSync(`${root}/notes.txt`, 'mine');
    writeFileSync(`${root}/assets/other.png`, 'other');
    await createDiskWriter(root).writeText(`${root}/Rules.typ`, 'new');
    expect(readFileSync(`${root}/Rules.typ`, 'utf8')).toBe('new');
    expect(readFileSync(`${root}/notes.txt`, 'utf8')).toBe('mine');
    expect(readFileSync(`${root}/assets/other.png`, 'utf8')).toBe('other');
    expect(readdirSync(root).sort()).toEqual([
      'Rules.typ',
      'assets',
      'notes.txt',
    ]);
  });

  it('US-007 AC-1: never deletes a file', async () => {
    const root = fresh();
    mkdirSync(root, {recursive: true});
    writeFileSync(`${root}/stale.pdf`, 'old pdf');
    const writer = createDiskWriter(root);
    await writer.writeText(`${root}/Rules.typ`, 'x');
    expect(existsSync(`${root}/stale.pdf`)).toBe(true);
  });

  it('US-007 AC-1: refuses a path outside the export folder and writes nothing', async () => {
    const root = fresh();
    const writer = createDiskWriter(root);
    for (const path of [
      `${root}/../escape.typ`,
      `${root}/assets/../../escape.typ`,
      `${tmp}/elsewhere/x.typ`,
      `${root}-sibling/x.typ`,
      '/etc/o2t-test',
      'relative.typ',
    ]) {
      await expect(writer.writeText(path, 'x'), path).rejects.toThrow(
        'Refusing to write outside the export folder',
      );
      await expect(
        writer.writeBytes(path, new Uint8Array([1])),
        path,
      ).rejects.toThrow('Refusing to write outside the export folder');
    }
    expect(existsSync(join(root, '..', 'escape.typ'))).toBe(false);
    expect(existsSync(`${tmp}/elsewhere`)).toBe(false);
    expect(existsSync(`${root}-sibling`)).toBe(false);
  });

  it('US-007 AC-1: a trailing slash on the root and doubled slashes in the path are accepted', async () => {
    const root = fresh();
    await createDiskWriter(`${root}/`).writeText(`${root}//a.typ`, 'x');
    expect(readFileSync(`${root}/a.typ`, 'utf8')).toBe('x');
  });
});
