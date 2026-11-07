<!-- Filed 2026-11-06 as #126 on the user's go (epic #121, ticket 5 of 16). -->

### User story

[US-031](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-031-entry-layouts-on-facing-pages.md), ACs addressed AC-1, AC-2, AC-3, AC-13

### Description

Recognise the entries chapter through the `headingRules` rule `entries`, report entries outside it and nested entries with a layout, read and check the `layout` value, and keep body images inside entries out of US-028's fit-flow.

### Acceptance criteria (from the user story)

The examples use a preset with `headingRules: {Menagerie: entries}`,
`page.facingPages: true` (US-009), folios on (US-019), and this outline
(entries are headings with an `o2t-entry` block, US-030; the layout in
brackets):

```
# Menagerie
## Beasts

- **AC-1 (the entries chapter):** US-017's `headingRules` gains the rule name
  `entries` next to `glossary` (US-017), `colophon` and `back-notes`
  (US-026). The message of an invalid value becomes `headingRules.<text>
  must be a rule name: glossary, colophon, back-notes, entries or none`
  (today `… glossary, colophon, back-notes or none`, in
  `src/core/presets/parse.ts` and asserted by four tests in
  `us-017-heading-rules.test.ts` and one in `us-026-book-parts.test.ts`;
  SCAR-027). A heading whose plain text matches a key with
  the rule `entries` (matched as US-017 AC-2) starts an entries chapter that
  runs to the next heading of the same or a higher level. There is no
  built-in key (G0-C1). Inside it:
  - a heading with an `o2t-entry` block is an **entry**; an entry inside
    another entry (a deeper heading with its own block, US-030 AC-20) is a
    **nested entry**: it gets its statblock inline in the parent's text and
    no page or spread of its own; its illustration is not placed, and a
    `layout` other than `auto` gives `ENTRY_NESTED_LAYOUT "<heading>":
    <value>` (decision 3);
  - any other heading that holds entries is a **section** (`## Beasts`);
  - pairing (AC-8) never crosses a section heading.

  A matched heading whose chapter holds no entry is ignored (no warning).
  Several keys give several entries chapters
  (`{Menagerie: entries, Relics: entries}`).

- **AC-2 (entries outside the chapter):** An entry outside every entries
  chapter keeps its heading, statblock and body (US-030) and gets none of
  this story's layout: no page or spread, no left-page start, no pairing, its
  illustration not placed (it stays out of the text). Warning:
  `ENTRY_OUTSIDE_CHAPTER "<heading>"` with its line. Example: `### Fen Hare`
  also embedded under `# Example Crypt` → laid out there as text with its
  statblock, `ENTRY_OUTSIDE_CHAPTER "Fen Hare"`.

- **AC-3 (values):** The block's key `layout` takes one of the seven layouts
  or `auto`; missing means `auto` (decision 1). `auto` and every replaced value are
  decided by US-032; until US-032, `auto` is `page-text` when the entry fits
  one page (`measure()`, AC-14) and `spread-text` otherwise. Any other value
  gives `ENTRY_LAYOUT_UNKNOWN "<heading>: <value>"` and is treated as `auto`.
  Example: `layout: sideways` → `ENTRY_LAYOUT_UNKNOWN "Fen Hare: sideways"`.

- **AC-13 (images in the body):** Images in an entry's body (not the
  illustration) are drawn as US-003 draws them, without US-028's shrink,
  float or move (G0-C5).

## Decisions (answered by the user, 2026-11-06)

1. **`auto` before US-032:** the simple rule of AC-3 (`page-text` when the
   entry fits one page, `spread-text` otherwise); US-032 replaces it.
2. **Caption in the portrait column:** under the image, as in every slot
   (AC-7).
3. **Nested entries:** inline, no page or spread of their own; an explicit
   layout gives `ENTRY_NESTED_LAYOUT` (AC-1).

### Implementation notes

- `src/core/presets/parse.ts`: the rule name `entries` beside `glossary`, `colophon`, `back-notes`; the message `headingRules.<text> must be a rule name: glossary, colophon, back-notes, entries or none`. The tests that assert today's message (four in `tests/unit/us-017-heading-rules.test.ts`, one in `tests/unit/us-026-book-parts.test.ts`) and US-017's own story text are updated with it (SCAR-027).
- `src/core/markers/entries.ts` (from #123): the chapter is a heading matched by a key with the rule `entries` (US-017 AC-2's matching), its section runs to the next heading of the same or a higher level; a matched heading without entries is ignored; sections are the non-entry headings inside it that hold entries; a nested entry (an entry inside an entry) is inline.
- Warnings: `ENTRY_OUTSIDE_CHAPTER` (with its line), `ENTRY_NESTED_LAYOUT`, `ENTRY_LAYOUT_UNKNOWN`; rows in `warning-codes.md`.
- `ENTRY_LAYOUT_CONFLICT` needs the compile's measurement: its facts are written with the placement (#127) and reported by the report module (#128).
- Images in an entry body: written without `fit-flow` even when `images.minScale` is below 100 (G0-C5).

### Tests

- `tests/unit/us-031-layouts.test.ts` (all)
- Updated with this ticket: the message tests of `tests/unit/us-017-heading-rules.test.ts` and `tests/unit/us-026-book-parts.test.ts`.

### SCAR check

- SCAR-027: the users of the old `headingRules` message (code, five tests, US-017's text) are listed and changed together.
- SCAR-017: one matching function for every heading rule (US-017's `headingRuleKey`).
- SCAR-002, SCAR-007: composed cases (a matched heading without entries, entries in two chapters, nested entries) are tests.
- SCAR-039: the chapter marker is read by the entry reader only; the glossary marker and the book parts (US-026) keep their own headings (one heading text, one rule).
- Not applicable: UI SCARs, 021, 022.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
