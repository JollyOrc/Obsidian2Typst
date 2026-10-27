// US-012 AC-12: the browser downsampler with stand-ins for `createImageBitmap`
// and the canvas (the real pixels are checked in manual check M2 step 15).
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readDensity} from '../../src/core/preview/downsample';
import {downsampleImage} from '../../src/plugin/preview/browser-downsample';
import {png} from '../support/images';

interface Scratch {
  width: number;
  height: number;
  removed: number;
  drawn: unknown[][];
  types: string[];
}
let scratch: Scratch[] = [];
let closed = 0;
let bitmapSize = {width: 2400, height: 1200};
let encoded: Uint8Array = png(1200, 600);

beforeEach(() => {
  scratch = [];
  closed = 0;
  bitmapSize = {width: 2400, height: 1200};
  encoded = png(1200, 600);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.stubGlobal('createImageBitmap', async () => ({
    ...bitmapSize,
    close: () => void closed++,
  }));
  vi.stubGlobal('document', {
    createElement: () => {
      const record: Scratch = {
        width: 0,
        height: 0,
        removed: 0,
        drawn: [],
        types: [],
      };
      scratch.push(record);
      return {
        set width(v: number) {
          record.width = v;
        },
        get width() {
          return record.width;
        },
        set height(v: number) {
          record.height = v;
        },
        get height() {
          return record.height;
        },
        remove: () => void record.removed++,
        getContext: () => ({
          drawImage: (...args: unknown[]) => record.drawn.push(args),
        }),
        toBlob: (done: (b: Blob | null) => void, type: string) => {
          record.types.push(type);
          done(new Blob([new Uint8Array(encoded)]));
        },
      };
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('US-012 AC-12 the browser downsampler', () => {
  it('US-012 AC-12: a 2400×1200 PNG without resolution becomes 1200×600 on a scratch canvas with 36 dpi written, the canvas is released and the bitmap closed', async () => {
    const copy = await downsampleImage(png(2400, 1200), 'png');
    expect(copy).not.toBeNull();
    expect(scratch).toHaveLength(1);
    expect([scratch[0]?.width, scratch[0]?.height]).toEqual([0, 0]); // released
    expect(scratch[0]?.removed).toBe(1);
    expect(scratch[0]?.drawn[0]?.slice(1)).toEqual([0, 0, 1200, 600]);
    expect(scratch[0]?.types).toEqual(['image/png']);
    expect(Math.round(readDensity(copy as Uint8Array) ?? 0)).toBe(36);
    expect(closed).toBe(1);
  });

  it('US-012 AC-12: an image of 1200 px or less is left alone (null) and nothing is drawn', async () => {
    bitmapSize = {width: 1200, height: 400};
    expect(await downsampleImage(png(1200, 400), 'png')).toBeNull();
    expect(scratch).toHaveLength(0);
    expect(closed).toBe(1);
  });

  it('US-012 AC-12: WebP, SVG, GIF and unknown extensions are never decoded or changed', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    for (const extension of ['webp', 'svg', 'gif', 'tiff', '']) {
      expect(await downsampleImage(png(2400, 1200), extension)).toBeNull();
    }
    expect(decode).not.toHaveBeenCalled();
  });

  it('US-012 AC-12: an image that cannot be decoded keeps the original (null) and no canvas is made', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('bad image');
    });
    expect(await downsampleImage(png(2400, 1200), 'png')).toBeNull();
    expect(scratch).toHaveLength(0);
  });

  it('US-012 AC-12: a JPEG is encoded as JPEG (quality type image/jpeg), an uppercase extension counts', async () => {
    await downsampleImage(png(2400, 1200), 'JPG');
    expect(scratch[0]?.types).toEqual(['image/jpeg']);
  });

  it('US-012 AC-12: when the canvas cannot encode, the original is kept and the canvas is still released', async () => {
    const real = document.createElement;
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        const canvas = real(tag) as unknown as {
          toBlob: (done: (b: Blob | null) => void) => void;
        };
        canvas.toBlob = (done) => done(null);
        return canvas;
      },
    });
    expect(await downsampleImage(png(2400, 1200), 'png')).toBeNull();
    expect(scratch[0]?.removed).toBe(1);
    expect(closed).toBe(1);
  });
});
