// US-012 AC-7, AC-12: the one canvas helper (size, limit, CSS size, release,
// pixel check, log lines) with a stand-in for the DOM canvas.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  MAX_CANVAS_SIDE,
  inspectPage,
  makePageCanvas,
  makeScratchCanvas,
} from '../../src/plugin/preview/canvas';

class FakeCanvas {
  width = 0;
  height = 0;
  removed = 0;
  style: Record<string, string> = {};
  pixels = new Uint8ClampedArray(0);
  getContext() {
    return {
      getImageData: () => ({data: this.pixels}),
    };
  }
  remove() {
    this.removed++;
  }
}

const made: FakeCanvas[] = [];
vi.stubGlobal('document', {
  createElement: (tag: string) => {
    expect(tag).toBe('canvas');
    const canvas = new FakeCanvas();
    made.push(canvas);
    return canvas;
  },
});
vi.spyOn(console, 'log').mockImplementation(() => undefined);

afterEach(() => {
  made.length = 0;
  vi.mocked(console.log).mockClear();
});

describe('US-012 AC-7 page canvas', () => {
  it('US-012 AC-7: a 419.5 × 595.3 pt page at 2 px/pt has 839 × 1191 px and keeps its shape in CSS', () => {
    const page = makePageCanvas(419.5, 595.3, 2);
    expect([page.width, page.height]).toEqual([839, 1191]);
    expect(page.pixelPerPt).toBe(2);
    expect(made[0]?.style.aspectRatio).toBe('419.5 / 595.3');
    expect(made[0]?.style.width).toBe('100%');
  });

  it('US-012 AC-7: a page that would be longer than the limit is drawn smaller and reports the scale to draw with', () => {
    const page = makePageCanvas(1000, 4000, 3);
    expect(page.height).toBe(MAX_CANVAS_SIDE);
    expect(page.pixelPerPt).toBeCloseTo(MAX_CANVAS_SIDE / 4000, 6);
    expect(page.width).toBe(Math.round(1000 * page.pixelPerPt));
  });

  it('US-012 AC-7: a side of exactly the limit is not reduced', () => {
    const page = makePageCanvas(MAX_CANVAS_SIDE, 10, 1);
    expect(page.pixelPerPt).toBe(1);
    expect(page.width).toBe(MAX_CANVAS_SIDE);
  });

  it('US-012 AC-7: release sets the size to 0 and takes the canvas out of its parent', () => {
    const page = makePageCanvas(100, 100, 2);
    page.release();
    expect([made[0]?.width, made[0]?.height, made[0]?.removed]).toEqual([
      0, 0, 1,
    ]);
  });

  it('US-012 AC-7: the helper logs every canvas with [o2t preview]', () => {
    makePageCanvas(100, 100, 2);
    makeScratchCanvas(30, 20);
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.startsWith('[o2t preview] '))).toBe(true);
  });
});

describe('US-012 AC-7 the pixel check of a drawn page', () => {
  const draw = (nonWhite: number, total: number) => {
    const page = makePageCanvas(10, 10, 1);
    const canvas = made[0] as FakeCanvas;
    canvas.pixels = new Uint8ClampedArray(total * 4).fill(255);
    for (let i = 0; i < nonWhite; i++) canvas.pixels[i * 4] = 0;
    return inspectPage(3, page);
  };

  it('US-012 AC-7: a page with 6.9 % non-white pixels is not blank (page 3 of the reference)', () => {
    const result = draw(69, 1000);
    expect(result.share).toBeCloseTo(0.069, 6);
    expect(result.blank).toBe(false);
  });

  it('US-012 AC-7: a white page is blank and the log line says so with the page number', () => {
    const result = draw(0, 1000);
    expect(result.blank).toBe(true);
    const line = String(vi.mocked(console.log).mock.calls.at(-1)?.[0]);
    expect(line).toContain('page 3');
    expect(line).toContain('(blank)');
  });
});
