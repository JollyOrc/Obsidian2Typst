# TICKET-007 — Round-trip harness: escaped output must compile and read back unchanged

**Status:** Done
**User story:** [US-013](../user-stories/US-013-typst-safe-output.md)
**ACs addressed:** AC-9, AC-6 (compiler side)

---

## Description

Build a test support module that compiles Typst with the bundled compiler in Node (offline, no fonts) and reads the text back, then use it to prove the three functions of TICKET-004 to TICKET-006 against the real compiler. This is the programmatic check demanded by SCAR-008 and the edge-input test demanded by SCAR-001.

---

## Acceptance criteria (from the user story)

- **AC-9:** every printable ASCII character, alone, in the middle of text, at line start, and after a space at line start, wrapped in `[` … `]`, compiles and reads back as the original text; the same for the AC-1 to AC-3 examples, the hostile strings, and the code forms; typography has its own expectations (`--` → `–`, `---` → `—`, `...` → `…`).
- **AC-6 (compiler side):** each call-site shape reads back as plain text with no heading or list element.

---

## Implementation notes

- Add `@myriaddreamin/typst.ts`, `typst-ts-web-compiler`, `typst-ts-renderer` 0.7.0 (exact) to `devDependencies` and to `docs/technical/dependencies.md` (they become runtime dependencies with US-007's ticket). Build the compiler as `spikes/typst-wasm/lib/typst.mjs` does: `getModule` from the package files, `loadFonts([], {assets: false})`, and never touch the network.
- Support module `tests/support/typst-node.ts`: `compile(source)`, and `plainText(markup)` that wraps the markup in `#assert.eq(plain([…]), "@@")` and reads the actual text from the error message, as `spikes/typst-wasm/s12-escape-probe.mjs` does (first version of `plain()`). A smart quote maps back to its straight character.
- A raw `#assert.eq` mismatch is the only way this version of the API returns the value; if the compiler's `query` works later, switch to it.
- Compile time per snippet is a few milliseconds; keep one compiler instance per test file. Build the 95 ASCII × 4 positions as one document if single compiles are slow.
- The harness must fail loudly if the compiler cannot be loaded (no silent skip).

---

## Tests

- `tests/integration/us-013-escape-roundtrip.test.ts`: 8 tests (AC-9 ×5, AC-6 ×2, AC-7 ×1).
- `tests/integration/typst-node-support.test.ts` (new, written first): the support module itself, with a known-good and a known-bad input: `plainText("a *b* c")` is `a <strong>b</> c`-style output of the helper, and `plainText("a $5")` throws an "unclosed delimiter" error.

---

## Definition of done

- [x] All listed tests pass (no `todo` left for this ticket's ACs).
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`, `test:integration`).
- [x] The harness and its dependencies are listed in `docs/technical/dependencies.md`.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
