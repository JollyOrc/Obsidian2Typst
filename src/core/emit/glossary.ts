// US-017: the Typst of glossary terms. The only file in `src` that writes
// `#glossary-term` or `#let glossary-term` (SCAR-017; a text check in the
// US-017 tests). Which heading is a term is decided by core/markers/glossary.ts;
// this file only writes text. Pure: no Obsidian, Node, or I/O imports.

/**
 * US-017 | AC-6: The helper of the preamble rule `glossary` (order 86),
 * measured 2026-10-19 with the bundled Typst 0.14.2: the term in bold, then
 * ` — ` (blank, em dash U+2014, blank) unless `run-in` is false.
 */
export const GLOSSARY_HELPER =
  '#let glossary-term(body, run-in: true) = { strong(body); if run-in [ — ] }';

/**
 * US-017 | AC-4: A run-in term: the call, the label, one blank, then the
 * paragraph text as one paragraph. `term` and `paragraph` are emitted Typst
 * (the term with `atBlockStart: true`); `label` is a US-002 label without `<`
 * and `>`. The label right after `]` keeps a `(` or `[` at the start of the
 * paragraph out of the call (measured 2026-10-19, SCAR-010).
 */
export function emitTermRunIn(
  term: string,
  label: string,
  paragraph: string,
): string {
  return `#glossary-term[${term}] <${label}> ${paragraph}`;
}

/**
 * US-017 | AC-5: A term without a leading paragraph: alone, without the
 * separator, in a block kept with the next one (`sticky: true`).
 */
export function emitTermAlone(term: string, label: string): string {
  return `#block(sticky: true)[#glossary-term(run-in: false)[${term}] <${label}>]`;
}

/**
 * US-017 | AC-14: A heading inside a term: its level and label, no number, no
 * outline entry (and so no bookmark: `bookmarked: auto` follows `outlined`,
 * measured 2026-10-19). `text` is emitted with `atBlockStart: true`.
 */
export function emitUnnumberedHeading(
  level: number,
  text: string,
  label: string,
): string {
  return `#heading(level: ${level}, numbering: none, outlined: false)[${text}] <${label}>`;
}
