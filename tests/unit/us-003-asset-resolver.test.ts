// US-003 — the asset resolver and the content check (unit, pure core). Source of
// truth: docs/user-stories/US-003-images-and-assets.md (AC-2c, AC-4, AC-4b,
// AC-5b, AC-8). The vault is a map from path to the first bytes of the file.
import {describe, expect, it} from 'vitest';
import {
  createAssetResolver,
  extensionOf,
  sniffImage,
  SUPPORTED_IMAGE_EXTENSIONS,
} from '../../src/core/assets';
import {HEAD} from '../support/images';

const vault = (paths: Record<string, Uint8Array> | string[]) =>
  new Map(
    Array.isArray(paths)
      ? paths.map((p): [string, Uint8Array] => [p, HEAD.png])
      : Object.entries(paths),
  );
const NOTE = 'Sample/compiledtext.md';
const image = (target: string, files = vault(['Sample/assets/crypt.png'])) =>
  createAssetResolver({notePath: NOTE, files}).resolve({
    source: 'image',
    target,
    line: 1,
  });

describe('US-003 AC-5b the content check', () => {
  const ok = (ext: string, head: Uint8Array) => sniffImage(ext, head);

  it('US-003 AC-5b: accepts the first bytes of a PNG, JPEG, GIF, WebP and SVG file for their extension', () => {
    expect(ok('png', HEAD.png)).toBe(true);
    expect(ok('jpg', HEAD.jpg)).toBe(true);
    expect(ok('jpeg', HEAD.jpg)).toBe(true);
    expect(ok('gif', HEAD.gif87)).toBe(true);
    expect(ok('gif', HEAD.gif89)).toBe(true);
    expect(ok('webp', HEAD.webp)).toBe(true);
    expect(ok('svg', HEAD.svg)).toBe(true);
  });

  it('US-003 AC-5b: reads an SVG after a byte order mark and blanks, or with an XML declaration', () => {
    expect(ok('svg', HEAD.svgBom)).toBe(true);
    expect(ok('svg', HEAD.svgXml)).toBe(true);
  });

  it('US-003 AC-5b: rejects bytes of another kind, an empty file and text', () => {
    expect(ok('png', HEAD.jpg)).toBe(false);
    expect(ok('jpg', new Uint8Array([0xff, 0x00, 0x00]))).toBe(false);
    expect(ok('jpg', HEAD.png)).toBe(false);
    expect(ok('gif', HEAD.webp)).toBe(false);
    expect(ok('webp', HEAD.gif89)).toBe(false);
    expect(ok('svg', HEAD.png)).toBe(false);
    for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
      expect(ok(ext, HEAD.empty), ext).toBe(false);
      expect(ok(ext, HEAD.text), ext).toBe(false);
    }
  });

  it('US-003 AC-5b: compares the extension without regard to case and rejects an unknown one', () => {
    expect(ok('PNG', HEAD.png)).toBe(true);
    expect(ok('Jpeg', HEAD.jpg)).toBe(true);
    expect(ok('bmp', HEAD.png)).toBe(false);
  });

  it('US-003 AC-5: knows the extension of a path in lower case, and none for a dot file or no dot', () => {
    expect(extensionOf('a/B.PNG')).toBe('png');
    expect(extensionOf('a.b/c')).toBe('');
    expect(extensionOf('.png')).toBe('');
    expect(extensionOf('x.tar.gz')).toBe('gz');
    expect([...SUPPORTED_IMAGE_EXTENSIONS].sort()).toEqual(
      ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].sort(),
    );
  });
});

describe('US-003 AC-4 destinations and the list of used assets', () => {
  it('US-003 AC-4: maps assets/crypt.png next to the note to assets/crypt.png', () => {
    const r = createAssetResolver({
      notePath: NOTE,
      files: vault(['Sample/assets/crypt.png']),
    });
    expect(
      r.resolve({source: 'image', target: 'assets/crypt.png', line: 1}),
    ).toEqual({
      status: 'found',
      path: 'assets/crypt.png',
    });
    expect(r.uses()).toEqual([
      {from: 'Sample/assets/crypt.png', to: 'assets/crypt.png'},
    ]);
  });

  it('US-003 AC-4: maps a path that leaves the note folder to assets/_external/<name>', () => {
    const r = createAssetResolver({
      notePath: NOTE,
      files: vault(['Other/x.png', 'y.png']),
    });
    expect(
      r.resolve({source: 'image', target: '../Other/x.png', line: 1}),
    ).toEqual({
      status: 'found',
      path: 'assets/_external/x.png',
    });
    expect(r.resolve({source: 'image', target: '../y.png', line: 1})).toEqual({
      status: 'found',
      path: 'assets/_external/y.png',
    });
    expect(r.uses()).toEqual([
      {from: 'Other/x.png', to: 'assets/_external/x.png'},
      {from: 'y.png', to: 'assets/_external/y.png'},
    ]);
  });

  it('US-003 AC-2c: reads a leading / as the vault root', () => {
    const r = createAssetResolver({
      notePath: NOTE,
      files: vault(['Other/x.png', 'Sample/assets/crypt.png']),
    });
    expect(
      r.resolve({source: 'image', target: '/Other/x.png', line: 1}),
    ).toEqual({
      status: 'found',
      path: 'assets/_external/x.png',
    });
    expect(
      r.resolve({
        source: 'image',
        target: '/Sample/assets/crypt.png',
        line: 1,
      }),
    ).toEqual({status: 'found', path: 'assets/crypt.png'});
  });

  it('US-003 AC-2c: resolves . and .. segments inside the path', () => {
    expect(image('./assets/../assets/crypt.png')).toEqual({
      status: 'found',
      path: 'assets/crypt.png',
    });
  });

  it('US-003 AC-4: records an asset referenced several times once, with one destination', () => {
    const r = createAssetResolver({
      notePath: NOTE,
      files: vault(['Sample/assets/crypt.png']),
    });
    for (let i = 0; i < 3; i++) {
      expect(
        r.resolve({source: 'image', target: 'assets/crypt.png', line: i + 1}),
      ).toEqual({status: 'found', path: 'assets/crypt.png'});
    }
    expect(r.uses()).toHaveLength(1);
  });

  it('US-003 AC-4: a note in the vault root has every file below it inside the note folder', () => {
    const r = createAssetResolver({
      notePath: 'note.md',
      files: vault(['assets/a.png']),
    });
    expect(
      r.resolve({source: 'image', target: 'assets/a.png', line: 1}),
    ).toEqual({
      status: 'found',
      path: 'assets/a.png',
    });
    expect(r.resolve({source: 'image', target: '../a.png', line: 1})).toEqual({
      status: 'missing',
    });
    const withRoot = createAssetResolver({
      notePath: 'note.md',
      files: vault(['a.png']),
    });
    expect(
      withRoot.resolve({source: 'image', target: '../a.png', line: 1}),
    ).toEqual({status: 'missing'});
  });

  it('US-003 AC-5: reports a file that is not in the vault as missing and records nothing', () => {
    const r = createAssetResolver({notePath: NOTE, files: vault([])});
    expect(
      r.resolve({source: 'image', target: 'assets/no.png', line: 1}),
    ).toEqual({
      status: 'missing',
    });
    expect(r.uses()).toEqual([]);
  });

  it('US-003 AC-2c: looks a standard image up by its exact path only, not by name', () => {
    expect(image('crypt.png')).toEqual({status: 'missing'});
    expect(image('other/crypt.png')).toEqual({status: 'missing'});
    expect(image('Assets/crypt.png')).toEqual({status: 'missing'});
  });

  it('US-003 AC-2c: compares names in Unicode NFC', () => {
    const nfd = 'Sample/assets/é.png';
    expect(image('assets/é.png', vault([nfd]))).toEqual({
      status: 'found',
      path: 'assets/é.png',
    });
  });

  it('US-003 AC-5b: reports a file with wrong or empty content as invalid and records nothing', () => {
    for (const head of [HEAD.jpg, HEAD.empty, HEAD.text]) {
      const r = createAssetResolver({
        notePath: NOTE,
        files: vault({'Sample/assets/x.png': head}),
      });
      expect(
        r.resolve({source: 'image', target: 'assets/x.png', line: 1}),
      ).toEqual({
        status: 'invalid',
      });
      expect(r.uses()).toEqual([]);
    }
  });

  it('US-003 AC-5b: checks the content against the extension in any letter case', () => {
    const files = vault({'Sample/assets/X.PNG': HEAD.png});
    expect(image('assets/X.PNG', files)).toEqual({
      status: 'found',
      path: 'assets/X.PNG',
    });
  });
});

describe('US-003 AC-4b two sources, one destination', () => {
  const files = vault([
    'a/x.png',
    'b/x.png',
    'c/x.png',
    'd/X.png',
    'e/x.png',
    'Sample/assets/_external/x-2.png',
  ]);

  it('US-003 AC-4b: gives the first source the plain name and each later one -2, -3 before the extension', () => {
    const r = createAssetResolver({notePath: NOTE, files});
    const to = (t: string) =>
      (r.resolve({source: 'image', target: t, line: 1}) as {path: string}).path;
    expect(to('../a/x.png')).toBe('assets/_external/x.png');
    expect(to('../b/x.png')).toBe('assets/_external/x-2.png');
    expect(to('../c/x.png')).toBe('assets/_external/x-3.png');
  });

  it('US-003 AC-4b: treats names that differ only in case as the same name', () => {
    const r = createAssetResolver({notePath: NOTE, files});
    const to = (t: string) =>
      (r.resolve({source: 'image', target: t, line: 1}) as {path: string}).path;
    to('../a/x.png');
    expect(to('../d/X.png')).toBe('assets/_external/X-2.png');
  });

  it('US-003 AC-4b: a name taken in capitals blocks the same name in lower case', () => {
    const r = createAssetResolver({notePath: NOTE, files});
    const to = (t: string) =>
      (r.resolve({source: 'image', target: t, line: 1}) as {path: string}).path;
    expect(to('../d/X.png')).toBe('assets/_external/X.png');
    expect(to('../a/x.png')).toBe('assets/_external/x-2.png');
  });

  it('US-003 AC-4b: skips a name that is already taken by a file inside the note folder', () => {
    const r = createAssetResolver({notePath: NOTE, files});
    const to = (t: string) =>
      (r.resolve({source: 'image', target: t, line: 1}) as {path: string}).path;
    expect(to('assets/_external/x-2.png')).toBe('assets/_external/x-2.png');
    expect(to('../a/x.png')).toBe('assets/_external/x.png');
    expect(to('../b/x.png')).toBe('assets/_external/x-3.png');
  });

  it('US-003 AC-4b: gives the same destinations for the same input in the same order', () => {
    const run = () => {
      const r = createAssetResolver({notePath: NOTE, files});
      ['../a/x.png', '../b/x.png', '../a/x.png', '../c/x.png'].forEach((t) =>
        r.resolve({source: 'image', target: t, line: 1}),
      );
      return r.uses();
    };
    expect(run()).toEqual(run());
    expect(run().map((u) => u.to)).toEqual([
      'assets/_external/x.png',
      'assets/_external/x-2.png',
      'assets/_external/x-3.png',
    ]);
  });
});

describe('US-003 AC-2 embeds are looked up by file name', () => {
  const embed = (target: string, files: Map<string, Uint8Array>) =>
    createAssetResolver({notePath: NOTE, files}).resolve({
      source: 'embed',
      target,
      line: 1,
    });

  it('US-003 AC-2: finds a file by name anywhere in the vault', () => {
    expect(embed('crypt.png', vault(['Sample/assets/crypt.png']))).toEqual({
      status: 'found',
      path: 'assets/crypt.png',
    });
    expect(embed('crypt.png', vault(['Deep/er/crypt.png']))).toEqual({
      status: 'found',
      path: 'assets/_external/crypt.png',
    });
  });

  it("US-003 AC-2: prefers the file in the note's own folder when two files share the name, without a warning", () => {
    expect(
      embed('a.png', vault(['Other/a.png', 'Sample/a.png', 'Z/a.png'])),
    ).toEqual({status: 'found', path: 'a.png'});
  });

  it('US-003 AC-2: uses the first file by path order and reports ambiguity otherwise', () => {
    expect(
      embed('a.png', vault(['Z/a.png', 'Other/a.png', 'Sample/assets/a.png'])),
    ).toEqual({status: 'ambiguous', path: 'assets/_external/a.png', count: 3});
  });

  it('US-003 AC-2: orders the candidates by path, so the first is the smallest path', () => {
    expect(embed('a.png', vault(['Z/a.png', 'Sample/assets/a.png']))).toEqual({
      status: 'ambiguous',
      path: 'assets/a.png',
      count: 2,
    });
  });

  it('US-003 AC-2: narrows the match with the folders written in the embed', () => {
    const files = vault(['Sample/assets/a.png', 'Other/a.png']);
    expect(embed('assets/a.png', files)).toEqual({
      status: 'found',
      path: 'assets/a.png',
    });
    expect(embed('sets/a.png', files)).toEqual({status: 'missing'});
  });

  it('US-003 AC-2: reports an embed that matches no file as missing', () => {
    expect(embed('no.png', vault(['Sample/assets/crypt.png']))).toEqual({
      status: 'missing',
    });
  });

  it('US-003 AC-2: compares the name exactly: case matters and NFC counts', () => {
    expect(embed('Crypt.png', vault(['Sample/assets/crypt.png']))).toEqual({
      status: 'missing',
    });
    expect(embed('é.png', vault(['Sample/assets/é.png']))).toEqual({
      status: 'found',
      path: 'assets/é.png',
    });
  });

  it('US-003 AC-5b: reports the chosen file as invalid when its content is wrong', () => {
    expect(embed('a.png', vault({'Sample/a.png': HEAD.text}))).toEqual({
      status: 'invalid',
    });
  });

  it('US-003 AC-4: records the file an embed found, once', () => {
    const r = createAssetResolver({
      notePath: NOTE,
      files: vault(['Sample/assets/a.png']),
    });
    r.resolve({source: 'embed', target: 'a.png', line: 1});
    r.resolve({source: 'image', target: 'assets/a.png', line: 2});
    r.resolve({source: 'embed', target: 'a.png', line: 3});
    expect(r.uses()).toEqual([
      {from: 'Sample/assets/a.png', to: 'assets/a.png'},
    ]);
  });
});
