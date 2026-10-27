# TICKET-032 — Glyph check of the source text

**Status:** Done (2026-10-17)
**User story:** [US-010](../user-stories/US-010-fonts.md)
**ACs addressed:** AC-5, AC-5b
**Depends on:** TICKET-030
**SCARs:** SCAR-015 (content), SCAR-010 (joins)

---

## Description

Warn, per font family, about the characters of the source text that the family
cannot show, and give the picker the list of the characters that features need.

---

## Implementation notes

- **`core/fonts/glyphs.ts`:** `checkGlyphs(root, resolved, catalog)` walks the
  parsed tree and takes each text to its role: heading text, inline code and
  code blocks, image captions, everything else is body. Spaces, controls and
  invisible format characters (U+200B–U+200F, U+2060, U+FEFF, U+FE00–U+FE0F) are
  not checked; comments are dropped before. One `FONT_GLYPH_MISSING` per family
  (the union when two roles share a family), up to ten characters in code point
  order, then ` and N more`, with the first source line (frontmatter counted):
  `Font "X" lacks 2 characters: ☠ U+2620, ⚔ U+2694 (first at line 12)`.
- **Glyph warnings come after the `FONT_MISSING` warnings** in the result of
  `convert` and are sorted by line like the others (US-015 AC-7).
- **`core/fonts/picker.ts`:** `FEATURE_GLYPHS` (`☐` U+2610, `☒` U+2612),
  `missingFeatureGlyphs(catalog, family)`, `featureGlyphNotice(missing)`.
- The old task rule message of US-005 AC-6 stays; it now asks the resolved body
  family.
- `docs/technical/warning-codes.md`: `FONT_GLYPH_MISSING` message format amended.

---

## Tests

- `tests/unit/us-010-fonts-core.test.ts` (glyph check, feature glyphs)
- `tests/unit/us-010-fonts-convert.test.ts` (in the conversion result)

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each role assignment, the ignore list, the ten-item limit,
      the union per family and the first line switched off alone are caught by
      a test.
- [x] Full quality gate passes.
- [x] `docs/technical/tests.md` rows set to pass.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
