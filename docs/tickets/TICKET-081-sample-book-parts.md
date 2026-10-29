# TICKET-081 — The sample vault gets a colophon and back notes

**Status:** Done
**User story:** [US-026](../user-stories/US-026-book-parts-and-signatures.md)
**ACs addressed:** AC-11
**Depends on:** TICKET-078
**SCARs:** SCAR-012, SCAR-017, SCAR-018, SCAR-023, SCAR-027

---

## Description

The generator of the sample vault (US-024) writes a colophon and back notes
into `Book.md`, under headings that the sample preset `presets/Sample.md`
maps to `colophon` and `back-notes`; the committed sample vault is
regenerated (`npm run fixtures`).

---

## Implementation notes

- `tests/fixtures/generate.ts`: two new sections with words from the
  generator's vocabulary (not the built-in `Colophon`, `Back notes`, so that
  presets without the mapping keep them in the body and the test of AC-11
  proves the preset mapping); the manifest records them.
- Every user of `Book.md` listed before the change (SCAR-027, measured
  2026-10-28): 25 test files read it; all take their numbers from the
  manifest or from the private census (unchanged) except the preamble orders
  (not about `Book.md`). The manual checks M8 step 4, M9, M14 and M15 name
  page counts, page numbers and warning counts of `Book.md`: each is measured
  again through the plugin's own path with the font catalog (SCAR-012) and
  rewritten in the same change.

### Guards searched before the ticket (SCAR-023)

- `tests/tooling/us-024-generator.test.ts`: the committed vault equals the
  generator's output — regenerated in this ticket.
- `tests/unit/us-024-census.test.ts`: the manifest's structure; extended if
  the manifest gains a field.
- `tests/integration/us-001-validity.test.ts`: the two notes `Book.md`,
  `Other.md` — unchanged.

---

## Tests

- `tests/unit/us-026-book-parts.test.ts` AC-11; the US-024 tests and every
  `Book.md` reader green after the regeneration.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-012** (1–7) the manual checks' numbers measured again through the
  plugin's path with all inputs; the scratch vault's `Sample/` reinstalled at
  the next handover.
- **SCAR-017** (1–8) every check that names a `Book.md` number found by grep
  and rewritten.
- **SCAR-018** (1–10) the committed sample vault backed up with checksums
  before regeneration; the generator's output compared.
- **SCAR-023** (1–10) guards above.
- **SCAR-027** (1–3) every user of `Book.md` listed with what it asserts.
- Other SCARs: n/a (no converter code).

---

## Definition of done

- [x] Sample vault regenerated; every test green that was green before
- [x] M8, M9, M14, M15 numbers measured and rewritten (and M2, M3, M10,
  found by the grep)

---

## Result (2026-10-29)

Changed: `tests/fixtures/generate.ts` (the constant `BOOK_PARTS`: `# Senectus
Netus` with two paragraphs and `# Pretium Fames` with one, written after
`# Appendix`, so every byte above stays as it was; a check that each is one
heading of the note in any case; the preset's `headingRules` mapping them to
`colophon` and `back-notes`; the manifest key `bookParts`),
`tests/support/sample.ts` (the manifest type), the committed vault by `npm run
fixtures` (three files differ: `Book.md` +10 lines, `presets/Sample.md`,
`manifest.json`; the other 71 byte-identical, checked against the backup's
checksum list), `docs/technical/manual-checks.md`.

- Tests: `US-026 AC-11` green; the US-024 and US-026 unit and tooling files
  77/77; two generator runs byte-identical.
- Mutants (scratchpad `mut081/run.py`): 4, all caught — the colophon rule
  removed, the back-notes rule removed, the colophon heading at level 2, a
  rule key that is not the heading. Restores checked with `shasum -a 256 -c`.
- Manual checks (SCAR-012, SCAR-017): measured before and after through the
  plugin's `convertNote` (preset + Defaults, template, font catalog) and the
  bundled compiler (scratchpad `m081/measure.test.ts`, `before.json`,
  `after.json`); the before run reproduced every number the checks stated.
  Unchanged: 149 warnings, 178 numbers (436 at level 3), the glossary on
  pp. 413 to 419. Changed: 419 → 420 pages (last folio 419) in M2, M3, M8
  step 4, M9 step 6 and 7, M10 step 8, M14 steps 1 to 4; level 3 420 → 421;
  M15 435 → 439 (chapters 10 and 11 on pp. 437 and 439, empty pp. 436 and
  438), with `h2: none` 425 → 429 (empty pp. 426 and 428). M2, M3 and M10
  were not in the ticket's list; the grep found them.
- Gate (scratchpad `gate081.log`): typecheck, build (`main.js` sha256
  `77c39c19129c…`, unchanged), lint green; `npm test` 1934 passed, 63 failed,
  1 todo; integration 430 passed, 34 failed, 1 skipped. Every red test is of
  US-027 or US-028, or one of the two US-026 contents rows (US-027).
- Not done here: the scratch vault's `Sample/` still holds the old note; it
  is reinstalled at TICKET-082's handover (M16).
