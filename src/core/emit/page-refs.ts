// US-018: page numbers after internal links. The only file in `src` that
// writes `#let page-ref` or `#page-ref(` (SCAR-017; a text check in the
// US-018 tests). Which link gets a call is decided by the link emitter
// (`emitInline`, option `pageRefs`); this file holds the Typst text.
// Pure: no Obsidian, Node, or I/O imports.

/**
 * US-018 | AC-3: The helper of the preamble rule `page-refs` (order 47).
 *
 * Prints ` (<word>~<folio of the target page>)` in the context of the call:
 * a real space before `(`, a non-breaking space before the number, the number
 * as the folio of US-019 (the cover pages are not counted). Measured with
 * Typst 0.14.2 (2026-10-20, 2026-10-21). Assumes `escapedWord` was written
 * through `escapeMarkup(word, {atBlockStart: false})`: the word follows ` (`
 * inside a content block, never at its start.
 */
export function pageRefHelper(escapedWord: string): string {
  return `#let page-ref(target) = context [ (${escapedWord}~#numbering("1", ..counter(page).at(target)))]`;
}

/**
 * US-018 | AC-3: The call written right after a link to `label` (no `<>`).
 *
 * The call binds a following `.`, `(`, `[` or `;` like every call; the inline
 * emitter writes `callSeparator` after it (measured join table, story Notes).
 */
export function pageRefCall(label: string): string {
  return `#page-ref(<${label}>)`;
}

/**
 * US-018 | AC-2, AC-3: What the link emitter needs to write page numbers.
 *
 * `level`: links to headings up to this level get the number (1 to 6).
 * `inExplanation`: the text is inside a glossary term's explanation (US-017),
 * where every resolved link gets the number. `record` is called once for each
 * call written, so the pipeline writes the rule only when the body has one.
 */
export interface PageRefEnv {
  level: number;
  inExplanation: boolean;
  record: () => void;
}
