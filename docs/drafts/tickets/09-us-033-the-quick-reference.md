<!-- Filed 2026-11-06 as #130 on the user's go (epic #121, ticket 9 of 16). -->

### User story

[US-033](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-033-entry-openers-navigation-quick-reference.md), ACs addressed AC-9, AC-10, AC-11, AC-12

### Description

After each entries chapter's last entry, when switched on, a table of every entry in the note's order — entry, section, the box value, the stats, the track in short form and the first page — starting on a left page under a heading in the contents.

### Acceptance criteria (from the user story)

Examples use US-031's preset and outline (`headingRules: {Menagerie:
entries}`, A5, facing pages, folios and running header on with
`page.runningHeaderLevel: 2`), with each section having an intro paragraph.

- **AC-9 (the table, D35):** With `entries.quickReference: true`, a table
  follows each entries chapter's last entry, starting on a new left page
  under a heading `entries.quickReferenceTitle` (built-in `Quick Reference`)
  at the chapter's section level; the heading is in the contents. Columns:
  Entry, Section, the `entries.statblock.boxes` key's label (when set), one
  column per `entries.statblock.stats` label, Track (when `track` is set),
  Page. One row per entry of the chapter (nested entries excluded), in the
  order the entries stand in the note (decision 2, revised 2026-11-06: the
  compiled note already lists them in the author's order; no further
  sorting). A missing value is `—`. Page is the entry's first page (as AC-8).

- **AC-10 (the Track column):** Compared with `trackDefault` (US-030 AC-13):

  | Entry's cells | Track |
  |---|---|
  | the default | empty |
  | the default plus Fading | `+ Fading` |
  | the default without Down | `− Down` |
  | `states: none` | `none` |
  | any other set (Fine, Gone) | `Fine, Gone` |

  The column tells a reader how to use the blank cells of the encounter sheet
  (US-036).

- **AC-11 (layout and repeats):** The table may break across pages; its
  header row repeats on each page. An entry heading that appears twice in the
  chapter (a repeat the writer missed) has one row, for its first
  occurrence. Example with the outline above: 5 rows — Fen Hare, Marsh Owl,
  Cave Wyrm, Reed Cat, Bog Wight (the note's order); columns Entry, Section, vigour (the key, no stats label; US-030 AC-12), Might, Wits,
  Speed, Track, Page.

- **AC-12 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view): `entries.quickReference` (switch, built-in `false`) and
  `entries.quickReferenceTitle` (text, built-in `Quick Reference`; empty →
  no heading, then the table is not in the contents).

## Decisions (answered by the user, 2026-11-06)

1. **An entries chapter that is not an H1:** the same opener and header rules
   whatever its level (AC-2, AC-7).
2. **Quick reference order (revised 2026-11-06 at G2):** the order of the
   note, with no further sorting (AC-9). The first answer ("the language's
   order, from the preset's `lang`") rested on a setting that does not
   exist: Obsidian2Typst has no document language.
3. **The contents with an entries chapter:** the measured output of AC-6 is
   accepted.

### Implementation notes

- Settings: `entries.quickReference` (switch, built-in `false`), `entries.quickReferenceTitle` (text, built-in `Quick Reference`; empty → no heading, not in the contents), with their messages.
- Rows in the note's order (decision 2, revised): one per entry of the chapter, nested entries excluded, a repeated heading once (its first occurrence); missing values `—`.
- Track column: empty for the default, `+ <cells>`, `− <cells>`, `none`, or the list.
- The table may break across pages with its header row repeated (`table.header(repeat: true)`); page numbers through US-018's page-reference helper.

### Tests

- `tests/integration/us-033-openers-pdf.test.ts`: the tests of AC-9 to AC-12
- `tests/unit/us-033-openers.test.ts`: the AC-12 settings test

### SCAR check

- SCAR-021: the table's page numbers depend on the layout (as US-018's references); placed after the last entry, so the entries' pages do not depend on the table.
- SCAR-007: the rows, columns and Track texts as the story's tables.
- SCAR-019: on and off; with and without `boxes` and `track`; one and two chapters.
- SCAR-024: no sort, so no collation dependency (decision 2 revised: the earlier claim of a `lang` setting was wrong and is withdrawn).
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
