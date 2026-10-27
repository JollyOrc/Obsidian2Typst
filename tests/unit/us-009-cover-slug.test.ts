// US-009 AC-11 — the cover with a slug (unit): the geometry carries the slug,
// the cover page margin is the slug, and the crop warning measures trim + bleed.
// The PDF is measured in tests/integration/us-009-cover-slug-pdf.test.ts.
// Source of truth: docs/user-stories/US-009-page-setup.md.
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {emitCoverPages} from '../../src/core/cover';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
} from '../../src/core/layout/page-setup';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {pngHeader} from '../support/image-bytes';

const geometry = (slug: number) => {
  const r = resolvePageSetup({...BUILTIN_PAGE_PRESETS['A5 print'], slug});
  if (!r.ok) throw new Error('valid');
  return r.value;
};

describe('US-009 AC-11 geometry', () => {
  it('US-009 AC-11: carries the slug in mm, 0 when not set', () => {
    expect(geometry(5).slug).toBe(5);
    const none = resolvePageSetup(BUILTIN_PAGE_PRESETS['A4 digital']);
    expect(none.ok && none.value.slug).toBe(0);
  });
});

describe('US-009 AC-11 cover page text', () => {
  const lines = (slug?: number) =>
    emitCoverPages({path: 'c.png', blankPageAfter: true, slug}).split('\n');

  it('US-009 AC-11: slug 5 gives margin 5mm on the cover page and on the blank page', () => {
    expect(lines(5)).toEqual([
      '#page(margin: 5mm, header: none, footer: none)[',
      '  #image("c.png", width: 100%, height: 100%, fit: "cover")',
      ']',
      '#page(margin: 5mm, header: none, footer: none)[]',
      '#counter(page).update(1)',
    ]);
  });

  it('US-009 AC-11: slug 0 and no slug keep margin 0pt exactly as in US-011 AC-4', () => {
    expect(lines(0)).toEqual(lines(undefined));
    expect(lines(0)[0]).toBe('#page(margin: 0pt, header: none, footer: none)[');
  });

  it('US-009 AC-11: writes the slug in the number format of AC-7', () => {
    expect(lines(2.5)[0]).toBe(
      '#page(margin: 2.5mm, header: none, footer: none)[',
    );
    expect(lines(18.456)[0]).toContain('margin: 18.46mm');
  });
});

describe('US-009 AC-11 in the conversion', () => {
  async function go(slug: number) {
    const cover = 'Sample/assets/cover_plate_1000.png';
    const index = new FakeIndex([NOTE_PATH, cover]);
    index.images.set(cover, pngHeader(1000, 1000));
    return convert({
      source: '![](assets/cover_plate_1000.png)\n\n# Title\n\nText.\n',
      noteName: 'Rules',
      notePath: NOTE_PATH,
      settings: {
        ...SETTINGS,
        page: geometry(slug),
        cover: {...DEFAULT_COVER},
      },
      assets: index,
    });
  }

  it('US-009 AC-11: the cover page of the .typ has the slug as margin', async () => {
    const result = await go(5);
    expect(result.typ).toContain(
      '#page(margin: 5mm, header: none, footer: none)[',
    );
    expect((await go(0)).typ).toContain(
      '#page(margin: 0pt, header: none, footer: none)[',
    );
  });

  it('US-009 AC-11: COVER_CROPPED measures 154×216 mm with or without a slug', async () => {
    const expected =
      'Cover image is cropped by 28.7% (image 1000×1000 px, page 154×216 mm)';
    expect((await go(0)).warnings[0]?.message).toBe(expected);
    expect((await go(5)).warnings[0]?.message).toBe(expected);
  });
});
