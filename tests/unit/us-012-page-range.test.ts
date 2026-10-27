// US-012 AC-6 — the page range of the preview: what the field accepts, what it
// refuses (with the one message), and which pages that shows for a book of a
// given length. Source of truth: docs/user-stories/US-012-style-preview-panel.md.
import {describe, expect, it} from 'vitest';
import {
  RANGE_MESSAGE,
  pagesToShow,
  parsePageRange,
  type PageRange,
} from '../../src/core/preview/range';

const ALL: PageRange = {kind: 'all'};
const range = (from: number, to: number): PageRange => ({
  kind: 'range',
  from,
  to,
});

describe('US-012 AC-6 parsePageRange', () => {
  it.each(['', '   ', 'all', 'ALL', 'All pages', 'all PAGES', '  All pages  '])(
    'US-012 AC-6: %j means all pages',
    (text) => {
      expect(parsePageRange(text)).toEqual({ok: true, range: ALL});
    },
  );

  it.each([
    ['4', 4, 4],
    ['3-5', 3, 5],
    [' 3 - 5 ', 3, 5],
    ['1-1', 1, 1],
    ['3-3', 3, 3],
    ['263', 263, 263],
  ])('US-012 AC-6: %j is the pages %i to %i', (text, from, to) => {
    expect(parsePageRange(text)).toEqual({ok: true, range: range(from, to)});
  });

  it.each(['5-3', '0', '0-3', 'abc', '3-', '-2', '3,5', '1.5', '3-5-7', '3 5'])(
    'US-012 AC-6: %j is refused with the one message',
    (text) => {
      expect(parsePageRange(text)).toEqual({ok: false, message: RANGE_MESSAGE});
    },
  );

  it('US-012 AC-6: the message is the one of the story', () => {
    expect(RANGE_MESSAGE).toBe(
      'Enter all, a page such as 4, or a range such as 3-5',
    );
  });

  it('US-012 AC-6: a number too large to be a page is refused, not rounded', () => {
    expect(parsePageRange('99999999999999999999')).toEqual({
      ok: false,
      message: RANGE_MESSAGE,
    });
  });
});

describe('US-012 AC-6 pagesToShow', () => {
  it('US-012 AC-6: all pages of a book of 4 are 1 to 4', () => {
    expect(pagesToShow({kind: 'all'}, 4)).toEqual({
      pages: [1, 2, 3, 4],
      message: null,
    });
  });

  it('US-012 AC-6: 3-5 shows exactly pages 3, 4 and 5', () => {
    expect(pagesToShow(range(3, 5), 10)).toEqual({
      pages: [3, 4, 5],
      message: null,
    });
  });

  it('US-012 AC-6: 3-5 of a book of 4 shows 3 and 4 (fewer if shorter)', () => {
    expect(pagesToShow(range(3, 5), 4)).toEqual({pages: [3, 4], message: null});
  });

  it('US-012 AC-6: 250-300 of 263 pages shows 250 to 263', () => {
    const shown = pagesToShow(range(250, 300), 263);
    expect(shown.message).toBeNull();
    expect(shown.pages).toHaveLength(14);
    expect(shown.pages[0]).toBe(250);
    expect(shown.pages[13]).toBe(263);
  });

  it('US-012 AC-6: the last page alone and the page after the end', () => {
    expect(pagesToShow(range(263, 263), 263).pages).toEqual([263]);
    expect(pagesToShow(range(264, 264), 263)).toEqual({
      pages: [],
      message: 'The document has 263 pages',
    });
  });

  it('US-012 AC-6: a range wholly behind the end says how long the document is', () => {
    expect(pagesToShow(range(300, 310), 263)).toEqual({
      pages: [],
      message: 'The document has 263 pages',
    });
  });

  it('US-012 AC-6: a book of one page says page, not pages', () => {
    expect(pagesToShow(range(2, 2), 1).message).toBe('The document has 1 page');
  });
});
