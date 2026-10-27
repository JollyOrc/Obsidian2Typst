// US-011 — the pure parts of the cover: image sizes from file heads, the crop
// share, the first-block rule, the cover page text and the `cover` fields of a
// preset note (unit, pure core). The conversion with a cover is in
// us-011-cover-convert.test.ts, the PDF in tests/integration. Source of truth:
// docs/user-stories/US-011-cover.md.
import {describe, expect, it} from 'vitest';
import {IMAGE_SIZE_READ_BYTES, readImageSize} from '../../src/core/assets';
import {
  DEFAULT_COVER,
  cropMessage,
  cropPercent,
  emitCoverPages,
  findCoverImage,
  formatMm,
} from '../../src/core/cover';
import {parse} from '../../src/core/parse';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {
  gifHeader,
  jpegHeader,
  pngHeader,
  svgText,
  webpExtended,
  webpLossless,
  webpLossy,
} from '../support/image-bytes';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

describe('US-011 AC-6 reading image sizes from the head of a file', () => {
  it('US-011 AC-6: reads width and height of a PNG from its IHDR', () => {
    expect(readImageSize('png', pngHeader(2000, 3000))).toEqual({
      width: 2000,
      height: 3000,
    });
  });

  it('US-011 AC-6: reads a GIF (87a and 89a) and a WebP of all three forms', () => {
    expect(readImageSize('gif', gifHeader(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
    expect(readImageSize('gif', gifHeader(5, 7, '87a'))).toEqual({
      width: 5,
      height: 7,
    });
    expect(readImageSize('webp', webpLossy(1200, 1800))).toEqual({
      width: 1200,
      height: 1800,
    });
    expect(readImageSize('webp', webpLossless(1201, 1799))).toEqual({
      width: 1201,
      height: 1799,
    });
    expect(readImageSize('webp', webpExtended(5000, 7000))).toEqual({
      width: 5000,
      height: 7000,
    });
  });

  it('US-011 AC-6: reads a JPEG frame header, baseline and progressive, also after filler segments', () => {
    expect(readImageSize('jpg', jpegHeader(1500, 2100))).toEqual({
      width: 1500,
      height: 2100,
    });
    expect(
      readImageSize('jpeg', jpegHeader(1500, 2100, {marker: 0xc2})),
    ).toEqual({width: 1500, height: 2100});
    expect(
      readImageSize('jpg', jpegHeader(300, 200, {filler: 600_000})),
    ).toEqual({width: 300, height: 200});
  });

  it('US-011 AC-6: a JPEG whose frame marker lies after the bytes that were read gives no size', () => {
    const far = jpegHeader(300, 200, {filler: 1_200_000});
    expect(far.length).toBeGreaterThan(IMAGE_SIZE_READ_BYTES);
    expect(
      readImageSize('jpg', far.subarray(0, IMAGE_SIZE_READ_BYTES)),
    ).toBeNull();
    expect(IMAGE_SIZE_READ_BYTES).toBe(1_048_576);
  });

  it('US-011 AC-6: swaps width and height for an EXIF orientation of 5 to 8, in both byte orders', () => {
    for (const little of [false, true]) {
      for (const orientation of [5, 6, 7, 8]) {
        expect(
          readImageSize(
            'jpg',
            jpegHeader(300, 200, {orientation, littleEndian: little}),
          ),
          `${orientation} ${little}`,
        ).toEqual({width: 200, height: 300});
      }
      for (const orientation of [1, 2, 3, 4]) {
        expect(
          readImageSize(
            'jpg',
            jpegHeader(300, 200, {orientation, littleEndian: little}),
          ),
          `${orientation} ${little}`,
        ).toEqual({width: 300, height: 200});
      }
    }
  });

  it('US-011 AC-6: an EXIF orientation outside 1 to 8 or a damaged EXIF is ignored', () => {
    expect(
      readImageSize('jpg', jpegHeader(300, 200, {orientation: 0})),
    ).toEqual({width: 300, height: 200});
    expect(
      readImageSize('jpg', jpegHeader(300, 200, {orientation: 9})),
    ).toEqual({width: 300, height: 200});
  });

  it('US-011 AC-6: reads an SVG from viewBox, else from width and height', () => {
    expect(readImageSize('svg', svgText('viewBox="0 0 600 900"'))).toEqual({
      width: 600,
      height: 900,
    });
    expect(readImageSize('svg', svgText('viewBox="10 20 50.5 80"'))).toEqual({
      width: 50.5,
      height: 80,
    });
    expect(readImageSize('svg', svgText('viewBox="0,0,300,450"'))).toEqual({
      width: 300,
      height: 450,
    });
    expect(readImageSize('svg', svgText('width="400" height="300"'))).toEqual({
      width: 400,
      height: 300,
    });
    expect(
      readImageSize('svg', svgText('width="400px" height="300px"')),
    ).toEqual({width: 400, height: 300});
    expect(readImageSize('svg', svgText('width="40mm" height="60mm"'))).toEqual(
      {width: 40, height: 60},
    );
  });

  it('US-011 AC-6: the viewBox wins over width and height; width and height in different units are not used', () => {
    expect(
      readImageSize(
        'svg',
        svgText('width="10" height="10" viewBox="0 0 600 900"'),
      ),
    ).toEqual({width: 600, height: 900});
    expect(
      readImageSize('svg', svgText('width="40mm" height="300px"')),
    ).toBeNull();
    expect(
      readImageSize('svg', svgText('width="100%" height="100%"')),
    ).toBeNull();
  });

  it('US-011 AC-6: gives null for an SVG without viewBox and sizes, with a zero size, or with only a width', () => {
    expect(readImageSize('svg', svgText(''))).toBeNull();
    expect(readImageSize('svg', svgText('viewBox="0 0 0 10"'))).toBeNull();
    expect(readImageSize('svg', svgText('width="400"'))).toBeNull();
  });

  it('US-011 AC-6: gives null for a damaged or too short file, an unknown type and an empty file', () => {
    expect(readImageSize('png', pngHeader(10, 10).subarray(0, 20))).toBeNull();
    expect(
      readImageSize(
        'png',
        new TextEncoder().encode('not an image at all, really'),
      ),
    ).toBeNull();
    expect(readImageSize('gif', gifHeader(5, 5).subarray(0, 8))).toBeNull();
    expect(readImageSize('webp', webpLossy(5, 5).subarray(0, 24))).toBeNull();
    expect(readImageSize('jpg', new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(readImageSize('bmp', pngHeader(10, 10))).toBeNull();
    expect(readImageSize('png', new Uint8Array(0))).toBeNull();
  });

  it('US-011 AC-6: a PNG whose first chunk is not IHDR gives no size', () => {
    const bytes = pngHeader(10, 10).slice();
    bytes.set(new TextEncoder().encode('IDAT'), 12);
    expect(readImageSize('png', bytes)).toBeNull();
  });

  it('US-011 AC-6: a JPEG skips a Huffman table (marker 0xC4) and reads the real frame after it', () => {
    const frame = jpegHeader(300, 200).slice(2);
    const table = [0xff, 0xc4, 0x00, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8];
    const bytes = new Uint8Array([0xff, 0xd8, ...table, ...frame]);
    expect(readImageSize('jpg', bytes)).toEqual({width: 300, height: 200});
  });

  it('US-011 AC-6: gives null for a size of zero', () => {
    expect(readImageSize('png', pngHeader(0, 10))).toBeNull();
    expect(readImageSize('gif', gifHeader(10, 0))).toBeNull();
  });

  it('US-011 AC-6: takes the type from the extension, in any case', () => {
    expect(readImageSize('PNG', pngHeader(3, 4))).toEqual({
      width: 3,
      height: 4,
    });
  });
});

describe('US-011 AC-6 the crop share', () => {
  const page = {width: 154, height: 216};

  it('US-011 AC-6: computes 6.5% for an image of 2000×3000 on a 154×216 mm page', () => {
    expect(cropPercent({width: 2000, height: 3000}, page)).toBe(6.5);
  });

  it('US-011 AC-6: computes 0.0% for the same ratio', () => {
    expect(cropPercent({width: 1540, height: 2160}, page)).toBe(0);
  });

  it('US-011 AC-6: computes 28.7% for a square image', () => {
    expect(cropPercent({width: 1000, height: 1000}, page)).toBe(28.7);
  });

  it('US-011 AC-6: is symmetric: an image too wide for a portrait page is cropped like one too tall for a landscape page', () => {
    expect(cropPercent({width: 3000, height: 2000}, page)).toBe(52.5);
    expect(
      cropPercent({width: 2000, height: 3000}, {width: 216, height: 154}),
    ).toBe(52.5);
  });

  it('US-011 AC-6: rounds to one decimal, half up', () => {
    // 1 - 0.95 = 5.0 exactly; 1 - 0.9496 = 5.04 -> 5.0; 1 - 0.9494 = 5.06 -> 5.1
    expect(
      cropPercent({width: 95, height: 100}, {width: 100, height: 100}),
    ).toBe(5);
    expect(
      cropPercent({width: 9496, height: 10000}, {width: 100, height: 100}),
    ).toBe(5);
    expect(
      cropPercent({width: 9494, height: 10000}, {width: 100, height: 100}),
    ).toBe(5.1);
  });

  it('US-011 AC-6: writes the message with × and the page size with at most one decimal', () => {
    expect(cropMessage(6.5, {width: 2000, height: 3000}, page)).toBe(
      'Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)',
    );
    expect(
      cropMessage(
        28.7,
        {width: 1000, height: 1000},
        {width: 154.5, height: 216.25},
      ),
    ).toBe(
      'Cover image is cropped by 28.7% (image 1000×1000 px, page 154.5×216.3 mm)',
    );
  });

  it('US-011 AC-6: formatMm drops a trailing zero and rounds to one decimal', () => {
    expect(formatMm(154)).toBe('154');
    expect(formatMm(154.0)).toBe('154');
    expect(formatMm(154.5)).toBe('154.5');
    expect(formatMm(216.25)).toBe('216.3');
    expect(formatMm(148.04)).toBe('148');
  });
});

describe('US-011 AC-2 and AC-3 which block is the cover', () => {
  const find = (source: string) => findCoverImage(parse(source).root);

  it('US-011 AC-2: takes an image alone in the first paragraph, as in compiledtext.md', () => {
    const found = find('![](assets/cover_plate_1000.png)\n\n# The Handbook\n');
    expect(found?.index).toBe(0);
    expect(found?.node).toMatchObject({
      kind: 'image',
      src: 'assets/cover_plate_1000.png',
    });
  });

  it('US-011 AC-2: skips frontmatter, blank lines and a comment block before the image', () => {
    const found = find(
      '---\ntitle: x\n---\n\n<!-- note -->\n\n\n![A cover](c.png)\n\ntext',
    );
    expect(found?.node).toMatchObject({kind: 'image', src: 'c.png'});
    expect(found?.index).toBe(1);
  });

  it('US-011 AC-2: takes an Obsidian embed with a size, and ignores the size', () => {
    const found = find('![[cover.png|600]]\n\ntext');
    expect(found?.node).toMatchObject({
      kind: 'embed',
      file: 'cover.png',
      alias: '600',
    });
  });

  it('US-011 AC-2: takes an image that has an alt text and a title', () => {
    expect(find('![The cover](c.png "A title")\n\ntext')).not.toBeNull();
  });

  it('US-011 AC-2: has no cover when the first block is text, a heading, a list, a quote, a table or code', () => {
    for (const source of [
      'Some text\n\n![](c.png)',
      '# Title\n\n![](c.png)',
      '- item\n\n![](c.png)',
      '> quote\n\n![](c.png)',
      '| a |\n|---|\n| b |\n\n![](c.png)',
      '```\ncode\n```\n\n![](c.png)',
      '',
    ]) {
      expect(find(source), source).toBeNull();
    }
  });

  it('US-011 AC-2: has no cover when the first paragraph is an image and text, a link-wrapped image, two images, a web image or a note embed', () => {
    for (const source of [
      '![](a.png) Title\n\ntext',
      'Title ![](a.png)\n\ntext',
      '[![](a.png)](https://x.org)\n\ntext',
      '![](a.png)\n![](b.png)\n\ntext',
      '![](a.png) ![](b.png)\n\ntext',
      '![](https://example.org/a.png)\n\ntext',
      '![[Other note]]\n\ntext',
      '![[Other note#Heading]]\n\ntext',
    ]) {
      expect(find(source), source).toBeNull();
    }
  });

  it('US-011 AC-2: an embed or image of a type that is not an image can still be the first image (AC-7 reports it)', () => {
    expect(find('![[plan.pdf]]\n\ntext')?.node).toMatchObject({
      kind: 'embed',
      file: 'plan.pdf',
    });
    expect(find('![](a.bmp)\n\ntext')?.node).toMatchObject({
      kind: 'image',
      src: 'a.bmp',
    });
  });

  it('US-011 AC-2: a second comment block and then text is not skipped past text', () => {
    expect(find('<!-- a -->\n\ntext\n\n![](c.png)')).toBeNull();
  });
});

describe('US-011 AC-4 and AC-5 the cover pages', () => {
  const PAGE = '#page(margin: 0pt, header: none, footer: none)';

  it('US-011 AC-4: writes the cover page and the counter reset', () => {
    expect(
      emitCoverPages({
        path: 'assets/cover_plate_1000.png',
        blankPageAfter: false,
      }),
    ).toBe(
      [
        `${PAGE}[`,
        '  #image("assets/cover_plate_1000.png", width: 100%, height: 100%, fit: "cover")',
        ']',
        '#counter(page).update(1)',
      ].join('\n'),
    );
  });

  it('US-011 AC-5: puts the blank page before the counter reset', () => {
    const text = emitCoverPages({path: 'c.png', blankPageAfter: true});
    expect(text.split('\n')).toEqual([
      `${PAGE}[`,
      '  #image("c.png", width: 100%, height: 100%, fit: "cover")',
      ']',
      `${PAGE}[]`,
      '#counter(page).update(1)',
    ]);
    expect(text.indexOf('[]')).toBeLessThan(text.indexOf('#counter'));
  });

  it('US-011 AC-4: writes the path as a Typst string, quotes and backslashes escaped', () => {
    expect(
      emitCoverPages({path: 'a "b"\\c.png', blankPageAfter: false}),
    ).toContain('#image("a \\"b\\"\\\\c.png",');
  });
});

describe('US-011 AC-1 the cover fields of a preset note', () => {
  it('US-011 AC-1: reads mode, file, blankPageAfter, cropWarningPercent and back with their lines', () => {
    const result = parsePreset(
      note(
        'cover:',
        '  mode: file',
        '  file: "Layouting/Cover/front.png"',
        '  blankPageAfter: true',
        '  cropWarningPercent: 7.5',
        '  back: "Layouting/Cover/back.png"',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.cover).toEqual({
      mode: 'file',
      file: 'Layouting/Cover/front.png',
      blankPageAfter: true,
      cropWarningPercent: 7.5,
      back: true,
    });
    expect(result.lines['cover.mode']).toBe(4);
    expect(result.lines['cover.cropWarningPercent']).toBe(7);
  });

  it('US-011 AC-1: gives the documented defaults when the note has no cover group', () => {
    const parsed = parsePreset(note());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fields.cover).toBeUndefined();
    const result = effectiveSettings(parsed, {}, () => false);
    expect(result.ok && result.settings.cover).toEqual({
      mode: 'auto',
      file: null,
      blankPageAfter: false,
      cropWarningPercent: 5,
      back: false,
    });
    expect(DEFAULT_COVER).toEqual({
      mode: 'auto',
      file: null,
      blankPageAfter: false,
      cropWarningPercent: 5,
      back: false,
    });
  });

  it('US-011 AC-1: takes the values of the note; a null is not set; back is true for any value that is not null', () => {
    const parsed = parsePreset(
      note('cover:', '  mode: none', '  blankPageAfter: null', '  back: 3'),
    );
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(parsed, {}, () => false);
    expect(result.ok && result.settings.cover).toEqual({
      mode: 'none',
      file: null,
      blankPageAfter: false,
      cropWarningPercent: 5,
      back: true,
    });
    const nullBack = parsePreset(note('cover:', '  back: null'));
    if (!nullBack.ok) throw new Error('valid');
    const second = effectiveSettings(nullBack, {}, () => false);
    expect(second.ok && second.settings.cover.back).toBe(false);
  });

  it('US-011 AC-1: refuses an unknown mode with its line', () => {
    const result = parsePreset(note('cover:', '  mode: front'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatPresetError(result.error)).toBe(
      'cover.mode must be auto, file or none (line 4)',
    );
  });

  it('US-011 AC-1: refuses a cropWarningPercent below 0, above 100 or not a number', () => {
    for (const value of ['-1', '101', 'abc', '"5"', 'true']) {
      const result = parsePreset(
        note('cover:', '  mode: auto', `  cropWarningPercent: ${value}`),
      );
      expect(result.ok, value).toBe(false);
      if (result.ok) continue;
      expect(formatPresetError(result.error), value).toBe(
        'cover.cropWarningPercent must be a number from 0 to 100 (line 5)',
      );
    }
    for (const value of ['0', '100', '2.5']) {
      expect(
        parsePreset(note('cover:', `  cropWarningPercent: ${value}`)).ok,
        value,
      ).toBe(true);
    }
  });

  it('US-011 AC-1: refuses a blankPageAfter that is not true or false and a file that is not text', () => {
    const blank = parsePreset(note('cover:', '  blankPageAfter: "yes"'));
    expect(blank.ok).toBe(false);
    if (!blank.ok) {
      expect(formatPresetError(blank.error)).toBe(
        'cover.blankPageAfter must be true or false (line 4)',
      );
    }
    const file = parsePreset(note('cover:', '  mode: file', '  file: 5'));
    expect(file.ok).toBe(false);
    if (!file.ok) {
      expect(formatPresetError(file.error)).toBe(
        'cover.file must be a vault path written as text (line 5)',
      );
    }
  });

  it('US-011 AC-1: mode file needs a file; the error is on the line of mode', () => {
    for (const lines of [
      ['cover:', '  mode: file'],
      ['cover:', '  mode: file', '  file: ""'],
      ['cover:', '  mode: file', '  file: null'],
    ]) {
      const result = parsePreset(note(...lines));
      expect(result.ok, lines.join('|')).toBe(false);
      if (result.ok) continue;
      expect(formatPresetError(result.error)).toBe(
        'cover.file is needed when cover.mode is file (line 4)',
      );
    }
    expect(parsePreset(note('cover:', '  mode: auto', '  file: ""')).ok).toBe(
      true,
    );
  });

  it('US-011 AC-1: a cover group that is not a mapping is refused', () => {
    const result = parsePreset(note('cover: 5'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatPresetError(result.error)).toBe(
      'cover must be a group of settings (line 3)',
    );
  });

  it('US-011 AC-1: the Defaults do not hold cover settings (preset notes only)', () => {
    const result = validateFields({
      cover: {mode: 'none'},
      highlightColor: '#a5d6a7',
    });
    expect(result.ok && result.fields).toEqual({highlightColor: '#a5d6a7'});
    const parsed = parsePreset(note('cover:', '  mode: none'));
    if (!parsed.ok) throw new Error('valid');
    // A cover in the Defaults must not reach the effective settings.
    const merged = effectiveSettings(
      {fields: {}, lines: {}},
      {cover: {mode: 'none'}} as never,
      () => false,
    );
    expect(merged.ok && merged.settings.cover.mode).toBe('auto');
  });
});
