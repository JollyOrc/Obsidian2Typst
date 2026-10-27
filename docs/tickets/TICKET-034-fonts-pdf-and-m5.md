# TICKET-034 — Fonts in the PDF and manual check M5

**Status:** Done (2026-10-17, M5 passed on build `0.1.0-m5.2`)
**User story:** [US-010](../user-stories/US-010-fonts.md) (also closes [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) AC-7)
**ACs addressed:** AC-8 and the end-to-end part of AC-3 to AC-6
**Depends on:** TICKET-030, TICKET-031, TICKET-032, TICKET-033
**SCARs:** SCAR-012 (test build and handover), SCAR-015 (content, open question)

---

## Description

Check the composed result: the real compiler embeds the chosen fonts, the text
stays readable, no font file leaves the vault, and the user runs M5 in Obsidian.

---

## Implementation notes

- `tests/integration/us-010-fonts-pdf.test.ts` reads the embedded font names of
  the PDF (`/BaseFont`) with a guard run without the vault font.
- `tests/integration/us-007-composed-export.test.ts` replaces the todo of US-007
  AC-7: cover, vault font, list image, wikilink and table, real compiler,
  real disk, exactly the files of AC-1 and a log without warnings.
- **M5 (manual):** procedure in `docs/technical/manual-checks.md`. Prepared by
  the developer on build `0.1.0-m5.2` (SCAR-012; the build `0.1.0-m5.1` showed the font list and the glyph notice only after the settings were reopened):
  `npm run install:scratch`, checksum compared, fixtures in the scratch vault,
  empty export folder. Content checks per SCAR-015; the handover ends with the
  open question.

---

## Tests

- `tests/integration/us-010-fonts-pdf.test.ts`
- Manual check M5

---

## Definition of done

- [x] All listed tests pass; the todo of US-007 AC-7 is gone.
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`,
      `test:integration`).
- [x] M5 run by the user on a build with its own version.
- [x] `docs/technical/tests.md` updated; US-007 AC-7 and US-010 set to `Done`.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
