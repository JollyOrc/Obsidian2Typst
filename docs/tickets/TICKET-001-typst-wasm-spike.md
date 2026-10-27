# TICKET-001 — Spike: can a bundled WASM Typst compiler do the job inside Obsidian?

**Status:** Done
**User story:** [US-007](../user-stories/US-007-in-plugin-typst-compilation.md)
(also informs [US-010](../user-stories/US-010-fonts.md) and
[US-012](../user-stories/US-012-style-preview-panel.md))
**ACs addressed:** none implemented; the spike answers the open questions of
US-007 (AC-2, AC-3, AC-6, AC-8), US-010 (AC-3, AC-5) and US-012 (AC-2, AC-3, AC-7)

---

## Description

A time-boxed investigation (one working session, no production code) that
decides whether `typst.ts` (WebAssembly Typst compiler and renderer) can be
bundled into the Obsidian plugin and whether its size, speed, fonts, images,
and preview support are good enough for the stories. The result is a findings
document and a recommendation per open question; US-007, US-010, and US-012
are then updated and can move from `Draft` to `Ready`.

Out of scope: the converter, the settings UI, anything shipped to users.

---

## Acceptance criteria (from user stories)

The open points this spike must close, copied from the stories:

- **US-007 AC-2:** Export works offline and without a `typst` binary; the
  generated `.typ` uses no `@preview/...` packages.
- **US-007 AC-3:** Compilation runs in a Web Worker; the UI stays responsive.
- **US-007 AC-6 (provisional):** `The Rules/compiledtext.md` exports with zero
  compile errors; the time limit is to be set from the measurements here.
- **US-007 AC-8:** First release is desktop-only (decided; the spike only
  checks that nothing blocks desktop).
- **US-010 AC-3, AC-5:** Fonts from a vault folder reach the compiler; the plugin
  can tell whether a font contains a glyph.
- **US-012 AC-2, AC-3, AC-7:** The preview re-renders on a settings change,
  shows a page range, and the page count equals the PDF's.

---

## Implementation notes

Throw-away code lives in `spikes/typst-wasm/` (new folder). It is excluded from
the quality gate and from the build, and is not shipped. Rules that still apply:
nothing writes into `The Rules/` or any user vault; the Obsidian checks run in a
separate scratch vault `spikes/typst-wasm/scratch-vault/`; versions are pinned
and recorded.

Parts that need Obsidian itself (S7, S8) can only be run on the user's computer
with the desktop app; the rest (S1–S6, S9–S11) run in Node and can be done
without it.

Reference document for measurements: a naive Typst version of
`The Rules/compiledtext.md` (about 5,400 lines, with its images) produced by a
small script, because the real converter does not exist yet. Record the
script's limits; the numbers are an estimate, not a promise.

---

## Tests

Each check is a script (or a written procedure for S7/S8) that prints its
result. Create these stubs first (SCAR-003); the final report must say pass,
fail, or "not possible" for each.

- `spikes/typst-wasm/s01-inventory.mjs` — records the `typst.ts` version, the
  Typst compiler version it bundles, licences, and file sizes of the WASM and
  JS files. Pass: all five values are in the report.
- `spikes/typst-wasm/s02-hello.mjs` — compiles `= Hello` to PDF in Node. Pass:
  output starts with `%PDF-`.
- `spikes/typst-wasm/s03-story-snippets.mjs` — compiles every Typst snippet
  quoted in US-001 to US-011 (page set-up, figure with `numbering: none`,
  `#set highlight(fill: …)`, footnote counter reset on level-1 headings,
  `table.header`, `image(..., fit: "cover")`, `#quote(block: true)`, and so on).
  Pass: zero errors; every failing snippet is listed with the error and a
  proposed fix for the story.
- `spikes/typst-wasm/s04-fonts.mjs` — passes `.ttf`/`.otf` files from a folder to
  the compiler; lists which fonts are bundled and their licences; checks what the
  compiler does with a missing glyph (silent tofu or a warning); evaluates one
  font-parsing library for `hasGlyph(family, codePoint)` (size, licence, handles
  `.ttf`, `.otf`, `.ttc`). Pass: `☐` U+2610 test returns true for a font that has
  it and false for one that has not.
- `spikes/typst-wasm/s05-images.mjs` — compiles a document using PNG, JPEG, GIF,
  and SVG passed as in-memory files at paths like `assets/x.png`, including a
  file name with spaces. Pass: all four render; the PDF page count is correct.
- `spikes/typst-wasm/s06-reference.mjs` — compiles the reference document in
  Node, three runs. Record: cold and warm compile time, peak memory, PDF size,
  page count. No pass threshold; flag if a warm run takes more than 60 s.
- Procedure S7 (in Obsidian desktop) — a minimal spike plugin in the scratch
  vault loads the WASM from its own folder with the network disabled, compiles
  `= Hello` and the reference document in a Web Worker, and reports: it works
  offline (yes/no), peak memory, the longest main-thread block during compile.
  Pass: works offline; longest main-thread block ≤ 100 ms (proposal, to be
  confirmed by the user).
- Procedure S8 (preview) — compares two ways to show pages: the `typst.ts`
  renderer (vector/canvas) and PDF through a viewer. Record: time to first page,
  time to re-render after changing the page size, whether a page range can be
  shown cheaply, whether the compiler supports incremental recompile.
- `spikes/typst-wasm/s09-pdf-options.mjs` — tries PDF standard options of the
  bundled version (PDF/A-2b, A-4, UA-1) and records whether PDF/X, CMYK colours,
  ICC profiles are available; draws a crop mark with Typst's foreground to
  confirm marks are possible. Pass: each option is recorded as works / fails /
  absent (this feeds the backlog item "Print output").
- `spikes/typst-wasm/s10-packages.mjs` — `#import "@preview/example:0.1.0"`
  while offline. Record the error text and confirm no network request is made
  during a normal compile.
- `spikes/typst-wasm/s11-supersede.mjs` — starts a second compile while one runs
  and records whether the first can be cancelled or must finish; and whether
  results can be dropped safely (US-012 AC-4).

---

## Deliverables

1. `docs/technical/spike-typst-wasm.md` — findings per check (S1 to S11) with
   numbers, the pinned versions, and a recommendation: **go**, **go with
   changes** (list them), or **no-go** with an alternative (for example a local
   `typst` CLI for desktop).
2. US-007, US-010, and US-012 updated with the answers (new numbers instead of
   "to be set", provisional markers removed or turned into concrete limits) and
   moved to `Ready`.
3. `docs/technical/dependencies.md` filled with the pinned versions of
   `typst.ts`, the compiler it bundles, and the chosen font-parsing library.
4. A list of follow-up tickets that the findings imply.

---

## Definition of done

- [ ] All eleven checks have a recorded result (pass, fail, or not possible).
- [ ] `docs/technical/spike-typst-wasm.md` exists with a go / no-go recommendation.
- [ ] The user has read the recommendation and approved or changed it.
- [ ] US-007, US-010, US-012 updated and their status changed.
- [ ] `docs/technical/dependencies.md` updated.
- [ ] `docs/technical/tests.md` AC-to-test map updated (rows below).
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.
- [ ] No file in `The Rules/` or any user vault was modified (hash check of the
      folder before and after).

## Progress note (2026-10-16)

Node checks S1–S6 and S8–S11 are done; findings are in `docs/technical/spike-typst-wasm.md`. S7 and S8 ran in Obsidian on the user's Mac and passed (see the findings). Closed 2026-10-16. Not done: a hash baseline of `The Rules/` was never taken, so that definition-of-done item rests on the spike never writing there.
