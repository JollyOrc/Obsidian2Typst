# TICKET-037 — Preview core: page range, canvas plan, image density, status line, value owner

**Status:** Done (2026-10-18; gate note below)
**User story:** [US-012](../user-stories/US-012-style-preview-panel.md)
**ACs addressed:** AC-2 (owner text), AC-5 (aspect), AC-6 (range), AC-7 (canvas plan, blank check), AC-11 (status line), AC-12 (size plan, density)
**Depends on:** TICKET-009 to TICKET-036 (done)
**SCARs:** SCAR-007 (every rule has its numbers), SCAR-009 (range: every position of the text), SCAR-001 (a transform of image bytes is documented), SCAR-015 (the blank check)

---

## Description

The pure parts of the preview, in `src/core/preview/` and `src/core/presets/`
(no Obsidian, Node or I/O imports). All of them are decided by the story; this
ticket only writes them.

---

## Implementation notes

- `core/preview/range.ts`: `parsePageRange(text)` → `{ok, range: {kind: 'all'} | {kind: 'range', from, to}}` or `{ok: false, message: RANGE_MESSAGE}`; whole numbers only, `1 ≤ from ≤ to`, a number above `Number.MAX_SAFE_INTEGER` is refused; `pagesToShow(range, count)` → `{pages, message}` (`The document has 263 pages`, `1 page`).
- `core/preview/canvas.ts`: `planCanvases({pages, drawn, scrollTop, viewport, pageHeight, gap})` (draw window one viewport height around the visible part, release beyond three viewport heights; the page position is its place in `pages`); `aspectOf({width, height})`; `nonWhiteShare(rgba)` (a pixel counts when alpha > 0 and a channel is below 250); `isBlankPage(rgba)` (`BLANK_SHARE = 0.01`, an empty list is blank).
- `core/preview/downsample.ts`: `PREVIEW_MAX_SIDE = 1200`, `planDownsample(size, limit?)` → `{width, height, factor}` or `null`; `readDensity(bytes)` (PNG `pHYs` in meters, JPEG JFIF dots per inch or per cm, unit 0 gives null); `scaledDensity(dpi, factor)` (null counts as 72); `withDensity(bytes, dpi)`. **Transform documentation (SCAR-001):** `withDensity` changes only the header: a PNG gets one `pHYs` chunk (an old one is replaced) with a valid checksum before the first `IDAT`; a JPEG gets its JFIF density set (a JFIF header is inserted after the start marker when there is none); other bytes come back as they are; the picture data is never touched. It is the only code that writes a density; the browser re-encoder (TICKET-039) calls it.
- `core/preview/status.ts`: `statusLine(state)` → `Open a note to preview it` | `Preview of: <name> · <Compiling… | error | Export running; the preview updates afterwards | N warnings> [· hint]`; `warningCountText(n)`.
- `core/presets/owner.ts`: `ownerNote(presetName, presetFields, path)` (trim size, width and height are one group, US-009 AC-14), `shownValue(presetFields, defaults, path)`.

---

## Tests

`tests/unit/us-012-page-range.test.ts`, `us-012-canvas-plan.test.ts`,
`us-012-downsample.test.ts` (and the status, owner and aspect cases of the
controller and panel tests). Mutation checks to run: window sizes of the plan,
`≤` against `<` at the range ends, density factor inverted, `pHYs` after `IDAT`.


---

## Result (2026-10-18)

- Files: `core/preview/{range,canvas,downsample,status}.ts`, `core/presets/owner.ts`; new test `tests/unit/us-012-status-owner.test.ts` (the status line and the owner had their tests only inside files that wait for tickets 038 and 040).
- Mutation checks: 14 mutants. First run 4 survived: draw window `<` instead of `≤`, keep window of two panel heights, the trim group switched off, and one that turned out to be equivalent (the "not on screen" test of the release is already implied by the keep test; the code was simplified). Three tests were added (boundary distances 1, 3 and 3+ panel heights; drawn pages outside the range; the trim group in the unit file). Second run: 0 survivors.
- **Known limit, written into `withDensity`:** a JPEG can only carry whole dots per inch, so its placed size can differ from the original by up to half a dot per inch of the written resolution (about 1.7 % at 30 dpi). A PNG is exact to 0.07 %. Page counts of the preview can therefore drift in rare cases with many small JPEGs; AC-13 measures it on the reference, and PNG output for every downsampled image is the fallback if it matters.
- **Gate note:** the whole gate is red on purpose until TICKET-040: `tsc` fails only on the missing modules of tickets 038 to 040 (no error in a file of this ticket), so `npm run build` and its integration test `TICKET-003: npm run build exits with 0` fail too. Unit and plugin tests: 1290 passed, the three US-012 files of later tickets fail on their missing modules. Integration: 225 passed, `us-012-preview-equals-export` (TICKET-039) and the build test fail.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

SCAR-007 numbers in every rule (1200 px, 0.4, 1 %, 500 ms); SCAR-009 the range text is tested at start, inside and end (spaces) and with the refused shapes; SCAR-010 and SCAR-011 not affected (no concatenation of generated pieces, no generated names; the status line only joins display text); SCAR-001 `withDensity` transforms documented above; SCAR-013, SCAR-014, SCAR-016, SCAR-017 not affected (no UI).

---

## Definition of done

- [x] The tests of the listed files are green (page range 32, canvas plan 16, downsample 22, status and owner 10, placed size with the real compiler 4); lint and Prettier green; the 1205 earlier tests green
- [x] `src/core/**` imports nothing from Obsidian, Node or the plugin (`crc32` is written out; no `zlib`)
- [x] Rows of `docs/technical/tests.md` set to ✅ for the part of this ticket, pass counts noted (SCAR-006)
