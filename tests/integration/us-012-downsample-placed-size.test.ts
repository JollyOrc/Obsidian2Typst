// US-012 AC-12 — a smaller copy of an image is placed at the size of the
// original by the real compiler: PNG with pHYs and JPEG with the JFIF density.
// Guard cases show the size without the density (the copy would shrink).
// Source of truth: docs/user-stories/US-012-style-preview-panel.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {scaledDensity, withDensity} from '../../src/core/preview/downsample';
import {png} from '../support/images';
import {diagnose} from '../support/typst-node';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/us-012/${name}`));

/** The width in pt at which Typst places `name` (read from an assertion message). */
async function placed(name: string, bytes: Uint8Array): Promise<number> {
  const diagnostics = await diagnose(
    `#context assert.eq(measure(image("${name}")).width.pt(), -1)`,
    {[name]: bytes},
  );
  const message =
    diagnostics.find((d) => d.severity === 'error')?.message ?? '';
  const match = /value ([0-9.]+) was not equal/.exec(message);
  if (match === null) throw new Error(`no size in: ${message}`);
  return Number(match[1]);
}

const close = (a: number, b: number) =>
  expect(Math.abs(a - b) / b).toBeLessThanOrEqual(0.005);

describe('US-012 AC-12 placed size of a smaller copy (real compiler)', () => {
  it('US-012 AC-12: a 400×200 PNG places at 400 pt; its 200×100 copy with the scaled resolution does too, without it at 200 pt', async () => {
    expect(await placed('a.png', png(400, 200))).toBe(400);
    expect(await placed('b.png', png(200, 100))).toBe(200); // the trap
    const copy = withDensity(png(200, 100), scaledDensity(null, 0.5));
    close(await placed('c.png', copy), 400);
  });

  it('US-012 AC-12: a PNG with its own resolution keeps its placed size', async () => {
    const original = withDensity(png(400, 200), 144); // 200 pt
    close(await placed('o.png', original), 200);
    const copy = withDensity(png(200, 100), scaledDensity(144, 0.5));
    close(await placed('c.png', copy), 200);
  });

  it('US-012 AC-12: a 600×300 JPEG at 96 dpi places at 450 pt; its 300×150 copy with 48 dpi does too, at 72 dpi it is 300 pt', async () => {
    expect(await placed('o.jpg', fixture('photo-600x300-96dpi.jpg'))).toBe(450);
    expect(await placed('h.jpg', fixture('photo-300x150-72dpi.jpg'))).toBe(300);
    const copy = withDensity(
      fixture('photo-300x150-72dpi.jpg'),
      scaledDensity(96, 0.5),
    );
    close(await placed('c.jpg', copy), 450);
  });

  it('US-012 AC-12: a JPEG without a resolution counts as 72 dpi, as the story says', async () => {
    expect(await placed('s.jpg', fixture('small-nodensity.jpg'))).toBe(40);
  });

  it('US-012 AC-12: a WebP has no resolution: its half-size copy shrinks to 200 pt, so the browser downsampler leaves WebP alone', async () => {
    expect(await placed('o.webp', fixture('photo-400x200.webp'))).toBe(400);
    expect(await placed('h.webp', fixture('photo-200x100.webp'))).toBe(200);
    const source = readFileSync(
      'src/plugin/preview/browser-downsample.ts',
      'utf8',
    );
    expect(source).not.toMatch(/webp:\s*'image\/webp'/);
  });
});
