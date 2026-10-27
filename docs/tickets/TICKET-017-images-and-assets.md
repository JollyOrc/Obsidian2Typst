# TICKET-017 — Images and assets

**Status:** Done
**User story:** [US-003](../user-stories/US-003-images-and-assets.md)
**ACs addressed:** AC-1, AC-1b, AC-1c, AC-1d, AC-2, AC-2b, AC-2c, AC-3, AC-4, AC-4b, AC-5, AC-5b, AC-6, AC-7, AC-8
**Depends on:** TICKET-012 (`emitInline`), TICKET-013 (`emitBlocks`), TICKET-014 (headings), TICKET-015 (links), TICKET-016 (tables, footnotes)

---

## Description

Convert images (`![alt](path)` and `![[file|…]]`) into `#fit-image(...)`, `#image(...)` and `#figure(...)`, resolve and validate asset files through an injected `AssetResolver`, and copy the used assets into the export folder. Warnings: `ASSET_MISSING`, `ASSET_TYPE_UNSUPPORTED`, `ASSET_INVALID`, `ASSET_REMOTE`, `ASSET_AMBIGUOUS`, `IMAGE_IN_HEADING`.

---

## Acceptance criteria (from user story)

See US-003 (exact examples are in the story and the tests). Decided by the user on 2026-10-17: an image in a heading is placed as a figure after the heading with `IMAGE_IN_HEADING`; file content is checked by its first bytes (mismatch gives the placeholder and `ASSET_INVALID`); a standard image path is looked up exactly, embeds by file name; no `ASSET_AMBIGUOUS` when the note's own folder decides.

---

## Implementation notes

- **`src/core/assets`** (pure): `AssetResolver`, `AssetRequest`, `AssetResult`, `AssetUse`, `createAssetResolver({notePath, files})`, `sniffImage`, `extensionOf`, `SUPPORTED_IMAGE_EXTENSIONS`. Destinations per AC-4 / AC-4b; `uses()` returns each `{from, to}` once, in order.
- **`src/core/emit`:** image emitter inside `emitInline` (block-level item; a paragraph is split at each image; marks that contain an image use the function form); `FIT_IMAGE_HELPER` export; `assets` option in `InlineOptions` and `BlockOptions`; heading handling in `blocks.ts` (`IMAGE_IN_HEADING`); a link around an image is `#link("url")[#fit-image(...)]` without a footnote. Without a resolver the old fallback stays.
- **`src/plugin/copy-assets.ts`:** `copyAssets(uses, fs, exportDir)` with `AssetFs {read, write}`; returns `{copied}`.
- **`tests/support/typst-node.ts`:** `diagnose` and `plainText` accept `files` (virtual file system for `image()`).

---

## Tests

- `tests/unit/us-003-images.test.ts` — exact strings and warnings for every example of the ACs
- `tests/unit/us-003-asset-resolver.test.ts` — sniffing, extensions, destinations, collisions, embeds, uses
- `tests/plugin/us-003-asset-copy.test.ts` — copying against a fake file system
- `tests/integration/us-003-fit-image.test.ts` — measured sizes of the helper against the compiler
- `tests/integration/us-003-images-roundtrip.test.ts` — every image form × container, placeholders, the real file (64 images, 62 files)

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `core/assets`: `createAssetResolver` (exact path for images, file-name lookup for embeds, note folder first, NFC and case-sensitive), `sniffImage`, `extensionOf`, `SUPPORTED_IMAGE_EXTENSIONS`, the `AssetResolver` types.
- `core/emit/image.ts`: `emitImage` and `FIT_IMAGE_HELPER`; `emitInline` got an `assets` option and an item kind `block` (a paragraph is split at an image, marks around an image use the function form, a link around an image keeps its image without an address footnote); `emitBlocks` places the images of a heading after it (`IMAGE_IN_HEADING`) and indexes headings with `{dropImages: true}` so that the label does not contain the alt text.
- `plugin/copy-assets.ts`: `copyAssets` and `AssetFs`.
- Measured on the real file: 64 images, 62 files to copy, 17 captions, no `ASSET_*` warning; the whole document compiles with stand-in images of the same names.
- Measured with the compiler: the helper gives 160 pt for 1000x500 px, 39 pt for 300x2000 px (height-limited), 100 pt for 100x50 px (not enlarged), 154.5 pt inside a list item, 150 pt in a one-column table cell, 160 pt in a figure.
- `file:` addresses never reach the emitter: markdown-it does not make an image of them, so the text stays as written; `data:` and `ftp:` do and are reported as `ASSET_REMOTE`.
- Mutation check U1 to U24, I1 to I16, N41 to N50, B1 to B7, H1 to H3, C1 and C2 (61 mutants): all caught after tests were added for U2, U15, U19, U21, I6, I15, H2, C1, C2.
- Left for other stories: the preamble that contains `FIT_IMAGE_HELPER` (US-015), image placement rules (backlog), the plugin's vault file system and the list of vault files (US-012 and the export flow).
