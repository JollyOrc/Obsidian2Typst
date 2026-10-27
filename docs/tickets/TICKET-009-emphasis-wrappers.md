# TICKET-009 — `wrapEmphasis`: emit strong and emphasis safely

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-12 (and US-001 AC-2b as its first caller)

---

## Description

Add `wrapEmphasis(kind, inner, ctx)` to `core/emit`: delimiter form when no letter or digit touches the marks and the content does not end in an address, otherwise `#strong[…]` / `#emph[…]`. Found by probe `s16`: `*b*c` and `a*b*` fail to compile and `a*b*c` silently loses its emphasis.

---

## Acceptance criteria (from user story)

- **AC-12:** returns `*inner*` / `_inner_` when neither `prev` nor `next` is a letter or digit and `endsWithAddress` is false, else `#strong[inner]` / `#emph[inner]`; round trip against the compiler for the rows in the story, nested forms and a Unicode set; transform ids `emphasis-delimiter`, `emphasis-function`.

---

## Implementation notes

- Letter/digit test uses Unicode `\p{L}\p{N}`; CJK counts as a letter here, which only selects the (always valid) function form.
- Add the ids to `EMPHASIS_TRANSFORMS`, export from `core/emit/index.ts`, register in the README register (already listed), and extend `tests/support/typst-node.ts` `plainText` to show strong/emph so the round trip can assert emphasis survives.
- `inner` is already escaped Typst; this function never escapes.

---

## Tests

- `tests/unit/us-013-typst-escaping.test.ts` — US-013 AC-12 (table rows, purity)
- `tests/integration/us-013-escape-roundtrip.test.ts` — US-013 AC-12 (compiler round trip)

---

## Definition of done

- [x] All listed tests pass (unit 7 + 1 register, integration 6).
- [x] Full quality gate passes (typecheck, lint, build, test, test:integration).
- [x] US-013 status back to Done; AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
