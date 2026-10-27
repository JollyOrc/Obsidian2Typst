# TICKET-011 — `callSeparator` and the slash rule of `wrapEmphasis`

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-12b, AC-13 (used by US-001 AC-1c and AC-2b)

---

## Description

Two Typst hazards found while specifying the inline emitter (probes `s20`, `s21`, `s22` in `spikes/typst-wasm/`): text that directly follows an embedded call (`#strike[a].b`, `#strike[a](x)`, `#strike[a][x]` fail; `#strike[a];b` loses the `;`), and a strong delimiter next to a slash (`a/*b*` and `*b*/c` are comment markers). Add `callSeparator(next)` to `core/emit` and extend `wrapEmphasis` so the inline emitter can rely on both.

---

## Acceptance criteria (from user story)

- **AC-12b:** `wrapEmphasis('strong', …)` returns `#strong[inner]` when the last character of `prev`, the first of `next`, the first or the last of `inner` is `/`; `emph` is unchanged.
- **AC-13:** `callSeparator(next)` returns `;` when the first character of `next` is `.`, `(`, `[` or `;`, and `''` otherwise; round trip against the compiler for every call form and every follower; transform id `call-separator`.

---

## Implementation notes

- New file `src/core/emit/call.ts` with `callSeparator` and `CALL_TRANSFORMS` (`[{id: 'call-separator', …}]`), exported from `core/emit/index.ts`. One character means one code point (`Array.from(next)[0]`).
- `wrapEmphasis` stays one function: add the slash check next to the word-character check in `emphasis.ts`; the ids in `EMPHASIS_TRANSFORMS` do not change (a slash selects `emphasis-function`).
- Register: add the `callSeparator` row to the shared-utility register in `docs/user-stories/README.md` and extend the `wrapEmphasis` row.
- `core/emit` stays pure (lint rule).

---

## Tests

- `tests/unit/us-013-typst-escaping.test.ts` — US-013 AC-12b (2 tests), AC-13 (4 tests + 1 register test under AC-10)
- `tests/integration/us-013-escape-roundtrip.test.ts` — US-013 AC-12b (2 tests), AC-13 (3 tests)

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] US-013 status back to Done; ACs refined during implementation are written back.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
