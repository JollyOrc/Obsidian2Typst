# TICKET-005 — `typstString`: write a value as a Typst string literal

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-7, AC-10 (string part)

---

## Description

Implement `typstString(value)` in `src/core/emit/typst-string.ts`. It is used for image paths, link addresses, font family names, colour values, and the `#raw("…")` forms of TICKET-006. It is a different transform from `escapeMarkup` and the two must not be mixed.

---

## Acceptance criteria (from the user story)

- **AC-7:** returns the value in double quotes with `\` → `\\`, `"` → `\"`, newline → `\n`, tab → `\t`, other control characters (U+0000–U+001F, U+007F) → `\u{hex}`; nothing else changes. Examples: `a"b.png` → `"a\"b.png"`; `C:\x\y.png` → `"C:\\x\\y.png"`; `Cover Draft.png` → `"Cover Draft.png"`.
- **AC-10 (string part):** pure, deterministic, `STRING_TRANSFORMS` exported and registered.

---

## Implementation notes

- Transform ids: `quote`, `backslash`, `newline`, `tab`, `control`.
- Unicode above U+007F, including emoji and NBSP, is kept as it is.
- Existing call sites that build strings by hand (US-003 AC-7 path, US-011 cover path, US-001 AC-13 `rgb("…")`) must call this function; the converter tickets check it.

---

## Tests

- `tests/unit/us-013-typst-escaping.test.ts`, block `US-013 typstString`: 6 tests (AC-7 ×5, AC-10).
- Round trip against the compiler for strings (a `#assert.eq("…", "…")` check) is added in TICKET-007.

---

## Definition of done

- [x] All listed tests pass (no `todo` left for this ticket's ACs).
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`, `test:integration`).
- [x] The transform ids are exported from `core/emit` and listed in the shared-utility register (`docs/user-stories/README.md`), each with a one-line description (SCAR-001).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
