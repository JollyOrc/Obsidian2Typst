// US-007 AC-13 (SCAR-015) — the default fonts that make the PDF show text: the
// files and licences exist, they are embedded as gzip + base64, decode on first
// use, and the export gives them to the compiler. Source of truth:
// docs/user-stories/US-007-in-plugin-typst-compilation.md.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {gzipBase64} from '../../build/embed.mjs';
import {lazyFonts} from '../../src/plugin/compiler/default-fonts';

const DIR = 'assets/fonts';
const FONT_FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
];

describe('US-007 AC-13 the font files', () => {
  it('US-007 AC-13: assets/fonts holds the six faces and the two licence texts, and nothing else', () => {
    expect(readdirSync(DIR).sort()).toEqual(
      [...FONT_FILES, 'DejaVu-LICENSE.txt', 'Libertinus-OFL.txt'].sort(),
    );
  });

  it('US-007 AC-13: every face starts with an OpenType (OTTO) or TrueType header', () => {
    for (const name of FONT_FILES) {
      const head = readFileSync(join(DIR, name)).subarray(0, 4);
      const tag = head.toString('latin1');
      const isTrueType = head.equals(Buffer.from([0, 1, 0, 0]));
      expect(tag === 'OTTO' || isTrueType, name).toBe(true);
    }
  });

  it('US-007 AC-13: the licence texts name the licences', () => {
    expect(readFileSync(join(DIR, 'Libertinus-OFL.txt'), 'utf8')).toContain(
      'SIL Open Font License, Version 1.1',
    );
    expect(readFileSync(join(DIR, 'DejaVu-LICENSE.txt'), 'utf8')).toContain(
      'Bitstream',
    );
  });

  it('US-007 AC-13: dependencies.md names both fonts and their licences', () => {
    const text = readFileSync('docs/technical/dependencies.md', 'utf8');
    for (const word of [
      'Libertinus Serif',
      'DejaVu Sans Mono',
      'OFL',
      'Bitstream Vera',
    ]) {
      expect(text, word).toContain(word);
    }
  });
});

describe('US-007 AC-13 lazyFonts', () => {
  const encoded = FONT_FILES.map((n) =>
    gzipBase64(new Uint8Array(readFileSync(join(DIR, n)))),
  );

  it('US-007 AC-13: decodes every embedded font back to the exact bytes, in order', async () => {
    const fonts = await lazyFonts(encoded)();
    expect(fonts).toHaveLength(FONT_FILES.length);
    FONT_FILES.forEach((name, i) => {
      expect(
        Buffer.from(fonts[i] as Uint8Array).equals(
          readFileSync(join(DIR, name)),
        ),
        name,
      ).toBe(true);
    });
  });

  it('US-007 AC-13: decodes on the first call only', async () => {
    const decode = vi.fn(async (text: string) => new Uint8Array([text.length]));
    const get = lazyFonts(['abcd', 'ef'], decode);
    expect(decode).not.toHaveBeenCalled();
    const a = await get();
    const b = await get();
    expect(decode).toHaveBeenCalledTimes(2);
    expect(a).toBe(b);
    expect(a.map((f) => f[0])).toEqual([4, 2]);
  });

  it('US-007 AC-13: a failed decode is tried again on the next call', async () => {
    const decode = vi
      .fn<(text: string) => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error('bad'))
      .mockResolvedValue(new Uint8Array([1]));
    const get = lazyFonts(['x'], decode);
    await expect(get()).rejects.toThrow('bad');
    expect(await get()).toHaveLength(1);
  });
});

describe('US-007 AC-13 wiring', () => {
  const main = readFileSync('src/plugin/main.ts', 'utf8');
  const build = readFileSync('build/build-plugin.mjs', 'utf8');

  it('US-007 AC-13: the export and the compiler check give the default fonts to the compiler, never an empty list', () => {
    expect(main).not.toMatch(/fonts:\s*\[\]/);
    expect(
      (main.match(/embeddedFonts\(\)/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('US-007 AC-13: the build embeds every file of assets/fonts that is a font', () => {
    expect(build).toContain("'default-fonts'");
    expect(build).toContain('assets/fonts');
  });
});
