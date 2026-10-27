# TICKET-028 — Cover core: image sizes, crop share, first-block rule, cover pages, `cover` preset fields

**Status:** Done (2026-10-17)
**User story:** [US-011](../user-stories/US-011-cover.md)
**ACs addressed:** AC-1, AC-2 (rule), AC-4 (text), AC-5 (text), AC-6 (size and share), AC-10 (field)
**Depends on:** TICKET-021 (presets core), TICKET-017 (assets)

---

## Description

The pure part of the cover: nothing here reads a file or the vault. The
conversion (TICKET-029) and the plugin call it.

---

## Implementation notes

- **`src/core/assets/image-size.ts`:** `readImageSize(extension, bytes)` gives
  `{width, height}` or `null`; `IMAGE_SIZE_READ_BYTES = 1_048_576`. PNG (IHDR),
  GIF, WebP (`VP8 `, `VP8L`, `VP8X`), JPEG (first frame marker; EXIF orientation
  5 to 8 swaps width and height, both byte orders, other values ignored), SVG
  (`viewBox`, else `width` and `height` in the same unit). Documents its
  transforms in the doc comment and in the shared utilities register (SCAR-001).
- **`src/core/cover/`:** `types.ts` (`CoverSettings`, `DEFAULT_COVER`),
  `crop.ts` (`cropPercent`, `cropMessage`, `formatMm`), `find.ts`
  (`findCoverImage(root)`: first block after comment blocks; one image and
  nothing else; not a web image, not a link-wrapped image, not a note embed),
  `emit.ts` (`emitCoverPages`: cover page, optional blank page, then the
  counter reset), `index.ts`.
- **`core/presets`:** `PresetFields.cover` (`mode`, `file`, `blankPageAfter`,
  `cropWarningPercent`, `back: true` when present and not null), validation with
  the messages of AC-1 and the lines `cover.<field>`, `effectiveSettings` gives
  `settings.cover`; the Defaults never carry `cover` (`validateFields` drops it,
  the merge ignores it). `PRESET_FIELDS` and `docs/technical/…` list it.
- **SCAR review (2026-10-17):** the size reader lists all its transforms in its doc
  comment (EXIF swap, SVG unit rule, rounding is not done here); the new call site
  of `typstString` for the cover path documents its transforms and is tested with
  a name containing quotes and a backslash (SCAR-001, SCAR-010).
- Warning codes `COVER_*` stay `reserved` until TICKET-029.

---

## Tests

- `tests/unit/us-011-cover.test.ts` (sizes, share, first block, cover text,
  `cover` fields).

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule of the size reader (each type, the EXIF swap, the
      units, the limits), the share and rounding, the first-block rule and the
      field checks switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] `docs/technical/tests.md` AC-to-test map updated; shared utilities register updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
