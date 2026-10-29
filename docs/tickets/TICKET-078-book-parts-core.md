# TICKET-078 — Book parts: the colophon and back-notes rules (core)

**Status:** Done (2026-10-28)
**User story:** [US-026](../user-stories/US-026-book-parts-and-signatures.md)
**ACs addressed:** AC-1, AC-2, AC-8
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-007, SCAR-011, SCAR-017, SCAR-018,
SCAR-023, SCAR-026, SCAR-027

---

## Description

Two new heading rules, `colophon` and `back-notes`, with the built-in
mapping `Colophon` and `Back notes`. A marked section leaves the body: the
colophon goes before it, the back notes after it. A hidden heading is not
written, its label stays on a `metadata` marker. Several sections of one kind
are joined (`BOOK_PART_JOINED`); an empty part with a hidden heading is left
out (`BOOK_PART_EMPTY`). The pages (front matter, padding) are TICKET-079.

---

## Acceptance criteria (from user story)

- **AC-1:** rule names `glossary`, `colophon`, `back-notes`, `none`; the
  built-in mapping adds `Colophon: colophon`, `Back notes: back-notes`;
  `headingRules.Impressum must be a rule name: glossary, colophon, back-notes
  or none (line 4)`; a part runs from its top-level heading to the next
  heading of the same or a higher level; not inside a callout, a glossary
  section or another part.
- **AC-2:** `book.colophonHeading`, `book.backNotesHeading` (`hidden` built
  in): hidden writes `#metadata(none) <h-colophon>` instead of the heading;
  printed writes the heading as today.
- **AC-8:** the warning texts of the story (amended at G2), at the second or
  the empty heading's line.

---

## Implementation notes

- `src/core/markers/heading-rules.ts`: `HeadingRule` gains `colophon`,
  `back-notes`; `HEADING_RULE_NAMES`, `BUILTIN_HEADING_RULES`.
- `src/core/markers/glossary.ts`: the section walk of `findGlossary` becomes
  the one decider of sections for every rule (SCAR-017): it opens a section
  for `glossary`, `colophon` or `back-notes`, closes it at the same or a
  higher level, and records `inSection` for all; the plan gains `parts:
  {colophon: BlockNode[][], backNotes: BlockNode[][]}` (each section's blocks
  with its heading) and the warnings of AC-8. A heading inside a part opens
  no rule (as inside a glossary section).
- `src/core/presets/parse.ts`: the message names the four rules.
- `src/core/convert/index.ts`: the root is split into colophon, body, back
  notes before `emitBlocks` (the heading index stays the one of the whole
  note, so links and labels are unchanged; SCAR-011); each part is emitted
  with the same options; hidden headings become markers.
- `src/core/presets/note-edit.ts` (`headingRuleAction`, US-022): reads only
  `glossary`; a heading mapped to `colophon` offers `Use as glossary
  section` and would replace the mapping — out of scope (story Notes), but the
  test of US-022 is read so that a built-in `Colophon` heading keeps today's
  menu text; listed here so the next story sees it.
- `src/plugin/settings/details.ts`: the summary row shows the built-in
  mapping from `BUILTIN_HEADING_RULES` (now three pairs).
- Register rows "Heading rules" and "Glossary plan".

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-017-heading-rules.test.ts`: the message and the built-in
  mapping tests were updated or narrowed at G2.
- `tests/plugin/us-021-groups-details.test.ts` "Heading rules": a preset's
  own rules (`Glossary → glossary, Index → none`); the built-in row for no
  preset is not pinned to one pair — read again when coding.
- `tests/unit/us-022-preset-edits.test.ts`, `tests/plugin/us-022-menus-write.test.ts`:
  `headingRuleAction` for `Glossary`; unaffected by new names.
- No whole-list test of `HEADING_RULE_NAMES` besides US-026's own.

---

## Tests

- `tests/unit/us-026-book-parts.test.ts` AC-1, AC-2, AC-8.
- US-004, US-017, US-018, US-021, US-022 tests stay green.
- Mutation checks: a part found inside a callout; a part ending at a deeper
  heading; the back notes before the body; a hidden heading written; the
  marker without the label; parts not joined; an empty printed part dropped;
  the built-in mapping missing one name; the message without `back-notes`.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-001** (1–4) the section walk's new call sites (parts) documented in
  its register row; edge inputs: a part at the start, at the end, two of one
  kind, an empty one.
- **SCAR-002** (1–6) composed: parts with a glossary section, a callout
  heading named `Colophon`, links into a hidden part (AC-2), footnotes in a
  part; checked against US-002, US-004, US-017, US-018, US-022; the new item
  (a decision's rule re-measured): decision 2 (built-in mapping) re-read in
  every example.
- **SCAR-003** (1–3) red tests exist (G2); AC list read again; map.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) exact messages and lines.
- **SCAR-008** n/a (no Typst fact beyond the label on `metadata`, measured at
  G1).
- **SCAR-009** (1–4) a part as first block, as last block, after a cover.
- **SCAR-010** (1–6) parts are joined to the body as blocks (blank line); no
  inline join.
- **SCAR-011** (1–5) one heading index for the whole note: the labels of part
  headings keep their suffixes (`h-colophon`, `h-colophon-2`).
- **SCAR-012** n/a here (TICKET-082).
- **SCAR-013, SCAR-014** n/a (no dialog, nothing written into the vault).
- **SCAR-015** (1–2) the tests assert the text of each part and its place.
- **SCAR-016** n/a (no control).
- **SCAR-017** (1) grep of every reader of the rule table (above: parse,
  glossary, line-context, convert, note-edit, details); (2) the class rule in
  the story (one section rule); (3) one decider; (4–8) pointers.
- **SCAR-018** (1–10) backups by full path with checksums for the mutation run.
- **SCAR-019** (1–5) both heading choices for both parts.
- **SCAR-020** n/a (no option offered).
- **SCAR-021** n/a (no layout read).
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1–10) guards above; the "Colophon: none" test is paired with
  the test that shows the built-in in effect; the new item: whole-list tests
  of the rule names searched.
- **SCAR-024** n/a (no new dependency statement).
- **SCAR-025** n/a.
- **SCAR-026** (1–4) the built-in words matched as headings only, by the
  heading-rule comparison; the private book's two headings classified at G1.
- **SCAR-027** (1–3) the changed default output listed in AC-1 (the private
  book only); release notes item in the result.
- **SCAR-028** (1–4) the tests read the Typst source, no new reader.

---

## Definition of done

- [x] Tests named above green; US-004, US-017, US-018, US-021, US-022 green
- [x] Mutation checks run, results in the result
- [x] ESLint and Prettier clean; pass counts in the result
- [x] Register rows updated

---

## Result (2026-10-28)

Changed: `src/core/markers/heading-rules.ts` (`colophon`, `back-notes`, the
built-in mapping), `src/core/markers/glossary.ts` (`BookPart`; the section
walk collects parts; `parts` in the plan), `src/core/markers/index.ts`,
`src/core/presets/parse.ts` (the message), `src/core/layout/page-setup.ts`
(`BookSettings`, `DEFAULT_BOOK`), `src/core/convert/types.ts`
(`ConvertSettings.book`), new `src/core/convert/parts.ts` (`arrangeParts`),
`src/core/convert/index.ts` (one emitter call over the arranged blocks, so
footnotes and labels stay one document), `src/core/emit/blocks.ts` (options
`hidden`, `gone`; a hidden heading is its label marker; hidden headings do not
break), `src/core/emit/inline.ts` (`LinkEnv.gone`);
`docs/technical/warning-codes.md` (two rows); register rows.

- Gate (scratchpad `gate078.log`): typecheck, build (`main.js` sha256
  `3b558d21a5e6…`), lint green; `npm test` 1918 passed, 74 failed, 1 todo;
  integration 412 passed, 50 failed, 1 skipped. US-026 unit 17 of 22 green:
  AC-1, AC-2, AC-8; the 5 red are AC-9 (TICKET-079) and AC-11 (TICKET-081).
  Every other red test is of TICKET-079 to 081 or US-027, US-028.
- Found while coding and decided by the user: a link to an empty part that is
  left out pointed at a label that no longer existed (Typst error `label
  <h-colophon> does not exist`). Decided: such a link is unresolved (text,
  `LINK_UNRESOLVED`). AC-8 amended; a test added; the compile checked
  (no diagnostics).
- Guard missed at G3 (SCAR-023, reported): `tests/unit/us-015-warning-registry.test.ts`
  (every code in `src/core` has a row) — the two rows added. TICKET-066 had
  listed this guard; the TICKET-078 search did not.
- Also found by this gate: `tests/integration/build-output.test.ts` had been
  red since the M15 build (TICKET-077): a test build `x.y.z-…` needs
  `versions.json` to map `x.y.z`; `"0.10.0": "1.5.0"` added (see TICKET-077).
- Changed default output (for the release notes): a note with a top-level
  heading `Colophon` or `Back notes` now has it moved and hidden; migration
  `Colophon: none` / `Back notes: none` in the preset.
- Mutants (scratchpad `mut078/run.py`; US-026, US-017, US-004, US-022 unit and
  US-021 plugin tests; baseline 179 passed with the 5 known red): 11, all
  caught (more failures than the baseline) — a hidden heading written, the
  marker without its label, no joined warning, an empty printed part dropped,
  the mapping without `Back notes`, the message without `back-notes`, links to
  a dropped part kept, the back notes before the body, the colophon after the
  body, a heading inside a part opening a rule, a part ending only at a
  higher heading. Restores checked (6 files OK).
