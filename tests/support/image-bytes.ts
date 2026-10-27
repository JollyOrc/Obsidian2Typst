// Test support for US-011: the first bytes of image files with a known size, as
// the size reader sees them (a PNG header only, a GIF header, the three WebP
// forms, a JPEG with optional EXIF orientation and filler, an SVG text).

const be32 = (n: number): number[] => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
const le16 = (n: number): number[] => [n & 255, (n >>> 8) & 255];
const le24 = (n: number): number[] => [n & 255, (n >>> 8) & 255, n >>> 16];
const ascii = (text: string): number[] =>
  Array.from(text, (ch) => ch.charCodeAt(0));

/** The signature and the IHDR chunk of a PNG (no pixel data). */
export function pngHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    ...ascii('IHDR'),
    ...be32(width),
    ...be32(height),
    8,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

/** A GIF header with the logical screen size. */
export function gifHeader(
  width: number,
  height: number,
  version = '89a',
): Uint8Array {
  return new Uint8Array([
    ...ascii(`GIF${version}`),
    ...le16(width),
    ...le16(height),
    0,
    0,
    0,
  ]);
}

/** A lossy WebP (`VP8 `) header. */
export function webpLossy(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...ascii('RIFF'),
    ...le24(40),
    0,
    ...ascii('WEBP'),
    ...ascii('VP8 '),
    ...le24(20),
    0,
    0x10,
    0x02,
    0x00,
    0x9d,
    0x01,
    0x2a,
    ...le16(width),
    ...le16(height),
    0,
    0,
    0,
    0,
  ]);
}

/** A lossless WebP (`VP8L`) header: 14 bits each of width - 1 and height - 1. */
export function webpLossless(width: number, height: number): Uint8Array {
  const bits = ((height - 1) << 14) | (width - 1);
  return new Uint8Array([
    ...ascii('RIFF'),
    ...le24(40),
    0,
    ...ascii('WEBP'),
    ...ascii('VP8L'),
    ...le24(10),
    0,
    0x2f,
    bits & 255,
    (bits >>> 8) & 255,
    (bits >>> 16) & 255,
    (bits >>> 24) & 255,
    0,
    0,
    0,
    0,
  ]);
}

/** An extended WebP (`VP8X`) header: 24-bit canvas width - 1 and height - 1. */
export function webpExtended(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...ascii('RIFF'),
    ...le24(40),
    0,
    ...ascii('WEBP'),
    ...ascii('VP8X'),
    ...le24(10),
    0,
    0,
    0,
    0,
    0,
    ...le24(width - 1),
    ...le24(height - 1),
  ]);
}

export interface JpegOptions {
  /** EXIF orientation 1 to 8; none when left out. */
  orientation?: number;
  /** `true` writes the EXIF in little-endian (II), else big-endian (MM). */
  littleEndian?: boolean;
  /** Bytes of filler (APP2 segments of 60000 bytes) before the frame. */
  filler?: number;
  /** The frame marker, default 0xc0 (baseline); 0xc2 is progressive. */
  marker?: number;
}

/** A JPEG up to and including the first frame header (no image data). */
export function jpegHeader(
  width: number,
  height: number,
  options: JpegOptions = {},
): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  if (options.orientation !== undefined) {
    const little = options.littleEndian === true;
    const u16 = (n: number): number[] =>
      little ? [n & 255, n >>> 8] : [n >>> 8, n & 255];
    const tiff = [
      ...ascii(little ? 'II' : 'MM'),
      ...u16(42),
      ...(little ? [8, 0, 0, 0] : [0, 0, 0, 8]), // offset of the first IFD
      ...u16(1), // one entry
      ...u16(0x0112), // Orientation
      ...u16(3), // type SHORT
      ...(little ? [1, 0, 0, 0] : [0, 0, 0, 1]), // count
      ...u16(options.orientation), // value
      0,
      0,
      0,
      0,
      0,
      0, // no next IFD
    ];
    const payload = [...ascii('Exif'), 0, 0, ...tiff];
    out.push(
      0xff,
      0xe1,
      ...[(payload.length + 2) >>> 8, (payload.length + 2) & 255],
      ...payload,
    );
  }
  let left = options.filler ?? 0;
  while (left > 0) {
    const size = Math.min(left, 60000);
    out.push(0xff, 0xe2, ...[(size + 2) >>> 8, (size + 2) & 255]);
    for (let i = 0; i < size; i++) out.push(0x41);
    left -= size;
  }
  out.push(
    0xff,
    options.marker ?? 0xc0,
    0,
    11,
    8,
    height >>> 8,
    height & 255,
    width >>> 8,
    width & 255,
    1,
    1,
    0x11,
    0,
  );
  return new Uint8Array(out);
}

/** An SVG text with the given root attributes. */
export function svgText(attributes: string): Uint8Array {
  return new TextEncoder().encode(
    `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect width="1" height="1"/></svg>`,
  );
}
