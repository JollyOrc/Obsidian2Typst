# TICKET-053 — The `page-ref` call after internal links and the preamble rule `page-refs`

**Status:** Done (2026-10-21)
**User story:** [US-018](../user-stories/US-018-page-numbers-for-internal-links.md)
**ACs addressed:** AC-2 to AC-7, AC-9
**Depends on:** TICKET-052 (the fields in `ConvertSettings`)
**SCARs:** SCAR-001, SCAR-002, SCAR-008, SCAR-009, SCAR-010, SCAR-015, SCAR-017, SCAR-018, SCAR-019

---

## Description

Write `#page-ref(<label>)` after every resolved internal link that the rule
of AC-2 selects (after the marks that end right after the link), and the
preamble rule `page-refs` (order 47) with the measured helper, only when the
body holds a call; add `page-ref` to `PLUGIN_NAMES`.

---

## Acceptance criteria (from user story)

- **AC-2:** a resolved internal link gets the number when (1)
  `linkPageNumbers` and `page.folios` are true, (2) it is not inside a
  heading, a glossary term's heading included, (3) its target is a heading of
  level at most `linkPageLevel` (a term counts with its heading level) or the
  link is inside a glossary term's explanation. Same-page targets are
  numbered. Unresolved links never.
- **AC-3:** `#link(<l>)[text]#page-ref(<l>)`, the call separator behind the
  call; rule `page-refs`, order 47, only with a call in the body:
  `#let page-ref(target) = context [ (p.~#numbering("1", ..counter(page).at(target)))]`
  with the word through `escapeMarkup`; `page-ref` in `PLUGIN_NAMES`.
- **AC-4:** the number is the folio of the target page.
- **AC-5:** the composed cases and the mark cases of the story, exactly.
- **AC-6:** switch off or folios off: byte-identical to a convert without the
  fields; deterministic.
- **AC-7, AC-9:** content in the PDF; the fixture (33 at the built-in values;
  22, 59, 139 at levels 1, 3, 6).

---

## Implementation notes

- New `src/core/emit/page-refs.ts` (pure): `pageRefHelper(escapedWord)` and
  `pageRefCall(label)`; the only file in `src` that writes `#let page-ref` or
  `#page-ref(` (text check; the unit test compares the helper with
  `tests/support/page-refs.ts`). Re-exported from `src/core/emit/index.ts`.
- `src/core/emit/inline.ts`:
  - `InlineOptions` gains `pageRefs?: {level: number; inExplanation: boolean}`
    (absent: no calls). `internalLink` sets `ref: label` on the link item when
    `where !== 'heading'` and (`depth <= level` or `inExplanation`), using
    the `depth` of the `HeadingInfo` it already resolves.
  - Step 1 (prepare): a link item with `ref` is followed by a raw item
    `{t: 'raw', value: pageRefCall(label), call: true, trailingRef: true}`.
    A mark whose prepared items end with such a raw item gives it up: the
    mark keeps its items without it and the raw item follows the mark. Nested
    marks repeat this, so the call ends after every mark that ends with the
    link (`_*#link…*_#page-ref(…)`); a mark that goes on keeps the call inside.
  - Step 2 needs no change: the raw item is a call, so `callSeparator` writes
    `;` before `.`, `(`, `[`, `;` (measured join table, story Notes). A mark
    followed by the call sees `#` as its next character, which is not a word
    character, so `wrapEmphasis` keeps the delimiter form (measured).
- `src/core/markers/glossary.ts`, `GlossaryPlan`: a new
  `explanations: ReadonlySet<BlockNode>` — the top-level blocks from a term
  heading to the next heading of the same or a higher level (the run-in
  paragraph and blocks under a deeper heading included). `EMPTY_GLOSSARY_PLAN`
  gets an empty set. `src/core/emit/blocks.ts` passes `inExplanation: true`
  for those blocks and everything inside them (callouts, lists, tables), and
  for the text of a footnote called from them (decided 2026-10-21; a footnote
  called from the body keeps the normal rule).
- `src/core/convert/index.ts`: `pageRefs` only when `linkPageNumbers === true`
  and `pageFurniture?.folios === true`; a recorder (like the callout
  recorder) tells whether a call was written; the rule reads it.
- `src/core/convert/preamble.ts`: rule `{id: 'page-refs', order: 47}`, the
  word through `escapeMarkup(word, {atBlockStart: false})` (the word follows
  ` (` inside a content block, not at its start; 17 words measured).
- `src/core/template/plugin-names.ts`: `page-ref`.
- Register (`docs/user-stories/README.md`): a row for `emit/page-refs.ts`;
  the link emitter row gains the call transform; the `escapeMarkup` row gains
  the call site; the glossary plan row gains `explanations`; the template
  scan row names US-018.
- `docs/technical/warning-codes.md`: no new code expected.
- Existing tests expected to change, each reported: plugin tests that convert
  a note with internal links through `effectiveSettings` (built-in folios and
  numbers are on there); grep at start: `#link(<h-` in `tests/plugin` (none
  found at G3) and every `effectiveSettings(` test with a link in its note.

---

## Tests

- `tests/unit/us-018-page-refs.test.ts`: all `US-018 AC-2`, `AC-3`, `AC-5`,
  `AC-6`, `AC-9` tests and the two SCAR-017 tests.
- `tests/unit/us-015-conversion-pipeline.test.ts` (registry list),
  `tests/unit/us-016-callouts-convert.test.ts` (PLUGIN_NAMES).
- `tests/integration/us-018-page-refs-pdf.test.ts`: all tests (the 14 helper
  and join tests are green already and must stay green).
- Mutation checks (SCAR-018, SCAR-010): order 46; the folio condition
  dropped; `where === 'heading'` not checked; term headings numbered; `<=`
  → `<`; the explanation flag ignored; the explanation ending one heading
  level too late; the call kept inside a mark that ends with the link; the
  call moved out of a mark that goes on; the separator not written after the
  call; the word not escaped; the rule written without a call.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) new call sites: `escapeMarkup` (the word; its transform
  list read: markup characters escaped, block-start rules off with
  `atBlockStart: false` — all fit, measured with 17 words), `callSeparator`
  (after the call; its four characters fit, measured), the link emitter (one
  new transform, listed in its doc comment and the register), the glossary
  plan (one new field); (2) each list read before use, recorded here; (3) no
  flag that fits one use only: `pageRefs` absent means today's output;
  (4) edge inputs at the new call sites: `p*`, `p]`, `@p` words; a
  hyphenated, number-stripped anchor (`#1.5-raising-a-banner`).
- **SCAR-002** (1) composed cases: glossary explanation, footnote, callout,
  table cell, heading in a callout, heading and term heading, eight mark
  cases, a term link inside another term; (2) exact Typst for each;
  (3) "two levels deep": nested marks, a link in a callout in a glossary
  explanation, and a footnote called from an explanation (tests added at G3); (4) every story example ran through today's whole
  converter (G1, G2).
- **SCAR-003** (1) all tests exist and are red; (2) the AC list is gone
  through again before Done; (3) AC → test table in the result.
- **SCAR-006** (1) full gate before Done; (2) no skip; (3) counts in the
  result; (4) TICKET-054's red tests tracked in the map.
- **SCAR-007** (1) exact Typst and counts in the story; (2) nested marks and
  callout-in-glossary are two-level examples; (3) yes.
- **SCAR-008** (1) Typst functions used (`context`, `counter(page).at`,
  `numbering`) were measured, not inferred; (2) a missing number is our bug
  until proven (the composed export reads every number back); (3) the PDF is
  read by program (folios, text, headers, widths); (4) n/a (no canvas);
  (5) n/a (no remote harness).
- **SCAR-009** (1) the call is tested at the start of a cell, in the middle
  of a sentence, at the end of a paragraph, before a line break, before a
  footnote call; (2) the fixture guard checks every call against the real
  output; (3) the probe contexts are in the story Notes; not tried: a link
  inside a raw/code span (it is not a link there) and inside an image alt
  text (dropped); (4) the word moves into a content block after ` (`; its
  options were re-checked (`atBlockStart: false`, measured).
- **SCAR-010** (1) the call's hazards are listed in the story Notes (what may
  follow: `.`, `(`, `[`, `;`; what precedes: `]` of a link or mark, `*`, `_`);
  (2) guard test: `(` without `;` fails (green); (3) piece × neighbour in the
  PDF and over the fixture with labels taken from the source links;
  (4) mutation check "separator not written after the call" and "call inside
  the mark"; (5) the join table gains the row `page-ref call` in this change
  (story Notes).
- **SCAR-011** (1–5) n/a: the call uses the labels of US-002 and US-017.
- **SCAR-012** (1–5) n/a here (TICKET-054).
- **SCAR-013, SCAR-014** n/a: no control in this ticket.
- **SCAR-015** (1) AC-7 names the content (numbers equal folios; none in
  headings and headers; the word); (2) green guard with the switch off;
  (3–4) the manual part is TICKET-054; (5) headers checked for `(p.`.
- **SCAR-016** n/a here (preview in TICKET-054).
- **SCAR-017** (1) grep before coding: every writer of `#link(` in `src`
  (`emit/inline.ts`: the internal link and the web address; nothing else at
  G3), every reader of `GlossaryPlan` (`emit/blocks.ts`, `convert/index.ts`),
  every `PLUGIN_NAMES` user; hits and decisions in the result; (2) the class is
  "every resolved internal link", stated in AC-2 with every container;
  (3) one writer (`emit/page-refs.ts`) with a text check over `src`;
  (4) n/a (no defect).
- **SCAR-018** (1) path-mirrored backups of every file the mutants touch with
  a checksum list; (2) `shasum -a 256 -c` after every restore, stop on
  failure; (3) each mutant asserts one match; (4) arrays; (5) baseline in the
  same run; (6) caught only on a verified tree.
- **SCAR-019** (1) the level at 1, 2, 3, 6 and the switch off (AC-2, AC-9);
  the word at `p.`, `S.` and escaped words; (2) asked with all levels (G1);
  (3) the composed export runs at levels 1 and 3 and with `S.` (added at G3);
  (4) the dry run is TICKET-054.

---

## Definition of done

- [x] Tests named above green; the 14 helper and join tests still green
- [x] Register rows written; join table row in the story Notes
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-21)

Changed: new `src/core/emit/page-refs.ts` (`pageRefHelper`, `pageRefCall`,
`PageRefEnv`), re-exported from `src/core/emit/index.ts`;
`src/core/emit/inline.ts` (option `pageRefs`; `withPageRef` after a resolved
internal link; `clean` moves a trailing call behind every mark that ends with
it; footnote calls pass the explanation flag; inline notes pass `pageRefs`);
`src/core/emit/blocks.ts` (`BlockEnv.pageRefs`, `inExplanation`; top-level
blocks in `explanations` and the run-in paragraph set it; footnote bodies get
the flag of the call); `src/core/emit/footnote.ts` (`reference(…,
inExplanation)`, one body per variant, the second rendered with a throwaway
`EmitContext`); `src/core/markers/glossary.ts` (`GlossaryPlan.explanations`);
`src/core/convert/index.ts` (`pageRefs` only with the switch and folios on, a
call counter, the helper with the word through `escapeMarkup(…, {atBlockStart:
false})`); `src/core/convert/preamble.ts` (rule `page-refs`, order 47);
`src/core/template/plugin-names.ts` (`page-ref`). Register rows (new "Page
references"; escapeMarkup, callSeparator, link emitter, footnote notes,
glossary plan, template scan extended); join-table row in the story Notes.

- Gate (scratchpad `gate053.log`): typecheck, build (`main.js` sha256
  `14514faaf884…`), lint green; `npm test` 1634 passed, 1 todo; integration
  370 passed, 1 skipped. No red test left; the two US-018 preview tests of
  TICKET-054 are green too (no preview code needed, as expected).
- AC → tests: AC-2 to AC-6, AC-9 — every `US-018 AC-2`, `AC-3`, `AC-5`,
  `AC-6`, `AC-9` unit test and the two SCAR-017 tests; AC-4, AC-7 — the PDF
  tests (each number equals the target page folio after a cover; none in a
  heading or a header; `S.`; levels 1 and 3; guard); AC-9 — 33 numbers in the
  fixture PDF.
- Existing tests changed: none. The registry list (US-015) and PLUGIN_NAMES
  (US-016), extended at G2, are green now.
- Tests changed or added while coding: the fixture guard's regex `(.)` did not
  match a newline, so 15 calls at a line end were not checked (124 of 139);
  now `([\s\S]?)`, 139 checked. Added: a footnote called from both the body
  and an explanation (both forms written, `LINK_UNRESOLVED` once — US-005's
  once-per-export rule); the glossary intro before the first term is not an
  explanation (added after the mutant survived). The last untyped read is
  now the typed import of `pageRefHelper`.
- Decision made while coding, within the decided rule: a footnote called
  from both places is written in two variants; the second variant's warnings
  are dropped so each is reported once (documented in `footnote.ts` and the
  register).
- Mutants (scratchpad `mut053/run.py`; US-018 unit, plugin and PDF tests,
  US-004, US-005, US-015, US-017 unit tests; baseline 0 failed, 311 passed):
  14, all caught on the second run (the first run: 13 of 14, "glossary intro
  counted as explanation" survived, test added, all 14 run again): order 46;
  folio condition dropped; heading not checked; `<=` → `<`; explanation flag
  ignored; glossary intro counted; run-in paragraph not flagged; call kept
  inside the mark; call moved out of a mark that goes on; no separator after
  the call; word not escaped; rule without a call; footnote variant not
  passed; second variant reports again. Backups by full path, `shasum -a 256
  -c` after every restore and at the end: all 7 files OK, both runs.
- SCAR-017 greps: writers of `#let page-ref` / `#page-ref(` Typst — only
  `emit/page-refs.ts` (two doc comments in `inline.ts` and `blocks.ts` name
  the call); `#link(` written only in `emit/inline.ts` (internal link, web
  address); `GlossaryPlan` read by `markers`, `emit/blocks.ts`,
  `convert/index.ts` (all handled); `PLUGIN_NAMES` used by `template`
  (warnings) only; `Notes.reference` called once (`inline.ts`, updated).
- `The Rules/`: no file written; one file there has a modification time in the
  future (`Rules Ideas/Textmapper Test.md`, 2027-08-26), not from this work.
