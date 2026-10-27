// US-003 AC-2b — the fit-image helper against the real compiler (integration,
// offline, generated PNGs; SCAR-008: measure through the compiler, never
// assume). The size an image gets is read from the compiled document: the
// `width` of the `image` element that the helper produced.
import {describe, expect, it} from 'vitest';
import {FIT_IMAGE_HELPER} from '../../src/core/emit';
import {png, svg} from '../support/images';
import {decodeTypstString, diagnose} from '../support/typst-node';

const FILES = {
  'assets/p1000.png': png(1000, 500),
  'assets/p100.png': png(100, 50),
  'assets/tall.png': png(300, 2000),
  'assets/s.svg': svg(400, 200),
};
// A text block of 160 x 260 pt.
const PAGE = '#set page(width: 200pt, height: 300pt, margin: 20pt)';

/** The widths (pt, one decimal) of all images of `body`, joined by `|`. */
async function widths(body: string): Promise<string> {
  const source = `${PAGE}\n${FIT_IMAGE_HELPER}\n${body}\n#context { assert.eq(query(image).map(i => str(calc.round(i.width.length.pt(), digits: 1))).join("|"), "@@") }\n`;
  const first = (await diagnose(source, FILES)).find(
    (d) => d.severity === 'error',
  );
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first?.message ?? '',
    );
  if (match === null) throw new Error(`compile: ${first?.message ?? 'none'}`);
  return decodeTypstString(match[1] as string);
}

describe('US-003 fit-image helper (compiler)', () => {
  it('US-003 AC-2b: scales 1000x500 px to 160 x 80 pt and 300x2000 px to 39 x 260 pt at 160 x 260 pt available', async () => {
    expect(await widths('#fit-image("assets/p1000.png")')).toBe('160');
    // 300 x 2000 px: the height is the limit, 260 pt high, 39 pt wide.
    expect(await widths('#fit-image("assets/tall.png")')).toBe('39');
  });

  it('US-003 AC-2b: keeps a 100x50 px image at 100 x 50 pt (no enlarging)', async () => {
    expect(await widths('#fit-image("assets/p100.png")')).toBe('100');
  });

  it('US-003 AC-2b: scales an SVG of 400x200 units to 160 x 80 pt', async () => {
    expect(await widths('#fit-image("assets/s.svg")')).toBe('160');
  });

  it('US-003 AC-2b: gives the container width inside a list item, a table cell and a figure', async () => {
    expect(await widths('- a\n  #fit-image("assets/p1000.png")')).toBe('154.5');
    expect(
      await widths('#table(columns: 1, [#fit-image("assets/p1000.png")])'),
    ).toBe('150');
    expect(
      await widths(
        '#figure(fit-image("assets/p1000.png"), caption: [c], numbering: none)',
      ),
    ).toBe('160');
  });

  it('US-003 AC-2b: the helper compiles alone, so the preamble may define it once', async () => {
    const errors = (
      await diagnose(
        `${FIT_IMAGE_HELPER}\n#fit-image("assets/p100.png")\n`,
        FILES,
      )
    ).filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('US-003 AC-2b: an image with an explicit size keeps it and does not use the helper', async () => {
    expect(await widths('#image("assets/p1000.png", width: 225pt)')).toBe(
      '225',
    );
  });
});
