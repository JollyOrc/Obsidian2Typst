# TICKET-062 — Changing one key of a preset note, and the smallest change

**Status:** Done (2026-10-21)
**User story:** [US-022](../user-stories/US-022-heading-and-image-menus.md)
**ACs addressed:** AC-2, AC-4, AC-5 (the texts), AC-7 (the text change)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-007, SCAR-008, SCAR-011, SCAR-018, SCAR-019

---

## Description

Pure functions in `src/core/presets`: change one key of a preset note's text
with the `yaml` Document API (as measured), and plan the item, the change and
the question for a heading and for an image. Nothing is written here.

---

## Acceptance criteria (from user story)

- **AC-2:** the six cases of the smallest change (the built-in `Glossary`
  rule honoured); the key as the heading's visible text; a key of the same
  comparison form changed or removed in place; an empty `headingRules`
  removed; the measured note texts.
- **AC-4:** `Use as cover` → `mode: file` and `file`; `Stop` → `mode: auto`,
  `file` removed; the measured note texts.
- **AC-5:** the question texts with the verb rule (`Add … to`, `Set … in`,
  `Remove … from`) and the item titles (several images: the file name).
- **AC-7:** the body and everything outside the frontmatter byte for byte; a
  note that is not YAML or has no frontmatter is not changed (messages).

---

## Implementation notes

- New `src/core/presets/note-edit.ts`: `PresetChange`; `editPresetField(text,
  change)` — the existing `frontmatter` split (moved or shared from
  `parse.ts`, not copied, SCAR-017), `parseDocument`, the key found by
  `headingRuleKey` among the map's keys (in place), `setIn`/`deleteIn`, the
  emptied map removed, `String(doc)` without its last newline between the
  fences, the rest of the note kept; `headingRuleAction(fields, text, preset)`
  over `headingRuleTable` and `BUILTIN_HEADING_RULES`; `coverAction(fields,
  path, preset, several)`. Exported from `core/presets`.
- Register (`docs/user-stories/README.md`): a row "Preset note edits" (the
  yaml re-spacing accepted by the user, listed as transforms).

---

## Tests

- `tests/unit/us-022-preset-edits.test.ts`: the `AC-2`, `AC-4`, `AC-5`
  (cover and heading) and `AC-7` tests.
- Mutation checks (SCAR-018): the built-in rule ignored; `Set` and `Add`
  swapped; the in-place key doubled; the empty map kept; `Stop` cover
  leaving the file; `mode auto` counted as the cover; the body re-written;
  the missing-frontmatter message dropped.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) new call sites: `headingRuleKey`, `headingRuleTable`, the
  `frontmatter` split, the yaml Document API (writing, a new use); each
  transform list read (the re-spacing measured and accepted); (2) fits;
  (3) no flag; (4) edge inputs: `GLOSSAR`, a key with `: `, a comment on the
  changed line, a final comment.
- **SCAR-002** (1–3) composed: built-in rule with and without a preset key,
  `none` in the preset; (4) the note texts checked against the library
  (G2); (5) wrappers n/a.
- **SCAR-003** (1) tests red; (2) AC list again; (3) table in the result.
- **SCAR-006** (1–4) gate, no skip, counts, later tickets tracked.
- **SCAR-007** (1) exact note texts and questions; (2) the six-case table;
  (3) yes.
- **SCAR-008** (1) the yaml API read from its types and measured; (2–3) whole
  texts compared by program; (4–5) n/a; (6) the alternatives (byte-exact,
  re-spacing) were measured before the user chose; (7) n/a.
- **SCAR-009** (1) the changed key at the start, middle, end of the
  frontmatter, before a final comment; (2) checked against the library;
  (3–4) n/a.
- **SCAR-010** (1) the pieces: fences, the new YAML, the body; the join
  (newline before the closing fence) tested; (2–6) n/a beyond that.
- **SCAR-011** (1) invariant: one key per comparison form in `headingRules`
  after an edit; (2) the existing keys are looked up by form; (3) `GLOSSAR`
  tested; (4–5) n/a.
- **SCAR-012** n/a.
- **SCAR-013, SCAR-014** n/a here (the question is TICKET-064).
- **SCAR-015** n/a: no screen.
- **SCAR-016** n/a here.
- **SCAR-017** (1) grep before coding: `frontmatter(` and `parseDocument(` in
  `src` (one split, shared); (2–3) one writer function; (4–5) n/a;
  (6) inventory by grep (G0); (7) n/a.
- **SCAR-018** (1–6) path-mirrored backups of `note-edit.ts`, `parse.ts`,
  `index.ts`, checksums, checked restores, one match, arrays, baseline;
  (7) survivors read as unreachable inputs first.
- **SCAR-019** (1) rules at absent, none, glossary, with and without the
  built-in rule; cover at none, auto, file; (2) n/a; (3) yes; (4) M12.

---

## Definition of done

- [x] Tests named above green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register row

## Result (2026-10-21)

Changed: `src/core/presets/parse.ts` (new exported `frontmatterSpan(text)`:
the YAML between the fences with its offsets and the note's line end; the
private `frontmatter` now calls it, so the parser has one split, SCAR-017);
new `src/core/presets/note-edit.ts` (`PresetChange`, `PresetChangePlan`,
`editPresetField`, `headingRuleAction`, `coverAction`);
`src/core/presets/index.ts` (exports). Register row "Preset note edits".

- Gate (scratchpad `gate062.log`): typecheck, build (`main.js` sha256
  `3297e728f0f8…`), lint green; `npm test` 1721 passed, 18 failed, 1 todo;
  integration 370 passed, 1 skipped. All 18 red tests are TICKET-063's (4,
  the line context) and TICKET-064's (14, the plugin).
- AC → tests: AC-2 (three note-text tests, six smallest-change cases), AC-4
  (two note-text tests, four cover-item tests), AC-5 (the question texts in
  those tests), AC-7 (refusals; line ends and byte-order mark) — green. The
  parser's behaviour unchanged: every US-008 to US-021 test green before and
  after the shared split.
- Test added while coding (before the mutation run): a note with `\r\n` line
  ends and a byte-order mark keeps both and its body byte for byte (SCAR-009,
  SCAR-010: the join of the new YAML with the fences and the body).
- Mutants (scratchpad `mut062/run.py`; US-022 unit, US-008 unit, US-021 unit
  tests; baseline 4 failed, 104 passed): 10, all caught on the first run:
  built-in rule ignored; `Add` and `Set` swapped; the in-place key doubled;
  the empty map kept; `Stop` cover leaving the file; `mode: auto` counted as
  the cover; the body re-written; line ends not kept; the no-frontmatter
  message dropped; the offset after a byte-order mark lost. Backups by full
  path, `shasum -a 256 -c` after every restore and at the end: both files OK.
- SCAR-017 greps: `frontmatter(` and `parseDocument(` — `parse.ts` only before
  the ticket; after it `frontmatterSpan` is the one split (parser and editor),
  and `parseDocument` is called in `parse.ts` (reading) and `note-edit.ts`
  (writing).
