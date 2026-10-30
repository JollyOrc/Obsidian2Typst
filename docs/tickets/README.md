# Tickets

> **Archive (since 2026-10-30).** Tickets now live in
> [GitHub Issues](https://github.com/JollyOrc/Obsidian2Typst/issues), which
> are the source of truth. TICKET-001 to TICKET-097 below were migrated as
> closed issues #1 to #97 (label
> [`ticket`](https://github.com/JollyOrc/Obsidian2Typst/issues?q=label%3Aticket)),
> and the backlog topics of `docs/user-stories/README.md` as open issues
> (label
> [`backlog`](https://github.com/JollyOrc/Obsidian2Typst/issues?q=label%3Abacklog)).
> The files in this folder are kept as a read-only archive and are not
> updated. New tickets are created with the ticket issue form.

Work items derived from user stories. Each ticket is a single, implementable
unit of work — small enough to complete in one session, large enough to be
meaningful.

Each ticket lives in its own file: `TICKET-NNN-short-title.md`.
Update the index table below whenever a ticket is added or its status changes.

---

## Index

| ID | Title | User Story | Status |
|----|-------|------------|--------|
| [TICKET-001](TICKET-001-typst-wasm-spike.md) | Spike: can a bundled WASM Typst compiler do the job inside Obsidian? | [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) | Done |
| [TICKET-002](TICKET-002-page-setup-core.md) | Page setup core: geometry, validation, and `#set page` output | [US-009](../user-stories/US-009-page-setup.md) | Done |
| [TICKET-003](TICKET-003-build-and-lint.md) | Quality gate: `build` and `lint` scripts | — | Done |
| [TICKET-004](TICKET-004-escape-markup.md) | `escapeMarkup`: escape literal text for Typst markup | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |
| [TICKET-005](TICKET-005-typst-string-literal.md) | `typstString`: write a value as a Typst string literal | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |
| [TICKET-006](TICKET-006-raw-code-emission.md) | `rawInline` and `rawBlock`: emit code exactly | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |
| [TICKET-007](TICKET-007-escaping-roundtrip-harness.md) | Round-trip harness: escaped output must compile and read back unchanged | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |
| [TICKET-008](TICKET-008-markdown-parser-spike.md) | Markdown parser spike and decision | [US-014](../user-stories/US-014-markdown-parsing.md) | Done |
| [TICKET-013](TICKET-013-block-emitter.md) | Block emitter `emitBlocks`: paragraphs, lists, quotes, code, rules, HTML blocks, comments | [US-001](../user-stories/US-001-convert-markdown-to-typst.md) | Done |
| [TICKET-014](TICKET-014-headings-and-labels.md) | Headings: slug, heading index, heading emitter, numbering rule | [US-002](../user-stories/US-002-headings-and-structure.md) | Done |
| [TICKET-015](TICKET-015-links-and-references.md) | Links: resolver, link, wikilink and note-embed emitters | [US-004](../user-stories/US-004-links-and-references.md) | Done |
| [TICKET-016](TICKET-016-tables-footnotes-tasklists.md) | Tables, footnotes and task lists | [US-005](../user-stories/US-005-tables-footnotes-tasklists.md) | Done |
| [TICKET-017](TICKET-017-images-and-assets.md) | Images and assets: resolver, image emitter, fit-image, asset copy | [US-003](../user-stories/US-003-images-and-assets.md) | Done |
| [TICKET-018](TICKET-018-warning-report-and-strict-mode.md) | Warning report, notices and strict mode | [US-006](../user-stories/US-006-warnings-and-strict-mode.md) | Done |
| [TICKET-019](TICKET-019-in-plugin-compilation.md) | In-plugin compilation: compile service, export run, packaging | [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) | Done |
| [TICKET-020](TICKET-020-conversion-pipeline.md) | Conversion pipeline `convert`: preamble registry, asset first pass, line map | [US-015](../user-stories/US-015-conversion-pipeline.md) | Done |
| [TICKET-021](TICKET-021-presets-core.md) | Presets core: schema, YAML parsing, merge, effective settings, names, numbering | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-022](TICKET-022-preset-store-and-plugin-data.md) | Preset store, plugin data and the Obsidian vault port | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-023](TICKET-023-template-and-export-command.md) | Template file and the export command | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-024](TICKET-024-settings-tab.md) | Settings tab and the manual checks M2 and M3 | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-025](TICKET-025-dialog-keys-and-delete-confirmation.md) | Enter key in dialogs and confirmation before a preset is deleted | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-026](TICKET-026-test-build-version-and-install.md) | Unique version for every test build and an install script | — | Done |
| [TICKET-027](TICKET-027-default-fonts.md) | Bundled default fonts, so that an export has text | [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) | Done |
| [TICKET-028](TICKET-028-cover-core.md) | Cover core: image sizes, crop share, first-block rule, cover pages, `cover` preset fields | [US-011](../user-stories/US-011-cover.md) | Done |
| [TICKET-029](TICKET-029-cover-conversion-and-export.md) | Cover in the conversion, the export and the PDF | [US-011](../user-stories/US-011-cover.md) | Done |
| [TICKET-030](TICKET-030-fonts-core.md) | Fonts core: settings, catalog, resolution, the four lines | [US-010](../user-stories/US-010-fonts.md) | Done |
| [TICKET-031](TICKET-031-vault-fonts.md) | Fonts from the vault: font info, font set, export seam | [US-010](../user-stories/US-010-fonts.md) | Done |
| [TICKET-032](TICKET-032-glyph-check.md) | Glyph check of the source text | [US-010](../user-stories/US-010-fonts.md) | Done |
| [TICKET-033](TICKET-033-fonts-settings-tab.md) | Fonts section of the settings tab | [US-010](../user-stories/US-010-fonts.md) | Done |
| [TICKET-034](TICKET-034-fonts-pdf-and-m5.md) | Fonts in the PDF and manual check M5 | [US-010](../user-stories/US-010-fonts.md) | Done |
| [TICKET-035](TICKET-035-defaults-reset-confirmation.md) | Reset confirmation on the older Defaults rows | [US-008](../user-stories/US-008-presets-and-settings.md) | Done |
| [TICKET-036](TICKET-036-page-setup-pdf-cover-slug-and-settings.md) | Page setup: facing pages in the PDF, cover with a slug, trim size and gutter in the settings tab | [US-009](../user-stories/US-009-page-setup.md) | Done |
| [TICKET-037](TICKET-037-preview-core-pure-modules.md) | Preview core: page range, canvas plan, image density, status line, value owner | [US-012](../user-stories/US-012-style-preview-panel.md) | Done |
| [TICKET-038](TICKET-038-preview-controller-and-preparation.md) | Shared preparation, preview controller, preview request, settings change event | [US-012](../user-stories/US-012-style-preview-panel.md) | Done |
| [TICKET-039](TICKET-039-vector-compile-renderer-canvas.md) | Vector compile, page renderer, page canvas helper, browser downsampler | [US-012](../user-stories/US-012-style-preview-panel.md) | Done |
| [TICKET-040](TICKET-040-style-panel-view-rows-and-m2-15.md) | Style panel view, shared rows module, command, manual check M2 step 15 | [US-012](../user-stories/US-012-style-preview-panel.md) | Done |
| [TICKET-041](TICKET-041-callout-markers-core.md) | Callout markers core: header, built-in styles, aliases, style resolution | [US-016](../user-stories/US-016-callout-styles.md) | Done |
| [TICKET-042](TICKET-042-callouts-preset-field.md) | Preset field `callouts`: schema, validation, effective settings | [US-016](../user-stories/US-016-callout-styles.md) | Done |
| [TICKET-043](TICKET-043-callout-emission-and-pipeline.md) | Callout emission, preamble rule `callouts`, fonts, icons, warnings | [US-016](../user-stories/US-016-callout-styles.md) | Done |
| [TICKET-044](TICKET-044-template-plugin-names.md) | Template names the plugin defines: `PLUGIN_NAMES`, `TEMPLATE_NAME_TAKEN` | [US-016](../user-stories/US-016-callout-styles.md) | Done |
| [TICKET-045](TICKET-045-callouts-preview-build-and-m6.md) | Callouts in the preview, test build `0.2.0-m6.1`, manual check M6 | [US-016](../user-stories/US-016-callout-styles.md) | Done (2026-10-19) |
| [TICKET-046](TICKET-046-heading-rules-preset-field.md) | Preset field `headingRules`: schema, validation, effective settings, built-in mapping | [US-017](../user-stories/US-017-heading-rules-glossary.md) | Done (2026-10-19) |
| [TICKET-047](TICKET-047-glossary-terms-conversion.md) | Glossary terms in the conversion: sections, terms, emission, rule `glossary`, warnings | [US-017](../user-stories/US-017-heading-rules-glossary.md) | Done (2026-10-19) |
| [TICKET-048](TICKET-048-glossary-preview-build-and-m7.md) | Glossary terms in the preview, test build `0.3.0-m7.1`, manual check M7 | [US-017](../user-stories/US-017-heading-rules-glossary.md) | Done (2026-10-19) |
| [TICKET-049](TICKET-049-page-furniture-fields-and-rows.md) | Page fields `folios`, `runningHeader`, `runningHeaderLevel`: schema, built-ins, effective settings, Defaults rows | [US-019](../user-stories/US-019-folios-and-running-headers.md) | Done (2026-10-20) |
| [TICKET-050](TICKET-050-page-furniture-rule-and-cover.md) | Preamble rule `page-furniture`: folios, running header, cover numbering, helper names | [US-019](../user-stories/US-019-folios-and-running-headers.md) | Done (2026-10-20) |
| [TICKET-051](TICKET-051-folios-preview-build-and-m8.md) | Folios and headers in the preview, test build `0.4.0-m8.1`, manual check M8 | [US-019](../user-stories/US-019-folios-and-running-headers.md) | Done (2026-10-20) |
| [TICKET-052](TICKET-052-link-page-fields-and-rows.md) | Fields `linkPageNumbers`, `linkPageLevel`, `linkPageWord`: parsing, effective settings, Defaults rows, A4 digital | [US-018](../user-stories/US-018-page-numbers-for-internal-links.md) | Done (2026-10-21) |
| [TICKET-053](TICKET-053-page-ref-call-and-rule.md) | The `page-ref` call after internal links and the preamble rule `page-refs` | [US-018](../user-stories/US-018-page-numbers-for-internal-links.md) | Done (2026-10-21) |
| [TICKET-054](TICKET-054-page-refs-preview-build-and-m9.md) | Page numbers in the preview, test build `0.5.0-m9.1`, manual check M9 | [US-018](../user-stories/US-018-page-numbers-for-internal-links.md) | Done (2026-10-21) |
| [TICKET-055](TICKET-055-actions-module.md) | The actions: export a note by path, preview a note, use a preset | [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md) | Done (2026-10-21) |
| [TICKET-056](TICKET-056-ribbon-and-note-menus.md) | The ribbon icon and menu, the file explorer and editor menus | [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md) | Done (2026-10-21) |
| [TICKET-057](TICKET-057-menus-build-and-m10.md) | Test build `0.6.0-m10.1`, manual check M10 (menus in Obsidian) | [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md) | Done (2026-10-21) |
| [TICKET-058](TICKET-058-group-field-and-grouping.md) | The field `group:`, the group of an invalid note, and `groupPresets` | [US-021](../user-stories/US-021-preset-groups-and-details.md) | Done (2026-10-21) |
| [TICKET-059](TICKET-059-grouped-preset-lists.md) | The three preset lists grouped | [US-021](../user-stories/US-021-preset-groups-and-details.md) | Done (2026-10-21) |
| [TICKET-060](TICKET-060-preset-details-popup.md) | The details pop-up of a preset | [US-021](../user-stories/US-021-preset-groups-and-details.md) | Done (2026-10-21) |
| [TICKET-061](TICKET-061-groups-build-and-m11.md) | Test builds `0.7.0-m11.1` and `0.7.0-m11.2`, manual check M11 (groups and details) | [US-021](../user-stories/US-021-preset-groups-and-details.md) | Done (2026-10-21) |
| [TICKET-062](TICKET-062-preset-field-edits.md) | Changing one key of a preset note, and the smallest change | [US-022](../user-stories/US-022-heading-and-image-menus.md) | Done (2026-10-21) |
| [TICKET-063](TICKET-063-line-context.md) | Which line is a heading or holds images (`lineContext`) | [US-022](../user-stories/US-022-heading-and-image-menus.md) | Done (2026-10-22, amended) |
| [TICKET-064](TICKET-064-preset-edit-menus-and-action.md) | The menu items, the question and the write | [US-022](../user-stories/US-022-heading-and-image-menus.md) | Done (2026-10-22) |
| [TICKET-065](TICKET-065-preset-menus-build-and-m12.md) | Test build `0.8.0-m12.1`, manual check M12 (heading and image menus) | [US-022](../user-stories/US-022-heading-and-image-menus.md) | Done (2026-10-22) |
| [TICKET-066](TICKET-066-template-hook-core.md) | The template hook and the warning for top-level rules (core) | [US-023](../user-stories/US-023-templates-that-style-the-document.md) | Done (2026-10-22) |
| [TICKET-067](TICKET-067-template-hook-plugin.md) | The template hook in the export and the preview (plugin) | [US-023](../user-stories/US-023-templates-that-style-the-document.md) | Done (2026-10-22) |
| [TICKET-068](TICKET-068-mu-template-build-and-m13.md) | The MU template, test build `0.9.0-m13.1`, manual check M13 | [US-023](../user-stories/US-023-templates-that-style-the-document.md) | Done (2026-10-22) |
| [TICKET-069](TICKET-069-sample-vault-generator.md) | The sample vault generator and the committed sample vault | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-070](TICKET-070-migrate-real-file-tests.md) | Move the 23 real-file tests to the sample vault | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-071](TICKET-071-neutral-fake-paths.md) | Neutral fake vault paths: `The Rules/` becomes `Sample/` | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-072](TICKET-072-docs-without-the-private-vault.md) | Docs describe the sample vault and quote no rules text | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-073](TICKET-073-sample-vault-for-manual-checks.md) | The sample vault in the scratch vault; manual checks rewritten | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-074](TICKET-074-publish-gate.md) | The publish gate: ignore list, state tests, clean copy, private data | [US-024](../user-stories/US-024-synthetic-public-fixture.md) | Done (2026-10-27) |
| [TICKET-075](TICKET-075-page-breaks-core.md) | Page breaks by heading level (core) | [US-025](../user-stories/US-025-page-breaks-by-heading.md) | Done (2026-10-28) |
| [TICKET-076](TICKET-076-dropdown-rows-and-break-rows.md) | The dropdown row kind and the six break rows (plugin) | [US-025](../user-stories/US-025-page-breaks-by-heading.md) | Done (2026-10-28) |
| [TICKET-077](TICKET-077-page-breaks-build-and-m15.md) | Test build and manual check M15 (page breaks) | [US-025](../user-stories/US-025-page-breaks-by-heading.md) | Done (2026-10-28) |
| [TICKET-078](TICKET-078-book-parts-core.md) | Book parts: the colophon and back-notes rules (core) | [US-026](../user-stories/US-026-book-parts-and-signatures.md) | Done (2026-10-28) |
| [TICKET-079](TICKET-079-book-pages-core.md) | Book pages: front matter, first chapter, signature padding (core) | [US-026](../user-stories/US-026-book-parts-and-signatures.md) | Done (2026-10-28) |
| [TICKET-080](TICKET-080-book-rows.md) | The Book rows (plugin) | [US-026](../user-stories/US-026-book-parts-and-signatures.md) | Done |
| [TICKET-081](TICKET-081-sample-book-parts.md) | The sample vault gets a colophon and back notes | [US-026](../user-stories/US-026-book-parts-and-signatures.md) | Done |
| [TICKET-082](TICKET-082-book-build-and-m16.md) | Test build and manual check M16 (book parts and signatures) | [US-026](../user-stories/US-026-book-parts-and-signatures.md) | Done |
| [TICKET-083](TICKET-083-contents-fields.md) | The contents fields (core) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-084](TICKET-084-contents-lines-and-entries.md) | The contents lines and what they list (core) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-085](TICKET-085-contents-place-and-pages.md) | The place of the contents and their pages (core) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-086](TICKET-086-contents-menu-items.md) | The editor menu items that place the contents (plugin) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-087](TICKET-087-contents-rows.md) | The Contents rows, the details pop-up and the preview (plugin) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-088](TICKET-088-contents-build-and-m17.md) | Test build and manual check M17 (table of contents) | [US-027](../user-stories/US-027-table-of-contents.md) | Done |
| [TICKET-089](TICKET-089-image-fit-field.md) | The field `images.minScale` (core) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-090](TICKET-090-image-fit-lines.md) | The lines written for an image and which images get them (core) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-091](TICKET-091-image-fit-helper.md) | The helper `fit-flow` and its decisions (core) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-092](TICKET-092-image-fit-decisions-read-back.md) | Reading the decisions back; the warnings in export and preview (plugin) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-093](TICKET-093-image-fit-row.md) | The row `Smallest image size` (plugin) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-095](TICKET-095-image-fit-look.md) | The look as today: the probe's space and the full-width figure (defect fix) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-096](TICKET-096-image-fit-floats.md) | Floats with the look as today: the full-width block only where floats are off (defect fix) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-097](TICKET-097-image-fit-own-page.md) | A float never on its probe's page: the room corrected by the float's own height (defect fix) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-094](TICKET-094-image-fit-build-and-m18.md) | Test build and manual check M18 (image fit) | [US-028](../user-stories/US-028-image-fit.md) | Done |
| [TICKET-012](TICKET-012-inline-emitter.md) | Inline emitter `emitInline`: text, marks, breaks, HTML, comments | [US-001](../user-stories/US-001-convert-markdown-to-typst.md) | Done |
| [TICKET-011](TICKET-011-call-separator-and-slash-rule.md) | `callSeparator` and the slash rule of `wrapEmphasis` | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |
| [TICKET-010](TICKET-010-markdown-parser-core.md) | Markdown parser in `core/parse`: tokens to a tree with lines | [US-014](../user-stories/US-014-markdown-parsing.md) | Done |
| [TICKET-009](TICKET-009-emphasis-wrappers.md) | `wrapEmphasis`: emit strong and emphasis safely | [US-013](../user-stories/US-013-typst-safe-output.md) | Done |

**Status values:** `Open` · `In Progress` · `Done` · `Cancelled`

---

## How to add a ticket

1. Copy `_TEMPLATE.md` to `TICKET-NNN-short-title.md`.
2. Link it to the user story and the specific ACs it addresses.
3. Keep scope tight — one ticket, one testable outcome.
4. Add a row to the index table above.
5. Add a matching row to the AC-to-test map in `docs/technical/tests.md`.
6. Back-link the ticket from the user story file's "Related tickets" section.
