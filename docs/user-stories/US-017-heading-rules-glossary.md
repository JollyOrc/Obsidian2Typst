# US-017 — Heading rules: a Glossary heading turns its sub-headings into term entries

**Status:** Done (2026-10-19)
**Introduced:** v0.3.0 (planned; a new feature bumps the minor version)
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author of a rulebook,
**I want** the `## Term` headings under my `# Glossary` heading to be printed as
glossary entries (the term in bold at the start of its explanation) and not as
numbered headings,
**so that** the glossary reads as Style Guide §6.6 describes it (a term with
one or more paragraphs explaining it), while links to the terms from the rest
of the book still work and the terms stay out of the table of contents.

Decided by the user (`docs/state/00_governance.md`): 2026-10-18, glossary
`## Term` headings become term entries, keep their labels, and are left out of
the outline and the heading numbering. 2026-10-19: the rule comes from a preset
field that maps heading texts to rules; only the headings one level below the
matched heading become terms; the section ends at the next heading of the same
or a higher level; a term is printed run-in; the chapter reference with a page
number (§6.6) is a later story (backlog "Page numbers for internal links"), so
this story keeps the author's links as they are. 2026-10-19 (open decisions):
a deeper heading under a term stays a heading without number and outline
entry, with a warning; a term is bold in the body font with the separator
` — `, no style fields; `Glossary: glossary` is built in.

Notation as in US-001: `⏎` is a line break, `md :` the note, `typ:` the output.
Today (measured 2026-10-19) the glossary is emitted as headings:
`= Glossary <h-glossary>`, `== Gambit <h-gambit>`, and a link `[Fighting
Pool](#tidal-basin)` is `#link(<h-tidal-basin>)[Tidal Basin]`.

---

## Acceptance criteria

- **AC-1 (preset field `headingRules`):** Field `headingRules` maps heading
  texts to rule names. The only rule name in this version is `glossary`; the
  value `none` switches a mapping off.
  ```
  headingRules:
    Glossary: glossary
    Glossar: glossary
    Terms: none
  ```
  Built-in mapping (used when the preset does not name the text): `Glossary:
  glossary` (decided 2026-10-19). The preset's entries are added to the built-in
  mapping; an entry for the same key (compared as in AC-2) replaces it, so
  `Glossary: none` switches the built-in rule off. Invalid values make the
  preset invalid (US-008 AC-4) with the line of the field and the first of:
  `headingRules must be a group of heading texts`;
  `headingRules.<text> must be a rule name: glossary or none`;
  `headingRules has the heading text "<text>" twice (compared without case and trailing blanks)`.
  Examples (note starts `---`, `schemaVersion: 1`, `headingRules:` on line 3):
  `headingRules: glossary` → `headingRules must be a group of heading texts
  (line 3)`; `Glossary: index` on line 4 → `headingRules.Glossary must be a rule
  name: glossary or none (line 4)`; `Glossary: glossary` and `glossary: none`
  on lines 4 and 5 → `headingRules has the heading text "glossary" twice
  (compared without case and trailing blanks) (line 5)`. `null` is unset.
  Preset field only: the Defaults of the settings tab get no `headingRules`
  (as `callouts`, US-016 AC-8), and the style panel gets no row.

- **AC-2 (which heading matches; every form, SCAR-009):** A heading matches a
  key when its plain text (`visibleText` of US-002 with images dropped: the
  inline content without markup, `**Glossary**` → `Glossary`; a link's text;
  code text; a run of blanks as one blank) with leading and trailing blanks
  removed equals the key in the same form, compared in lower case. Any heading level 1 to 5 can match; a level-6 heading has no
  sub-level (AC-9).
  ```
  md : # Glossary                matches
  md : # glossary                matches (case)
  md : # Glossary␠␠              matches (trailing blanks)
  md : ## **Glossary**           matches (markup removed), terms are ###
  md : # Tidal   Basin         matches the key "Tidal Basin" (runs of blanks inside count as one; decided 2026-10-19)
  md : # ![x](i.png) Glossary    matches (image alt text is not heading text; decided 2026-10-19)
  md : # Glossary:               no match (":" is part of the text)
  md : # The Glossary            no match
  md : # Glossary <!-- c -->     matches (today `= Glossary  <h-glossary>`, COMMENT_DROPPED)
  md : #Glossary                 no match: not a heading, paragraph "\#Glossary"
  ```
  Only headings at the top level of the note match: a heading inside a
  callout, quote or list item keeps US-002 and US-016 AC-6 (AC-8).

- **AC-3 (which headings become terms; the section):** Under a matched heading
  of level `n`, the section runs until the next heading of level `n` or less, or
  the end of the note. Inside it, every heading of level `n + 1` is a term.
  Blocks before the first term stay as they are (an introduction). The blocks
  after a term, up to the next term or the end of the section, are the term's
  explanation.
  ```
  md : # Glossary⏎Below.⏎## Gambit⏎A thing.⏎## Break⏎Dice.⏎# End notes⏎End.
  terms: Gambit (explanation "A thing."), Break (explanation "Dice.")
  "Below." stays a paragraph; "# End notes" ends the section and is a heading.
  ```

- **AC-4 (Typst shape of a term; run-in):** A term whose explanation starts
  with a paragraph is written as one paragraph: the call of the helper
  `glossary-term` (AC-6) with the term text, the term's label, one blank, then
  the paragraph's text as today.
  ```
  md : ## Gambit⏎A thing you can do. Two per Pulse.
  typ: #glossary-term[Gambit] <h-gambit> A thing you can do. Two per Pulse.

  md : ## Tidal Basin⏎The pool. Uses *dice*.⏎⏎Second paragraph.
  typ: #glossary-term[Tidal Basin] <h-tidal-basin> The pool. Uses _dice_.⏎⏎Second paragraph.

  md : ## Pool **bold** `x`⏎Text.
  typ: #glossary-term[Pool *bold* `x`] <h-pool-bold-x> Text.
  ```
  The term text goes through `emitInline` with the heading options
  (`where: 'heading'`) but `atBlockStart: true`, because it starts a content
  block (decided 2026-10-19; measured: with `atBlockStart: false` the term `- x`
  is a list item, `= x` a heading inside the bold term; `## - x` is `#glossary-term[\- x]`);
  the paragraph's text is emitted as
  it is today at the start of a paragraph (`atBlockStart: true`), so `- not a
  list` stays `\- not a list`. In the PDF the paragraph reads
  `Gambit — A thing you can do. Two per Pulse.` with `Gambit` in bold, in the
  body font (decided 2026-10-19: separator ` — ` = blank, em dash U+2014,
  blank; no preset style fields in this version).

- **AC-5 (a term without a leading paragraph):** When the explanation is
  empty or starts with another block (list, table, code, quote, callout,
  image, a deeper heading), the term is a paragraph of its own, kept with the
  next block, and has no separator:
  ```
  md : ## Rapid Basin⏎- list first⏎- second
  typ: #block(sticky: true)[#glossary-term(run-in: false)[Rapid Basin] <h-rapid-basin>]⏎⏎- list first⏎- second

  md : ## Empty term⏎## Next⏎x
  typ: #block(sticky: true)[#glossary-term(run-in: false)[Empty term] <h-empty-term>]⏎⏎#glossary-term[Next] <h-next> x
  ```
  No warning for an empty explanation.

- **AC-6 (preamble rule `glossary`, order 86):** When the body holds at least
  one term, the preamble gets the rule `glossary` (order 86: after `callouts`
  85, before `cover` 90; US-015 AC-2) with the helper (measured 2026-10-19 with
  the bundled Typst 0.14.2):
  ```
  #let glossary-term(body, run-in: true) = { strong(body); if run-in [ — ] }
  ```
  Without a term the rule is not written. `glossary-term` joins
  `PLUGIN_NAMES` (US-016 AC-11): a template that defines it gets
  `TEMPLATE_NAME_TAKEN`, and the text check over the preamble rules covers it.

- **AC-7 (labels, links, numbering, outline; SCAR-011):** A term keeps the
  label it would have as a heading (`<h-gambit>`), taken from the same label
  set (US-002). Invariant: the set of labels and the target of every link are
  the same with and without the rule. `[Tidal Basin](#tidal-basin)` and
  `[[#Tidal Basin]]` from anywhere in the note (before, inside or after the
  glossary) stay `#link(<h-tidal-basin>)[…]` and jump to the term. A term is
  not a heading in Typst: it has no number, no outline entry and no PDF
  bookmark, and the next heading is numbered as if the term did not exist.
  Measured 2026-10-19 (`= Rules`, `= Glossary`, a term, `= Back`): headings
  `1`, `2`, `3`; the outline lists `Rules`, `Glossary`, `Back`; the label of a
  run-in term is on the `sequence`, of a lone term on the `strong`, each found
  once; both links compile. The matched heading itself (`Glossary`) stays a
  heading with its number and outline entry. Warnings of US-002 are computed
  on the headings of the note as written: `HEADING_LEVEL_SKIPPED` and
  `HEADING_EMPTY` are unchanged by the rule (`## ` under `# Glossary` is
  still `HEADING_EMPTY` and is omitted).

- **AC-8 (composed and nested, SCAR-002):** Each case states the result.
  ```
  md : ## Glossary⏎### Gambit⏎A.⏎## Next     terms are level 3; "## Next" ends the section
  md : # Glossary⏎## A⏎a⏎# Other⏎# Glossary⏎## B⏎b   two sections; A and B are both terms
  md : > [!note] N⏎> # Glossary⏎> ## A⏎> a       inside a callout: no rule; headings as US-016 AC-6
  md : - x⏎⏎  ## Glossary                         heading inside a list item (today `  == Glossary <h-glossary-2>`); no rule
  md : # Glossary⏎## A⏎> [!example] E⏎> body      A is a lone term (AC-5) followed by the callout
  md : # Glossary⏎## A⏎a[^1]⏎⏎[^1]: n            footnote in the explanation numbered in order (US-005)
  md : # Glossary⏎## A[^1]⏎a                     footnote call stays in the term text
  md : # Glossary⏎## ![Map](assets/map.png) A⏎a  #glossary-term[A] <h-a> a⏎⏎#figure(fit-image(…)…): the image after the run-in paragraph, IMAGE_IN_HEADING as today (US-003 AC-1d)
  md : # Glossary⏎## [[Tessera]]⏎a                term text is the link of US-004
  md : # Glossary⏎## A⏎a⏎### Deep⏎d             Deep is a heading without number (AC-14)
  ```

- **AC-9 (no terms):** A matched heading with no heading of level `n + 1` in
  its section (also a matched level-6 heading) gives one warning at its line
  and changes nothing:
  `HEADING_RULE_NO_TERMS  Heading "Glossary" has the rule glossary but no headings one level below it; nothing was changed`.
  The heading text in the message is as typed, escaped for the report
  (US-006).

- **AC-10 (page breaks):** A run-in term is part of its paragraph, so it is
  never alone on a line at the bottom of a page when the paragraph has two or
  more lines (Typst's widow and orphan defaults). A lone term (AC-5) is kept
  with the next block (`sticky: true`). The end-to-end test checks, in a case
  built to put it there (sweep of filler lines as US-016 AC-14), that no page
  ends with a term text.

- **AC-11 (composed export, content; SCAR-015):** A test note with an
  introduction, five terms (run-in, two paragraphs, list first, empty, inline
  markup), a link to a term before and after the glossary, and a heading after
  the section, compiles with no error, and the PDF:
  - holds `Gambit — A thing you can do.` as one line of text, and each term
    text exactly once;
  - holds the bold font (Libertinus Serif Bold) for the term texts;
  - has PDF bookmarks that list `Glossary` and the following heading, and no
    term (`tests/support/pdf.ts` has no bookmark reader yet; added in G2);
  - has a link annotation for each of the two links whose destination is on
    the page of its term.

  Guard test: the same note with `headingRules: {Glossary: none}` prints
  `Gambit` as a numbered heading `2.1 Gambit` and lists it as a bookmark.

- **AC-12 (preview panel):** The preview of US-012 shows the terms as the
  export (same `convert`). Editing `headingRules` in the active preset note
  redraws the preview (US-012 AC-14); a test shows that a change from
  `glossary` to `none` reaches the next preview request.

- **AC-13 (the sample note):** `Book.md` of the sample vault (US-024):
  `# Glossary` holds the terms of its manifest (at least 40, as the author's
  real file had); each starts its explanation with a paragraph, so the export
  has one run-in term per manifest term, no lone term, no
  `HEADING_RULE_NO_TERMS`, the rule `glossary` in the preamble, and no other
  change outside the section. The links to the manifest's linked term (at
  least 3) compile and land on its page. The export is deterministic (rule 7).
  Unit tests use their own notes, never a private vault.

- **AC-14 (a deeper heading inside a term; decided 2026-10-19):** Inside a
  term's explanation (after the first term of a section, AC-3), a heading of
  level `n + 2` or deeper stays a heading with its level and label, but has no
  number and no outline entry, and gives one warning at its line:
  ```
  md : # Glossary⏎## Gambit⏎A thing.⏎### Deep⏎deep text
  typ: #glossary-term[Gambit] <h-gambit> A thing.⏎⏎#heading(level: 3, numbering: none, outlined: false)[Deep] <h-deep>⏎⏎deep text
  warning: HEADING_IN_TERM  Heading "Deep" is inside the glossary term "Gambit"; it is printed without number and outline entry
  ```
  Measured 2026-10-19 (Typst 0.14.2): it compiles, a link to `<h-deep>`
  compiles, the heading is not in the outline and not bookmarked (`bookmarked:
  auto` follows `outlined`), and the headings around it are numbered `1`, `2`,
  `3` (no `2.0.1`). Its text goes through `emitInline` as a heading's
  (`where: 'heading'`) with `atBlockStart: true`, as the term text (AC-4). The two texts in the message are as typed, escaped for
  the report (US-006). A deeper heading before the first term (in the
  introduction) is not inside a term and stays as today (with
  `HEADING_LEVEL_SKIPPED` where US-002 gives it).

---

## Decisions (2026-10-19)

The three open decisions of the Draft were answered by the user: (1) option
(a), AC-14; (2) bold, body font, separator ` — `, no style fields, AC-4;
(3) `Glossary: glossary` built in, AC-1.

---

## Notes

- Not in this version: style fields for the term (font, colour, separator); the chapter reference with a page number (Style Guide
  §6.6; backlog "Page numbers for internal links"); a glossary page built from
  marked entries elsewhere (backlog "Front and back matter"); sorting the
  terms (they are kept in the order of the note); other rule names than
  `glossary`; matching by regular expression.
- New call sites (SCAR-001): `emitInline` for the term text with the
  heading options; the US-002 label set for term labels; the plain text of a
  heading for matching (to be named in G2: a function that already exists,
  or a new one in `core/markers`); `escapeMarkup` through the report message of
  AC-9.
- New piece types for the join table (SCAR-010): `#glossary-term[…] <label>`
  followed by a blank and the paragraph's first character (letter, `\`-escape,
  `#` call, `*` and `_` markup, `` ` `` raw, `$`-escaped, link call, footnote
  call); and the lone form `#block(sticky: true)[…]` before every block kind.
  Measured 2026-10-19 (G2): the label right after `]` is what protects the
  call; `<h-a>x`, `<h-a>(x)` and `<h-a> \[x\]` compile, while
  `#glossary-term[A](x)` fails (`unknown variable: x`) and
  `#glossary-term[A][x]` fails (`unexpected argument`). The blank after the
  label is kept for readability.
- Labels (SCAR-011): no new labels; the invariant of AC-7 is tested over a
  mixed note and over the fixture.
- Worst misplaced click (SCAR-014): none; no control, no dialog (SCAR-013), no
  settings row (SCAR-016, SCAR-017): the rule is a preset field only.
- Where the rule runs: in `core/markers` (recognising marked content) on the
  parsed tree, before `core/emit`; the emitter gets terms as a block kind. To be
  confirmed in the tickets (dependency direction of `CLAUDE.md`).

---

## Related tickets

- [TICKET-046](../tickets/TICKET-046-heading-rules-preset-field.md) — Preset field `headingRules`: schema, validation, effective settings, built-in mapping
- [TICKET-047](../tickets/TICKET-047-glossary-terms-conversion.md) — Glossary terms in the conversion: sections, terms, emission, rule `glossary`, warnings
- [TICKET-048](../tickets/TICKET-048-glossary-preview-build-and-m7.md) — Glossary terms in the preview, test build `0.3.0-m7.1`, manual check M7
