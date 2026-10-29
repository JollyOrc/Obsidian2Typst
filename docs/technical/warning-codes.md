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
| `IMAGE_MOVED` | US-028 AC-4, AC-5, AC-6 | an image did not fit after its text even at `images.minScale` and could not float (a right page, a container, the back notes, a page break or nothing after it); it moved to the next page and the space before it stays empty. Read after the compile; strict mode reports it but never stops | active |
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

Not used (decided): `HEADING_DUPLICATE` (repeated titles are numbered silently,
US-002 AC-3) and `LINK_LOCAL_FILE` (links to local files get a footnote,
US-004 AC-9).
