# TICKET-086 — The editor menu items that place the contents (plugin)

**Status:** Done (2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-7
**Depends on:** TICKET-083 (the fields)
**SCARs:** SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-022, SCAR-023

---

## Description

On the line of a top-level H1 of the body the editor menu offers `Table of
contents before this heading` and `… after this heading` (or `Remove table
of contents placement` where the preset already places them there). Each
asks first and writes `toc.heading` and `toc.position` (and `toc.depth: 2`
while the contents are off) in one atomic change of the preset note, through
US-022's machinery.

---

## Acceptance criteria (from user story)

- **AC-7 (the editor menu items; SCAR-013, SCAR-014, SCAR-016):** On the line
  of a top-level H1 of the body (not a glossary term, not inside a callout,
  not a colophon or back-notes heading; US-022 AC-1's line rules) the editor
  menu offers `Table of contents before this heading` and `Table of contents
  after this heading`; where the preset already places the contents at that
  heading and side, that item reads `Remove table of contents placement`
  (back to the default place). Each asks first, as US-022 AC-5 (`Change
  preset "Folios"`, `Change preset` / `Cancel`, `Cancel` focused), e.g.
  `Place the table of contents of preset "Folios" before "Rules"?`, and
  writes `toc.heading` and `toc.position` in one atomic change of the preset
  note (US-022 AC-7). No preset or an invalid one: disabled with the reason
  (US-022 AC-6). With `toc.depth` 0 or unset the item is offered and its
  question also sets `toc.depth: 2` in the same change (decision 3):
  `Place the table of contents of preset "Folios" before "Rules" and show
  headings down to level 2?`. The menu reads the line and the preset when it
  opens; the action reads the preset again at `Change preset` (US-022 AC-9).

---

## Implementation notes

- `src/core/convert/line-context.ts`: `heading` gains `level` (the
  heading's depth) and a role from the rule table, so the menu can tell a
  colophon or back-notes heading (`findGlossary`'s parts; SCAR-017: the one
  decider of sections). Headings in callouts stay `null` (US-022 AC-1).
- `src/core/presets/note-edit.ts`: `PresetChange` gains `{kind: 'toc',
  heading: string | null, position: 'before' | 'after' | null, depth?: 2}`;
  `editPresetField` writes or removes the keys under `toc:` in one edit,
  keeping every other byte (the two unit tests in the plugin file), and adds
  a `toc:` group when there is none.
- `src/plugin/menus.ts`, `presetEditEntries`: after the glossary item, for a
  level-1 heading of the body that is no part heading: the two items, the
  Remove title where `toc.heading` (compared as heading rules compare) and
  `toc.position` match, the questions of the tests; disabled reasons through
  `presetEntry` (US-022 AC-6). `changePreset` (US-022) asks, re-reads the
  active preset at `Change preset` and writes — no new dialog.
- Callback data (SCAR-022): the menu is synchronous; it uses the note text,
  the cursor line and the store's active preset fields, all in memory.

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-022-menus-write.test.ts` lines 93, 116, 125, 482 give
  `presetEditEntries` a line context `{heading: {text}}` without `level`,
  which the real `lineContext` now always gives, and pin the whole entry
  list. Narrowed with the reason: the fake contexts get `level: 2` (a level
  that offers no contents item), every assertion kept; the local type at
  line 39 gains `level`.
- `tests/unit/us-022-preset-edits.test.ts` lines 335 to 369 pin
  `lineContext(…).heading` with `toEqual({text: …})`: they gain the `level`
  of each heading (the field is new, the text unchanged); the local type at
  line 38 gains `level`. `headingRuleAction` tests (the entry texts): no
  context, unaffected.
- US-022 tests of `editPresetField` for `heading-rule` and `cover`: the
  change union grows; no test pins the union.

---

## Tests

- `tests/plugin/us-027-contents-menu.test.ts` › AC-7 (9).
- The US-022 tests above, narrowed as listed, green.
- Mutation checks: items on an H2; items on the colophon heading; Remove on
  the wrong side; depth 2 not written while off; a second edit instead of
  one; the question without the heading text.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) `headingRuleTable`'s comparison gets a call site (the
  Remove match); fits (the same comparison as AC-5).
- **SCAR-002** (1–6) the items checked on a callout H1, a colophon H1, an H2,
  the glossary H1 (offered: it is a body H1), a heading after an open
  glossary section (none, US-022 line rules).
- **SCAR-003** (1–3) red tests exist; map row.
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) exact titles and questions in the tests.
- **SCAR-008** n/a (no third-party API beyond US-022's).
- **SCAR-009** (1–4) the YAML write at the end of `toc:`, as the only key,
  in a note without `toc:` (tests).
- **SCAR-010** n/a.
- **SCAR-011** n/a.
- **SCAR-012** n/a here (TICKET-088).
- **SCAR-013** (1–6) no new dialog: US-022's question (Enter, Escape, IME)
  is reused; M17 runs one item with the keyboard only.
- **SCAR-014** (1–6) `Cancel` focused; refusals (no preset, invalid) before
  the question; worst misplaced click: the item on the wrong H1 — the
  question names heading and side.
- **SCAR-015** n/a (no output).
- **SCAR-016** (1–8) draw, change, use: the preset changed after the menu
  opened → US-022 AC-9 refuses; the preview after the write (TICKET-087);
  M17 on an open tab.
- **SCAR-017** (1–8) one change writer (`editPresetField`); one menu builder;
  grep for `heading-rule` to find every switch over the change kind (note
  edit, actions, notice) and each one handles `toc`.
- **SCAR-018** (1–10) mutation run with backups and checksums.
- **SCAR-019** (1–5) depth unset, 0, and 2 or more; both sides; Remove for a
  placed side, the other side offered.
- **SCAR-020** n/a.
- **SCAR-021** n/a.
- **SCAR-022** (1–4) listed above: everything the menu needs is in memory.
- **SCAR-023** (1–10) guards above, narrowed with reasons.
- **SCAR-024** n/a.
- **SCAR-025** n/a.
- **SCAR-026** n/a.
- **SCAR-027** n/a.
- **SCAR-028** n/a (no reader).
- **SCAR-029** n/a here (M17 is a file of its own, TICKET-088).

---

## Definition of done

- [x] Tests named above green; US-022 tests green
- [x] Mutation checks run; full gate counts in the result
- [x] Map row AC-7 names this ticket; index row `Done`

---

## Result (2026-10-29)

Changed: `src/core/convert/line-context.ts` (`heading` gains `level`);
`src/core/presets/note-edit.ts` (change kind `toc` in `editPresetField`:
`heading`, `position`, `depth` set in that order, or both removed and an
empty `toc` group removed; new `contentsAction`: the title, change and
question of an item, Remove where the preset's place matches by
`headingRuleKey` and side, a missing position read as `before` (decision
6)); `src/core/presets/index.ts` (export); `src/plugin/menus.ts`
(`presetEditEntries`: the two items after the glossary item on a top-level
H1 whose rule (preset and built-in table) is not `colophon` or
`back-notes`, icon `list-ordered`, disabled reasons through `presetEntry`;
`ActivePresetView.defaults` and `activePresetView(…, defaults)`);
`src/plugin/main.ts` (passes the Defaults). The question, the re-read at
`Change preset` and the write are US-022's `changePreset` (no new dialog;
the only other switch over the change kind, the cover's byte check in
`actions.ts`, does not apply to `toc`).

- Reading of decision 3 (stated here, not asked): "the contents are off"
  is the effective depth (the preset's, else the Defaults', else 0); with
  Defaults at depth 3 and a silent preset the item writes no depth. Test
  added (SCAR-019).
- Tests: `tests/plugin/us-027-contents-menu.test.ts` AC-7 13/13 (three
  added: the effective depth, decision 6 with a lower-case heading, Remove
  of a group that holds only the place); the US-022 tests narrowed as
  listed (the four fake contexts and the two local types gain `level: 2`;
  the `lineContext` assertions gain each heading's level) and green.
- SCAR-023 gap → closed: the guard search had not listed `US-022 AC-6,
  SCAR-019: the menus' active preset is pickActive …`, which pins the whole
  view object; the view carries `defaults` only when the caller passes
  them, so that test's input gives the object as before.
- Mutants (scratchpad `mut086/run.py`; the US-027 menu and both US-022
  files): 11, all caught on the second run; the first run's survivor (an
  empty `toc` group kept) had no input that reached it, test added.
  Restores checked with `shasum -a 256 -c` (3 files OK).
- Gate (scratchpad `gate086.log`): typecheck, build (`main.js` sha256
  `3185f17969ae…`), lint green; `npm test` 1979 passed, 31 failed, 1 todo;
  integration 445 passed, 23 failed, 1 skipped. Red: US-027 AC-8 (4,
  TICKET-087), US-028, and `US-007 AC-12: main.js contains the compiler
  WASM …` by its 5000 ms time limit (5018 ms under the parallel run; alone
  7/7 twice, about 9 s for the file). Not changed here; put to the user.
