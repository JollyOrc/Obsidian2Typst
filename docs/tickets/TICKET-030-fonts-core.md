# TICKET-030 — Fonts core: settings, catalog, resolution, the four lines

**Status:** Done (2026-10-17)
**User story:** [US-010](../user-stories/US-010-fonts.md)
**ACs addressed:** AC-1, AC-2, AC-4, AC-7 (pure part)
**Depends on:** TICKET-028 (preset fields), TICKET-023 (preamble registry)
**SCARs:** SCAR-001 (Typst strings), SCAR-010 (joins), SCAR-015 (content)

---

## Description

The pure core of the fonts: the `fonts` fields of a preset and of the Defaults
(parse, validate, merge, edit by path), the font catalog over the faces that
the compiler reports, one `resolveFonts` with the fallback chain and its
`FONT_MISSING` warnings, the four Typst lines as preamble rule `text-and-fonts`
(order 40), and the use of the resolved body family by the task-list rule.

---

## Implementation notes

- **`src/core/fonts/`** (no Obsidian, Node or I/O imports): `types.ts`
  (`FontRole`, `FontsSettings`, `DEFAULT_FONTS`, `BUNDLED_DEFAULT_FAMILY`,
  `BUNDLED_CODE_FAMILY`, `FaceInfo`), `catalog.ts` (`decodeCoverage`,
  `createFontCatalog`: families once and sorted without regard to case,
  `resolve(name)` gives the name the file reports, `hasGlyph(family, cp)` adds
  up the faces of a family), `resolve.ts` (`resolveFonts(settings, catalog?)`;
  without a catalog the names are taken as written and nothing is reported),
  `emit.ts` (`emitFonts`, four lines, sizes in pt without trailing zeros,
  families through `typstString`), `index.ts`.
- **Presets:** `PresetFields.fonts`; schema, parse and merge with the messages
  and line numbers of AC-1; the Defaults use the same validation
  (`validateFields`, `loadPluginData`); `getField/withField` work on the path
  `fonts.heading.family`; `effectiveSettings` gives `settings.fonts`.
- **Convert:** `ConvertSettings.fonts?: FontsSettings` (missing: no rule, older
  callers keep their output); `ConvertInput.fonts` is the catalog (it still
  answers `hasGlyph`); the rule `text-and-fonts` order 40 after the page rules
  and before the highlight rule; the `FONT_MISSING` warnings are part of
  `converted.warnings` at line 0; `bodyFamily` for the task markers is the
  resolved body family.
- `docs/technical/warning-codes.md`: `FONT_MISSING` becomes `active`; the
  message formats of AC-4 are written there.

---

## Tests

- `tests/unit/us-010-fonts-core.test.ts` (AC-1, AC-2, AC-4, catalog)
- `tests/unit/us-010-fonts-convert.test.ts` (place and order of the lines,
  warnings, task family)
- `tests/plugin/us-010-fonts-plugin.test.ts` (Defaults in `data.json`)

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each fallback step, the order of the four lines, the
      case-insensitive match, the default for a missing role family and the
      size format switched off alone are caught by a test.
- [x] Full quality gate passes.
- [x] `docs/technical/tests.md` rows set to pass; shared utilities registered in
      `docs/user-stories/README.md`.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
