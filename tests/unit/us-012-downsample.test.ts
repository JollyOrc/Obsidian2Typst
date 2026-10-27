// US-012 AC-12 — preview images: which images are made smaller and to what
// size, and the resolution that keeps the placed size (PNG pHYs, JPEG JFIF).
// The re-encoding itself runs in Obsidian; the real compiler checks the placed
// size in tests/integration/us-012-downsample-placed-size.test.ts. Source of
// truth: docs/user-stories/US-012-style-preview-panel.md.
import {readFileSync} from 'node:fs';
import {crc32} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {
  PREVIEW_MAX_SIDE,
  planDownsample,
  readDensity,
  scaledDensity,
  withDensity,
} from '../../src/core/preview/downsample';
import {png} from '../support/images';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/us-012/${name}`));

describe('US-012 AC-12 planDownsample', () => {
  it('US-012 AC-12: the limit is 1200 px on the longest side', () => {
    expect(PREVIEW_MAX_SIDE).toBe(1200);
  });

  it.each([
    [3000, 2000, 1200, 800],
    [2000, 3000, 800, 1200],
    [1500, 1001, 1200, 801], // 800.8 rounds up
    [1201, 1, 1200, 1], // never below 1
    [4000, 3, 1200, 1], // 0.9 rounds to 1
  ])('US-012 AC-12: %i×%i px becomes %i×%i', (w, h, nw, nh) => {
    const plan = planDownsample({width: w, height: h});
    expect(plan).not.toBeNull();
    expect(plan?.width).toBe(nw);
    expect(plan?.height).toBe(nh);
    expect(plan?.factor).toBeCloseTo(1200 / Math.max(w, h), 10);
  });

  it.each([
    [1200, 1200],
    [1000, 500],
    [1200, 800],
    [1, 1],
  ])('US-012 AC-12: %i×%i px is used as it is', (w, h) => {
    expect(planDownsample({width: w, height: h})).toBeNull();
  });

  it('US-012 AC-12: an unusable size (0 or negative) is left alone', () => {
    expect(planDownsample({width: 0, height: 5000})).toBeNull();
    expect(planDownsample({width: -1, height: 5000})).toBeNull();
  });

  it('US-012 AC-12: another limit can be given', () => {
    expect(planDownsample({width: 1000, height: 500}, 500)?.width).toBe(500);
  });
});

describe('US-012 AC-12 scaledDensity', () => {
  it('US-012 AC-12: the resolution is multiplied by the new px over the old px', () => {
    expect(scaledDensity(300, 0.4)).toBeCloseTo(120, 10);
    expect(scaledDensity(96, 0.5)).toBe(48);
  });

  it('US-012 AC-12: an original without a resolution counts as 72 dpi (1 px = 1 pt)', () => {
    expect(scaledDensity(null, 0.5)).toBe(36);
  });
});

/** The chunks of a PNG: [type, data, stored crc]. */
function chunks(bytes: Uint8Array): [string, Uint8Array, number][] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: [string, Uint8Array, number][] = [];
  let at = 8;
  while (at < bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    out.push([
      type,
      bytes.subarray(at + 8, at + 8 + length),
      view.getUint32(at + 8 + length),
    ]);
    at += 12 + length;
  }
  return out;
}

describe('US-012 AC-12 withDensity (PNG)', () => {
  it('US-012 AC-12: a PNG without a resolution reads as null', () => {
    expect(readDensity(png(20, 10))).toBeNull();
  });

  it('US-012 AC-12: the resolution written can be read back (36 dpi, 120 dpi)', () => {
    expect(readDensity(withDensity(png(200, 100), 36))).toBeCloseTo(36, 0);
    expect(readDensity(withDensity(png(1200, 800), 120))).toBeCloseTo(120, 0);
  });

  it('US-012 AC-12: the pHYs chunk sits before the image data, in meters, with a valid checksum', () => {
    const out = withDensity(png(200, 100), 36);
    const list = chunks(out);
    const names = list.map(([name]) => name);
    expect(names.indexOf('pHYs')).toBeGreaterThan(names.indexOf('IHDR'));
    expect(names.indexOf('pHYs')).toBeLessThan(names.indexOf('IDAT'));
    const phys = list.find(([name]) => name === 'pHYs');
    expect(phys?.[1]).toHaveLength(9);
    expect(phys?.[1][8]).toBe(1); // unit: meter
    for (const [name, data, stored] of list) {
      const body = new Uint8Array([...new TextEncoder().encode(name), ...data]);
      expect(crc32(body)).toBe(stored);
    }
  });

  it('US-012 AC-12: an existing pHYs chunk is replaced, not doubled; the picture data is kept', () => {
    const once = withDensity(png(200, 100), 36);
    const twice = withDensity(once, 144);
    const names = chunks(twice).map(([name]) => name);
    expect(names.filter((name) => name === 'pHYs')).toHaveLength(1);
    expect(readDensity(twice)).toBeCloseTo(144, 0);
    const idat = (b: Uint8Array) =>
      chunks(b).find(([name]) => name === 'IDAT')?.[1];
    expect(idat(twice)).toEqual(idat(png(200, 100)));
  });
});

describe('US-012 AC-12 withDensity (JPEG)', () => {
  it('US-012 AC-12: a JPEG with 96 dpi reads 96, one with density unit 0 reads null', () => {
    expect(readDensity(fixture('photo-600x300-96dpi.jpg'))).toBe(96);
    expect(readDensity(fixture('small-nodensity.jpg'))).toBeNull();
  });

  it('US-012 AC-12: the JFIF density is rewritten and nothing else changes', () => {
    const original = fixture('photo-300x150-72dpi.jpg');
    const out = withDensity(original, 48);
    expect(readDensity(out)).toBe(48);
    expect(out).toHaveLength(original.length);
    const diff = [...out].flatMap((b, i) => (b === original[i] ? [] : [i]));
    expect(Math.max(...diff)).toBeLessThan(20); // only the JFIF header differs
  });

  it('US-012 AC-12: a JPEG without a JFIF header gets one after the start marker', () => {
    const original = fixture('photo-300x150-72dpi.jpg');
    // remove the APP0 segment (FF E0 00 10 + 14 bytes)
    const bare = new Uint8Array([
      ...original.subarray(0, 2),
      ...original.subarray(20),
    ]);
    expect(readDensity(bare)).toBeNull();
    const out = withDensity(bare, 48);
    expect(readDensity(out)).toBe(48);
    expect([...out.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('US-012 AC-12: bytes that are neither PNG nor JPEG come back unchanged', () => {
    const other = new Uint8Array([1, 2, 3, 4, 5]);
    expect(withDensity(other, 50)).toEqual(other);
    expect(readDensity(other)).toBeNull();
  });
});
