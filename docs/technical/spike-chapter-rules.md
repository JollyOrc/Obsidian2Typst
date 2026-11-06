# Spike: which heading is the entries chapter (epic #121, G0-C2)

**Date:** 2026-11-06. **Code:** `spikes/chapter-rules/compare.mjs`
(git-ignored), synthetic outlines with invented names.

## Question

The entry layout (section openers, left-page starts, pairing, the quick
reference after the last entry) works per chapter. Which rule names that
chapter? Three candidates from the G0 review:

- **R1 heading rule:** a heading whose text matches a preset key; its section
  runs to the next heading of the same or a higher level.
- **R2 block-holding chapter:** every level-1 heading whose section holds at
  least one `o2t-entry` block.
- **R3 common ancestor:** the nearest heading above all entry headings.

## A real book (measured, private, not quoted)

The author's compiled book: one level-1 chapter holds all entry notes, at
level 3 under three level-2 sections; no entry note is headed in another
chapter, and the chapter's heading text appears once as a heading. On this
book all three rules pick the same chapter. They differ only in the cases
below.

## Synthetic cases (measured with the script)

| Case | R1 heading rule | R2 block-holding chapter | R3 common ancestor |
|---|---|---|---|
| A one chapter (as the real book) | the chapter | the chapter | the chapter |
| B an entry note also embedded whole in another chapter (an example dungeon's inhabitants) | the chapter; 1 entry outside | **both chapters**: the dungeon gets section openers and blank pages | **the whole book** |
| C chapter heading renamed or translated | none; all entries outside | the chapter | a **section** |
| D the key text also used by a lower heading elsewhere | the chapter and a `###` without entries | the chapter | a **section** |
| E entries at mixed depths | the chapter | the chapter | the chapter |
| F no level-1 headings (one note exported) | none; all entries outside | none; all entries outside | **the whole book** |
| G two catalogue chapters | the named one; the other's entries outside (both if both are named) | both | **the whole book** |
| H all entries in one section | the chapter | the chapter | a **section** |

## Findings

1. **R3 is unsafe:** one stray entry makes the whole book the entries
   chapter (B, F, G), and a book whose entries sit in one section gets that
   section as its chapter (C, D, H).
2. **R2 turns any chapter into an entries chapter as soon as it embeds one
   entry note whole** (B), which the Vault Compiler does for every whole-note
   embed (its BL-B1). An example adventure listing a creature would get the
   chapter layout.
3. **R1 only fails visibly:** a renamed heading (C) or stray entries (B, F)
   leave entries outside any chapter, which can be warned about. A matching
   heading without entries (D) can be ignored. Several keys name several
   chapters (G).
4. **The matching already exists:** US-017's preset field `headingRules`
   maps heading texts to rules, with its matching specified for every form
   (case, markup, blanks, levels 1 to 5; AC-2). An `entries` rule there
   (`Menagerie: entries`) gives R1 with no second matching code (SCAR-017),
   and translations or several catalogues are more keys.

## Consequence

- **G0-C2 holds: R1.** Decided 2026-11-06: the rule name `entries` in
  `headingRules` instead of a separate `entries.chapterHeading`. No built-in
  key (G0-C1). The two points below are proposals for G1.
- A matched heading whose section holds no entry is ignored.
- An entry outside every entries chapter is still drawn as an entry (heading,
  statblock, body) but without the chapter layout (no opener, pairing or
  left-page start), with a warning `ENTRY_OUTSIDE_CHAPTER "<heading>"`. To be
  decided at G1.
- One heading text maps to one rule, so a heading can't be both a glossary
  and an entries chapter (US-017 AC-1 already reports the duplicate key).
