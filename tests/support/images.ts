// Test support for images (US-003): real image bytes made in Node, headers for
// the content check, and a recording asset resolver for the emitter tests.
import {deflateSync} from 'node:zlib';
import type {
  AssetRequest,
  AssetResolver,
  AssetResult,
} from '../../src/core/assets';

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * A valid PNG of `width` x `height` pixels (solid colour, no resolution
 * information, so Typst reads 1 px as 1 pt).
 */
export function png(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8); // 8 bit, RGB
  const row = new Uint8Array(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([200, 80, 40], 1 + x * 3);
  const raw = new Uint8Array(row.length * height);
  for (let y = 0; y < height; y++) raw.set(row, y * row.length);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A valid JPEG of 30 x 20 pixels (made with Pillow, 96 dpi). */
export const jpeg = (): Uint8Array =>
  new Uint8Array(
    Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAAUAB4DASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAQF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AkAkaQAAAAAD/2Q==',
      'base64',
    ),
  );

/** A small valid SVG. */
export const svg = (width = 40, height = 20): Uint8Array =>
  new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#2a6"/></svg>`,
  );

/** The first bytes of a file of each kind, as the content check sees them. */
export const HEAD = {
  png: png(1, 1).subarray(0, 16),
  jpg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]),
  gif87: new TextEncoder().encode('GIF87a\u0001\u0000\u0001\u0000'),
  gif89: new TextEncoder().encode('GIF89a\u0001\u0000\u0001\u0000'),
  webp: new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '),
  svg: svg().subarray(0, 16),
  svgXml: new TextEncoder().encode('<?xml version="1.0"?><svg/>'),
  svgBom: new Uint8Array([
    0xef,
    0xbb,
    0xbf,
    ...new TextEncoder().encode('  \n<svg xmlns="x"/>'),
  ]),
  text: new TextEncoder().encode('not an image'),
  empty: new Uint8Array(0),
} as const;

/** A resolver that answers from `answers` (by target) and records requests. */
export interface FakeAssets extends AssetResolver {
  requests: AssetRequest[];
}

export function fakeAssets(
  answers: Record<string, AssetResult | string>,
): FakeAssets {
  const requests: AssetRequest[] = [];
  return {
    requests,
    resolve(request) {
      requests.push(request);
      const answer = answers[request.target];
      if (answer === undefined) return {status: 'missing'};
      return typeof answer === 'string'
        ? {status: 'found', path: answer}
        : answer;
    },
  };
}

/** A resolver that finds every target and maps it to `assets/<name>`. */
export function findAll(): FakeAssets {
  const requests: AssetRequest[] = [];
  return {
    requests,
    resolve(request) {
      requests.push(request);
      const name = request.target.split('/').pop() ?? request.target;
      return {status: 'found', path: `assets/${name}`};
    },
  };
}
