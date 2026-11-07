<!-- Filed 2026-11-06 as #132 on the user's go (epic #121, ticket 11 of 16). -->

### User story

[US-034](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md), ACs addressed AC-1, AC-2, AC-3, AC-4

### Description

Warn about images that print below `images.minDpi`: the image helpers record each block image's drawn width, the plugin reads it after every compile, and a pure function compares it with the file's pixel width.

### Acceptance criteria (from the user story)



- **AC-1 (setting):** `images.minDpi`: whole number 0 to 2400, built-in 300;
  `0` = off. In preset notes and the Defaults (US-008 AC-1 precedence).
  Settings screen (US-029 AC-1, AC-2): a feature row `Print resolution`,
  description `Warns about images below this dpi; off at 0.`, with a gear
  whose modal holds the number field — the form of the `Contents` row
  (`off while its depth is 0`). The row is placed after `Image fit`. Invalid
  values make the preset invalid (US-008 AC-4): `images.minDpi must be a
  whole number from 0 to 2400 (line N)`. A digital preset may set it lower.

- **AC-2 (what is checked):** Every block image of the body, entry
  illustrations included, and the cover (US-011): its effective resolution is
  its pixel width divided by its drawn width in inches, after fit, shrink,
  float or an entry slot. The drawn width comes from the compile: the image
  helper records each image's file and drawn width as `metadata`, read after
  the compile (as US-028 AC-5's decisions); the pixel width from the image
  file's header (PNG, JPEG, WebP, GIF). SVG and other vector images are not
  checked. An inline image (inside text) and a refused image (US-003 AC-6)
  are not checked.

- **AC-3 (the warning):** Below `images.minDpi`:
  `IMAGE_LOW_DPI "<file>": <d> dpi at <w> mm (min <m>)`, with `d` rounded to
  a whole number and `w` to 0.1 mm. A file drawn several times is checked once,
  at its largest drawn width, and named once. Examples (a 272 px wide image):

  | Drawn width | dpi | `minDpi` | Warning |
  |---|---|---|---|
  | 50 mm | 138 | 300 | `IMAGE_LOW_DPI "assets/small.png": 138 dpi at 50.0 mm (min 300)` |
  | 50 mm | 138 | 120 | none |
  | 20 mm | 345 | 300 | none |
  | 50 mm and 20 mm (twice) | 138 | 300 | one warning, at 50.0 mm |
  | any | — | 0 | none |

- **AC-4 (preview and export):** The check runs wherever the compile runs —
  preview and export (it needs no PDF scan). It never stops an export, also
  in strict mode (decision 1).

## Decisions (answered by the user, 2026-11-06)

1. **Strict mode:** neither `IMAGE_LOW_DPI` nor `TEXT_WIDE_GAP` stops an
   export (AC-4, AC-8); print checks are fixed at the author's pace.
2. **The lede column:** gets the narrow-column limits like every column
   under 60 % (AC-6); the scan shows whether it helps.

### Implementation notes

- `images.minDpi` (0 to 2400, built-in 300, 0 = off) in preset notes and the Defaults, with its message.
- Settings screen (US-029): a feature row `Print resolution` after `Image fit`, description `Warns about images below this dpi; off at 0.`, a gear row `Minimum print resolution` holding the number. The story's AC-1 names the row but not the gear row's label; the label is the one the G2 test fixes, and AC-1 is updated to name it in this ticket.
- Test interface: every block-image helper (`fit-image`, `fit-flow`, the entry slots, the cover) writes `metadata((file, widthMm))` labelled `<o2t-image>`; an inline image writes none.
- `src/core/checks/print.ts` (new): `lowDpiWarnings(images, pixelWidths, minDpi)` → `IMAGE_LOW_DPI "<file>": <d> dpi at <w> mm (min <m>)`, one per file at its largest width; files without a pixel width (vector) skipped. Pixel widths from the files' headers (PNG, JPEG, WebP, GIF).
- Plugin: after each compile (preview and export) the facts are read and the warnings added; never stops an export (decision 1).

### Tests

- `tests/unit/us-034-print-checks.test.ts`: the AC-1 and AC-3 tests and `US-034 AC-2: a file whose pixel width is unknown …`
- `tests/integration/us-034-print-pdf.test.ts`: `US-034 AC-2: a body image and an entry illustration record their drawn width …`

### SCAR check

- SCAR-017: every block-image helper writes the same fact; a text check over the helpers' definitions in the prelude.
- SCAR-016, SCAR-013: the settings row reuses US-029's feature-row form (reads at click time; keyboard as the other rows).
- SCAR-019: `minDpi` 0, 1, 120, 300, 2400 and refused values.
- SCAR-015: drawn widths compared with the PDF's image matrix.
- SCAR-022: the facts are read after the compile (as US-028).
- SCAR-007: the settings row's labels written into AC-1 (a gap found at G2).
- Not applicable: 014, 021.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
