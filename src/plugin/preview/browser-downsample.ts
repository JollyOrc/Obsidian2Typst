// US-012 AC-12: smaller copies of large images for the preview, in the browser.
// The size plan and the resolution are the pure functions of
// `core/preview/downsample`; this file decodes, draws to the scratch canvas of
// `./canvas` and encodes. Only the preview request calls it; the export never
// does.
//
// WebP is never changed: a WebP file has no resolution that Typst reads, so a
// smaller copy would be placed at its pixel size and shrink in the preview, and
// a PNG under a `.webp` name is refused by Typst (checked with the compiler,
// `us-012-downsample-placed-size.test.ts`).
import {
  planDownsample,
  readDensity,
  scaledDensity,
  withDensity,
} from '../../core/preview/downsample';
import {makeScratchCanvas} from './canvas';

const log = (text: string): void => console.log(`[o2t preview] ${text}`);

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** An independent ArrayBuffer-backed copy (Blob parts must not be shared). */
const own = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes);

/**
 * US-012 AC-12: a copy of the image with at most 1200 px on its longest side
 * and the resolution written so that Typst places it at the original size
 * (JPEG, PNG), or null when the image is small enough, is a WebP, has an
 * unknown extension or cannot be decoded (the original is used then).
 */
export async function downsampleImage(
  bytes: Uint8Array,
  extension: string,
): Promise<Uint8Array | null> {
  const mime = MIME[extension.toLowerCase()];
  if (mime === undefined) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([own(bytes)], {type: mime}));
  } catch (error) {
    log(`image not decoded (${extension}): ${String(error)}`);
    return null;
  }
  try {
    const plan = planDownsample(bitmap);
    if (plan === null) return null;
    const scratch = makeScratchCanvas(plan.width, plan.height);
    try {
      scratch.context.drawImage(bitmap, 0, 0, plan.width, plan.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        scratch.canvas.toBlob(
          resolve,
          mime === 'image/jpeg' ? 'image/jpeg' : 'image/png',
          0.85,
        ),
      );
      if (blob === null) return null;
      const copy = new Uint8Array(await blob.arrayBuffer());
      const dpi = scaledDensity(readDensity(bytes), plan.factor);
      log(
        `image ${bitmap.width}×${bitmap.height} → ${plan.width}×${plan.height} (${extension}, ${dpi.toFixed(1)} dpi)`,
      );
      return withDensity(copy, dpi);
    } finally {
      scratch.release();
    }
  } finally {
    bitmap.close();
  }
}
