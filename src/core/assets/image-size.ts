// US-011 AC-6: the size of an image in pixels, read from the first bytes of
// the file. Pure: no Obsidian, Node, or I/O imports; the caller reads the
// bytes (US-015 gives it `IMAGE_SIZE_READ_BYTES` of them).

/** How many bytes of a file are read to find its size (1 MiB). */
export const IMAGE_SIZE_READ_BYTES = 1_048_576;

/** A width and a height in pixels, both greater than 0. */
export interface ImageSize {
  width: number;
  height: number;
}

const ascii = (text: string): number[] =>
  Array.from(text, (ch) => ch.charCodeAt(0));

const has = (head: Uint8Array, bytes: readonly number[], at: number): boolean =>
  head.length >= at + bytes.length && bytes.every((b, i) => head[at + i] === b);

const le16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const be16 = (b: Uint8Array, at: number): number => (b[at]! << 8) | b[at + 1]!;
const le24 = (b: Uint8Array, at: number): number =>
  b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const be32 = (b: Uint8Array, at: number): number =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;

function sized(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? {width, height} : null;
}

function png(head: Uint8Array): ImageSize | null {
  if (!has(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) {
    return null;
  }
  if (head.length < 24 || !has(head, ascii('IHDR'), 12)) return null;
  return sized(be32(head, 16), be32(head, 20));
}

function gif(head: Uint8Array): ImageSize | null {
  if (!has(head, ascii('GIF8'), 0) || head.length < 10) return null;
  return sized(le16(head, 6), le16(head, 8));
}

function webp(head: Uint8Array): ImageSize | null {
  if (!has(head, ascii('RIFF'), 0) || !has(head, ascii('WEBP'), 8)) {
    return null;
  }
  if (has(head, ascii('VP8 '), 12)) {
    if (head.length < 30 || !has(head, [0x9d, 0x01, 0x2a], 23)) return null;
    return sized(le16(head, 26) & 0x3fff, le16(head, 28) & 0x3fff);
  }
  if (has(head, ascii('VP8L'), 12)) {
    if (head.length < 25 || head[20] !== 0x2f) return null;
    const bits = le24(head, 21) | (head[24]! << 24);
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (has(head, ascii('VP8X'), 12)) {
    if (head.length < 30) return null;
    return sized(le24(head, 24) + 1, le24(head, 27) + 1);
  }
  return null;
}

/** The EXIF orientation (1 to 8) in the payload of an APP1 segment, or 1. */
function exifOrientation(head: Uint8Array, start: number, end: number): number {
  if (!has(head, [...ascii('Exif'), 0, 0], start) || end > head.length) {
    return 1;
  }
  const tiff = start + 6;
  const little = has(head, ascii('II'), tiff);
  if (!little && !has(head, ascii('MM'), tiff)) return 1;
  const u16 = (at: number): number =>
    little ? le16(head, at) : be16(head, at);
  const u32 = (at: number): number =>
    little
      ? (le16(head, at) | (le16(head, at + 2) << 16)) >>> 0
      : be32(head, at);
  if (tiff + 8 > end || u16(tiff + 2) !== 42) return 1;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function jpeg(head: Uint8Array): ImageSize | null {
  if (!has(head, [0xff, 0xd8], 0)) return null;
  let orientation = 1;
  let at = 2;
  while (at + 4 <= head.length) {
    if (head[at] !== 0xff) return null;
    const marker = head[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      at += 2;
      continue;
    }
    const length = be16(head, at + 2);
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      if (at + 9 > head.length) return null;
      const height = be16(head, at + 5);
      const width = be16(head, at + 7);
      return orientation >= 5 ? sized(height, width) : sized(width, height);
    }
    if (marker === 0xe1 && orientation === 1) {
      orientation = exifOrientation(head, at + 4, at + 2 + length);
    }
    if (marker === 0xda || marker === 0xd9) return null;
    at += 2 + length;
  }
  return null;
}

const NUMBER = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(px|pt|pc|mm|cm|in)?\s*$/;

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`,
  ).exec(tag);
  return match === null ? null : (match[2] ?? match[3] ?? null);
}

function svg(head: Uint8Array): ImageSize | null {
  const text = new TextDecoder('utf-8').decode(head);
  const open = /<svg(?=[\s>/])[^>]*>/.exec(text);
  if (open === null) return null;
  const tag = open[0];
  const box = attribute(tag, 'viewBox');
  if (box !== null) {
    const parts = box
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return sized(parts[2]!, parts[3]!);
    }
  }
  const w = attribute(tag, 'width');
  const h = attribute(tag, 'height');
  if (w === null || h === null) return null;
  const mw = NUMBER.exec(w);
  const mh = NUMBER.exec(h);
  if (mw === null || mh === null) return null;
  if ((mw[2] ?? 'px') !== (mh[2] ?? 'px')) return null;
  return sized(Number(mw[1]), Number(mh[1]));
}

/**
 * US-011 AC-6: the size of the image in `bytes` (the start of a file), taken
 * from its type (`extension`, any case); null when no size can be read.
 *
 * Transforms: (1) a JPEG with an EXIF orientation of 5 to 8 has width and
 * height swapped, because Typst shows it turned; other orientations, and
 * damaged EXIF data, are ignored. (2) An SVG's `viewBox` wins over `width` and
 * `height`; those are used only when both have the same unit (no unit is read
 * as px) and no conversion between units is made, since only the ratio is
 * needed. (3) A size of 0 gives null. Nothing is rounded.
 */
export function readImageSize(
  extension: string,
  bytes: Uint8Array,
): ImageSize | null {
  switch (extension.toLowerCase()) {
    case 'png':
      return png(bytes);
    case 'gif':
      return gif(bytes);
    case 'webp':
      return webp(bytes);
    case 'jpg':
    case 'jpeg':
      return jpeg(bytes);
    case 'svg':
      return svg(bytes);
    default:
      return null;
  }
}
