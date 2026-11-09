# Warning codes

Owned by [US-006](../user-stories/US-006-warnings-and-strict-mode.md) and
checked by [US-015](../user-stories/US-015-conversion-pipeline.md) AC-7: every
code that `src/core` can produce is listed here (a test compares the file and
the code). Status `active`: the code is produced by `src/core`; `reserved`: its
story is not implemented yet, the code is not produced, and the story that
implements it flips it to `active`. A warning is `{code, message, line}`; the line is
a line of the source note. Message patterns are examples; the exact texts are
fixed by the story that owns the code.

| Code | Story | When it is reported | Status |
|------|-------|---------------------|--------|
| `HTML_UNSUPPORTED` | US-001 AC-9 | an HTML tag other than `<u>`, `<span>`, `<br>` is dropped (text kept) | active |
| `COMMENT_DROPPED` | US-001 AC-15 | HTML comments were removed; one warning per export with the count and the line of the first | active |
| `HEADING_LEVEL_SKIPPED` | US-002 AC-6 | `Heading level jumps from 1 to 3` | active |
| `HEADING_EMPTY` | US-002 AC-7 | a heading without text is omitted | active |
| `ASSET_MISSING` | US-003 AC-5 | linked file does not exist (placeholder is emitted) | active |
| `ASSET_TYPE_UNSUPPORTED` | US-003 AC-5 | file type is not png, jpg, jpeg, gif, webp, svg | active |
| `ASSET_REMOTE` | US-003 AC-3 | `http(s)` image is not downloaded (placeholder is emitted) | active |
| `ASSET_AMBIGUOUS` | US-003 AC-2c | several vault files have the embed's name; the first is used | active |
| `ASSET_INVALID` | US-003 AC-5b | the file's first bytes do not match its extension, or it is empty (placeholder is emitted) | active |
| `IMAGE_IN_HEADING` | US-003 AC-1d | an image in a heading is placed after the heading | active |
| `IMAGE_FLOATED` | US-028 AC-4, AC-5, AC-8 | an image did not fit after its text even at `images.minScale`; it is placed at the top of the next page and the text after it fills the gap. At the tightest edge the paragraph after it may not fit in the gap either, so the gap can stay (Typst's paragraph breaking; not verified). Read after the compile; strict mode reports it but never stops | active |
| `IMAGE_LOW_DPI` | US-034 AC-1 to AC-4 | a block image (body, entry illustration, cover) prints below `images.minDpi` (built-in 300, 0 = off): its pixel width over its drawn width in inches, at its largest drawn width, once per file; vector images are not checked. Read after every compile (preview and export); strict mode reports it but never stops (decision 1) | active |
| `TEXT_WIDE_GAP` | US-034 AC-5, AC-7, AC-8 | a justified line whose widest word gap is over `entries.maxWordGap` (built-in 200 %; 0 = no scan): `"<where>": "<line>" (<n> %)`, `<where>` the entry whose pages hold it, else `p. <folio>`. Found by the export's word-gap scan of the last PDF, in the worker; never in the preview; strict mode reports it but never stops (decision 1) | active |
| `TEXT_GAP_SCAN_FAILED` | US-034 AC-8 | the word-gap scan could not read the exported PDF (or its worker failed); no line was checked; once per export; the export completes | active |
| `PDF_PAGE_LAYOUT_FAILED` | US-037 AC-9 | an export with facing pages could not add `/PageLayout /TwoPageRight` to the PDF, because it is not in the form Typst 0.14.2 writes: `The PDF could not be set to open as spreads (<reason>); it is written as compiled`, `<reason>` one of `no startxref`, `no xref table`, `no trailer`, `no catalog`, `encrypted`, `already updated`. No source line; once per export; the export completes, also in strict mode | active |
| `DETAIL_YAML_INVALID` | US-038 AC-2 | `"Reed Weaving"`: the YAML of an `o2t-details` block does not parse or is not a mapping; no row (at the block's first line) | active |
| `DETAIL_ORPHAN_BLOCK` | US-038 AC-3 | `o2t-details block not directly under a heading; not read and not printed` | active |
| `DETAIL_BLOCK_TWICE` | US-038 AC-3 | `"Reed Weaving"`: a second `o2t-details` block under one heading (the first counts) | active |
| `DETAIL_BLOCK_IN_CONTAINER` | US-038 AC-3 | `o2t-details block inside a quote or callout; not read and not printed` (any depth) | active |
| `DETAIL_IN_GLOSSARY` | US-038 AC-3 | `"Reed"`: an `o2t-details` block under a glossary term or inside a term is not read and not printed (at the block's line) | active |
| `DETAIL_BLOCK_WITH_ENTRY` | US-038 AC-3 | `"Fen Hare"`: the heading also has an `o2t-entry` block; the entry is read, the details block is dropped (at the block's line) | active |
| `DETAIL_VALUE_NOT_TEXT` | US-038 AC-4 | `"Reed Weaving": kind`: the value of a key an item names is a list or a map; left out, once per key | active |
| `DETAIL_VALUE_UNMAPPED` | US-038 AC-4 | `"Reed Weaving": pace: soon`: the value is not in the item's `labels` or `icons` (and the item has no single `label` or `icon`); printed as written, once per item | active |
| `ENCOUNTER_SHEET_EMPTY` | US-036 AC-2 | `entries.encounterSheet` or `.encounterSheetFile` is on but the preset has neither `entries.statblock.track` nor `.boxes`; no sheet is made; once per export | active |
| `ENCOUNTER_SHEET_SMALL_BOXES` | US-036 AC-3 (decision 2) | the sheet's box column is too narrow for 2.0 mm boxes, so they shrink: `"<form>": <size> mm (min 2.0)`, once per form (`book`, `A4`); read after the compile | active |
| `ENCOUNTER_SHEET_FAILED` | US-036 AC-5 | the A4 encounter sheet did not compile (its Typst error follows); its `.typ` is written, its `.pdf` is not; the book's files are written as usual; never stops an export | active |
| `IMAGE_MOVED` | US-028 AC-4, AC-5, AC-6 | an image did not fit after its text even at `images.minScale` and could not float (a right page, a container, the back notes, a page break or nothing after it); it moved to the next page and the space before it stays empty. Read after the compile; strict mode reports it but never stops | active |
| `LAYOUT_NOT_SETTLED` | US-028 AC-14, AC-16 | Typst reported that the layout did not converge (`layout did not converge within 5 attempts`) in the export's last compile, or in the preview's one compile (decision C); page numbers, running headers and image places may be wrong. No source line. Read after the compile; strict mode reports it but never stops | active |
| `IMAGE_FIT_OFF` | US-028 AC-16 | the export's compiles with image fit did not settle the layout (8 compiles, or a pinned compile that could not change), so the note was converted again with `images.minScale: 100` and exported without image fit. No source line. Strict mode reports it but never stops | active |
| `LINK_UNRESOLVED` | US-004 AC-4, AC-8 | no heading matches the wikilink, file link, or anchor | active |
| `LINK_AMBIGUOUS` | US-004 AC-2, AC-8 | several headings match; the first is used | active |
| `LINK_URL_NOT_SPELLED` | US-004 AC-6 | an external link inside a heading gets no footnote | active |
| `EMBED_NOTE_UNEXPANDED` | US-004 AC-7 | `![[Note]]` of a note is not expanded | active |
| `TABLE_ROW_LONG` | US-005 AC-3 | a row has more cells than the header; extra cells are cut | active |
| `FOOTNOTE_UNDEFINED` | US-005 AC-4 | a reference without definition | active |
| `FOOTNOTE_UNUSED` | US-005 AC-4 | a definition that is never referenced, or a later definition of a label that is already defined | active |
| `FOOTNOTE_UNCLOSED` | US-005 AC-4c | an unclosed `^[` is kept as literal text | active |
| `FOOTNOTE_NESTED` | US-005 AC-4d | a footnote reference inside footnote text is omitted | active |
| `FONT_MISSING` | US-010 AC-4 | a configured font family is not available (the default family or the bundled font is used) | active |
| `FONT_FOLDER_MISSING` | US-010 AC-3 | the font folder of the preset does not exist | active |
| `FONT_ARCHIVE_IGNORED` | US-010 AC-3 | a zip file in the font folder is not read; unzip it first | active |
| `FONT_FILE_INVALID` | US-010 AC-3 | a `.ttf` or `.otf` file in the font folder cannot be read as a font | active |
| `FONT_GLYPH_MISSING` | US-005 AC-6, US-010 AC-5 | the body font lacks glyphs (task-list glyphs, or body characters) | active |
| `TEMPLATE_MISSING` | US-008 AC-11 | the selected template file does not exist | active |
| `TEMPLATE_SHADOWS_BUILTIN` | US-008 AC-10 | the template redefines a Typst built-in | active |
| `COVER_MISSING` | US-011 AC-7 | the chosen cover file does not exist | active |
| `COVER_TYPE_UNSUPPORTED` | US-011 AC-7 | the cover file type is not supported | active |
| `COVER_CROPPED` | US-011 AC-6 | share of the cover image that is cropped | active |
| `COVER_BACK_UNSUPPORTED` | US-011 AC-10 | `cover.back` is set but not supported yet | active |
| `NODE_UNSUPPORTED` | US-015 AC-12 | a tree node without an emitter reached the output; its text is kept | active |
| `CALLOUT_TYPE_UNKNOWN` | US-016 AC-10 | `No style for callout type "banana"; the default box is used` (one per callout, at the header line) | active |
| `CALLOUT_ICON_MISSING` | US-016 AC-13 | `Icon "…" of callout style "example" was not found` / `is not an image`; the box is drawn without it (once per used style, line 0) | active |
| `TEMPLATE_NAME_TAKEN` | US-016 AC-11 | `Template line 3 defines "callout", which the plugin also defines; the plugin's definition is used` (`fit-image`, `callout`, `callout-styles`, `glossary-term` of US-017 AC-6; line 0) | active |
| `TEMPLATE_RULE_IGNORED` | US-023 AC-5 | `Template rule at line 12 does not apply; put it inside template(doc)`: a `#set` or `#show` at the start of a template line, which never applies through the import (line 0). A rule at line start inside a content block (`#let template(doc) = [` … `]`) is reported too, although it applies (decision 1); the form `{ set …; doc }` is not | active |
| `HEADING_RULE_NO_TERMS` | US-017 AC-9 | `Heading "Glossary" has the rule glossary but no headings one level below it; nothing was changed` (at the heading's line) | active |
| `BOOK_PART_JOINED` | US-026 AC-8 | `The colophon section "Impressum" is joined to the colophon above` (or `The back-notes section "Notes" is joined to the back notes above`), at the joined heading's line: a second part of one kind is added after the first | active |
| `BOOK_PART_EMPTY` | US-026 AC-8 | `The colophon section "Colophon" is empty and is left out` (or the back-notes form), at the heading's line: a part with a hidden heading and no blocks is not written; links to it are unresolved | active |
| `TOC_HEADING_MISSING` | US-027 AC-5 | `The table of contents heading "Rules" is not in the note; the contents are at the default place` (line 0): the picked heading (`toc.heading`) is no top-level H1 of the body; the contents go before the first chapter | active |
| `HEADING_IN_TERM` | US-017 AC-14 | `Heading "Deep" is inside the glossary term "Gambit"; it is printed without number and outline entry` (at the heading's line) | active |
| `ENTRY_YAML_INVALID` | US-030 AC-3 | `"Fen Hare"`: an `o2t-entry` block whose YAML does not parse or is not a mapping (at the block's first line); the entry is laid out as ordinary text, no statblock | active |
| `ENTRY_ORPHAN_BLOCK` | US-030 AC-4 | `o2t-entry block not directly under a heading; not read and not printed` (text between it and the heading above, or no heading above) | active |
| `ENTRY_BLOCK_TWICE` | US-030 AC-4 | `"Fen Hare"`: a second `o2t-entry` block right under one heading; the first counts, the second is not printed | active |
| `ENTRY_BLOCK_IN_CONTAINER` | US-030 AC-4 | `o2t-entry block inside a quote or callout; not read and not printed` (any depth) | active |
| `ENTRY_VALUE_NOT_TEXT` | US-030 AC-5 | `"Fen Hare": attacks`: a value of a key the preset uses has the wrong shape (a map, a boolean, a list for a single value); it is left out (in a list: the wrong items) | active |
| `ENTRY_IN_GLOSSARY` | US-030 AC-21 | `"Fen Hare"`: an `o2t-entry` block under a glossary term is not read as an entry and not printed (at the block's line; decision 3) | active |
| `ENTRY_TRACK_UNKNOWN` | US-030 AC-13 | `"Fen Hare": Lost`: a label of the block's track key is not in `entries.statblock.track`; that cell is left out | active |
| `ENTRY_NO_LEDE` | US-030 AC-16 | `"Fen Hare": starts with list`: the entry's first block is not a plain paragraph (list, image, callout, quote, heading, table, code); it starts beside the statblock | active |
| `ENTRY_LEDE_SHORT` | US-030 AC-16 | `"Fen Hare": 9 words`: the opening paragraph has fewer than 10 words; it is used as normal | active |
| `STAT_BOXES_MANY` | US-030 AC-12 | `"Fen Hare": 46`: the box value is over 45; it is printed, no boxes are drawn | active |
| `STAT_BOXES_NOT_NUMBER` | US-030 AC-12 | `"Fen Hare"`: the box value is not a whole number from 0 (`varies`, `2d6`, `-3`, `2.5`); printed as written, no boxes | active |
| `TAG_UNMAPPED` | US-030 AC-14 | `"Fen Hare": rare`: a tag has no label in a non-empty `entries.tagLabels`; it is not printed (no warning when the map is empty) | active |
| `STAT_SUM_MISMATCH` | US-030 AC-18 | `"Fen Hare": 20 ≠ 4+8+3`: with `entries.statblock.sum`, the total differs from the sum of its parts (skipped when a value is not a number) | active |
| `STAT_ATTACK_NO_DICE` | US-030 AC-18 | `"Fen Hare": "Glare: frightens"`: an attack holds no `NdM` dice pool | active |
| `ENTRY_OUTSIDE_CHAPTER` | US-031 AC-2 | `"Fen Hare"`: an entry outside every entries chapter (`headingRules` rule `entries`); it keeps its heading, statblock and body, no page or spread of its own (at the block's line) | active |
| `ENTRY_NESTED_LAYOUT` | US-031 AC-1 | `"Fen Kit": page-text`: a nested entry asks for a layout other than `auto`; it stays inline in its parent (decision 3) | active |
| `ENTRY_LAYOUT_UNKNOWN` | US-031 AC-3 | `"Fen Hare: sideways"`: the block's `layout` is not one of the seven layouts or `auto`; treated as `auto` | active |
| `ENTRY_LAYOUT_CONFLICT` | US-031 AC-4, US-032 AC-11 | `"Bog Wight": full-image → page-text (no illustration)`: the layout needs an illustration that is missing or has the other orientation; the automatic choice is used. Read after the compile from the entry's facts | active |
| `ENTRY_AUTO` | US-032 AC-2 | `"Marsh Owl": page-landscape`: the layout chosen for `layout: auto` (copy it into the note to fix it). Read after the compile | active |
| `ENTRY_OVERFLOW` | US-032 AC-5, AC-7 | `"Cave Wyrm": spread-landscape, about 6 lines over` (with `(partner "Marsh Owl" moved)`): the entry runs on past its layout's pages even at `entries.image.minScale`. Read after the compile from the real positions | active |
| `ENTRY_SPREAD_EMPTY` | US-032 AC-9 | `"Dragonet": spread-text, right page 85 % empty – consider an illustration or trimming`: a spread's right page leaves at least `entries.emptyWarn` % unused (not `full-image`; 0 = off). Read after the compile | active |
| `ENTRY_UNPAIRED` | US-031 AC-10, US-033 AC-3 | `"Reed Cat"`: a page entry on a left page whose right page stays blank (no partner, no section opener there); not for the chapter's last entry. Read after the compile | active |
| `ENTRY_BLANK_PAGE` | US-031 AC-5, US-033 AC-3 | `"Horrors"`: a section opener could not reuse a free right page; the left page before it shows the folio only. Read after the compile | active |
| `SECTION_INTRO_OVERFLOW` | US-033 AC-4 | `"Horrors"`: a section's intro runs on past its opener page; the first entry starts on the next left page after it. Read after the compile | active |

Not used (decided): `HEADING_DUPLICATE` (repeated titles are numbered silently,
US-002 AC-3) and `LINK_LOCAL_FILE` (links to local files get a footnote,
US-004 AC-9).
