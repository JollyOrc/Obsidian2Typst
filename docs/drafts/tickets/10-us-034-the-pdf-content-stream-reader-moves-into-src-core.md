<!-- Filed 2026-11-06 as #131 on the user's go (epic #121, ticket 10 of 16). -->

### User story

[US-034](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md), ACs addressed AC-9

### Description

Move the PDF reader of `tests/support/pdf.ts` into `src/core/pdf/reader.ts` as pure code with a one-pass object index, so that the word-gap scan (#133) and the tests share it.

### Acceptance criteria (from the user story)



- **AC-9 (the reader is core code):** The PDF content-stream reader moves from
  `tests/support/pdf.ts` (`contentTokens`, `literalBytes`, `readCMap`) into
  `src/core`, as pure code on the PDF bytes with an object-offset index
  (one pass over the file, then direct slices), its transforms documented
  (SCAR-001); the tests use the core reader. Literal strings with balanced,
  unescaped parentheses are read correctly; fonts are read once per font
  object.

## Decisions (answered by the user, 2026-11-06)

1. **Strict mode:** neither `IMAGE_LOW_DPI` nor `TEXT_WIDE_GAP` stops an
   export (AC-4, AC-8); print checks are fixed at the author's pace.
2. **The lede column:** gets the narrow-column limits like every column
   under 60 % (AC-6); the scan shows whether it helps.

### Implementation notes

- `src/core/pdf/reader.ts`: `literalBytes`, `hexBytes`, `contentTokens`, `readCMap`, and `objectIndex(pdf)` (object number → offset after `n 0 obj`, built in one pass); stream access by the index instead of a regex per object (the scan-time spike: 120 ms vs 241 ms on 261 pages, growing faster without the index).
- `tests/support/pdf.ts` imports them from core and keeps only test-side readers (pages, bookmarks, links); its transforms are documented in the core module (SCAR-001).
- Pure: no Obsidian or I/O import.

### Tests

- `tests/unit/us-034-print-checks.test.ts`: the three AC-9 tests
- Guards: every test that reads PDFs through `tests/support/pdf.ts` (the whole `npm run test:integration`)

### SCAR check

- SCAR-001 (shared utility with undocumented transforms): the reader's transforms (escapes, octal, hex strings, CMap ranges) are documented where they now live.
- SCAR-027: the users of `tests/support/pdf.ts` are every PDF test; they stay green (the guard).
- SCAR-028 (test reader trusted unchecked): the reader's syntax rules get their own unit tests (balanced parentheses, escapes, the index).
- SCAR-017: one reader for the tests and the product.
- Not applicable: UI SCARs, 021, 022.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
