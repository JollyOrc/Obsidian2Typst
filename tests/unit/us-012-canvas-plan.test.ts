// US-012 AC-7 — which pages get a canvas and which are released while the user
// scrolls, the aspect ratio of a page, and the pixel check that tells a drawn
// page from a blank one (SCAR-015). The drawing itself needs Obsidian: manual
// check M2 step 15. Source of truth:
// docs/user-stories/US-012-style-preview-panel.md.
import {describe, expect, it} from 'vitest';
import {
  BLANK_SHARE,
  aspectOf,
  isBlankPage,
  nonWhiteShare,
  planCanvases,
} from '../../src/core/preview/canvas';

// 20 pages of 400 high with a gap of 20: page k (1-based) starts at (k-1)*420.
const PAGES = Array.from({length: 20}, (_, i) => i + 1);
const GEOMETRY = {viewport: 300, pageHeight: 400, gap: 20};

const plan = (scrollTop: number, drawn: number[] = [], pages = PAGES) =>
  planCanvases({pages, drawn: new Set(drawn), scrollTop, ...GEOMETRY});

describe('US-012 AC-7 planCanvases', () => {
  it('US-012 AC-7: at the top, pages within one panel height of the visible part are drawn', () => {
    // visible [0, 300]; draw window [-300, 600]: page 1 (0-400), page 2 (420-820)
    expect(plan(0)).toEqual({draw: [1, 2], release: []});
  });

  it('US-012 AC-7: a page that is already drawn is not drawn again', () => {
    expect(plan(0, [1, 2])).toEqual({draw: [], release: []});
    expect(plan(0, [1])).toEqual({draw: [2], release: []});
  });

  it('US-012 AC-7: scrolling down draws the pages that come near', () => {
    // visible [840, 1140]; window [540, 1440]: page 2 (420-820) touches, 3, 4
    // (1260-1660) touch; page 5 starts at 1680
    expect(plan(840).draw).toEqual([2, 3, 4]);
  });

  it('US-012 AC-7: a drawn page more than three panel heights away is released', () => {
    // at the top the keep window is [-900, 1200]: page 3 (840-1240) stays,
    // page 4 starts at 1260 and goes, page 10 goes
    expect(plan(0, [1, 2, 3, 4, 10])).toEqual({draw: [], release: [4, 10]});
  });

  it('US-012 AC-7: a drawn page between the draw window and the release window stays as it is', () => {
    const result = plan(0, [3]);
    expect(result.release).toEqual([]);
    expect(result.draw).toEqual([1, 2]);
  });

  it('US-012 AC-7: only the pages of the range take part, in their order on screen', () => {
    // pages 7, 8, 9 at positions 0, 1, 2: the same plan as pages 1, 2, 3
    expect(plan(0, [], [7, 8, 9]).draw).toEqual([7, 8]);
  });

  it('US-012 AC-7: a page exactly one panel height away is drawn, exactly three away is kept, beyond is released', () => {
    // pages of 300 without a gap, viewport 300: page k starts at (k-1)*300
    const flat = (scrollTop: number, drawn: number[]) =>
      planCanvases({
        pages: PAGES,
        drawn: new Set(drawn),
        scrollTop,
        viewport: 300,
        pageHeight: 300,
        gap: 0,
      });
    expect(flat(0, []).draw).toEqual([1, 2, 3]); // page 3 is 300 away
    // page 4 is 600 away: kept; page 5 is 900 away: kept; page 6 is 1200 away
    expect(flat(0, [4, 5, 6]).release).toEqual([6]);
  });

  it('US-012 AC-7: drawn pages that are not in the range any more are released', () => {
    expect(plan(0, [1, 2, 7], [7, 8, 9]).release).toEqual([1, 2]);
  });

  it('US-012 AC-7: no pages gives an empty plan', () => {
    expect(plan(0, [], [])).toEqual({draw: [], release: []});
  });

  it('US-012 AC-7: a released page that is drawn again later is planned like a new one', () => {
    // visible [8000, 8300]; window [7700, 8600]: page 19 (7560-7960) and 20
    expect(plan(8000, [1, 2])).toEqual({
      draw: [19, 20],
      release: [1, 2],
    });
  });
});

describe('US-012 AC-5 aspectOf', () => {
  it('US-012 AC-5: A5 (148×210) is 0.705 and A4 (210×297) is 0.707 at three decimals', () => {
    expect(aspectOf({width: 148, height: 210}).toFixed(3)).toBe('0.705');
    expect(aspectOf({width: 210, height: 297}).toFixed(3)).toBe('0.707');
  });
});

/** RGBA pixels from a list of colours. */
const pixels = (...colours: [number, number, number, number][]) =>
  Uint8ClampedArray.from(colours.flat());

describe('US-012 AC-7 nonWhiteShare', () => {
  it('US-012 AC-7: an untouched canvas (transparent) has no non-white pixels', () => {
    expect(nonWhiteShare(pixels([0, 0, 0, 0], [0, 0, 0, 0]))).toBe(0);
  });

  it('US-012 AC-7: an all-white page has none', () => {
    expect(
      nonWhiteShare(pixels([255, 255, 255, 255], [255, 255, 255, 255])),
    ).toBe(0);
  });

  it('US-012 AC-7: one black pixel of four is 0.25; near-white (250) is white', () => {
    expect(
      nonWhiteShare(
        pixels(
          [0, 0, 0, 255],
          [255, 255, 255, 255],
          [250, 250, 250, 255],
          [255, 255, 255, 255],
        ),
      ),
    ).toBe(0.25);
  });

  it('US-012 AC-7: a pixel with one dark channel counts, an empty list is 0', () => {
    expect(nonWhiteShare(pixels([255, 255, 100, 255]))).toBe(1);
    expect(nonWhiteShare(new Uint8ClampedArray(0))).toBe(0);
  });

  it('US-012 AC-7: a page with fewer than 1 % non-white pixels is blank, 6.9 % is not', () => {
    expect(BLANK_SHARE).toBe(0.01);
    const make = (share: number) => {
      const data = new Uint8ClampedArray(1000 * 4).fill(255);
      for (let i = 0; i < Math.round(share * 1000); i++) data[i * 4] = 0;
      return data;
    };
    expect(isBlankPage(make(0.009))).toBe(true);
    expect(isBlankPage(make(0.01))).toBe(false);
    expect(isBlankPage(make(0.069))).toBe(false);
    expect(isBlankPage(new Uint8ClampedArray(0))).toBe(true);
  });
});
