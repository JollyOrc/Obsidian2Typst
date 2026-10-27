// US-012 AC-6: the page range of the preview. Pure core: no Obsidian or I/O
// imports.

/** What the field means: every page, or the pages `from` to `to` (1-based). */
export type PageRange =
  {kind: 'all'} | {kind: 'range'; from: number; to: number};

/** US-012 AC-6: the one message for any refused text. */
export const RANGE_MESSAGE =
  'Enter all, a page such as 4, or a range such as 3-5';

const ALL = /^\s*(?:all(?:\s+pages)?)?\s*$/i;
const RANGE = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/;

/**
 * US-012 AC-6: reads the text of the range field.
 *
 * Accepts empty text or `all` / `All pages` in any case (all pages), `N`
 * and `N-M` with whole numbers and `1 <= N <= M`; spaces around the numbers
 * and the dash are ignored. Anything else (`5-3`, `0`, `3-`, `-2`, `3,5`,
 * `1.5`, a number too large to be exact) is refused with {@link RANGE_MESSAGE}.
 */
export function parsePageRange(
  text: string,
): {ok: true; range: PageRange} | {ok: false; message: string} {
  const refused = {ok: false as const, message: RANGE_MESSAGE};
  if (ALL.test(text)) return {ok: true, range: {kind: 'all'}};
  const match = RANGE.exec(text);
  if (match === null) return refused;
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return refused;
  if (from < 1 || to < from) return refused;
  return {ok: true, range: {kind: 'range', from, to}};
}

/**
 * US-012 AC-6: the pages to show for a document of `count` pages. A range that
 * reaches past the end is cut (`250-300` of 263 shows 250 to 263); a range
 * wholly behind the end shows no page and a message with the length.
 */
export function pagesToShow(
  range: PageRange,
  count: number,
): {pages: number[]; message: string | null} {
  const from = range.kind === 'all' ? 1 : range.from;
  const to = range.kind === 'all' ? count : Math.min(range.to, count);
  if (range.kind === 'range' && range.from > count) {
    return {
      pages: [],
      message: `The document has ${count} ${count === 1 ? 'page' : 'pages'}`,
    };
  }
  const pages: number[] = [];
  for (let page = from; page <= to; page++) pages.push(page);
  return {pages, message: null};
}
