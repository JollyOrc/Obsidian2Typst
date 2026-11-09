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
 * US-025 | AC-6: True on page `p` when it was added by a written break: it lies
 * strictly between the page of a `<o2t-break-before>` marker and the page of
 * its `<o2t-break-after>` marker. The markers are paired in document order
 * (the emitter writes them in pairs). A before-marker never starts a page
 * after a heading (a zero-height marker stays at the end of the page before;
 * swept in the US-025 AC-6 tests), so a page that starts with one comes before
 * any heading and has no header to hide; a mutant that tested for it survived
 * every input and the test was removed (TICKET-075).
 * Reads where the markers fell and changes no layout, so it cannot oscillate
 * (SCAR-021). Measured 2026-10-28 on the page tables of US-025 AC-2, AC-5,
 * AC-6 (scratch probe `p075/blank.test.ts`).
 */
export const O2T_BLANK_HELPER = [
  '#let o2t-blank(p) = {',
  '  let before = query(<o2t-break-before>)',
  '  let after = query(<o2t-break-after>)',
  '  before.zip(after).any(((b, a)) => {',
  '    let bp = b.location().page()',
  '    let ap = a.location().page()',
  '    bp < p and p < ap',
  '  })',
  '}',
].join('\n');

/**
 * US-026 | AC-6: True on page `p` when it lies in a no-header range: from the
 * page of a `<o2t-part-start>` marker to the page of its `<o2t-part-end>`
 * marker, both included (the colophon, the back notes, padding at the end).
 * Paired in document order like `o2t-blank`; reads where the markers fell and
 * changes no layout (SCAR-021). Measured 2026-10-28 (scratch probe `p079`).
 */
export const O2T_PART_HELPER = [
  '#let o2t-part(p) = {',
  '  let starts = query(<o2t-part-start>)',
  '  let ends = query(<o2t-part-end>)',
  '  starts.zip(ends).any(((s, e)) => s.location().page() <= p and p <= e.location().page())',
  '}',
].join('\n');

/** US-026: what the book parts ask of the furniture. */
export interface BookFurniture {
  /** Some no-header range is written (colophon, back notes, end padding). */
  parts: boolean;
  /**
   * The folios of the front matter, when there is front matter: `roman`
   * prints i, ii, … from the cover on (AC-3), `none` prints no folio until the
   * first chapter switches to arabic (AC-4); null without front matter.
   */
  front: 'roman' | 'none' | null;
  /** US-032 AC-8: an entries chapter is laid out (the "(continued)" line). */
  continued?: boolean;
}

/** US-026: no book parts; the furniture text is as before. */
export const NO_BOOK_FURNITURE: BookFurniture = Object.freeze({
  parts: false,
  front: null,
});

/**
 * US-032 | AC-8 (decision 1): the heading of the entry that runs on to page
 * `p` past its own pages, or none: pairs each placed entry's `<o2t-entry>`
 * fact (inline ones left out) with its `<o2t-entry-end>` fact in document
 * order; its own pages are the first (page entries) or the first two
 * (spread entries). Reads where the facts fell and changes no layout, so it
 * cannot oscillate (SCAR-021; the spike's "(continued)" runs).
 */
export const O2T_CONTINUED_HELPER = [
  '#let o2t-continued(p) = {',
  '  let starts = query(<o2t-entry>).filter(m => m.value.size != "inline")',
  '  let ends = query(<o2t-entry-end>)',
  '  for (s, e) in starts.zip(ends) {',
  '    let own = s.value.page + if s.value.size == "spread" { 1 } else { 0 }',
  '    if p > own and p <= e.value.page { return s.value.heading }',
  '  }',
  '  none',
  '}',
].join('\n');

/**
 * US-033 | AC-7 (decision 1): the header of page `p` inside an entries
 * chapter, or none outside them: "" on the chapter's opener page (from its
 * `<o2t-chapter-start>` page), else the title of the last section that
 * started on or before `p` (`<o2t-section-start>`), up to the chapter's
 * `<o2t-chapter-end>` page; whatever `runningHeaderLevel` is. Reads where the
 * markers fell and changes no layout (SCAR-021).
 */
export const O2T_CHAPTER_HEADER_HELPER = [
  '#let o2t-chapter-header(p) = {',
  '  for (s, e) in query(<o2t-chapter-start>).zip(query(<o2t-chapter-end>)) {',
  '    let sp = s.location().page()',
  '    if p == sp { return "" }',
  '    if p > sp and p <= e.location().page() {',
  '      let secs = query(<o2t-section-start>).filter(m => m.location().page() >= sp and m.location().page() <= p)',
  '      return if secs.len() == 0 { "" } else { secs.last().value.name }',
  '    }',
  '  }',
  '  none',
  '}',
].join('\n');

/**
 * US-033 | AC-7 (amended for #139), US-036 AC-6: the header of page `p` when
 * it holds a page an entries chapter writes after its last entry (the quick
 * reference, the encounter sheet page, anything later written there): the
 * title of the last `<o2t-tail>` marker on or before `p`, while the first
 * `<o2t-tail-end>` after that marker is on `p` or later; "" for an empty
 * title; none on a page where a level-1 heading starts (US-019) and on any
 * other page. One rule for the class (SCAR-017). Reads where the markers
 * fell and changes no layout (SCAR-021).
 */
export const O2T_TAIL_HEADER_HELPER = [
  '#let o2t-tail-header(p) = {',
  '  let tails = query(<o2t-tail>).filter(m => m.location().page() <= p)',
  '  if tails.len() == 0 { return none }',
  '  let t = tails.last()',
  '  let ends = query(selector(<o2t-tail-end>).after(t.location()))',
  '  if ends.len() == 0 or ends.first().location().page() < p { return none }',
  '  if query(heading.where(level: 1)).any(h => h.location().page() == p) { return none }',
  '  t.value.title',
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
 * 0.9em. US-025 AC-6: with `breaks` (a break rule is set) and the header on,
 * the header asks `o2t-blank` and prints nothing on an added page; the folio
 * stays. Without `breaks` the text is as before. US-026 AC-3, AC-4, AC-6:
 * `book` sets the front matter's numbering and lets the header skip the
 * no-header ranges; `NO_BOOK_FURNITURE` gives the text as before.
 */
export function pageFurnitureRule(
  furniture: PageFurniture | undefined,
  facingPages: boolean,
  breaks = false,
  book: BookFurniture = NO_BOOK_FURNITURE,
): string | null {
  if (furniture === undefined) return null;
  const {folios, runningHeader, runningHeaderLevel} = furniture;
  if (!folios && !runningHeader) return null;
  const side = facingPages
    ? 'if calc.even(here().page()) { left } else { right }'
    : 'center';
  const parts: string[] = [];
  // US-026 AC-3, AC-4: the front matter's numbering; the first chapter
  // switches to "1" (breaks.ts).
  const numbering =
    book.front === 'roman' ? '"i"' : book.front === 'none' ? 'none' : '"1"';
  if (folios) parts.push(`numbering: ${numbering}`);
  // US-025 AC-6: a page added by a break prints no header.
  const blank = runningHeader && breaks;
  // US-026 AC-6: nor does a page of the colophon or the back notes.
  const part = runningHeader && book.parts;
  if (runningHeader) {
    const title = `set text(size: 0.9em); align(center, running-title(${runningHeaderLevel}))`;
    const tests = [
      ...(blank ? ['not o2t-blank(here().page())'] : []),
      ...(part ? ['not o2t-part(here().page())'] : []),
    ];
    const header =
      tests.length > 0 ? `if ${tests.join(' and ')} { ${title} }` : title;
    // US-033 AC-7: inside an entries chapter the section's title, none on
    // the opener page; blank pages stay without a header.
    // US-033 AC-7 (amended for #139): after the chapter's last entry, the
    // title of the page written there (quick reference, sheet page).
    const own = (v: string): string =>
      `${v} != ""` +
      (tests.length > 0 ? ` and ${tests.join(' and ')}` : '') +
      ` { set text(size: 0.9em); align(center, ${v}) }`;
    const chapterHeader = `let h = o2t-chapter-header(here().page()); if h == none { let t = o2t-tail-header(here().page()); if t == none { ${header} } else if ${own('t')} } else if ${own('h')}`;
    // US-032 AC-8 (decision 1): on an entry's overflow page the line
    // "<heading> (continued)" replaces the running header; the folio stays.
    parts.push(
      book.continued === true
        ? `header: context { let c = o2t-continued(here().page()); if c != none { align(center, text(weight: "bold", c + " (continued)")) } else { ${chapterHeader} } }`
        : `header: context { ${header} }`,
    );
  }
  if (folios) {
    const folio = `set text(size: 0.9em); align(${side}, counter(page).display())`;
    // US-026 AC-4: with no numbering the counter would still print (measured,
    // F2: `3` on the colophon), so the footer asks for one.
    parts.push(
      book.front === 'none'
        ? `footer: context { if here().page-numbering() != none { ${folio} } }`
        : `footer: context { ${folio} }`,
    );
  }
  const line = `#set page(${parts.join(', ')})`;
  if (!runningHeader) return line;
  const helpers = [RUNNING_TEXT_HELPER, RUNNING_TITLE_HELPER];
  if (blank) helpers.push(O2T_BLANK_HELPER);
  if (part) helpers.push(O2T_PART_HELPER);
  if (book.continued === true)
    helpers.push(
      O2T_CONTINUED_HELPER,
      O2T_CHAPTER_HEADER_HELPER,
      O2T_TAIL_HEADER_HELPER,
    );
  return [...helpers, line].join('\n');
}
