# US-018 — Page numbers for internal links

**Status:** Done (2026-10-21)
**Introduced:** v0.5.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.5.0 (test build `0.5.0-m9.1`, M9 passed 2026-10-21)
**Supersedes:** —

---

## Story

**As an** author of a rulebook,
**I want** a link to a chapter, and every link in a glossary explanation, to
print the page of its target after the link text (`Raising a Banner (p.
42)`),
**so that** a reader of the printed book can follow the reference as a reader
of the PDF follows the link (Style Guide §6.6: "hyperlink (for PDFs) and page
number (for print)").

Decided by the user (`docs/state/00_governance.md`, 2026-10-19): page numbers
go on links to headings up to a preset level (default 2) and on every link
inside a glossary term's explanation; the form is `Link (p. 42)`, the word a
preset text (`S.` for a German preset); a preset switch, on by default, off in
the built-in A4 digital preset. Folios come first: they exist since US-019
(2026-10-20), and the page number printed after a link is the folio of the
target page.

Notation as in US-001: `⏎` is a line break, `md :` the note, `typ:` the
output. Measured 2026-10-20 with the bundled Typst 0.14.2 (scratch probe): the
helper of AC-3 prints the folio of the target (`(p. 3)` for a heading on PDF
page 4 after a cover), works for a glossary term's label (US-017), and a `(` or
`[` right after its call joins the call unless a `;` separates them.

Fixture facts (`The Rules/compiledtext.md`, measured 2026-10-20): 139 resolved
internal links: 1 to a `#` heading, 11 to `##`, 34 to `###`, 4 to `####`, 40 to
`#####`, 40 to `######`, 9 to glossary terms; 21 links sit inside the
glossary.

---

## Acceptance criteria

- **AC-1 (fields):** In preset notes and the Defaults, with the precedence of
  US-008 AC-1:
  ```
  linkPageNumbers: true     # built-in true
  linkPageLevel: 2          # whole number 1 to 6; built-in 2
  linkPageWord: "p."        # text, not empty; built-in "p."
  ```
  (three top-level fields, decided 2026-10-21). Messages with the line of the
  field: `linkPageNumbers must be true or false`; `linkPageLevel must be a
  whole number from 1 to 6`; `linkPageWord must be text`. Examples (`---`,
  `schemaVersion: 1` first): `linkPageLevel: 7` on line 3 →
  `linkPageLevel must be a whole number from 1 to 6 (line 3)`; `linkPageWord:
  ""` → `linkPageWord must be text (line 3)`. `null` is unset. The built-in
  preset note `A4 digital` that the plugin creates (US-008 AC-6) gains
  `linkPageNumbers: false`; existing preset notes in a vault are never changed
  (rule 2).

- **AC-2 (which links get a number; every value of the level, SCAR-019):** A
  resolved internal link (US-004: `[text](#anchor)`, `[[#Heading]]`) gets the
  page number when all hold:
  1. `linkPageNumbers` is true and folios are on (`page.folios`, US-019), so
     the printed number exists on its page;
  2. the link is not inside a heading (the heading text reaches the running
     header and the outline); a glossary term's heading is a heading here too
     (decided 2026-10-21: `## See [Tessera](#tessera)` under `# Glossary` prints
     the term `See Tessera` without a number);
  3. its target is a heading of level at most `linkPageLevel`, or the link sits
     inside a glossary term's explanation (US-017: the blocks of a term, its
     run-in paragraph included, and the text of a footnote called from them,
     decided 2026-10-21), whatever its target.
  ```
  linkPageLevel  link to          in body       in a glossary explanation
  1              # Rules          (p. N)        (p. N)
  1              ## Tessera        —             (p. N)
  2 (default)    ## Tessera        (p. N)        (p. N)
  2              ### Moss         —             (p. N)
  3              ### Moss         (p. N)        (p. N)
  6              ###### Detail    (p. N)        (p. N)
  any            unresolved link  —             —
  ```
  A link to a glossary term (US-017) counts with the level of the term's
  heading in the note (decided 2026-10-21): `## Gambit` under `# Glossary` is
  level 2, so with `linkPageLevel: 1` a body link to it gets no number and with
  2 (the default) or more it does; a link to a term inside another term's
  explanation always gets one (rule 3). A link whose target is on
  its own page still gets the number (decided 2026-10-21, see Decisions 3).

- **AC-3 (Typst shape):** The number is a call of the helper `page-ref` right
  after the link. The call separator of US-001 AC-1c that the link emitter
  writes today after a link (measured 2026-10-20: `…[Advancing a
  Character];.`, `…[x];(y)`) moves behind the `page-ref` call, which has the
  same join hazards (measured: `(` and `[` join the call):
  ```
  md : See [Raising a Banner](#1.5-raising-a-banner).
  today: See #link(<h-raising-a-banner>)[Raising a Banner];.
  typ:   See #link(<h-raising-a-banner>)[Raising a Banner]#page-ref(<h-raising-a-banner>);.
  ```
  (The anchor `#1.5-raising-a-banner` resolves to the heading `## Advancing
  a Character` by the number-stripped rule of US-004.)
  The preamble rule `page-refs` (order 47: after `page-furniture` 45, before
  `highlight` 50) defines, only when the body holds a `page-ref` call:
  ```
  #let page-ref(target) = context [ (p.~#numbering("1", ..counter(page).at(target)))]
  ```
  with the word of AC-1 written through `escapeMarkup` (`S.` → `(S.~42)`), a
  non-breaking space before the number. `page-ref` joins `PLUGIN_NAMES`
  (US-016 AC-11). PDF: `See Raising a Banner (p. 42).`

- **AC-4 (the number is the folio):** The number equals the folio printed on
  the target's page (US-019 AC-3): the cover and its blank page do not count.
  Measured: a heading on PDF page 4 after a cover prints `(p. 3)`, the folio
  of that page.

- **AC-5 (composed, SCAR-002; every example was run through today's whole
  converter on 2026-10-20, with US-016 and US-017 on; the `today` forms are its
  output):**
  ```
  md : # Glossary⏎## Wandering⏎Converts treasure. [see the Wandering chapter.](#raising-a-banner)⏎# Rules⏎## Raising a Banner⏎x
  typ: #glossary-term[Wandering] <h-wandering> Converts treasure. #link(<h-raising-a-banner>)[see the Wandering chapter.]#page-ref(<h-raising-a-banner>)
  md : ## See [Tessera](#tessera)         no number (inside a heading; today `== See #link(<h-tessera>)[Tessera] <h-see-tessera>`)
  md : x[^1]⏎[^1]: See [Tessera](#tessera).   number inside the footnote
  md : > [!note] N⏎> See [Tessera](#tessera).   number inside the callout
  md : | [Tessera](#tessera) |                  number inside the cell
  md : [Boxed](#boxed) to a ## inside a callout   number (it is a heading, US-016 AC-6)
  md : [x](#tessera)(y)                        today `#link(<h-tessera>)[x];(y)`; typ: `#link(<h-tessera>)[x]#page-ref(<h-tessera>);(y)`
  ```
  A link inside a mark (strong, emph, highlight, strike, underline; decided
  2026-10-21): the number goes after every mark that ends right after the
  link, so it is printed plain; a mark that goes on after the link keeps the
  number inside (measured 2026-10-21: every form below compiles; the number
  after `*…*` has the width of plain `(p.~3)`, inside it the width of bold):
  ```
  md : See **[Tessera](#tessera)** now.
  today: See *#link(<h-tessera>)[Tessera]* now.
  typ:   See *#link(<h-tessera>)[Tessera]*#page-ref(<h-tessera>) now.
  md : **See [Tessera](#tessera).**
  today: *See #link(<h-tessera>)[Tessera];.*
  typ:   *See #link(<h-tessera>)[Tessera]#page-ref(<h-tessera>);.*
  md : ***[Tessera](#tessera)***.
  today: _*#link(<h-tessera>)[Tessera]*_.
  typ:   _*#link(<h-tessera>)[Tessera]*_#page-ref(<h-tessera>);.
  md : See ==[Tessera](#tessera)==.
  today: See #highlight[#link(<h-tessera>)[Tessera]];.
  typ:   See #highlight[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);.
  md : See ~~[Tessera](#tessera)~~(x)
  typ:   See #strike[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);(x)
  md : See *[Tessera](#tessera)*[^1]⏎⏎[^1]: n
  typ:   See _#link(<h-tessera>)[Tessera]_#page-ref(<h-tessera>)#footnote[n]
  md : See <u>[Tessera](#tessera)</u>.
  typ:   See #underline[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);.
  md : **[Tessera](#tessera) and [Rules](#rules)**
  typ:   *#link(<h-tessera>)[Tessera]#page-ref(<h-tessera>) and #link(<h-rules>)[Rules]*#page-ref(<h-rules>)
  ```

- **AC-6 (switch off, folios off, determinism):** With `linkPageNumbers:
  false` or `page.folios: false`, no `page-ref` call and no rule; the Typst is
  byte-identical to a convert without the fields (AC-8 of US-019). The same
  note and settings give the same Typst (rule 7).

- **AC-7 (composed export, content; SCAR-015):** A test note with a cover,
  chapters on several pages, a glossary whose explanations link to chapters
  and to a `###` section, a link in a footnote and one in a heading, exported
  with folios on, compiles with no error, and the PDF:
  - prints `(p. N)` after each link of AC-2, where `N` is the folio of the
    page that holds the target (read by the PDF readers of US-017/US-019);
  - prints no number after the link in the heading and none in the running
    header;
  - with `linkPageWord: "S."` prints `(S. N)`.
  Guard test: with `linkPageNumbers: false` no `(p.` text appears.

- **AC-8 (settings rows and preview):** The fields are in the Defaults
  (decided 2026-10-21); the Defaults rows gain, right after `Running header
  level` (US-019, the folios they need), `Page numbers in links` (toggle),
  `Link page level` (number, hint `1 to 6`) and `Link page word` (text, hint
  `p.`), with the existing save rule, reset question and redraw (SCAR-013,
  014, 016, 017); the preview shows the numbers as the export, and an edit of
  `linkPageLevel` in the active preset reaches the next preview request.

- **AC-9 (the sample note):** `Book.md` of the sample vault (US-024) with
  the built-in values: the links its manifest counts as `numberedLinks['2']`
  get a number; compiles; deterministic; at `linkPageLevel` 1, 3 and 6 the
  manifest's counts. (The author's real file, measured 2026-10-21: 33 at the
  built-in values — 12 in the body to `#`/`##` headings and all 21 links of
  the glossary — and 22, 59, 139 at levels 1, 3, 6; the sample has at least
  these.)
  No link of the fixture is inside a heading.

---

## Decisions (answered 2026-10-21)

1. **Field names and place.** *Decided 2026-10-21: the proposal (three
   top-level fields with Defaults rows).* Proposed: three top-level fields
   (`linkPageNumbers`, `linkPageLevel`, `linkPageWord`), in presets and the
   Defaults, with three Defaults rows (as US-019). Alternative: a group
   `pageReferences: {show, level, word}`, or preset notes only (no rows).
2. **Links to glossary terms.** *Decided 2026-10-21: the proposal (the
   level of the term's heading).* A term is not a heading in the PDF (US-017).
   Proposed: a link to a term counts with the level of the term's heading in
   the note (`## Gambit` under `# Glossary` = level 2), so with the default
   the 9 term links of the fixture get a number. Alternative: term links never
   get a number outside the glossary.
3. **Same-page targets.** *Decided 2026-10-21: printed like any other.* The
   alternative was measured first (scratch probe, Typst 0.14.2, A5, eight
   links in one paragraph before the target, filler swept): a helper that
   drops the number when `locate(target).page() == here().page()` oscillates
   at a page edge (the number pushes the paragraph onto the target's page,
   where it is dropped, and the paragraph moves back) and ended with links on
   page 1 to page 2 and no number; the compile path returns no warnings, so
   it would be silently wrong (rule 8). The plain helper was right at every
   fill level. Proposed: printed like any other (`(p. 3)` on page
   3); dropping it would need a second layout pass. Alternative: left out
   when the target is on the link's page (Typst can test it in `context`; to
   be measured).

---

## Notes

- Not in this version: `see p. N` wording around the link, page ranges,
  chapter numbers as references (`§1.5`), references to figures or tables.
- New call sites (SCAR-001): the link emitter of US-004 (a suffix after an
  internal link), `callSeparator` (after `page-ref`), `escapeMarkup` (the
  word), the US-017 glossary plan (is the link inside an explanation), the
  built-in preset texts of US-008 AC-6.
- Join table, measured 2026-10-21 (Typst 0.14.2, A5, the AC-3 helper, the
  PDF text read back): after `#page-ref(<l>)` the neighbours `.`, `(`
  (with the `;` of `callSeparator`), `,`, `)`, `;;`, a letter, a space, an
  escaped `\[`, `\*`, a quote, `#footnote[…]`, a line break `\`, the end of
  the paragraph, another `#link`, a table cell, and inside and after `*…*`,
  `_…_`, `#highlight[…]`, `#strike[…]`, `#underline[…]` all compile and print
  `Tessera (p. 3)` followed by the neighbour; `(` without `;` fails (`unknown
  variable: y`). The space before `(` is a real space (width of `Tessera#page-ref`
  equals `Tessera (p.~3)`).
- Join table row `page-ref call` (TICKET-053): followed by `.`, `(`, `[`, `;`
  → `;` between (callSeparator); by a letter, `,`, `)`, a blank, a footnote
  call, a line break, the end → nothing between; preceded by `]` of the link,
  `*`, `_` or `]` of a mark → nothing between (a `#` after a mark is not a word
  character, so the delimiter form stays). Guard: `(` without `;` fails.
- New piece type for the join table (SCAR-010): `#page-ref(<label>)` after a
  link, before every neighbour of a link (`.`, `,`, `)`, `;`, a letter, a
  footnote call, `(`, `[`, end of paragraph, line break).
- Labels (SCAR-011): none; the call uses the link's label.
- SCAR-019: AC-2 has examples at levels 1, 2, 3 and 6 and the switch off;
  AC-7 uses a non-default word; the manual check uses a non-default preset.
- Worst misplaced click (SCAR-014): a new row's reset icon, behind the
  existing question.

---

## Related tickets

- [TICKET-052](../tickets/TICKET-052-link-page-fields-and-rows.md) — the
  fields, effective settings, Defaults rows, A4 digital (AC-1, AC-8 rows).
- [TICKET-053](../tickets/TICKET-053-page-ref-call-and-rule.md) — the call
  and the rule `page-refs` (AC-2 to AC-7, AC-9).
- [TICKET-054](../tickets/TICKET-054-page-refs-preview-build-and-m9.md) —
  preview, test build `0.5.0-m9.1`, manual check M9 (AC-8 preview, manual
  parts).
