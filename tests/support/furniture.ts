// Test support for US-019: the expected Typst of the preamble rule
// `page-furniture`, as measured 2026-10-19 with the bundled Typst 0.14.2
// (scratch probe: rules 1 to 5 of AC-5, the folios of AC-3, the footnote
// hazard of AC-7). Source of truth:
// docs/user-stories/US-019-folios-and-running-headers.md.

/** US-019 AC-6, AC-7 (measured 2026-10-19): the title text without footnotes. */
export const RUNNING_TEXT = [
  '#let running-text(it) = {',
  '  if type(it) != content { return it }',
  '  if it.func() == footnote { return [] }',
  '  if it.has("children") { return it.children.map(running-text).join() }',
  '  if it.func() == link { return link(it.dest, running-text(it.body)) }',
  '  if it.func() in (strong, emph, highlight, underline, strike) { return (it.func())(running-text(it.body)) }',
  '  it',
  '}',
].join('\n');

/** US-019 AC-5 (measured 2026-10-19): the title of the page's header. */
export const RUNNING_TITLE = [
  '#let running-title(level) = {',
  '  let p = here().page()',
  '  let starts(h) = h.location().page() == p',
  '  if query(heading.where(level: 1)).any(starts) { return none }',
  '  let starting = query(heading.where(level: level)).filter(starts)',
  '  if starting.len() > 0 { return running-text(starting.first().body) }',
  '  running-text(query(selector(heading).before(here())).filter(h => h.level <= level).at(-1, default: (body: none)).body)',
  '}',
].join('\n');

export const HEADER = (level: number) =>
  `header: context { set text(size: 0.9em); align(center, running-title(${level})) }`;
export const FOOTER_FACING =
  'footer: context { set text(size: 0.9em); align(if calc.even(here().page()) { left } else { right }, counter(page).display()) }';
export const FOOTER_SINGLE =
  'footer: context { set text(size: 0.9em); align(center, counter(page).display()) }';
