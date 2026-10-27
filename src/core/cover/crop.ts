// US-011 AC-6: how much of the cover image Typst's `fit: "cover"` cuts away,
// and the words of the warning. Pure core.
import type {ImageSize} from '../assets';

/** A page size in millimetres. */
export interface PageMm {
  width: number;
  height: number;
}

/**
 * The share of the image that is cropped, in percent, rounded to one decimal:
 * `1 - min(a/b, b/a)` for the width/height ratio `a` of the image and `b` of
 * the page. Transform: rounding (half up, one decimal) is applied here, so the
 * threshold is compared against the rounded value.
 */
export function cropPercent(image: ImageSize, page: PageMm): number {
  const a = image.width / image.height;
  const b = page.width / page.height;
  const share = 1 - Math.min(a / b, b / a);
  return Math.round(share * 1000) / 10;
}

/** Millimetres with at most one decimal and no trailing zero. */
export function formatMm(value: number): string {
  return String(Number(value.toFixed(1)));
}

/** US-011 AC-6: the text of `COVER_CROPPED`. */
export function cropMessage(
  percent: number,
  image: ImageSize,
  page: PageMm,
): string {
  return (
    `Cover image is cropped by ${percent.toFixed(1)}% ` +
    `(image ${image.width}×${image.height} px, ` +
    `page ${formatMm(page.width)}×${formatMm(page.height)} mm)`
  );
}
