// US-011 — the cover in the conversion: which block becomes the cover, what the
// `.typ` holds, the warnings and the files to copy (unit, `convert` with a fake
// vault). The page structure of the PDF is checked in
// tests/integration/us-011-cover-pdf.test.ts. Source of truth:
// docs/user-stories/US-011-cover.md.
import {describe, expect, it} from 'vitest';
import {IMAGE_SIZE_READ_BYTES} from '../../src/core/assets';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {typstString} from '../../src/core/emit/typst-string';
import {DEFAULT_COVER, type CoverSettings} from '../../src/core/cover';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
} from '../../src/core/layout/page-setup';
import {
  A5_PRINT,
  FakeIndex,
  NOTE_PATH,
  SETTINGS,
  standIn,
} from '../support/convert';
import {
  gifHeader,
  jpegHeader,
  pngHeader,
  svgText,
  webpLossy,
} from '../support/image-bytes';
import {jpeg} from '../support/images';

const ASSETS = 'Sample/assets';
const COVER = `${ASSETS}/cover_plate_1000.png`;
const FILES = [
  NOTE_PATH,
  COVER,
  `${ASSETS}/map.png`,
  `${ASSETS}/small.png`,
  'Layouting/Cover/front.png',
  'Layouting/Cover/front.webp',
  'Layouting/Cover/front.gif',
  'Layouting/Cover/front.svg',
  'Layouting/Cover/photo.jpg',
  'Layouting/Cover/plain.bmp',
  'Layouting/Cover/fake.png',
  'Other/front.png',
  'Other/front-2.png',
  'Layouting/Cover/say "hi" \\ cover.png',
  'A/cover.png',
  'B/cover.png',
  'Docs/plan.pdf',
];
const PAGE = '#page(margin: 0pt, header: none, footer: none)';
const BODY = '# The Handbook\n\nSome text.\n';

const cover = (over: Partial<CoverSettings> = {}): CoverSettings => ({
  ...DEFAULT_COVER,
  ...over,
});

interface Rig {
  index: FakeIndex;
  settings: ConvertSettings;
}

function rig(
  coverSettings: CoverSettings | undefined,
  images: Record<string, Uint8Array> = {},
  page = A5_PRINT,
): Rig {
  const index = new FakeIndex(FILES);
  for (const [path, bytes] of Object.entries(images)) {
    index.images.set(path, bytes);
  }
  return {
    index,
    settings: {...SETTINGS, page, cover: coverSettings},
  };
}

const go = (source: string, r: Rig) =>
  convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: r.settings,
    assets: r.index,
  });

/** The lines of the `.typ` after the preamble: from the first blank line on. */
const afterPreamble = (typ: string): string[] => {
  const lines = typ.split('\n');
  return lines.slice(lines.indexOf('') + 1);
};

const COVER_FIRST = `![](assets/cover_plate_1000.png)\n\n${BODY}`;

describe('US-011 AC-2 an image in first position becomes the cover', () => {
  it('US-011 AC-2: makes the first line of compiledtext.md the cover and removes it from the body', async () => {
    const result = await go(COVER_FIRST, rig(cover()));
    expect(afterPreamble(result.typ).slice(0, 6)).toEqual([
      `${PAGE}[`,
      '  #image("assets/cover_plate_1000.png", width: 100%, height: 100%, fit: "cover")',
      ']',
      '#counter(page).update(1)',
      '',
      '= The Handbook <h-the-handbook>',
    ]);
    expect(result.typ.match(/cover_plate_1000\.png/g)).toHaveLength(1);
    expect(result.typ).not.toContain('fit-image');
  });

  it('US-011 AC-2: makes no cover when the first block is text or a heading, and keeps the image where it is', async () => {
    for (const source of [
      `Intro\n\n![](assets/cover_plate_1000.png)\n`,
      `# Title\n\n![](assets/cover_plate_1000.png)\n`,
    ]) {
      const result = await go(source, rig(cover()));
      expect(result.typ).not.toContain(PAGE);
      expect(result.typ).toContain('#fit-image("assets/cover_plate_1000.png")');
    }
  });

  it('US-011 AC-8: still takes ![[cover.png|600]] as the cover and ignores the width hint', async () => {
    const r = rig(cover());
    const result = await convert({
      source: `![[cover_plate_1000.png|600]]\n\n${BODY}`,
      noteName: 'Rules',
      notePath: NOTE_PATH,
      settings: r.settings,
      assets: r.index,
    });
    expect(result.typ).toContain(
      '#image("assets/cover_plate_1000.png", width: 100%, height: 100%, fit: "cover")',
    );
    expect(result.typ).not.toContain('450pt');
    expect(result.typ).not.toContain('600');
  });

  it('US-011 AC-2: takes the cover after frontmatter and a comment block', async () => {
    const result = await go(
      `---\ntitle: T\n---\n\n<!-- x -->\n\n![](assets/cover_plate_1000.png)\n\n${BODY}`,
      rig(cover()),
    );
    expect(result.typ).toContain(`${PAGE}[`);
    expect(result.typ).not.toContain('fit-image');
  });

  it('US-011 AC-2: does not take a first paragraph of image and text or of two images', async () => {
    for (const source of [
      `![](assets/cover_plate_1000.png) Title\n\n${BODY}`,
      `![](assets/cover_plate_1000.png)\n![](assets/map.png)\n\n${BODY}`,
    ]) {
      expect((await go(source, rig(cover()))).typ).not.toContain(PAGE);
    }
  });
});

describe('US-011 AC-3 modes file and none, and a convert without cover settings', () => {
  it('US-011 AC-3: mode file uses the chosen file and still removes the image in first position, without copying it', async () => {
    const result = await go(
      COVER_FIRST,
      rig(cover({mode: 'file', file: 'Layouting/Cover/front.png'})),
    );
    expect(result.typ).toContain(
      '#image("assets/_external/front.png", width: 100%',
    );
    expect(result.typ).not.toContain('cover_plate_1000');
    expect(result.assets).toEqual([
      {from: 'Layouting/Cover/front.png', to: 'assets/_external/front.png'},
    ]);
  });

  it('US-011 AC-3: mode file makes a cover also when the note starts with text', async () => {
    const result = await go(
      `Intro\n\n${BODY}`,
      rig(cover({mode: 'file', file: 'Layouting/Cover/front.png'})),
    );
    expect(afterPreamble(result.typ)[0]).toBe(`${PAGE}[`);
    expect(result.typ).toContain('Intro');
  });

  it('US-011 AC-3: mode none makes no cover and removes nothing', async () => {
    const result = await go(COVER_FIRST, rig(cover({mode: 'none'})));
    expect(result.typ).not.toContain(PAGE);
    expect(result.typ).toContain('#fit-image("assets/cover_plate_1000.png")');
    expect(result.assets.map((a) => a.to)).toEqual([
      'assets/cover_plate_1000.png',
    ]);
  });

  it('US-011 AC-3: a convert without cover settings (US-015 callers) behaves as mode none', async () => {
    const result = await go(COVER_FIRST, rig(undefined));
    expect(result.typ).not.toContain(PAGE);
    expect(result.typ).toContain('#fit-image("assets/cover_plate_1000.png")');
  });

  it('US-011 AC-3: the file path is a vault path written exactly, not searched by name', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'file', file: 'front.png'})),
    );
    expect(result.warnings.map((w) => w.code)).toEqual(['COVER_MISSING']);
    const wrongCase = await go(
      BODY,
      rig(cover({mode: 'file', file: 'layouting/cover/front.png'})),
    );
    expect(wrongCase.warnings.map((w) => w.code)).toEqual(['COVER_MISSING']);
  });
});

describe('US-011 AC-4 and AC-5 what the .typ holds', () => {
  it('US-011 AC-5: writes the blank page before the counter reset', async () => {
    const result = await go(COVER_FIRST, rig(cover({blankPageAfter: true})));
    expect(afterPreamble(result.typ).slice(0, 7)).toEqual([
      `${PAGE}[`,
      '  #image("assets/cover_plate_1000.png", width: 100%, height: 100%, fit: "cover")',
      ']',
      `${PAGE}[]`,
      '#counter(page).update(1)',
      '',
      '= The Handbook <h-the-handbook>',
    ]);
  });

  it('US-011 AC-4: puts the cover after the preamble and the image helper, with one blank line before it', async () => {
    const source = `![](assets/cover_plate_1000.png)\n\n![](assets/map.png)\n\n${BODY}`;
    const result = await go(source, rig(cover()));
    const lines = result.typ.split('\n');
    const at = lines.indexOf(`${PAGE}[`);
    expect(lines[at - 1]).toBe('');
    expect(
      lines.indexOf('#let fit-image(path) = layout(size => {'),
    ).toBeLessThan(at);
    expect(lines.findIndex((l) => l.startsWith('#set page('))).toBeLessThan(at);
    expect(lines.findIndex((l) => l.startsWith('#set heading('))).toBeLessThan(
      at,
    );
  });

  it('US-011 AC-4: writes the cover only once and keeps the body lines pointing at their source lines', async () => {
    const source = `![](assets/cover_plate_1000.png)\n\n${BODY}\n## Second\n\nMore.\n`;
    const result = await go(source, rig(cover({blankPageAfter: true})));
    const lines = result.typ.split('\n');
    const sourceLines = source.split('\n');
    for (const entry of result.lineMap) {
      const typ = (lines[entry.typLine - 1] ?? '').replace(/ <h-[^>]*>$/, '');
      const src = sourceLines[entry.sourceLine - 1] ?? '';
      if (typ.startsWith('= ')) expect(src).toBe(`# ${typ.slice(2)}`);
      if (typ.startsWith('== ')) expect(src).toBe(`## ${typ.slice(3)}`);
    }
    const headings = result.lineMap.filter((e) =>
      (lines[e.typLine - 1] ?? '').startsWith('='),
    );
    expect(headings.map((e) => e.sourceLine)).toEqual([3, 7]);
    expect(lines.filter((l) => l === `${PAGE}[]`)).toHaveLength(1);
  });

  it('US-011 AC-4: a note that is only the cover gives the cover and nothing after it', async () => {
    const result = await go('![](assets/cover_plate_1000.png)\n', rig(cover()));
    expect(result.typ.trimEnd().endsWith('#counter(page).update(1)')).toBe(
      true,
    );
    const blank = await go(
      '![](assets/cover_plate_1000.png)\n',
      rig(cover({blankPageAfter: true})),
    );
    expect(
      blank.typ.trimEnd().endsWith(`${PAGE}[]\n#counter(page).update(1)`),
    ).toBe(true);
  });

  it('US-011 AC-4: gives the same result for the same input', async () => {
    const a = await go(COVER_FIRST, rig(cover({blankPageAfter: true})));
    const b = await go(COVER_FIRST, rig(cover({blankPageAfter: true})));
    expect(a).toEqual(b);
  });
});

describe('US-011 AC-6 the crop warning in the conversion', () => {
  const A4 = (() => {
    const result = resolvePageSetup(BUILTIN_PAGE_PRESETS['A4 digital']);
    if (!result.ok) throw new Error('valid');
    return result.value;
  })();

  it('US-011 AC-6: warns for 2000×3000 on 154×216 mm with the line of the image (auto cover)', async () => {
    const result = await go(
      COVER_FIRST,
      rig(cover(), {[COVER]: pngHeader(2000, 3000)}),
    );
    expect(result.warnings).toEqual([
      {
        code: 'COVER_CROPPED',
        message:
          'Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)',
        line: 1,
      },
    ]);
  });

  it('US-011 AC-6: gives line 0 for a cover file', async () => {
    const r = rig(cover({mode: 'file', file: 'Layouting/Cover/front.png'}), {
      'Layouting/Cover/front.png': pngHeader(2000, 3000),
    });
    const result = await go(BODY, r);
    expect(result.warnings).toEqual([
      {
        code: 'COVER_CROPPED',
        message:
          'Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)',
        line: 0,
      },
    ]);
  });

  it('US-011 AC-6: does not warn for the same ratio, nor at exactly the threshold, nor below it', async () => {
    expect(
      (await go(COVER_FIRST, rig(cover(), {[COVER]: pngHeader(1540, 2160)})))
        .warnings,
    ).toEqual([]);
    const at = rig(cover({cropWarningPercent: 6.5}), {
      [COVER]: pngHeader(2000, 3000),
    });
    expect((await go(COVER_FIRST, at)).warnings).toEqual([]);
    const above = rig(cover({cropWarningPercent: 7}), {
      [COVER]: pngHeader(2000, 3000),
    });
    expect((await go(COVER_FIRST, above)).warnings).toEqual([]);
  });

  it('US-011 AC-6: warns above the threshold, and at threshold 0 for any crop', async () => {
    const low = rig(cover({cropWarningPercent: 6.4}), {
      [COVER]: pngHeader(2000, 3000),
    });
    expect((await go(COVER_FIRST, low)).warnings.map((w) => w.code)).toEqual([
      'COVER_CROPPED',
    ]);
    const zero = rig(cover({cropWarningPercent: 0}), {
      [COVER]: pngHeader(2000, 3000),
    });
    expect((await go(COVER_FIRST, zero)).warnings.map((w) => w.code)).toEqual([
      'COVER_CROPPED',
    ]);
    const none = rig(cover({cropWarningPercent: 0}), {
      [COVER]: pngHeader(1540, 2160),
    });
    expect((await go(COVER_FIRST, none)).warnings).toEqual([]);
  });

  it('US-011 AC-6: warns 28.7% for a square image', async () => {
    const result = await go(
      COVER_FIRST,
      rig(cover(), {[COVER]: pngHeader(1000, 1000)}),
    );
    expect(result.warnings[0]?.message).toBe(
      'Cover image is cropped by 28.7% (image 1000×1000 px, page 154×216 mm)',
    );
  });

  it('US-011 AC-6: uses the full page size including bleed, so the same image gives another share on a page without bleed', async () => {
    const result = await go(
      COVER_FIRST,
      rig(cover(), {[COVER]: pngHeader(2000, 3000)}, A4),
    );
    expect(result.warnings[0]?.message).toBe(
      'Cover image is cropped by 5.7% (image 2000×3000 px, page 210×297 mm)',
    );
  });

  it('US-011 AC-6: swaps the size of a JPEG with EXIF orientation 6 before taking the ratio (Typst turns it)', async () => {
    const file = 'Layouting/Cover/photo.jpg';
    const turned = rig(cover({mode: 'file', file}), {
      [file]: jpegHeader(3000, 2000, {orientation: 6}),
    });
    expect((await go(BODY, turned)).warnings.map((w) => w.message)).toEqual([
      'Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)',
    ]);
    const plain = rig(cover({mode: 'file', file}), {
      [file]: jpegHeader(3000, 2000),
    });
    expect((await go(BODY, plain)).warnings.map((w) => w.message)).toEqual([
      'Cover image is cropped by 52.5% (image 3000×2000 px, page 154×216 mm)',
    ]);
  });

  it('US-011 AC-6: reads the size of a webp, a gif and an svg cover', async () => {
    const message = (size: string) =>
      `Cover image is cropped by 6.5% (image ${size} px, page 154×216 mm)`;
    const cases: [string, Uint8Array, string][] = [
      ['Layouting/Cover/front.webp', webpLossy(2000, 3000), '2000×3000'],
      ['Layouting/Cover/front.gif', gifHeader(200, 300), '200×300'],
      [
        'Layouting/Cover/front.svg',
        svgText('viewBox="0 0 2000 3000"'),
        '2000×3000',
      ],
    ];
    for (const [file, bytes, size] of cases) {
      const r = rig(cover({mode: 'file', file}), {[file]: bytes});
      expect(
        (await go(BODY, r)).warnings.map((w) => w.message),
        file,
      ).toEqual([message(size)]);
    }
  });

  it('US-011 AC-6: skips the check silently when no size can be read (SVG without viewBox and sizes)', async () => {
    const file = 'Layouting/Cover/front.svg';
    const r = rig(cover({mode: 'file', file}), {[file]: svgText('')});
    const result = await go(BODY, r);
    expect(result.warnings).toEqual([]);
    expect(result.typ).toContain(`${PAGE}[`);
  });

  it('US-011 AC-6: reads the head of the cover with IMAGE_SIZE_READ_BYTES and of other images with 16 bytes, and nothing for mode none', async () => {
    const r = rig(cover());
    await go(
      `![](assets/cover_plate_1000.png)\n\n![](assets/map.png)\n\n${BODY}`,
      r,
    );
    const byPath = new Map(
      r.index.reads.map((p, i) => [p, r.index.lengths[i]]),
    );
    expect(byPath.get(COVER)).toBe(IMAGE_SIZE_READ_BYTES);
    expect(byPath.get(`${ASSETS}/map.png`)).toBe(16);
    expect(r.index.reads.filter((p) => p === COVER)).toHaveLength(1);
    const none = rig(cover({mode: 'none'}));
    await go(COVER_FIRST, none);
    expect(none.index.lengths).toEqual([16]);
  });
});

describe('US-011 AC-7 a cover that cannot be used', () => {
  it('US-011 AC-7: reports COVER_MISSING for a file that does not exist and makes no cover', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'file', file: 'Layouting/Cover/none.png'})),
    );
    expect(result.warnings).toEqual([
      {
        code: 'COVER_MISSING',
        message: 'Cover image not found: Layouting/Cover/none.png',
        line: 0,
      },
    ]);
    expect(result.typ).not.toContain(PAGE);
    expect(result.typ).toContain('= The Handbook');
  });

  it('US-011 AC-7: reports COVER_TYPE_UNSUPPORTED for a .bmp and for a file that is not what its extension says', async () => {
    const bmp = await go(
      BODY,
      rig(cover({mode: 'file', file: 'Layouting/Cover/plain.bmp'})),
    );
    expect(bmp.warnings).toEqual([
      {
        code: 'COVER_TYPE_UNSUPPORTED',
        message:
          'Cover image type .bmp is not supported: Layouting/Cover/plain.bmp',
        line: 0,
      },
    ]);
    expect(bmp.typ).not.toContain(PAGE);
    const fake = rig(cover({mode: 'file', file: 'Layouting/Cover/fake.png'}), {
      'Layouting/Cover/fake.png': jpeg(),
    });
    expect((await go(BODY, fake)).warnings).toEqual([
      {
        code: 'COVER_TYPE_UNSUPPORTED',
        message:
          'Cover image is not a valid .png image: Layouting/Cover/fake.png',
        line: 0,
      },
    ]);
  });

  it('US-011 AC-7: accepts a .webp cover', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'file', file: 'Layouting/Cover/front.webp'}), {
        'Layouting/Cover/front.webp': webpLossy(1540, 2160),
      }),
    );
    expect(result.warnings).toEqual([]);
    expect(result.typ).toContain(
      '#image("assets/_external/front.webp", width: 100%',
    );
  });

  it('US-011 AC-7: a web address as cover file is reported as missing', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'file', file: 'https://example.org/c.png'})),
    );
    expect(result.warnings.map((w) => w.code)).toEqual(['COVER_MISSING']);
  });

  it('US-011 AC-7: an auto cover that is missing is reported with its line, removed from the body, and not reported as an image', async () => {
    const result = await go(`![](assets/missing.png)\n\n${BODY}`, rig(cover()));
    expect(result.warnings).toEqual([
      {
        code: 'COVER_MISSING',
        message: 'Cover image not found: assets/missing.png',
        line: 1,
      },
    ]);
    expect(result.typ).not.toContain(PAGE);
    expect(result.typ).not.toContain('Missing image');
    expect(result.typ).toContain('= The Handbook');
  });

  it('US-011 AC-7: an auto cover of an unsupported type is reported and removed (.bmp image, .pdf embed)', async () => {
    const bmp = await go(`![](plain.bmp)\n\n${BODY}`, rig(cover()));
    expect(bmp.warnings).toEqual([
      {
        code: 'COVER_TYPE_UNSUPPORTED',
        message: 'Cover image type .bmp is not supported: plain.bmp',
        line: 1,
      },
    ]);
    expect(bmp.typ).not.toContain('Missing image');
    const pdf = await go(`![[plan.pdf]]\n\n${BODY}`, rig(cover()));
    expect(pdf.warnings.map((w) => w.code)).toEqual(['COVER_TYPE_UNSUPPORTED']);
    expect(pdf.typ).not.toContain(PAGE);
  });

  it('US-011 AC-7: a name that matches several files uses the first and reports ASSET_AMBIGUOUS as for any image', async () => {
    const result = await go(
      `![[cover.png]]\n\n${BODY}`,
      rig(cover(), {'A/cover.png': pngHeader(1540, 2160)}),
    );
    expect(result.warnings).toEqual([
      {
        code: 'ASSET_AMBIGUOUS',
        message: '"cover.png" matches 2 files; the first is used',
        line: 1,
      },
    ]);
    expect(result.typ).toContain(`${PAGE}[`);
    expect(result.assets).toEqual([
      {from: 'A/cover.png', to: 'assets/_external/cover.png'},
    ]);
  });

  it('US-011 AC-7: mode none reports no cover problem for a missing file setting', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'none', file: 'Layouting/Cover/none.png'})),
    );
    expect(result.warnings).toEqual([]);
  });

  it('US-011 AC-7: the body is generated normally after a cover problem', async () => {
    const good = await go(`Intro\n\n${BODY}`, rig(cover({mode: 'none'})));
    const bad = await go(
      `Intro\n\n${BODY}`,
      rig(cover({mode: 'file', file: 'x/none.png'})),
    );
    expect(afterPreamble(bad.typ)).toEqual(afterPreamble(good.typ));
  });
});

describe('US-011 AC-8 composed: cover file, blank page and crop', () => {
  it('US-011 AC-8: gives cover, blank page and body in that order with exactly one COVER_CROPPED', async () => {
    const r = rig(
      cover({
        mode: 'file',
        file: 'Layouting/Cover/front.png',
        blankPageAfter: true,
      }),
      {
        'Layouting/Cover/front.png': pngHeader(2000, 3000),
      },
    );
    const result = await go(`![](assets/map.png)\n\n${BODY}`, r);
    expect(result.warnings.map((w) => w.code)).toEqual(['COVER_CROPPED']);
    const lines = afterPreamble(result.typ);
    expect(lines.slice(0, 5)).toEqual([
      `${PAGE}[`,
      '  #image("assets/_external/front.png", width: 100%, height: 100%, fit: "cover")',
      ']',
      `${PAGE}[]`,
      '#counter(page).update(1)',
    ]);
    expect(lines[6]).toBe('= The Handbook <h-the-handbook>');
  });
});

describe('US-011 AC-9 the cover is copied once', () => {
  it('US-011 AC-9: lists the cover image once although the body uses it again', async () => {
    const source = `![](assets/cover_plate_1000.png)\n\n${BODY}\n![Again](assets/cover_plate_1000.png)\n`;
    const result = await go(source, rig(cover()));
    expect(result.assets).toEqual([
      {from: COVER, to: 'assets/cover_plate_1000.png'},
    ]);
    expect(result.typ.match(/"assets\/cover_plate_1000\.png"/g)).toHaveLength(
      2,
    );
  });

  it('US-011 AC-9: gives the cover file a name that does not clash with another asset (first use wins, the cover comes first)', async () => {
    const r = rig(cover({mode: 'file', file: 'Layouting/Cover/front.png'}));
    const result = await go(
      `Intro\n\n![Other](../Other/front.png)\n\n${BODY}`,
      r,
    );
    expect(result.assets.map((a) => a.to)).toEqual([
      'assets/_external/front.png',
      'assets/_external/front-2.png',
    ]);
    expect(result.typ).toContain(
      '#image("assets/_external/front.png", width: 100%',
    );
  });

  it('US-011 AC-9 (SCAR-011): never gives two files the same name when another asset is called like the generated name front-2.png', async () => {
    const r = rig(cover({mode: 'file', file: 'Layouting/Cover/front.png'}));
    const result = await go(
      `Intro\n\n![](../Other/front.png)\n\n![](../Other/front-2.png)\n\n${BODY}`,
      r,
    );
    const names = result.assets.map((a) => a.to);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    expect(names[0]).toBe('assets/_external/front.png');
  });

  it('US-011 AC-4 (SCAR-001, SCAR-010): writes a cover name with quotes and a backslash as an escaped Typst string', async () => {
    const file = 'Layouting/Cover/say "hi" \\ cover.png';
    const result = await go(BODY, rig(cover({mode: 'file', file})));
    expect(result.assets).toHaveLength(1);
    expect(result.typ).toContain(
      `#image(${typstString(result.assets[0]!.to)}, width: 100%`,
    );
  });

  it('US-011 AC-9: does not list a cover file that is missing or not an image', async () => {
    const result = await go(
      BODY,
      rig(cover({mode: 'file', file: 'Layouting/Cover/plain.bmp'})),
    );
    expect(result.assets).toEqual([]);
  });
});

describe('US-011 AC-10 the reserved back cover', () => {
  it('US-011 AC-10: reports COVER_BACK_UNSUPPORTED once and otherwise ignores it, in every mode', async () => {
    for (const mode of ['auto', 'file', 'none'] as const) {
      const result = await go(
        BODY,
        rig(
          cover({
            mode,
            file: mode === 'file' ? 'Layouting/Cover/front.png' : null,
            back: true,
          }),
        ),
      );
      expect(
        result.warnings.filter((w) => w.code === 'COVER_BACK_UNSUPPORTED'),
        mode,
      ).toEqual([
        {
          code: 'COVER_BACK_UNSUPPORTED',
          message: 'cover.back is not supported yet and is ignored',
          line: 0,
        },
      ]);
    }
  });

  it('US-011 AC-10: reports nothing without cover.back', async () => {
    expect((await go(BODY, rig(cover()))).warnings).toEqual([]);
  });
});

describe('US-011 a real image of the fake vault', () => {
  it('US-011 AC-6: the stand-in png of 30×20 pixels is read from its real header', async () => {
    const result = await go(`![](assets/small.png)\n\n${BODY}`, rig(cover()));
    expect(standIn('x.png').length).toBeGreaterThan(16);
    expect(result.warnings.map((w) => w.message)).toEqual([
      'Cover image is cropped by 52.5% (image 30×20 px, page 154×216 mm)',
    ]);
    expect(result.typ).toContain(`${PAGE}[`);
  });
});
