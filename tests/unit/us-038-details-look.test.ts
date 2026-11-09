// US-038 AC-6 — the look of the row: built-ins, the preset's colour and size,
// grayscale, the sizes at both ends (one source for the PDF and the preview).
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {detailsLookValues} from '../../src/core/emit/details';

describe('US-038 AC-6 the look', () => {
  it('US-038 AC-6: the built-ins are umber, 9.5 pt; a preset sets both', () => {
    expect(detailsLookValues(undefined, undefined)).toMatchObject({
      color: '#7a4a2e',
      size: 9.5,
    });
    expect(
      detailsLookValues({items: [], color: '#112233', size: 14}, 'color'),
    ).toMatchObject({
      color: '#112233',
      size: 14,
    });
  });

  it('US-038 AC-6: grayscale makes text and icons #4d4d4d whatever the colour says', () => {
    for (const color of [undefined, '#112233']) {
      expect(
        detailsLookValues(
          {items: [], ...(color === undefined ? {} : {color})},
          'grayscale',
        ),
      ).toMatchObject({color: '#4d4d4d'});
    }
  });

  it('US-038 AC-6: the sizes at both ends and in the middle are kept', () => {
    for (const size of [6, 9.5, 14, 200]) {
      expect(detailsLookValues({items: [], size}, undefined).size).toBe(size);
    }
  });
});
