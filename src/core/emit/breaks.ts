// US-025: the Typst of page breaks before headings. The only file in `src`
// that writes `#pagebreak(` (SCAR-017; a text check in the US-025 tests).
// Pure: no Obsidian, Node, or I/O imports. Measured 2026-10-28 with the
// bundled Typst 0.14.2: `to: "odd"` and `to: "even"` follow the physical page,
// `weak: true` adds nothing on an empty page, an added page is told from a
// real one by the two markers around the break (`o2t-blank`, furniture.ts).
import type {BreakLevel, BreakRule, BreakRules} from '../layout/page-setup';

/** US-025 AC-2: the label before every written break. */
export const BREAK_BEFORE_LABEL = 'o2t-break-before';
/** US-025 AC-2: the label after every written break. */
export const BREAK_AFTER_LABEL = 'o2t-break-after';

/** What the block emitter needs to write breaks. */
export interface BreakOptions {
  /** The rule per level; a missing level is `none`. */
  rules: Partial<BreakRules>;
  /** Without facing pages every side acts as a new page (AC-2). */
  facingPages: boolean;
}

/**
 * US-025 | AC-2: The three lines written before a breaking heading, joined by
 * line breaks, or null for `none`. `right` breaks to the next odd page,
 * `left` to the next even page, `page` to the next page; with facing pages
 * off every rule but `none` is `page`. Every break is weak, so a heading that
 * already starts a page adds nothing (AC-4).
 */
export function breakLines(
  rule: BreakRule,
  facingPages: boolean,
): string | null {
  if (rule === 'none') return null;
  const side = facingPages ? rule : 'page';
  const to =
    side === 'right' ? 'to: "odd", ' : side === 'left' ? 'to: "even", ' : '';
  return [
    `#metadata(none) <${BREAK_BEFORE_LABEL}>`,
    `#pagebreak(${to}weak: true)`,
    `#metadata(none) <${BREAK_AFTER_LABEL}>`,
  ].join('\n');
}

/** US-025 AC-4: the strength of a rule; a side beats `page`, `page` beats `none`. */
const strength = (rule: BreakRule): number =>
  rule === 'none' ? 0 : rule === 'page' ? 1 : 2;

/**
 * US-025 | AC-4: The one rule of a run of headings that follow each other
 * with no block between them, given in note order: the strongest; of two
 * sides the first one's (a later side never replaces an earlier side).
 */
export function mergeRules(rules: readonly BreakRule[]): BreakRule {
  let best: BreakRule = 'none';
  for (const rule of rules) {
    if (strength(rule) > strength(best)) best = rule;
  }
  return best;
}

/** US-025 AC-1: the rule of heading level `depth` (1 to 6); missing is `none`. */
export function ruleOf(rules: Partial<BreakRules>, depth: number): BreakRule {
  return rules[`h${depth}` as BreakLevel] ?? 'none';
}

/** US-026 AC-6: the label at the start of a page range with no running header. */
export const PART_START_LABEL = 'o2t-part-start';
/** US-026 AC-6: the label at the end of that range (on its last page). */
export const PART_END_LABEL = 'o2t-part-end';
/** US-026 AC-5: the labels the padding block reads its page counts from. */
const PAD_START_LABEL = 'o2t-pad-start';
const BACK_START_LABEL = 'o2t-back-start';
const BACK_END_LABEL = 'o2t-back-end';

const marker = (label: string): string => `#metadata(none) <${label}>`;

/** US-026 | AC-6: The marker line before the first block of the colophon. */
export const partStartLine = (): string => marker(PART_START_LABEL);

/**
 * US-027 | AC-4, AC-6: The lines of the contents `text` in the front matter,
 * before the first chapter's lines (`chapterBreakLines`, which close the
 * no-header range). The contents start a new page (a weak break: a page that
 * is already new adds nothing — the document's first page, the cover's next
 * right page of US-026, a colophon that ends with its page). After a
 * colophon they stand inside the colophon's range; without one they open the
 * range themselves, after the break, so that front-matter text before them
 * (US-026 decision 7) keeps its header (found by a test, 2026-10-29).
 */
export function frontContentsLines(
  text: string,
  afterColophon: boolean,
): string {
  return [
    '#pagebreak(weak: true)',
    ...(afterColophon ? [] : [partStartLine()]),
    text,
  ].join('\n');
}

/**
 * US-027 | AC-5, AC-6 (decision 5): The lines of the contents `text` in the
 * body: a new page, a no-header range of their own around them (the folio
 * goes on counting), and with `newPageAfter` a new page after them (before a
 * heading; the back notes start their own page, and at the end of the
 * document a break would add an empty page). Weak breaks: a page that is
 * already new adds nothing.
 */
export function bodyContentsLines(text: string, newPageAfter: boolean): string {
  return [
    '#pagebreak(weak: true)',
    partStartLine(),
    text,
    marker(PART_END_LABEL),
    ...(newPageAfter ? ['#pagebreak(weak: true)'] : []),
  ].join('\n');
}

/**
 * US-026 | AC-3, AC-4, AC-6, AC-7: The lines between the front matter and the
 * first chapter: the end of the colophon's no-header range, then a break that
 * is not weak, to the next even page (`left`, the left page of the next free
 * spread) or the next odd page (`right`), a plain new page without facing
 * pages, between the US-025 markers so a page it adds prints no header; then,
 * with folios on, arabic numbering from here, and the counter set to 1.
 * Measured 2026-10-28 (scratch probe `p079`, F1): the markers after the
 * numbering rule add no page; after a colophon on p. 3 `left` gives p. 4,
 * `right` p. 5, a colophon on pp. 3–5 gives p. 6.
 */
export function chapterBreakLines(
  side: 'left' | 'right',
  facingPages: boolean,
  folios: boolean,
): string {
  const to = !facingPages ? '' : side === 'left' ? 'to: "even"' : 'to: "odd"';
  return [
    marker(PART_END_LABEL),
    marker(BREAK_BEFORE_LABEL),
    `#pagebreak(${to})`,
    // Only with folios: a numbering alone brings back Typst's own footer.
    ...(folios ? ['#set page(numbering: "1")'] : []),
    '#counter(page).update(1)',
    marker(BREAK_AFTER_LABEL),
  ].join('\n');
}

/**
 * US-026 | AC-5, AC-6: The lines before the first block of the back notes:
 * a new page; with a signature `n > 0` first the padding block, which reads
 * the page where it starts and the length of the back notes from markers and
 * adds blank pages until the total is a multiple of `n` (each holds an
 * invisible mark: an empty page between two breaks is dropped, measured at
 * G1). The padding lies between the US-025 markers (folio only); the back
 * notes start the no-header range that `backNotesEndLines` closes. Swept
 * 2026-10-28 (scratch probe `p079`, F4) over 30 body lengths with signatures
 * 4 and 8, back notes of one and several pages: every total right, the back
 * notes on the last page, no oscillation (SCAR-021).
 */
export function backNotesStartLines(signature: number): string {
  if (signature === 0) {
    return ['#pagebreak(weak: true)', marker(PART_START_LABEL)].join('\n');
  }
  return [
    marker(BREAK_BEFORE_LABEL),
    '#pagebreak(weak: true)',
    marker(PAD_START_LABEL),
    '#context {',
    `  let used = query(<${PAD_START_LABEL}>).first().location().page() - 1`,
    `  let notes = query(<${BACK_END_LABEL}>).first().location().page() - query(<${BACK_START_LABEL}>).first().location().page() + 1`,
    `  for _ in range(calc.rem(${signature} - calc.rem(used + notes, ${signature}), ${signature})) { place(hide[.]); pagebreak() }`,
    '}',
    '#pagebreak(weak: true)',
    marker(BREAK_AFTER_LABEL),
    marker(PART_START_LABEL),
    marker(BACK_START_LABEL),
  ].join('\n');
}

/** US-026 | AC-5, AC-6: The lines after the last block of the back notes. */
export function backNotesEndLines(signature: number): string {
  return signature === 0
    ? marker(PART_END_LABEL)
    : [marker(BACK_END_LABEL), marker(PART_END_LABEL)].join('\n');
}

/**
 * US-026 | AC-5, AC-6: Without back notes, the lines after the last block:
 * blank pages until the total is a multiple of `signature` (> 0), each with
 * its folio only (a no-header range opened on the first one). Measured with
 * the same sweep as `backNotesStartLines` (F4, `notes=null`).
 */
export function paddingEndLines(signature: number): string {
  return [
    marker(PAD_START_LABEL),
    '#context {',
    `  let used = query(<${PAD_START_LABEL}>).first().location().page()`,
    `  let k = calc.rem(${signature} - calc.rem(used, ${signature}), ${signature})`,
    `  for i in range(k) { pagebreak(); if i == 0 [${marker(PART_START_LABEL)}]; place(hide[.]) }`,
    `  if k > 0 [${marker(PART_END_LABEL)}]`,
    '}',
  ].join('\n');
}
