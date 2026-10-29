# Spike findings — bundled WASM Typst compiler (TICKET-001)

**Status:** Complete. Node checks and the Obsidian run (2026-10-16, user's Mac) are in.
**Recommendation: go with changes.** See "Recommendation" at the end.
**Date:** 2026-10-16. Throw-away code and raw results: `spikes/typst-wasm/` (`results/*.json`).

## Pinned versions

| Component | Version | Licence |
|-----------|---------|---------|
| `@myriaddreamin/typst.ts` | 0.7.0 | Apache-2.0 |
| `@myriaddreamin/typst-ts-web-compiler` | 0.7.0 | Apache-2.0 |
| `@myriaddreamin/typst-ts-renderer` | 0.7.0 | Apache-2.0 |
| Typst compiler inside | 0.14.2 | (Apache-2.0, per upstream; not re-verified) |

## Results at a glance

| Check | Result | One-line finding |
|-------|--------|------------------|
| S1 inventory | pass | Compiler WASM 28.3 MB (10.9 MB gzip); renderer WASM 1.0 MB; JS about 0.4 MB |
| S2 hello | pass | `= Hello` compiles offline in Node in 134 ms including init; output `%PDF-1.7` |
| S3 story snippets | pass | All 39 Typst snippets of US-001 to US-011 compile with zero errors |
| S4 fonts | pass | Glyph coverage comes from the compiler itself; **no fonts are bundled** |
| S5 images | pass | PNG, JPEG, GIF, SVG, **and WebP** work from memory; names with spaces work |
| S6 reference document | pass | 263 A5 pages: 9.6 to 10.1 s cold, 1.3 s after a page-size change, **peak memory 2.2 GB** (Node) |
| S7 inside Obsidian | pass | Worker compile works; main-thread gap 34 ms (limit 100); 0 fetch calls; reference 9.1 s; Obsidian process 2.5 GB |
| S8 preview | pass | Page 3 renders to canvas in 53 ms (A5) / 96 ms (A4), sharp and complete (user check); 263 pages = PDF |
| S9 PDF options | pass (recorded) | **PDF/A, PDF/UA, PDF/X are not selectable** in typst.ts 0.7.0; CMYK kept; crop marks possible |
| S10 packages and network | pass | Zero network connections during compile; `@preview` import fails with a clear error |
| S11 superseded compile | pass | A second request waits for the running one; hard cancel costs about 0.2 s |

## Details

**S1.** Sizes in bytes: compiler 28,325,178 (gzip 10,859,138); renderer 972,425 (gzip 357,260); typst.ts bundle 153,398. The built spike plugin has `main.js` 153 kB and `worker.js` 250 kB.

**S2.** A fresh `TypstSnippet` with the default font download switched off (`loadFonts([], {assets: false})`) never touches the network. The default would fetch fonts from a CDN.

**S3.** Snippets must be compiled as a file inside the project root (`/main.typ`); the quick `mainContent` mode puts the file outside the root and every image or template import fails with "access denied". Compiling without errors does not prove correct layout; the snippets ran without fonts. Warnings are not visible (see S4).

**S4.**
- Coverage: `get_font_info(bytes)` returns each face's family, weight, style, and coverage (run lengths of not-covered/covered code points). A decoder is 8 lines. No font-parsing library is needed.
- Real fonts on this machine: `DejaVu Sans` has ☐ U+2610 and ☒ U+2612; `DejaVu Serif`, `Nimbus Roman`, `Liberation`, `Lato`, `Lora`, `Poppins` and all Pepper&Carrot fonts have neither; `OpenSymbol` has ☒ but not ☐ (a real partial case). The `[ ]` fallback of US-005 AC-6 will be the common case.
- Vault fonts: all 11 Pepper&Carrot font files loaded; the font name appears in the PDF.
- Bundled fonts: none. Typst's default text fonts (DejaVu Sans Mono, Libertinus Serif, New Computer Modern) are normally fetched from a CDN by typst.ts; the plugin must ship its own default fonts.
- Diagnostics: a successful compile returns **no warnings**. An unknown font family and a missing glyph are silent. Errors come as `"/e.typ:1:9: error: expected expression"` (path, line, column), which is enough for US-007 AC-4.

**S5.** WebP also renders (Typst 0.14.2). SVG becomes vector drawing commands, not an image object.

**S6.** Reference document = naive Typst from `compiledtext.md` (386 kB, 5,443 lines, 64 image references, 62 distinct images, 102 MB), A5 with margins of US-009, Nimbus Roman 10 pt, numbered headings. Limits of the naive converter: no bold or italic, links reduced to text, tables as plain `#table`, no footnotes, no callouts. Real conversion adds work, so treat the numbers as a floor.
- Cold 9,593 to 10,107 ms; same input again 153 to 176 ms (cached); after changing to A4 1,346 ms (177 pages).
- PDF 100 MB (images are embedded as they are; no downsampling).
- Peak resident memory 2,247 MB (OS-reported maximum). A sampling timer reports 136 MB because the event loop is blocked during the compile; that number is wrong and was discarded.

**S8 (Node half).** Vector form of the reference: 109 MB, 4.0 s first, 0.37 s warm. The renderer reports 263 pages, same as the PDF. SVG for the whole document is 154 MB: unusable in a DOM. A `window` for pages 3 to 5 still returned all pages; semantics unclear. The renderer offers `renderCanvas` with a `pageOffset` (one page per canvas); that is the intended route and it needs Obsidian to test.

**S9.**
- Format strings accepted by the compiler: `pdf`, `vector`. `pdf-a2b`, `pdf-ua-1`, `pdf-x` and variants are rejected. The compiler contains PDF/A and PDF/UA-1 code (as in Typst's docs), but the typst.ts 0.7.0 API cannot select it.
- Colour: a `cmyk()` fill is written with the CMYK operator (`k`); ICC profile objects are present; no OutputIntent; `DeviceCMYK` name not used. PDF/X is not available.
- Crop marks: a page `foreground` can draw marks; a rendered pixel check at the mark was black. Marks must sit outside the bleed, so the media size must be trim + 2 × (bleed + slug); US-009 currently stops at bleed.

**S10.** Error text for an offline `@preview` import: "failed to load package (... Dummy Registry, please initialize compiler with withPackageRegistry())". A normal compile with fonts and an image opened zero network connections (fetch, net, tls, dns were instrumented).

**S11.** Compile is a blocking WASM call. While a long compile runs, a quick second request in the same worker answers only after the first (10.6 s vs 10.6 s). Stale results must be dropped by request id (US-012 AC-4), or the worker terminated and restarted: 193 ms to the next result (images must then be loaded again).

**S7 (Obsidian, user's run).** "Hello" compiles in 4 ms (83 ms with worker start); main-thread gap 0 ms. The reference document: 62 images (102 MB) read from the vault in 131 ms; compile 9,068 ms in the worker; longest main-thread gap 34 ms; second identical compile 148 ms (gap 22 ms); PDF 99,955 kB. Fetch calls in the worker: 0. Process memory (all of Obsidian) rose from 322 MB to 2,494 MB. The log does not say whether Wi-Fi was off; zero fetch calls is the evidence for offline use.

**S8 (Obsidian, user's run).** Vector compile of the reference: A5 3,655 ms (263 pages), then A4 1,396 ms (177 pages). Page 3 drawn with `renderCanvas` on a 2D context at 2 px/pt: 53 ms (A5), 96 ms (A4); 6.9% and 7.1% non-white pixels; the user confirmed it looks sharp and complete. Process memory after both: 4,298 MB. First attempt drew nothing because the spike passed the canvas element instead of its 2D context and never sized it; `renderCanvas` needs `canvas: ctx` and a canvas sized to page size × pixelPerPt.

## Effect on the stories (proposed; not applied yet)

| Story | Proposed change | Why |
|-------|-----------------|-----|
| US-003 AC-5, US-011 AC-7 | Add `webp` to the supported image types | Typst 0.14.2 renders WebP (S5) |
| US-010 AC-4, AC-5, AC-5b | Replace "decide in the spike" by: coverage from the compiler's `get_font_info`; no library; families found the same way; warnings for missing family and glyph are made by the plugin because the compiler is silent | S4 |
| US-010 | Add: the plugin ships default fonts (a Libertinus Serif / DejaVu Sans Mono set is typst.ts's own default) and lists their licences | S4 |
| US-007 AC-6 | Replace "to be set" by a limit after S7 (Node: about 10 s cold for the naive reference) | S6 |
| US-007 AC-4 | Error message form `"<name>.typ:41:8: error text"` is what the compiler returns | S4 |
| US-007 | Add: PDF/A and PDF/UA cannot be selected through typst.ts 0.7.0 | S9 |
| US-009 / backlog "Print output" | Crop marks need a slug area outside the bleed; PDF/X is not available; PDF/A needs a newer typst.ts or an upstream change | S9 |
| US-012 AC-3, AC-7 | Page count is available from the renderer; per-page canvas rendering to be confirmed in Obsidian | S8 |
| US-012 | Add a preview-only option: downsample images in preview to keep memory and vector size down (new idea, needs your decision) | S6, S8 |

## Risks still open

1. **Memory.** The export of the reference document takes Obsidian to about 2.5 GB; export plus a preview render reached 4.3 GB. It worked on the user's Mac, but this is the main risk. Lever: downsample images in the preview (approved); free the vector data and the worker after a compile.
2. **Distribution.** Obsidian's documented release assets are `main.js`, `manifest.json`, `styles.css`; the docs do not say that other files are installed. A 28 MB WASM (38 MB as base64 inside `main.js`) may need to be embedded or downloaded once on first use. To verify before any release work.
3. **Typst version gap.** PDF standards exist in the bundled Typst 0.14.2 but are unreachable from typst.ts 0.7.0.
4. ~~Main-thread blocking~~ Measured: 34 ms at most (limit 100 ms). Closed.

## Recommendation (preliminary)

**Go with changes.** S7 and S8 passed:
- Use the bundled `typst.ts` compiler in a Web Worker; compile offline; use the compiler's own font coverage instead of a library.
- Ship default fonts in the plugin; read all other fonts from the vault.
- Drop stale results by request id; keep terminate and restart as the escape hatch.
- Treat PDF/A, PDF/UA, and PDF/X as out of the first release (reachable later through a newer typst.ts or a local `typst` CLI route on desktop).
- Decide the distribution of the 28 MB WASM and the preview image strategy before US-007 and US-012 become `Ready`.
- The no-go triggers did not occur. The local `typst` CLI on desktop stays the fallback if memory proves a problem on smaller machines.
- The hash check of `The Rules/` in the ticket's definition of done has no baseline (none was taken before the spike). Nothing in the spike writes there; the spike plugin was run only in its own scratch vault.

## Decisions by the user (2026-10-16)

`webp` is supported; the WASM ships with the plugin; the preview may downsample images; a slug area is added to US-009; `cropWarningPercent` stays 5; the main-thread limit is 100 ms.

## Follow-up tickets implied

1. Default fonts: choose, license, ship (US-010).
2. Packaging of the shipped WASM (inside `main.js` or as an extra release file; check Obsidian's release rules) (US-007).
3. Preview image downsampling (US-012).
4. Story updates listed above.
5. Slug area and crop marks for the "Print output" story.

## How to reproduce

```bash
cd spikes/typst-wasm && npm install
node run-all.mjs                       # S1-S6, S9-S11; S8 via: node --max-old-space-size=8192 s08-preview.mjs
node prepare-scratch-vault.mjs && node obsidian-plugin/build.mjs   # then follow s07-obsidian-procedure.md
```

## Manual runs

- 2026-10-17, procedure M1 (US-007, TICKET-019), plugin build with the embedded compiler in `spikes/typst-wasm/scratch-vault`: `%PDF-`, 2716 bytes, 0.1 s, longest main-thread gap 12 ms (limit 100 ms; includes decoding the embedded WASM). Second command refused, offline run, unload during compile and memory fall-back: all as expected (reported by the user, no numbers recorded). Obsidian version and operating system were not recorded.
- 2026-10-17, procedure M2 (US-008, TICKET-024), scratch vault: all steps 1 to 12 as expected (user's notes in `Test notes.md`); findings: Enter must confirm in dialogs (SCAR-013) and `Delete` must ask first (SCAR-014), both implemented as US-008 AC-17 (TICKET-025). Steps 3 and 10 are to be repeated with build 0.1.0-m3.1.
- 2026-10-17, procedure M3 (US-008 AC-9, 11, 12, 15, US-007 AC-1, AC-6), build `0.1.0-m3.1` (sha256 f7577e81…) in `spikes/typst-wasm/scratch-vault`: all steps as expected (reported by the user). Obsidian version, operating system, export time and folder-dialog platform were not recorded.
- 2026-10-17, M3 follow-up: the user reported afterwards that the PDF of the M3 run had images but no visible text (not asked for by the check). Cause: no fonts shipped, empty font list (SCAR-015). Fixed by bundled default fonts (US-007 AC-13, TICKET-027); M3 to be repeated on build `0.1.0-m3.2`, now with a text check and an open question at the end.
- 2026-10-17, M2 (all steps, incl. AC-17 keyboard and delete confirmation) and M3 (incl. readable text, fonts) repeated on build `0.1.0-m3.2` (sha256 f6e8c6f3…): all steps as expected (reported by the user). Obsidian version and operating system not recorded. US-008 and TICKET-024, 025, 027 set to Done.
- 2026-10-17, M3 (repeated, now with the cover as page 1) and M4 (cover in the PDF, five presets) on build `0.1.0-m4.1` (sha256 69f591fb…c3d71): all steps as expected (reported by the user). Latest macOS, Obsidian 1.14.4. US-011 and TICKET-029 set to Done.
- 2026-10-17, M5 (fonts from the vault, settings tab, glyph check) on build `0.1.0-m5.1` and, after a fix, `0.1.0-m5.2` (sha256 24b0537a…47d27): reported by the user on the latest macOS, Obsidian 1.14.4. First run: steps 2 to 8 as expected; step 1 passed but the font list and the glyph notice appeared only after the settings were reopened (defect, fixed in m5.2: the tab now redraws after a change); `A5 print` showed `FONT_ARCHIVE_IGNORED` and `FONT_FILE_INVALID` because the Defaults still held the font folder of step 1 (by design). Rerun of steps 1 and 2 on m5.2: as expected. US-010, TICKET-030 to TICKET-034 and US-007 AC-7 set to Done.
- 2026-10-17, M2 step 13 (reset icons of the Defaults rows, US-008 AC-18) on builds `0.1.0-m5.3` and `0.1.0-m5.4` (sha256 ce13f209…c63511): reported by the user, Obsidian 1.14.4. First run: the dialogs and values as expected, but the icon sometimes did nothing until the tab was reopened (defect: the icon used the value read when the row was drawn; fixed in m5.4, SCAR-016). Rerun on m5.4: as expected. TICKET-035 Done.
- 2026-10-18, M2 step 14 (page setup in the settings tab and the PDF; US-009 AC-11 to AC-14, US-008 AC-19, AC-20) on builds `0.1.0-m5.5`, `0.1.0-m5.6` and `0.1.0-m5.7` (sha256 59dcb979…1bb1db5d): reported by the user, Obsidian 1.14.4. m5.5: dropdown, gutter and the `Slug 5` PDF as expected; defects: the tab jumped to the top on every redraw, typed widths raised a notice per preset (a lone value), the gutter stood apart from Facing pages. m5.6: the height digit `2` still raised notices (every text field saved on every key; SCAR-017). m5.7: all steps as expected. US-009 and TICKET-036 set to Done.
- 2026-10-18, M2 step 15 (style panel: rows, owner texts, preview pages, page counts, Broken preset, range field, export pause; US-012 AC-1 to AC-15) on build `0.1.0-m6.1` (sha256 3cf9db45…): all checks passed (reported by the user, Obsidian 1.14.4). No defects, no open-question findings. US-012 and TICKET-037 to TICKET-040 set to Done.
- 2026-10-19, M6 (callouts in the PDF and the preview; US-016 AC-1, AC-13 to AC-16) on build `0.2.0-m6.1` (sha256 a8593435…5a43a) in `spikes/typst-wasm/scratch-vault`: passed (reported by the user). First run exported at 12:42 to `~/Desktop` with the active preset `A5 print` instead of `Callouts` (the user's first try was not run as the check describes; no defect): 2 warnings (`banana`, `rule-note`), built-in violet `example` box, no monospace font, no icon, preset `fill` without effect. All as expected for `A5 print`; with `Callouts` active every step passed. Step 2 (the six header shapes as Obsidian draws them), step 7, Obsidian version and operating system were not recorded.
- 2026-10-19, M7 (glossary terms in the PDF and the preview; US-017 AC-4, AC-10 to AC-14) on build `0.3.0-m7.1` (sha256 0d72bd80…a9c3a) in `spikes/typst-wasm/scratch-vault`, preset `Glossary terms`: all steps 1 to 7 passed (reported by the user), Obsidian 1.14.4, macOS 27.0.1 (26A434). No defects, no open-question findings. US-017 and TICKET-048 set to Done.
- 2026-10-20, M8 (folios and running headers; US-019 AC-2, AC-4, AC-5, AC-9 to AC-11) on build `0.4.0-m8.1` (sha256 4360ca03…31b8) in `spikes/typst-wasm/scratch-vault`, presets `Folios` and `Folios single`: all steps 1 to 7 passed (reported by the user), Obsidian 1.14.4, macOS 27.0.1 (26A434). No defects, no open-question findings. US-019 and TICKET-051 set to Done.
- 2026-10-21, M9 (page numbers for internal links; US-018 AC-4, AC-5, AC-7 to AC-9) on build `0.5.0-m9.1` (sha256 14514faa…ec30) in `spikes/typst-wasm/scratch-vault`, presets `PageRefs` and `PageRefs deep`: all steps 1 to 8 passed (reported by the user), Obsidian 1.14.4, macOS 27.0.1 (26A434). No defects, no open-question findings. US-018 and TICKET-054 set to Done.
- 2026-10-21, M10 (ribbon and note menus; US-020 AC-3, AC-5 to AC-10) on build `0.6.0-m10.1` (sha256 bcf31ed6…07ae) in `spikes/typst-wasm/scratch-vault`, active preset `PageRefs`: steps 1 to 5 and 8 to 10 passed; steps 6 and 7 first showed the preview only after `Refresh` — the specified US-012 AC-4 behaviour, which US-020 AC-8 had missed; the user decided to keep it, the steps were rewritten and passed on the same build (reported by the user). Obsidian 1.14.4, macOS 27.0.1 (26A434). No code defect. US-020 and TICKET-057 set to Done.
- 2026-10-21, M11 (preset groups and the details pop-up; US-021 AC-3 to AC-11) in `spikes/typst-wasm/scratch-vault`, seven presets grouped (`Print`, `print`, `Screen`), active preset `Folios`: on build `0.7.0-m11.1` (sha256 06ba6440…e14a) steps 1, 2 and 4 to 11 passed, step 3 found the panel's preset dropdown empty after a restart (the preset store did not announce its load; a gap since US-012); fixed, build `0.7.0-m11.2` (sha256 67c69c98…c3a9): steps 1 to 4 passed, step 3 across a restart and a presets-folder change (reported by the user). Obsidian 1.14.4, macOS 27.0.1 (26A434). US-021 and TICKET-061 set to Done.
- 2026-10-22, M12 (heading and image menus that change the active preset; US-022 AC-1, AC-3, AC-5 to AC-12) on build `0.8.0-m12.1` (sha256 057a331a…944b) in `spikes/typst-wasm/scratch-vault`, active preset `Folios`, fixtures `Menus.md` and `Menus/m12-broken.png`: all steps 1 to 14 passed (reported by the user), Obsidian 1.14.4, macOS 27.0.1 (26A434). Step 3 (AC-11): a right-click does not move the cursor — on line 1 with the cursor on line 3 no US-022 item appeared (reported by the user); the items follow the cursor line, as specified. After the run `Folios.md` differed from the backup (`m12-state-backup`): it held `cover.mode: file`, `cover.file: Layouting/Cover/wide.png` and `headingRules: Glossar: glossary` (file time 11:08:54), not S0 as steps 10 and 13 leave it; `data.json` unchanged (checksum OK). Restored from the backup on the user's request (2026-10-22; `shasum -a 256 -c`: `Folios.md` OK, `data.json` OK).
- 2026-10-22, M13 (a template that styles the document: A5 MU Print; US-023 AC-1, AC-3, AC-5, AC-7, AC-11) on build `0.9.0-m13.1` (sha256 cdbc3da5…f83f) in `spikes/typst-wasm/scratch-vault`, note `MU check.md`: all steps 1 to 7 passed as instructed (reported by the user), Obsidian 1.14.4, macOS 27.0.1 (26A434). Finding (step 7): the parchment fade has visible seams (a screenshot: hard vertical edges where the side strips meet the top band). Cause, reproduced from the same PDF at 1300 px: the template draws four opaque gradient strips that overlap, and the strip drawn last covers the others. A variant with each strip fading from the edge colour to transparent was measured (smooth, no seams; the other colours unchanged) and applied on the user's directive the same day (template, test fixture, US-023 AC-8); step 2 re-checked from the compiled PDF of the vault's files, both pages rendered at three times their size. After the run: the preset note equals `m13-state-backup/handover/` (checksum OK); `data.json` changed by the check itself (active preset `A5 MU Print`, its export folder `m13-export`); the warnings note shows the last export (the four font warnings).
- 2026-10-28, M14 (the sample vault in the exports; US-024 AC-8, US-007 AC-6, US-011, US-017 AC-13, US-018 AC-9, US-019 AC-11) on build `0.9.1-m14.1` (sha256 cdbc3da5…f83f, the `main.js` of release 0.9.1) in `spikes/typst-wasm/scratch-vault`, note `Sample/Book.md`, presets `A5 print`, `Glossary terms`, `Folios`, `PageRefs`, Obsidian 1.14.4, macOS 27.0.1 (26A434): steps 1 to 4 passed (the user's report "M14 passed"); step 5 (anything odd): nothing reported. Afterwards `data.json` restored to the state as handed over (active preset and remembered export folders had changed; checksums OK); the four presets unchanged; the exports stay in `spikes/typst-wasm/m14-export/1` to `4`.
- 2026-10-28, M15 (page breaks by heading level; US-025 AC-2, AC-5 to AC-7, AC-10) on build `0.10.0-m15.1` (sha256 a5c96785…77f7) in `spikes/typst-wasm/scratch-vault`, note `Sample/Book.md`, preset `Breaks` (`h1: right`, `h2: page`), Obsidian 1.14.4, macOS 27.0.1 (26A434): steps 1 to 6 passed (the user's report "M15 passed"); step 7 (anything odd): nothing reported. Checked by program afterwards: the export has 435 pages, the blank pages 2, 52, 116, 230, 358 with their folio and no header, page 4 starting with `1.1 Cras Ac`; its warnings note has 149 entries, not the 148 the text named — the M14 exports have the same 149 (a `FONT_GLYPH_MISSING` for the task box U+2610): the count in M8, M9, M14 and M15 had been measured without the font catalog and was corrected. `data.json` differs from the handover state only by the check's own effects (active preset `Breaks`, a remembered export folder for it); Obsidian was running, so it was not written. `Breaks.md` and every other preset note unchanged (checksums OK); the export stays in `spikes/typst-wasm/m15-export/1`.
- 2026-10-29, M16 (book parts and signatures; US-026 AC-3 to AC-6, AC-9, AC-10) on build `0.10.0-m16.1` (sha256 77c39c19…3a8a) in `spikes/typst-wasm/scratch-vault`, note `Sample/Book.md`, preset `Book parts` (signature 8, roman front matter, first chapter left, `Senectus Netus` colophon, `Pretium Fames` back notes), Obsidian 1.14.4, macOS 27.0.1 (26A434): steps 1 to 7 passed (the user's report "all m16 tests pass"). Checked by program afterwards: `m16-export/1/Book.pdf` has 424 pages (53 × 8); p. 1 cover, p. 2 empty, p. 3 colophon `iii`, p. 4 `1 Mollit` with `1`, pp. 422 and 423 folio only (`419`, `420`), p. 424 the back notes (`421`); the warnings note counts 149 (80, 64, 2, 1, 1, 1), no `BOOK_PART`. Preset notes, `Sample/` and the installed build equal `m16-state-backup/handover/` (checksums OK); `data.json` not compared or written while Obsidian runs.
- 2026-10-29, M17 (table of contents; US-027 AC-2 to AC-8) on build `0.10.0-m17.1` (sha256 d9216acc…7fe26540) in `spikes/typst-wasm/scratch-vault`, note `Sample/Book.md`, preset `Contents` (the `Book parts` settings and `toc: depth: 2`), Obsidian 1.14.4, macOS 27.0.1 (26A434): steps 1 to 9 passed (the user's report "M17 passed"). Step 8 was checked by the user in another way (no export file on disk; the user's answer "Checked otherwise"). After the steps the user tried the menu items again (`Contents.md` placed after `Praesent`, `Senectus Netus: glossary`; the user's answer "I did it myself"); `Contents.md` and `data.json` restored from `m17-state-backup/handover/` with Obsidian closed (93 files, checksums OK).
- 2026-10-29, M18 (images that stay with their text; US-028 AC-4 to AC-6, AC-9, AC-11, AC-13) on build `0.10.0-m18.1` (sha256 787b899c…f61495ac) in `spikes/typst-wasm/scratch-vault`, notes `Sample/Book.md` and `Image fit check.md`, presets `Image fit` and `Image fit single` (the `Contents` settings with `images.minScale: 70`, the second single-sided), Obsidian 1.14.4, macOS 27.0.1 (26A434): steps 1 to 7 passed (the user's report "all checks pass"). Exports on disk: `m18-export/1` (`Book.pdf`, `export-warnings.md` with 4 `IMAGE_FLOATED`, no `IMAGE_MOVED`), `m18-export/2` (`Image fit check.pdf`, 1 `IMAGE_FLOATED` at line 41, 2 `IMAGE_MOVED`). Compared with `m18-state-backup/handover/` (96 files): only `data.json` differs (active preset `Image fit`, the two export folders remembered; strict mode off, no image value in the Defaults, as handed over); restored from `handover/` with Obsidian closed (96 files, checksums OK).
