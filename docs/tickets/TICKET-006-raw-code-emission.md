# TICKET-006 — `rawInline` and `rawBlock`: emit code exactly

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-8, AC-10 (raw part); also serves US-001 AC-7

---

## Description

Implement `rawInline(code)` and `rawBlock(code, lang)` in `src/core/emit/raw.ts`. They keep code byte for byte and choose a delimiter that cannot be broken by the content. Depends on TICKET-005 (`typstString`).

---

## Acceptance criteria (from the user story)

- **AC-8:** inline content without backtick and newline → `` `code` ``; otherwise `#raw("code")`. Block: fence = longest backtick run + 1, at least 3; the tag follows the fence if it is empty or only letters, digits, `_`, `-`; otherwise `#raw(block: true, lang: "c++", "…")`. Examples in the story.
- **AC-10 (raw part):** pure, deterministic, `RAW_TRANSFORMS` exported and registered.

---

## Implementation notes

- Transform ids: `inline-plain`, `inline-function`, `block-fence`, `block-lang-function`.
- Why not a two-backtick fence or a padded fence: `docs/technical/typst-escaping-findings.md`, raw section.
- Does not escape markup characters inside code; code is never passed through `escapeMarkup` (US-001 AC-4 last sentence).

---

## Tests

- `tests/unit/us-013-typst-escaping.test.ts`, block `US-013 raw code`: 9 tests (AC-8 ×8, AC-10).
- Round trip against the compiler in TICKET-007.

---

## Definition of done

- [x] All listed tests pass (no `todo` left for this ticket's ACs).
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`, `test:integration`).
- [x] The transform ids are exported from `core/emit` and listed in the shared-utility register (`docs/user-stories/README.md`), each with a one-line description (SCAR-001).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
