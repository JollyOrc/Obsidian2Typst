// US-019: the Typst of the page furniture (folios and running header). The
// only file in `src` that writes `running-text` or `running-title`
// (SCAR-017; a text check in the US-019 tests). Pure: no Obsidian, Node, or
// I/O imports. Measured 2026-10-19 with the bundled Typst 0.14.2; the same
// text is the expected value in tests/support/furniture.ts.
import type {PageFurniture} from '../layout/page-setup';

/**
 * US-019 | AC-6, AC-7: The title text without footnotes. A footnote call in a
 * heading would otherwise be laid out again in the header and step the
 * footnote counter (measured: the body footnotes became 3 and 4). Rebuilds
 * sequences, links and the five marks with their footnotes removed; any other
 * content is kept as it is.
 */
export const RUNNING_TEXT_HELPER = [
  '#let running-text(it) = {',
  '  if type(it) != content { return it }',
  '  if it.func() == footnote { return [] }',
  '  if it.has("children") { return it.children.map(running-text).join() }',
  '  if it.func() == link { return link(it.dest, running-text(it.body)) }',
  '  if it.func() in (strong, emph, highlight, underline, strike) { return (it.func())(running-text(it.body)) }',
  '  it',
  '}',
].join('\n');

/**
 * US-019 | AC-5: The title of a page's header for heading level `level`:
 * none on a page where a level-1 heading starts; else the first level-`level`
 * heading that starts on the page; else the last heading before the page
 * whose level is at most `level` (decided 2026-10-20: a new H1 section never
 * shows an old chapter's title); else none.
 */
export const RUNNING_TITLE_HELPER = [
  '#let running-title(level) = {',
  '  let p = here().page()',
  '  let starts(h) = h.location().page() == p',
  '  if query(heading.where(level: 1)).any(starts) { return none }',
  '  let starting = query(heading.where(level: level)).filter(starts)',
  '  if starting.len() > 0 { return running-text(starting.first().body) }',
  '  running-text(query(selector(heading).before(here())).filter(h => h.level <= level).at(-1, default: (body: none)).body)',
  '}',
].join('\n');

/**
 * US-019 | AC-3, AC-4, AC-5, AC-8: The preamble rule `page-furniture`, or null
 * when both parts are off or the settings are missing (the output then is
 * exactly as before, AC-8).
 *
 * Writes the two helpers only with the header on, and `numbering: "1"` only
 * with folios on (with the header alone a numbering would bring back Typst's
 * default footer). On facing pages the folio sits at the outer edge (left on
 * even PDF pages, right on odd ones, the sides of the outside margin; measured
 * 2026-10-19), on single pages centred. Header and folio use the body font at
 * 0.9em.
 */
export function pageFurnitureRule(
  furniture: PageFurniture | undefined,
  facingPages: boolean,
): string | null {
  if (furniture === undefined) return null;
  const {folios, runningHeader, runningHeaderLevel} = furniture;
  if (!folios && !runningHeader) return null;
  const side = facingPages
    ? 'if calc.even(here().page()) { left } else { right }'
    : 'center';
  const parts: string[] = [];
  if (folios) parts.push('numbering: "1"');
  if (runningHeader) {
    parts.push(
      `header: context { set text(size: 0.9em); align(center, running-title(${runningHeaderLevel})) }`,
    );
  }
  if (folios) {
    parts.push(
      `footer: context { set text(size: 0.9em); align(${side}, counter(page).display()) }`,
    );
  }
  const line = `#set page(${parts.join(', ')})`;
  return runningHeader
    ? [RUNNING_TEXT_HELPER, RUNNING_TITLE_HELPER, line].join('\n')
    : line;
}
