// US-012 AC-5, AC-7: which pages of the preview get a canvas, the shape of a
// page, and the pixel check that tells a drawn page from a blank one. Pure
// core: no Obsidian or I/O imports.

/** US-012 AC-7: a page with fewer non-white pixels than this is blank. */
export const BLANK_SHARE = 0.01;

/** A pixel counts as white when every channel is at least this. */
const WHITE_FROM = 250;

export interface CanvasPlanInput {
  /** The pages on screen, in order (the range of AC-6). */
  pages: readonly number[];
  /** The pages that have a canvas now. */
  drawn: ReadonlySet<number>;
  scrollTop: number;
  /** Height of the visible part of the preview area. */
  viewport: number;
  pageHeight: number;
  /** Space between two pages. */
  gap: number;
}

/**
 * US-012 AC-7: the pages to draw and the canvases to release.
 *
 * Page `k` (its place in `pages`, from 0) occupies `k * (pageHeight + gap)` to
 * that plus `pageHeight`. A page that is not drawn is drawn when its distance
 * to the visible part is at most one `viewport`; a page that is drawn is
 * released when the distance is more than three `viewport`s or when it is not
 * on screen at all (the range changed). Draw order follows `pages`; release
 * order is ascending.
 */
export function planCanvases(input: CanvasPlanInput): {
  draw: number[];
  release: number[];
} {
  const {pages, drawn, scrollTop, viewport, pageHeight, gap} = input;
  const distance = (index: number): number => {
    const top = index * (pageHeight + gap);
    const bottom = top + pageHeight;
    return Math.max(top - (scrollTop + viewport), scrollTop - bottom, 0);
  };
  const draw: number[] = [];
  const kept = new Set<number>();
  pages.forEach((page, index) => {
    const away = distance(index);
    if (away <= 3 * viewport) kept.add(page);
    if (away <= viewport && !drawn.has(page)) draw.push(page);
  });
  const release = [...drawn]
    .filter((page) => !kept.has(page))
    .sort((a, b) => a - b);
  return {draw, release};
}

/** US-012 AC-5: width divided by height of a page (A5 148×210 is 0.705). */
export function aspectOf(size: {width: number; height: number}): number {
  return size.width / size.height;
}

/**
 * US-012 AC-7 (SCAR-008, SCAR-015): the share of pixels that are not white.
 * `rgba` is the data of `getImageData`. A pixel counts when it is not
 * transparent and a channel is below 250, so an untouched canvas (all zero)
 * counts as nothing drawn. An empty list gives 0.
 */
export function nonWhiteShare(rgba: ArrayLike<number>): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let marked = 0;
  for (let i = 0; i < pixels; i++) {
    const at = i * 4;
    const alpha = rgba[at + 3] ?? 0;
    if (alpha === 0) continue;
    if (
      (rgba[at] ?? 255) < WHITE_FROM ||
      (rgba[at + 1] ?? 255) < WHITE_FROM ||
      (rgba[at + 2] ?? 255) < WHITE_FROM
    ) {
      marked++;
    }
  }
  return marked / pixels;
}

/** US-012 AC-7: true when fewer than {@link BLANK_SHARE} of the pixels are drawn. */
export function isBlankPage(rgba: ArrayLike<number>): boolean {
  return nonWhiteShare(rgba) < BLANK_SHARE;
}
