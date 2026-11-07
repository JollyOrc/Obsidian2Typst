// US-034: the print checks — images below the print resolution (AC-2,
// AC-3). Pure: no Obsidian, Node, or I/O imports. The drawn widths come from
// the compile's `<o2t-image>` facts and the conversion's fixed-width images;
// the pixel widths from the image files' headers.
import {extensionOf} from '../assets';
import {readImageSize} from '../assets/image-size';
import type {ImageFact, Warning} from '../emit';

/** US-034 AC-2: the raster types whose pixel width is read; vectors are not checked. */
const RASTER = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/**
 * US-034 AC-2: the pixel width of a raster image's file, by its header; null
 * for a vector image (SVG, PDF) or a header that cannot be read.
 */
export function pixelWidthOf(file: string, bytes: Uint8Array): number | null {
  const extension = extensionOf(file);
  if (!RASTER.has(extension)) return null;
  return readImageSize(extension, bytes)?.width ?? null;
}

/** US-034 AC-2: the pixel widths of the files that are raster images. */
export function pixelWidths(
  files: Readonly<Record<string, Uint8Array>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [file, bytes] of Object.entries(files)) {
    const width = pixelWidthOf(file, bytes);
    if (width !== null) out[file] = width;
  }
  return out;
}

/**
 * US-034 | AC-2, AC-3: one `IMAGE_LOW_DPI "<file>": <d> dpi at <w> mm (min
 * <m>)` per file below `minDpi`, checked at its largest drawn width, in the
 * order the files are first drawn; `d` a whole number, `w` to 0.1 mm. A file
 * without a pixel width (vector, unreadable) is not checked; `minDpi` 0 is
 * off. The warnings have no source line (0).
 */
export function lowDpiWarnings(
  images: readonly ImageFact[],
  pixelWidths: Readonly<Record<string, number>>,
  minDpi: number,
): Warning[] {
  if (minDpi <= 0) return [];
  const widest = new Map<string, number>();
  for (const {file, widthMm} of images) {
    if (!(widthMm > 0)) continue;
    widest.set(file, Math.max(widest.get(file) ?? 0, widthMm));
  }
  const out: Warning[] = [];
  for (const [file, widthMm] of widest) {
    const pixels = pixelWidths[file];
    if (pixels === undefined) continue;
    const dpi = pixels / (widthMm / 25.4);
    if (Math.round(dpi) >= minDpi) continue;
    out.push({
      code: 'IMAGE_LOW_DPI',
      message: `"${file}": ${Math.round(dpi)} dpi at ${widthMm.toFixed(1)} mm (min ${minDpi})`,
      line: 0,
    });
  }
  return out;
}

/**
 * US-034 AC-2: the drawn-width facts of a compile (`<o2t-image>` values)
 * that have the expected shape; anything else is ignored.
 */
export function imageFacts(values: readonly unknown[]): ImageFact[] {
  return values.flatMap((v) => {
    if (typeof v !== 'object' || v === null) return [];
    const {file, widthMm} = v as Record<string, unknown>;
    return typeof file === 'string' && typeof widthMm === 'number'
      ? [{file, widthMm}]
      : [];
  });
}

export {
  entryPages,
  scanWordGaps,
  type EntryPages,
  type GapLine,
} from './word-gaps';
