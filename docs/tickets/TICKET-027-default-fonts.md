# TICKET-027 — Bundled default fonts, so that an export has text

**Status:** Done
**User story:** [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) (AC-13); prepares [US-010](../user-stories/US-010-fonts-default-and-per-role.md)
**ACs addressed:** US-007 AC-13
**Depends on:** TICKET-019, TICKET-023
**SCARs:** SCAR-015, SCAR-012

---

## Description

M3 passed, but the PDF had no visible text: the plugin ships no fonts and the
export passes an empty font list (spike S4: the compiler is silent about it).
Decided by the user on 2026-10-17: bundle default fonts now.

---

## Implementation notes

- **`assets/fonts/`:** `LibertinusSerif-{Regular,Bold,Italic,BoldItalic}.otf`
  (version 7.051, SIL OFL 1.1, `Libertinus-OFL.txt`), `DejaVuSansMono.ttf` and
  `DejaVuSansMono-Bold.ttf` (Bitstream Vera licence, `DejaVu-LICENSE.txt`).
  Typst's own defaults for text and `raw`, so the generated `.typ` needs no
  font setting.
- **Build:** `build/build-plugin.mjs` embeds `embedded:default-fonts` as a list of
  gzip + base64 strings (one per file, the helper of AC-12).
- **`src/plugin/compiler/default-fonts.ts`:** `lazyFonts(encoded)` decodes on the
  first call and returns `Uint8Array[]` (same retry rule as `lazyWasm`);
  `embedded-fonts.ts` binds it to the embedded text; `main.ts` passes the
  result as `fonts` for the export and for `Check compiler`.
- A vault font loaded later (US-010) is added to this list, not instead of it.
- `docs/technical/dependencies.md`: fonts and licences. M3 states the text
  that must be readable and asks for anything odd (SCAR-015). Version of the
  next test build `0.1.0-m3.2`.

---

## Tests

- `tests/plugin/us-007-default-fonts.test.ts` — files and licences are in
  `assets/fonts`, encoder/decoder round trip for every font, the decoded bytes
  are OpenType/TrueType, decoding once, wiring text (`main.ts` passes the fonts
  and no `fonts: []` remains in the export).
- `tests/integration/us-007-default-fonts-pdf.test.ts` — real compiler: the
  guard (no fonts: PDF names no font) and the result (default fonts: PDF names
  `LibertinusSerif`; a `raw` block names `DejaVuSansMono`; bold and italic
  faces are used).
- `tests/integration/us-007-export-compiledtext.test.ts` — the PDF of The Rules
  names `LibertinusSerif` and `DejaVuSansMono`.
- `tests/integration/build-output.test.ts` — `main.js` stays under 25 MB and
  contains no `.ttf`/`.otf` reference to a file (fonts are embedded).

---

## Definition of done

- [ ] All listed tests pass.
- [ ] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] M3 repeated by the user on the new build; text readable.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result

`assets/fonts` (six faces, two licence texts), `build/build-plugin.mjs` embeds
them as `embedded:default-fonts`, `compiler/default-fonts.ts` (`lazyFonts`),
`compiler/embedded-fonts.ts`, `main.ts` passes them to the export and to
`Check compiler`. `main.js` grew from 15.3 MB to 17.1 MB (limit 25 MB). Checked
with `pdftotext` and `pdffonts` on a compiled sample: the text is extractable and
both fonts are embedded. Mutation check: 3 mutants of `lazyFonts` (no memo, no
retry after failure, a font dropped) all caught. Test build `0.1.0-m3.2`
installed in the scratch vault (sha256 `f6e8c6f3…`); presets, Defaults, the
template and the export folder were reset for the repeat of M3.
