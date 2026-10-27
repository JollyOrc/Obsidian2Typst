// Test support for US-018: the expected Typst of the preamble rule
// `page-refs`, as measured 2026-10-20 and 2026-10-21 with the bundled Typst
// 0.14.2 (scratch probes: the folio of the target, the join table, the words
// through escapeMarkup). Source of truth:
// docs/user-stories/US-018-page-numbers-for-internal-links.md.

/**
 * US-018 AC-3: the helper with the word as `escapeMarkup` writes it (the
 * caller passes the escaped word; `S.`, `p.` and plain letters are unchanged).
 */
export const PAGE_REF = (escapedWord: string): string =>
  `#let page-ref(target) = context [ (${escapedWord}~#numbering("1", ..counter(page).at(target)))]`;

/** US-018 AC-3: the call written right after a link to `label`. */
export const REF = (label: string): string => `#page-ref(<${label}>)`;
