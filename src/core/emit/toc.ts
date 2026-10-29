// US-027: the Typst of the table of contents. The only file in `src` that
// writes `#outline(` (SCAR-017). Where the contents stand is decided by the
// conversion; this file only writes text. Pure: no Obsidian, Node, or I/O
// imports.
import type {TocSettings} from '../layout/page-setup';
import {escapeMarkup} from './escape-markup';

/** US-027 AC-2 (O2): the switch that removes the dot leaders. */
const NO_DOT_LEADERS = '#set outline.entry(fill: none)';

/** US-027 AC-2 (O3): the switch that removes the page numbers, links kept. */
const NO_PAGE_NUMBERS =
  '#show outline.entry: it => link(it.element.location(), it.indented(it.prefix(), it.body()))';

/**
 * US-027 | AC-2: The lines of the contents for `toc` with a depth of 1 to 6:
 * the title line (none for an empty title), then `#outline(title: none,
 * depth: n)`. A switch that is off adds its rule before the outline, and
 * then the rules and the outline are put in one `#block[…]` so that they
 * apply to the contents only (measured S1). The title goes through
 * `escapeMarkup` at a block start: it is the first text of a content block
 * (SCAR-001, SCAR-009). Lines start in column 0; no blank line inside.
 */
export function contentsLines(
  toc: Pick<TocSettings, 'depth' | 'title' | 'pageNumbers' | 'dotLeaders'>,
): string {
  const title =
    toc.title === ''
      ? []
      : [
          `#block(below: 1em)[#text(size: 1.4em, weight: "bold")[${escapeMarkup(toc.title, {atBlockStart: true})}]]`,
        ];
  const outline = `#outline(title: none, depth: ${toc.depth})`;
  const rules = [
    ...(toc.dotLeaders ? [] : [NO_DOT_LEADERS]),
    ...(toc.pageNumbers ? [] : [NO_PAGE_NUMBERS]),
  ];
  const body =
    rules.length === 0 ? [outline] : ['#block[', ...rules, outline, ']'];
  return [...title, ...body].join('\n');
}
