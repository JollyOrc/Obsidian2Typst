# TICKET-004 — `escapeMarkup`: escape literal text for Typst markup

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 (module side), AC-10 (markup part)

---

## Description

Implement `escapeMarkup(text, {atBlockStart})` in `src/core/emit/escape-markup.ts`, the only function that turns literal text into Typst markup text. Rules and evidence: US-013 and `docs/technical/typst-escaping-findings.md`.

---

## Acceptance criteria (from the user story)

- **AC-1:** `\ $ # @ < > [ ] ~ * _ ` ` get a backslash; `_` also inside words; `{ } ( ) : % & ^ |`, quotes, and non-ASCII stay.
- **AC-2:** `//` becomes `\/\/`; single `/` stays; `/*` and `*/` are safe through the `*` rule.
- **AC-3:** at the start of the text (when `atBlockStart`) and after every newline, the first non-blank character is escaped when it starts a marker: `=` run + blank, `-`/`+`/`/` + blank, digits + `. `. Leading blanks are kept. `=5`, `==x`, a lone `=`/`-`/`+`, `12.` at the end, `1.5 x`, `1) x`, `a = b` are not escaped.
- **AC-4:** with `atBlockStart: false` only the lines after a newline are line starts.
- **AC-5:** `--`, `---`, `...`, straight quotes, NBSP unchanged; `-?` becomes `\-?`.
- **AC-6 (module side):** the caller passes `atBlockStart` as listed in the story; the call-site table goes into the register.
- **AC-10 (markup part):** pure, deterministic, `MARKUP_TRANSFORMS` exported and registered.

---

## Implementation notes

- Transform ids (export them as `MARKUP_TRANSFORMS`, an array of `{id, description}`): `backslash`, `special-chars` (`$ # @ < > [ ] ~ * _ ``), `double-slash`, `soft-hyphen`, `line-start-heading`, `line-start-list`, `line-start-enum`.
- Single left-to-right pass over the text; no regular-expression chain that could escape twice. Not idempotent by design (US-013 AC-10).
- Do not add a flag to change what the function does; code and string literals have their own functions (SCAR-001).
- Call sites are added by the converter tickets. Each of those tickets must tick the call-site table in the register and add a test with an edge input at its own call site (SCAR-001).

---

## Tests

Real tests were written before the code (SCAR-003); exact string comparison.

- `tests/unit/us-013-typst-escaping.test.ts`, block `US-013 escapeMarkup`: 18 tests (AC-1 ×3, AC-2, AC-3 ×6, AC-4 ×2, AC-5, AC-6 ×3, AC-10 ×2, and AC-11 in block `US-013 scope`).
- `tests/integration/us-013-escape-roundtrip.test.ts` (TICKET-007) proves the same rules against the compiler.

---

## Definition of done

- [x] All listed tests pass (no `todo` left for this ticket's ACs).
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`, `test:integration`).
- [x] The transform ids are exported from `core/emit` and listed in the shared-utility register (`docs/user-stories/README.md`), each with a one-line description (SCAR-001).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Result

Implemented in `src/core/emit/escape-markup.ts`. The round-trip harness (TICKET-007) found one error in the first version of the rules: a marker at the **end of a line** (`+` followed by a newline) is an empty list item or heading in Typst, so a lone `=`, `-`, `+`, `/`, or `12.` must be escaped too. US-013 AC-3, the findings file, and the tests were corrected; the earlier probe had only looked at the end of a whole content block.
