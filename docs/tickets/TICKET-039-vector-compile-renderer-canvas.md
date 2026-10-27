# TICKET-039 — Vector compile, page renderer, page canvas helper, browser downsampler

**Status:** Done
**User story:** [US-012](../user-stories/US-012-style-preview-panel.md)
**ACs addressed:** AC-7 (drawing), AC-12 (browser re-encoder), AC-13 (integration)
**Depends on:** TICKET-037, TICKET-038
**SCARs:** SCAR-008 (read the type definitions of `renderCanvas`, one canvas helper, programmatic check of the pixels), SCAR-015, SCAR-012

---

## Description

The part that needs the compiler WASM, the renderer WASM and a browser.

---

## Implementation notes

- **Read first (SCAR-008):** the `.d.ts` of `@myriaddreamin/typst-ts-renderer` and `typst-ts-web-compiler`: the options of `renderCanvas` (spike S8: pass the 2D context as `canvas`, size the canvas to page size × `pixelPerPt`, `pageOffset`), the vector format string, the page count API. Write what was read into the file comment.
- `plugin/compiler`: `compileVector(request)` → `{ok: true, vector: Uint8Array}` or the same failure shapes as `compile`; the worker answers a new message `compile-vector` (`worker-core.ts` format `vector`, the plain-data copy rules of US-007 AC-11). One worker per call as before; `cancel` ends the worker (spike S11: 193 ms to the next result). `createTypstCompiler` returns a job (`{result, cancel}`) for the preview; `compile` keeps its form.
- `plugin/preview/renderer.ts`: `createPageRenderer({rendererWasm})` → `open(vector)` → `{pageCount, pageSize(page) /* pt */, draw(page, context, pixelPerPt), dispose()}`. The renderer WASM is bundled like the compiler WASM (US-007 AC-12): same decoding on first use, nothing fetched, `build-output` and `packaging` tests extended.
- `plugin/preview/canvas.ts`: the one helper that makes a canvas, for pages (`makePageCanvas`) and for the scratch canvas of the downsampler (`makeScratchCanvas`); no other file calls `createElement('canvas')` or `new OffscreenCanvas` (a text check in `us-012-panel.test.ts`). It is the one that makes a page canvas (2D context, size = page size × `pixelPerPt`, CSS size set separately, a maximum size, release by setting the size to 0). `nonWhiteShare` of the drawn pixels is the guard for a blank result.
- `plugin/preview/browser-downsample.ts`: `downsampleImage(bytes, extension)` decodes with `createImageBitmap`, draws to the scratch canvas of `./canvas` with the plan of `planDownsample`, re-encodes (JPEG 0.85 for JPEG, PNG otherwise), and applies `withDensity(copy, scaledDensity(readDensity(bytes), factor))`; `null` for a small or undecodable image. Only the preview request calls it.

---

## Tests

`tests/integration/us-012-preview-equals-export.test.ts` and
`us-012-downsample-placed-size.test.ts` (real compiler and renderer in Node).
Browser parts (canvas, `createImageBitmap`) are checked in manual check M2
step 15 of TICKET-040 (page 3 of the reference: 6.9 % non-white pixels at 2 px/pt).
Mutation checks: density dropped (caught by AC-13), canvas not sized, wrong page offset.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-008:** type definitions read first (note in `renderer.ts`); blank output is treated as our bug: the pixel check (`nonWhiteShare`) is in TICKET-037 and the manual step; one canvas helper (registered in the shared-utility table of `docs/user-stories/README.md`, row `Page canvas helper`; update its transforms: scale factor, maximum size, cleanup, scratch canvas); console log per step.
- **SCAR-015:** AC-13 states content (page counts above 10, cover page size, cover file in the request) and the pixel checks are in the manual step.
- **SCAR-001:** `withDensity` and the size plan are reused from TICKET-037; the new call site is checked by the real compiler in `us-012-downsample-placed-size.test.ts` (edge cases: a 1-px side, a JPEG without JFIF).
- **SCAR-012:** the build for the manual step is made in TICKET-040.
- SCAR-006: gate green, pass count noted. Others not affected.

---

## Definition of done

- [x] Integration tests green; gate red by design until TICKET-040 (panel module, `compileFonts` count); `main.js` size and the package contents checked as in US-007 AC-12
- [x] Every step of drawing and re-encoding logs `[o2t preview] …` to the console, with the non-white share per drawn page (SCAR-008: a hang or a silent no-op leaves a trace on the tester's machine)
- [x] Types read and noted in the file comment of `renderer.ts`
- [x] Rows of `docs/technical/tests.md` set to ✅

## Result (2026-10-18)

New: `renderer.ts`, `canvas.ts`, `browser-downsample.ts`, `compile-vector` in the worker, `VectorCompiler`, `embedded:renderer-wasm`. `main.js` is 17.65 MB (limit 25 MB). `npm test`: 1595 passed; red only for TICKET-040 (`us-012-panel` missing modules, `compileFonts` count in `main.ts`, build typecheck). Mutants: 34 in total, all caught after added tests (session free, retry after a failed WASM load, browser downsampler stand-in tests).

**Finding that differs from the story:** a WebP has no resolution that Typst reads (`400×200` places at 400 pt, the half-size copy at 200 pt), and a PNG stored under a `.webp` path is refused by Typst. So the browser downsampler leaves WebP alone (returns `null`); AC-12 was amended on the user's yes (2026-10-18): WebP is left as it is; the request builder no longer offers WebP either.

**Not testable in Node:** drawing into a real canvas (`render_page_to_canvas`, `getImageData`, `createImageBitmap`, `toBlob`) is covered by stand-ins for the logic and by manual check M2 step 15 (TICKET-040) for the pixels.
