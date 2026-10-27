// US-015 AC-6, AC-13 — the asset plan and the vault lookup `AssetIndex` (unit,
// pure core, fake index that records its reads). Source of truth:
// docs/user-stories/US-015-conversion-pipeline.md.
import {describe, expect, it} from 'vitest';
import {FakeIndex, NOTE_PATH, run} from '../support/convert';

const FILES = [
  NOTE_PATH,
  'Sample/assets/a.png',
  'Sample/assets/b.png',
  'Sample/assets/c.png',
  'Sample/assets/d.png',
  'Other/assets/b.png',
  'Unrelated/huge-1.png',
  'Unrelated/huge-2.jpg',
  'Unrelated/notes.md',
];

describe('US-015 AC-6 asset plan', () => {
  it('US-015 AC-6: lists each used asset once, in order of first use', async () => {
    const note = [
      '![](assets/b.png)',
      '',
      '![](assets/a.png)',
      '',
      '![](assets/b.png)',
      '',
      '![](assets/a.png)',
      '',
      '![](assets/b.png)',
    ].join('\n');
    const {assets} = await run(note, {}, FILES);
    expect(assets).toEqual([
      {from: 'Sample/assets/b.png', to: 'assets/b.png'},
      {from: 'Sample/assets/a.png', to: 'assets/a.png'},
    ]);
  });

  it('US-015 AC-6: lists an embedded image like a standard one, once for both', async () => {
    const {assets} = await run('![[a.png]]\n\n![](assets/a.png)', {}, FILES);
    expect(assets).toEqual([{from: 'Sample/assets/a.png', to: 'assets/a.png'}]);
  });

  it('US-015 AC-6: lists no missing, remote or unsupported asset', async () => {
    const note = [
      '![](assets/gone.png)',
      '',
      '![](https://example.org/x.png)',
      '',
      '![](assets/readme.md)',
      '',
      '![](assets/c.png)',
    ].join('\n');
    const {assets, warnings} = await run(note, {}, [
      ...FILES,
      'Sample/assets/readme.md',
    ]);
    expect(assets).toEqual([{from: 'Sample/assets/c.png', to: 'assets/c.png'}]);
    expect(warnings.map((w) => w.code).sort()).toEqual([
      'ASSET_MISSING',
      'ASSET_REMOTE',
      'ASSET_TYPE_UNSUPPORTED',
    ]);
  });

  it('US-015 AC-6: lists no asset for a note without images', async () => {
    const {assets} = await run('# No images', {}, FILES);
    expect(assets).toEqual([]);
  });
});

describe('US-015 AC-13 reads of the vault lookup', () => {
  it('US-015 AC-13: reads the head of a file once, however often it is referenced', async () => {
    const index = new FakeIndex(FILES);
    await run(
      '![](assets/a.png)\n\n![[a.png]]\n\n![x](assets/a.png)',
      {assets: index},
      FILES,
    );
    expect(index.reads).toEqual(['Sample/assets/a.png']);
  });

  it('US-015 AC-13: reads nothing for a note without images, and never a file of another name', async () => {
    const none = new FakeIndex(FILES);
    await run('# Title\n\ntext [[x]] [y](z.png)', {assets: none}, FILES);
    expect(none.reads).toEqual([]);

    const some = new FakeIndex(FILES);
    await run('![](assets/c.png)', {assets: some}, FILES);
    expect(some.reads).toEqual(['Sample/assets/c.png']);
  });

  it('US-015 AC-13: reads every file with the name of a reference (also in another folder), nothing else', async () => {
    const index = new FakeIndex(FILES);
    const {assets, warnings} = await run('![[b.png]]', {assets: index}, FILES);
    expect([...index.reads].sort()).toEqual([
      'Other/assets/b.png',
      'Sample/assets/b.png',
    ]);
    // Two candidates, none directly in the folder of the note: the first by
    // sorted path is used (US-003 AC-2c) and an outside file is copied to
    // assets/_external (US-003 AC-4).
    expect(assets).toEqual([
      {from: 'Other/assets/b.png', to: 'assets/_external/b.png'},
    ]);
    expect(warnings.map((w) => w.code)).toEqual(['ASSET_AMBIGUOUS']);
  });

  it('US-015 AC-13: reports ASSET_AMBIGUOUS when two files have the name and none is in the folder of the note', async () => {
    const files = [NOTE_PATH, 'X/p.png', 'Y/p.png'];
    const index = new FakeIndex(files);
    const {assets, warnings} = await run('![[p.png]]', {assets: index}, files);
    expect([...index.reads].sort()).toEqual(['X/p.png', 'Y/p.png']);
    expect(warnings.map((w) => w.code)).toEqual(['ASSET_AMBIGUOUS']);
    expect(assets).toHaveLength(1);
  });

  it('US-015 AC-13: collects references in lists, quotes, tables, links, headings, footnote definitions and inline footnotes', async () => {
    const note = [
      '- ![](assets/a.png)', // list item
      '',
      '> ![](assets/b.png)', // quote
      '',
      '| x | y |',
      '|--|--|',
      '| ![](assets/c.png) | 1 |', // table cell
      '',
      '[![d](assets/d.png)](https://example.org)', // image in a link
      '',
      '# ![](assets/e.png) Title', // heading
      '',
      'Text[^n] and ^[![](assets/f.png)]',
      '',
      '[^n]: ![](assets/g.png)',
    ].join('\n');
    const files = [
      NOTE_PATH,
      ...'abcdefg'.split('').map((c) => `Sample/assets/${c}.png`),
    ];
    const index = new FakeIndex(files);
    const {assets, warnings} = await run(note, {assets: index}, files);
    expect([...index.reads].sort()).toEqual(files.slice(1).sort());
    expect(assets.map((a) => a.to).sort()).toEqual(
      'abcdefg'.split('').map((c) => `assets/${c}.png`),
    );
    expect(warnings.filter((w) => w.code.startsWith('ASSET_'))).toEqual([]);
  });

  it('US-015 AC-13: does not read for a remote reference even when a vault file has that name', async () => {
    const index = new FakeIndex(FILES);
    const {warnings} = await run(
      '![](https://example.org/a.png)',
      {assets: index},
      FILES,
    );
    expect(index.reads).toEqual([]);
    expect(warnings.map((w) => w.code)).toEqual(['ASSET_REMOTE']);
  });

  it('US-015 AC-13: compares the file names after NFC, so a decomposed reference finds a composed file name', async () => {
    const composed = 'Café.png';
    const decomposed = 'Café.png';
    const files = [NOTE_PATH, `Sample/assets/${composed}`];
    const index = new FakeIndex(files);
    const {assets} = await run(
      `![](assets/${decomposed})`,
      {assets: index},
      files,
    );
    expect(index.reads).toEqual([`Sample/assets/${composed}`]);
    expect(assets).toHaveLength(1);
  });

  it('US-015 AC-13: finds a file by the percent-decoded name of a standard reference', async () => {
    const files = [NOTE_PATH, 'Sample/assets/my pic.png'];
    const index = new FakeIndex(files);
    const {assets, warnings} = await run(
      '![](assets/my%20pic.png)',
      {assets: index},
      files,
    );
    expect(index.reads).toEqual(['Sample/assets/my pic.png']);
    expect(assets).toEqual([
      {from: 'Sample/assets/my pic.png', to: 'assets/my pic.png'},
    ]);
    expect(warnings).toEqual([]);
  });

  it('US-015 AC-13: gives a file whose read fails an empty head, so it is ASSET_INVALID with a placeholder, and does not throw', async () => {
    const index = new FakeIndex(FILES);
    index.failing.add('Sample/assets/a.png');
    const result = await run(
      '![](assets/a.png)\n\n![](assets/c.png)',
      {assets: index},
      FILES,
    );
    expect(result.warnings.map((w) => w.code)).toEqual(['ASSET_INVALID']);
    expect(result.typ).toContain('Missing image');
    expect(result.assets).toEqual([
      {from: 'Sample/assets/c.png', to: 'assets/c.png'},
    ]);
  });

  it('US-015 AC-13: starts the reads together (it does not wait for one file before the next)', async () => {
    const files = [NOTE_PATH, 'Sample/a.png', 'Sample/b.png'];
    const index = new FakeIndex(files);
    index.delay = () => 40;
    const started = Date.now();
    await run('![](a.png)\n\n![](b.png)', {assets: index}, files);
    expect(Date.now() - started).toBeLessThan(70);
  });

  it('US-015 AC-13: does not change the file list it was given', async () => {
    const files = [...FILES];
    const index = new FakeIndex(files);
    await run('![](assets/a.png)', {assets: index}, files);
    expect(files).toEqual(FILES);
    expect(index.files).toEqual(FILES);
  });
});
