// US-034 AC-2 — the drawn widths the conversion fixes match the PDF
// (SCAR-015): an image with a size written in the note and the cover, whose
// widths are not recorded in the compile (their calls are as before), are
// reported by `convert` as `images`; each equals the width of the image's
// matrix in the PDF, and the facts of the compile add none for them.
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Added at G4 of #132 (2026-11-07).
import {afterAll, describe, expect, it} from 'vitest';
import {compileBook, disposeBookCompiler} from '../support/book';

afterAll(disposeBookCompiler);

const mmOf = (points: number): number => (points * 25.4) / 72;

describe('US-034 AC-2 fixed drawn widths', () => {
  it('US-034 AC-2: a sized image and the cover report the width the PDF draws', async () => {
    const book = await compileBook('# One\n\nText.\n\n![[map.png|200]]\n', {
      cover: 'cover',
    });
    const fixed = book.result.images ?? [];
    expect(fixed.map((f) => f.file)).toEqual([
      'assets/cover.png',
      'assets/map.png',
    ]);
    const drawn = book.pages.flatMap((p) => p.images.map((i) => mmOf(i.width)));
    for (const f of fixed) {
      expect(
        drawn.some((w) => Math.abs(w - f.widthMm) < 0.05),
        `${f.file} ${f.widthMm.toFixed(2)} mm in ${drawn.map((w) => w.toFixed(2)).join(', ')}`,
      ).toBe(true);
    }
  });
});
