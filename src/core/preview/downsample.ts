// US-012 AC-12: smaller images for the preview. The size plan, and the
// resolution that keeps the size at which Typst places a smaller copy. The
// re-encoding itself needs a browser (`plugin/preview`). Pure core: no
// Obsidian or I/O imports.

/** US-012 AC-12: the longest side of a preview image, in pixels. */
export const PREVIEW_MAX_SIDE = 1200;

/** The resolution Typst assumes for a PNG without one (1 px = 1 pt). */
const DEFAULT_DPI = 72;
const METERS_PER_INCH = 0.0254;
const CM_PER_INCH = 2.54;

/**
 * US-012 AC-12: the size of the smaller copy of an image of `size`, or null
 * when the image is used as it is (longest side at most `limit`, or no usable
 * size). The longest side becomes `limit`, the other `round(side × factor)`
 * with at least 1. `factor` is `limit ÷ longest side`.
 */
export function planDownsample(
  size: {width: number; height: number},
  limit: number = PREVIEW_MAX_SIDE,
): {width: number; height: number; factor: number} | null {
  const {width, height} = size;
  if (!(width > 0 && height > 0)) return null;
  const longest = Math.max(width, height);
  if (longest <= limit) return null;
  const factor = limit / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    factor,
  };
}

/**
 * US-012 AC-12: the resolution to write into a copy that has `factor` times
 * the pixels of the original (per side), so that Typst places it at the
 * original size: `original × factor`; an original without a resolution counts
 * as 72 dpi.
 */
export function scaledDensity(dpi: number | null, factor: number): number {
  return (dpi ?? DEFAULT_DPI) * factor;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const byteAt = (bytes: Uint8Array, at: number): number => bytes[at] ?? 0;
const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((value, i) => bytes[i] === value);
const isPng = (bytes: Uint8Array): boolean => startsWith(bytes, PNG_SIGNATURE);
const isJpeg = (bytes: Uint8Array): boolean => startsWith(bytes, [0xff, 0xd8]);
const u32 = (bytes: Uint8Array, at: number): number =>
  byteAt(bytes, at) * 2 ** 24 +
  (byteAt(bytes, at + 1) << 16) +
  (byteAt(bytes, at + 2) << 8) +
  byteAt(bytes, at + 3);

/** One PNG chunk: its type, data and the offset after it. */
interface PngChunk {
  type: string;
  data: Uint8Array;
  start: number;
  end: number;
}

function pngChunks(bytes: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = [];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = u32(bytes, at);
    const end = at + 12 + length;
    if (end > bytes.length) break;
    chunks.push({
      type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)),
      data: bytes.subarray(at + 8, at + 8 + length),
      start: at,
      end,
    });
    at = end;
  }
  return chunks;
}

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A `pHYs` chunk (pixels per meter, unit meter) for `dpi`, checksum included. */
function physChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / METERS_PER_INCH);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/** The bytes 2 to 19 of a JPEG that starts with a JFIF header, else null. */
function jfifAt(bytes: Uint8Array): number | null {
  const marker = byteAt(bytes, 2) === 0xff && byteAt(bytes, 3) === 0xe0;
  const name = [0x4a, 0x46, 0x49, 0x46, 0x00].every(
    (value, i) => bytes[6 + i] === value,
  );
  return marker && name && bytes.length >= 20 ? 2 : null;
}

/**
 * US-012 AC-12: the resolution in dots per inch that a PNG (`pHYs`, unit
 * meter) or a JPEG (JFIF header, unit inch or centimeter) declares; null when
 * there is none, when the unit is unknown, or for any other bytes.
 */
export function readDensity(bytes: Uint8Array): number | null {
  if (isPng(bytes)) {
    const phys = pngChunks(bytes).find((chunk) => chunk.type === 'pHYs');
    if (phys === undefined || phys.data.length < 9) return null;
    const ppm = u32(phys.data, 0);
    return phys.data[8] === 1 && ppm > 0 ? ppm * METERS_PER_INCH : null;
  }
  if (isJpeg(bytes) && jfifAt(bytes) !== null) {
    const units = byteAt(bytes, 13);
    const x = (byteAt(bytes, 14) << 8) + byteAt(bytes, 15);
    if (x === 0) return null;
    if (units === 1) return x;
    if (units === 2) return x * CM_PER_INCH;
  }
  return null;
}

/**
 * US-012 AC-12 (SCAR-001): a copy of `bytes` that declares `dpi` as its
 * resolution. This is the only code that writes a density, and it changes the
 * header only: a PNG gets exactly one `pHYs` chunk (an old one is removed) in
 * front of the first image-data chunk, with a valid checksum; a JPEG gets its
 * JFIF density set to whole dots per inch (a JFIF header is inserted after the
 * start marker when there is none), so the placed size can differ from the
 * original by up to half a dot per inch of `dpi`. The picture data is never
 * touched. Other bytes are returned unchanged. The argument is not changed.
 */
export function withDensity(bytes: Uint8Array, dpi: number): Uint8Array {
  if (isPng(bytes)) {
    const chunks = pngChunks(bytes);
    const idat = chunks.find((chunk) => chunk.type === 'IDAT');
    if (idat === undefined) return bytes;
    const parts: Uint8Array[] = [bytes.subarray(0, 8)];
    for (const chunk of chunks) {
      if (chunk.type === 'pHYs') continue;
      if (chunk === idat) parts.push(physChunk(dpi));
      parts.push(bytes.subarray(chunk.start, chunk.end));
    }
    const last = chunks[chunks.length - 1];
    if (last !== undefined) parts.push(bytes.subarray(last.end));
    return concat(parts);
  }
  if (isJpeg(bytes)) {
    const whole = Math.min(65535, Math.max(1, Math.round(dpi)));
    const header = [
      0xff,
      0xe0,
      0x00,
      0x10,
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01,
      0x01,
      0x01,
      whole >> 8,
      whole & 0xff,
      whole >> 8,
      whole & 0xff,
      0x00,
      0x00,
    ];
    if (jfifAt(bytes) !== null) {
      const out = bytes.slice();
      out[13] = 1; // units: dots per inch
      out[14] = whole >> 8;
      out[15] = whole & 0xff;
      out[16] = whole >> 8;
      out[17] = whole & 0xff;
      return out;
    }
    return concat([
      bytes.subarray(0, 2),
      Uint8Array.from(header),
      bytes.subarray(2),
    ]);
  }
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
