# US-029 — A settings screen of feature rows, and marked menu items

**Status:** Done (2026-10-31; M19 passed with one accepted variance, AC-7)
**Introduced:** v0.11.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.11.0 (test build `0.11.0-m19.1`, M19 passed 2026-10-31)
**Supersedes:** — (changes the layout of US-008's settings tab, US-012's style
panel and US-021's preset rows; changes the menu titles of US-020, US-022 and
US-027)

---

## Story

**As an** author who sets up print layouts,
**I want** the settings tab and the style panel arranged as a short list of
features — each with a switch where it can be turned on or off, and a button
that opens its detail settings — and every menu item of the plugin marked as
the plugin's,
**so that** I find a setting by what it does, see at a glance what is on, and
can tell the plugin's menu items from Obsidian's and other plugins'.

Directive of the user (2026-10-31): a settings screen like the one of
[`JollyOrc/obsidian-webpage-export`](https://github.com/JollyOrc/obsidian-webpage-export)
— toggles for broad functionality or setting groups, extra screens for
specific settings, combined as needed (an extra screen may exist without a
toggle) — and every context-menu item prefixed with an icon or `O2T`.
Decided at G0 (`docs/state/00_governance.md`, 2026-10-31): (1) the prefix
`O2T: `, action icons kept; (2) the settings tab and the style panel get the
new layout, the details pop-up stays a table ordered by the same groups; (3)
a toggle shows the effective value, toggles only over real boolean fields,
Contents, Image fit and Signatures get a gear only; (4) a preset row keeps
`Use` plus a gear that opens the preset's screen.

The reference (read 2026-10-31, its `src/plugin/settings/settings.ts` and
`settings-components.ts`): sections are `<details>` elements whose `<summary>`
is a heading row with a `chevron-right` icon; a feature row is a `Setting`
with name, description, a toggle (left out when the feature is always on) and
an extra button with the icon `settings` that opens a `Modal` titled with the
feature's name and holding its fields; when a feature has no fields the
button is kept invisible so that the toggles line up.

Today (read from the code, 2026-10-31):
- Settings tab (`settings-tab.ts`): the version line, then four headings —
  `Presets` (a row per preset with `Use`, `Details`, `Duplicate`, `Rename`,
  `Delete`, grouped by US-021; `New preset`), `Defaults` (every row of
  `DEFAULT_ROWS`, 37 rows), `Fonts` (every row of `FONT_ROWS`, 10 rows),
  `Folders and warnings` (`Presets folder`, `Strict mode`, `Warnings note
  folder`).
- Style panel (`preview/panel.ts`): the preset dropdown with the `info`
  button, then `Page` (every row of `DEFAULT_ROWS`), `Fonts` (every row of
  `FONT_ROWS`), `Cover` (four read-only rows), the preview.
- Rows are drawn by `addDefaultRows` and `addFontRows` (`settings/rows.ts`)
  for both screens; a row owned by the active preset is disabled with the
  text of `ownerNote` and has no reset icon (US-012 AC-2).
- **A defect found at G0:** a toggle row shows `current === true`
  (`rows.ts:323`), so a field the Defaults leave unset shows *off* even
  where the built-in value is *on*. Affected today: `Facing pages`, `Page
  numbers`, `Running header`, `Page numbers in links`, `Footnotes for
  external links`, `Contents page numbers`, `Contents dot leaders` (built-in
  `true`, `schema.ts:142`, `page-setup.ts:105`). An export uses the built-in
  value, so the screen and the PDF disagree.
- Menus: every item goes through `showEntries` (`main.ts:300`), the one place
  that turns a `MenuEntry` into an Obsidian menu item (US-020, SCAR-017).
  The commands are prefixed `Obsidian2Typst: ` by Obsidian itself.

---

## Acceptance criteria

- **AC-1 (the sections and rows of the settings tab):** Under the version
  line, five sections in this order. Each section is a collapsible block
  (`<details>`), its summary a heading row with a chevron. A section holds
  *feature rows* (name, description, optional toggle, optional gear) and
  *plain rows* (today's row, unchanged). Every row of `DEFAULT_ROWS` and
  `FONT_ROWS` and every global row stands exactly once on the tab or in one
  modal — none is lost, none is doubled (a test enumerates both lists).

  | Section | Row | Kind | Toggle field | Gear opens (rows, in this order) |
  |---|---|---|---|---|
  | Presets | one per preset (AC-6), then `New preset` | — | — | — |
  | Page | Page setup | feature | — | Trim size, Trim width (mm), Trim height (mm), Top margin (mm), Bottom margin (mm), Inside margin (mm), Outside margin (mm), Bleed (mm), Slug (mm), Facing pages, Gutter (mm) |
  | | Page numbers | feature | `page.folios` | — |
  | | Running header | feature | `page.runningHeader` | Running header level |
  | | Page breaks | feature | — | Break before H1 … Break before H6 |
  | Text | Fonts | feature | — | Font folder, Default font, Body font, Body size (pt), Heading font, Heading size (pt), Caption font, Caption size (pt), Code font, Code size (pt) |
  | | Heading numbering | plain | | |
  | | Highlight colour | plain | | |
  | | Page numbers in links | feature | `linkPageNumbers` | Link page level, Link page word |
  | | Footnotes for external links | feature | `externalLinkFootnotes` | — |
  | | Template file | plain | | |
  | Book | Book parts | feature | — | First chapter, Colophon heading, Back notes heading |
  | | Roman folios in the front matter | feature | `book.romanFrontMatter` | — |
  | | Signatures | feature | — | Pages per signature |
  | | Contents | feature | — | Contents depth, Contents title, Contents page numbers, Contents dot leaders |
  | | Image fit | feature | — | Smallest image size |
  | Export | Strict mode | feature | `strictMode` (plugin data) | — |
  | | Presets folder | plain | | |
  | | Warnings note folder | plain | | |

  The grouping as in the table (decision 4). Feature-row names and descriptions are
  listed in AC-2; plain rows keep today's name and hint.

- **AC-2 (a feature row):** Name, description, then (left to right) the
  toggle when the table names a field, the reset icon when the toggle's field
  is a Defaults field (US-008 AC-18, as every Defaults row), and a gear
  (`settings` icon, tooltip `Settings of <name>`) when the table names rows.
  A feature row without a gear keeps the gear's space empty, so toggles line
  up (as the reference). Descriptions (fixed text):

  | Row | Description |
  |---|---|
  | Page setup | `Trim size, margins, bleed and facing pages.` |
  | Page numbers | `A page number at the foot of every body page.` |
  | Running header | `The chapter title at the head of the page.` |
  | Page breaks | `A new page or spread before headings, by level.` |
  | Fonts | `The font folder, families and sizes.` |
  | Page numbers in links | `(p. 42) after internal links.` |
  | Footnotes for external links | `The address of an external link as a footnote.` |
  | Book parts | `Colophon, back notes and where the first chapter starts.` |
  | Roman folios in the front matter | `i, ii, iii before the first chapter.` |
  | Signatures | `Blank pages at the end to fill a signature.` |
  | Contents | `A table of contents; off while its depth is 0.` |
  | Image fit | `Images shrink to stay with their text; off at 100 %.` |
  | Strict mode | `Conversion warnings abort the export.` (corrected at #137: the warnings found after the compile never abort, US-028 decision E, US-034 decision 1) |

- **AC-3 (a toggle shows the effective value; fixes the G0 defect):** A
  toggle — on a feature row or inside a modal — shows the value an export
  would use: on the tab the Defaults' value, else the built-in value; in the
  panel the active preset's value, else the Defaults', else the built-in
  (`owner.ts`). Switching it writes `true` or `false` into the Defaults; the
  reset icon removes the field (asks first, US-008 AC-18). Examples
  (SCAR-019: unset, `true`, `false`, and a built-in `false`):

  | Field | Defaults | Preset (panel only) | Toggle shows |
  |---|---|---|---|
  | `externalLinkFootnotes` (built-in `true`) | unset | — | on (today: off) |
  | `externalLinkFootnotes` | `true` | — | on |
  | `externalLinkFootnotes` | `false` | — | off |
  | `book.romanFrontMatter` (built-in `false`) | unset | — | off |
  | `page.folios` (built-in `true`) | `true` | `false` (panel) | off, disabled, `Set by preset "A5 print"; change it in the preset note` |
  | `page.facingPages` (inside Page setup) | unset | — | on (today: off) |

  The same rule holds for every toggle row: Facing pages, Page numbers,
  Running header, Page numbers in links, Footnotes for external links, Roman
  folios, Contents page numbers, Contents dot leaders. `Strict mode` is plugin
  data with no unset state (no reset icon).

- **AC-4 (groups without a boolean, decision 3 of G0):** Contents, Image fit
  and Signatures have no toggle; their gear holds the field whose value turns
  them off (`Contents depth` `0`, `Smallest image size` `100`, `Pages per
  signature` `0`). Example: Defaults `toc.depth` unset → the Contents modal
  shows `Contents depth` `—` (not set; built-in 0, no contents), as today's
  row.

- **AC-5 (a modal of a feature row):** The gear opens an Obsidian `Modal`
  titled with the row's name, holding its rows drawn by the same row code as
  today (hints, validation messages, reset icons, `Custom` trim size, the
  font dropdowns) — a value saved in a modal is saved by the same path as
  today (`saveDefaultsField`, `commitOnChange`). Keys (SCAR-013): Escape and
  the close button close the modal; Enter in a text field saves that field
  (`change`) and does not close the modal. A value typed but not yet saved
  when the modal closes — by Escape, the close button or a click outside —
  is saved as when the field is left (decision 3): `Bleed (mm)` typed `4`,
  Escape → the Defaults hold `bleed: 4`; `Bleed (mm)` typed `abc`, Escape →
  nothing is saved and a notice shows today's message (the row that would
  show it is gone). The modal has no `OK`/`Cancel` buttons: every row saves
  on its own, as on the tab.
  Updates while open (SCAR-016): the modal redraws its rows when the plugin
  settings or a preset note change and when the active preset changes —
  except after a save made by one of its own rows, so the row the user is in
  keeps its place and focus (as the panel's rows, US-012 AC-14; refined at
  #112: `Bleed (mm)` typed `3` and left → saved, the modal is not drawn
  again); a row that changes what other rows show asks for the redraw itself
  (Facing pages, Trim size). When it closes, the screen behind redraws. A modal blocks the workspace, so
  these changes come from outside the window (a sync, a second window, an
  editor in another app). Examples (draw, change, use):
  1. Tab drawn; Page setup modal open; `Facing pages` switched off → `Gutter
     (mm)` in the same modal is disabled with `Used only with facing pages`
     without reopening (US-009 AC-13).
  2. Panel drawn with preset `A5 print`; Page setup modal open; the note
     `A5 print.md` gets `page.bleed: 3` on disk → `Bleed (mm)` in the open
     modal shows `3`, disabled, `Set by preset "A5 print"; …`.
  3. Running header modal: `Running header level` set to `3`; modal closed →
     the tab is drawn again at the same scroll position (US-008 AC-19), the
     Page section still open (AC-7).

- **AC-6 (preset rows, decision 4 of G0):** A preset row has `Use` (today's,
  `In use` for the active one, disabled for an invalid one) and a gear
  (tooltip `Preset "<name>"`). The gear opens the preset's screen: US-021's
  details pop-up (title, table or error, unchanged) with the buttons `Use`,
  `Open the note`, `Duplicate`, `Rename`, `Delete`, `Close`, in that order;
  `Close` has the focus (SCAR-014). `Duplicate` and `Rename` do what today's
  row buttons do (`Rename` opens the name dialog, Enter = OK, US-008
  AC-1); after a rename the pop-up shows the new name (decision 6;
  a rename elsewhere still gives US-021 AC-9's `does not exist`).
  `Delete` asks as today (`deletePreset`, `Cancel` the default) and closes
  the pop-up after a confirmed delete. The buttons `Details`, `Duplicate`,
  `Rename`, `Delete` leave the row. Group headings (US-021 AC-4) and `New
  preset` stay.

- **AC-7 (open and closed sections):** On first draw in a session, `Presets`
  is open and the other sections are closed; in the panel, which has no
  `Presets` section, all sections are closed (decision 2). A section the
  user opened or closed keeps that state across every redraw of the same
  screen (a preset change, a modal closed, a value saved) and across closing
  and reopening the settings tab in the same session; nothing is written to
  `data.json`. Clicking the summary or pressing Enter or Space on it opens and
  closes it (the element's own behaviour). Measured in M19 (2026-10-31,
  Obsidian 1.14.4, macOS 27.0.1): Tab does not reach a section heading in
  the settings tab — the focus goes to the first item inside — so the
  keyboard cannot open or close a section there; accepted as a known
  variance by the user (2026-10-31). Why the heading is skipped is not
  verified (SCAR-024).

- **AC-8 (the style panel):** The preset dropdown and the `info` button stay
  at the top (US-012 AC-3, US-021 AC-8). The `info` button opens the same
  preset screen as the tab's gear (AC-6), for the active preset at the moment
  of the click (decision 5). Below: the sections `Page`, `Text`, `Book` with the rows of
  AC-1, then `Cover` (today's four read-only rows, as a section). No
  `Presets` and no `Export` section. Rows owned by the active preset follow
  US-012 AC-2 inside modals too: disabled, the owner's text, no reset icon.
  A feature row whose modal holds owned rows says so after its description
  (decision 7): `Page setup` with `A5 print` setting `page.trimSize`
  and `page.bleed` → `Trim size, margins, bleed and facing pages. Set by
  preset "A5 print": Trim size, Trim width (mm), Trim height (mm), Bleed
  (mm).` (the trim size is one group, US-012 AC-2: a preset that sets one of
  the three owns all three; amended at G2). Rows are named in the modal's
  order; with no owned row the description is the fixed text alone. The section states of AC-7 are
  kept per screen (the panel's and the tab's are separate).

- **AC-9 (the details table, decision 2 of G0):** The table of US-021 AC-6
  lists its rows in the order of AC-1 (section by section, a feature row's
  toggle field first, then its modal's rows), then `Cover`, `Callout
  styles`, `Heading rules` as today. Labels unchanged; no section headings in
  the table. The `Used` column takes a built-in value from the same lookup as
  AC-3 (one built-in table in `core`, SCAR-017; decided by the user at G3,
  2026-10-31). Found at G3: today 16 rows show `—` with source `(built-in)`
  although an export uses a built-in value. With nothing set they read:

  | Row | Used, today | Used, new |
  |---|---|---|
  | Break before H1 … H6 | `—` | `none (built-in)` |
  | Pages per signature | `—` | `0 (built-in)` |
  | Roman folios in the front matter | `—` | `false (built-in)` |
  | First chapter | `—` | `left (built-in)` |
  | Colophon heading, Back notes heading | `—` | `hidden (built-in)` |
  | Contents depth | `—` | `0 (built-in)` |
  | Contents title | `—` | `Contents (built-in)` |
  | Contents page numbers, Contents dot leaders | `—` | `true (built-in)` |
  | Smallest image size | `—` | `100 (built-in)` |

  Unchanged: the font families stay `—` (built-in: the default font, US-021
  AC-6), and every other row reads as today.

- **AC-10 (menu items, decision 1 of G0):** Every item the plugin adds to the
  file explorer menu and the editor menu is titled `O2T: ` followed by
  today's title; its icon is unchanged. One place adds the prefix:
  `showEntries` for entries drawn with the plugin's section; no title text in
  `menus.ts` or `note-edit.ts` contains `O2T` (a text check, SCAR-017). The
  ribbon menu keeps today's titles: every item in it is the plugin's (decision
  1). Commands are unchanged (Obsidian prefixes
  them). Examples:

  | Menu | Today | New |
  |---|---|---|
  | file explorer, a note | `Export to PDF` | `O2T: Export to PDF` |
  | file explorer, a note | `Preview` | `O2T: Preview` |
  | file explorer, `map.png` | `Use as cover` | `O2T: Use as cover` |
  | file explorer, `map.png`, no preset | `Use as cover (no preset)` | `O2T: Use as cover (no preset)` |
  | editor, cursor on `# Glossary` | `Stop using as glossary section` | `O2T: Stop using as glossary section` |
  | editor, cursor on an H1 | `Table of contents before this heading` | `O2T: Table of contents before this heading` |
  | editor, a line with two images | `Use "a.png" as cover` | `O2T: Use "a.png" as cover` |
  | editor, invalid preset `Broken` | `Use as cover (preset "Broken" is invalid)` | `O2T: Use as cover (preset "Broken" is invalid)` |

  Labels, separators and checked states are not prefixed (only items with a
  title and an action or a disabled reason).

- **AC-11 (no change of behaviour beyond layout and titles):** Every value
  is saved, checked and refused as today, with today's messages; `data.json`
  and preset notes keep their format (no migration); exports are
  byte-identical. The only behaviour changes are AC-3's toggle display and
  AC-9's built-in values in the details table (the stored values and the
  export were right; the screens were wrong).

- **AC-12 (composed, SCAR-002):** Every example is checked against US-008
  (precedence; reset icon; AC-19 scroll; AC-20 commit), US-009 AC-12 to
  AC-14 (`Custom` trim size, gutter, trim size as one group), US-010 AC-6
  (font rows drawn asynchronously — inside a modal too), US-012 AC-2, AC-3,
  AC-15 (owned rows; same rows on both screens), US-020 AC-4 (a preset chosen
  elsewhere redraws), US-021 AC-4 to AC-9, US-022 AC-6 and US-027 AC-7 (menu
  titles that change with the preset's state). Cases: a modal open while the
  active preset changes (AC-5 ex. 2); the trim size set to `Custom` in the
  modal (the width and height rows appear in the same modal); a Fonts modal
  opened before the font folder is read (the rows appear when it is read); a
  preset deleted from its own pop-up while it is active (`deletePreset`'s
  rule picks the next one, US-008); a disabled menu item's title with its
  reason (AC-10).

- **AC-13 (who uses what is replaced, SCAR-027):** The tests that pin the
  layout or the titles are amended, not deleted: `us-008-export-command`,
  `us-008-wiring`, `us-008-text-commit`, `us-012-panel`, `us-012-rows`,
  `us-020-actions-menus`, `us-021-groups-details`, `us-022-menus-write`,
  `us-022-preset-edits`, `us-027-contents-menu`, `tests/support/
  settings-source.ts`, `tests/support/book-rig.ts`. Manual checks that name a
  menu title or a tab row (M02 to M18; M08 and M09 added at #115, found by a
  search for tab rows) get a note that titles and
  rows moved, with the new place, before they are run again. The user manual
  (`manual/manual.md`, `presets.md`, `preview-panel.md`,
  `glossary-and-heading-rules.md`, and every guide that names a settings
  row) is updated.

- **AC-14 (manual check M19):** In Obsidian, with a test build: the tab's
  five sections opened and closed, a redraw keeping them; each gear's modal
  against AC-1; the AC-3 table of toggles with a fresh `data.json` (every
  built-in on shows on); AC-5 examples 1 to 3; a preset's pop-up with
  Duplicate, Rename, Delete (Cancel and confirm); the panel with an owning
  preset; every menu item of AC-10 in the file explorer and the editor. The
  check names the version and the place where it runs first and ends with
  the open question (SCAR-012, SCAR-015).

---

## Decisions (answered 2026-10-31)

1. **The ribbon menu.** *Decided: no prefix.* Every item in it is the
   plugin's (it opens from the plugin's own icon). Alternative was `O2T: ` on
   its two actions.
2. **Sections on first draw.** *Decided: `Presets` open, the rest closed;
   in the panel all closed.* States kept for the session only (AC-7).
   Alternatives were all open, or states saved in `data.json`.
3. **A value typed in a modal but not saved when it closes.** *Decided:
   saved*, whatever closes the modal, as when the field is left (AC-5).
   How (the user's choice at G2, 2026-10-31): the modal does not rely on
   `change` when it is removed (not measured, SCAR-024): on close it saves
   every text field whose text differs from the text last saved for it; a
   field already saved by `change` with the same text is not saved twice. A
   refused value then shows its message as a notice (added at G1 as the
   consequence: its row is gone). Alternative was Escape drops the value.
4. **The grouping of AC-1.** *Decided: as proposed* — one-field gears for
   Signatures and Image fit; plain rows for Heading numbering, Highlight
   colour, Template file and the folders; Roman folios its own toggle row.
5. **The panel's `info` button.** *Decided: the full preset screen* (with
   Duplicate, Rename, Delete). Alternative was the details only.
6. **Rename from the pop-up.** *Decided: the pop-up follows the new name.*
   Alternative was US-021 AC-9's `Preset "<old>" does not exist`.
7. **Owned rows behind a gear in the panel.** *Decided: the feature row's
   description names them* (AC-8). Alternative was nothing on the row.

---

## Notes

- New controls (SCAR-013 to 016): the section summaries (Enter, Space,
  click); the gear and the feature toggles; the feature modals (Escape,
  close button, Enter in a field = save; closing saves, decision 3); the preset
  screen's `Duplicate`, `Rename`, `Delete` (moved, not new). Worst misplaced
  click: on the tab and in the panel, a feature toggle next to the gear
  (undo: click again, or the reset icon); in the preset screen, `Delete`
  next to `Rename` — its confirmation keeps `Cancel` as the default and the
  focus starts on `Close`.
- Every screen that shows a value of a modal (SCAR-016): the modal itself,
  the feature row behind it (toggle, owned-rows note), the details pop-up;
  each redraws on a settings or preset change.
- Callbacks (SCAR-022): menu building stays synchronous; the prefix is a
  string concatenation on data in memory.
- New call sites (SCAR-001): `addDefaultRows` / `addFontRows` drawn for a
  subset of rows into a modal; `ownerNote` / `shownValue` for the toggle's
  effective value; `deletePreset` and the name dialog from the pop-up.
- Not this story: menus for the right-clicked line (issue #109); a plugin
  icon of its own; new settings.

---

## Related tickets

- [#111](https://github.com/JollyOrc/Obsidian2Typst/issues/111) — layout data, one built-in lookup, details table order
  (AC-1 to AC-4, AC-8, AC-9 as data).
- [#112](https://github.com/JollyOrc/Obsidian2Typst/issues/112) — sections, feature rows and their modals on the tab and
  the panel (AC-1 to AC-5, AC-7, AC-8, AC-11, AC-12).
- [#113](https://github.com/JollyOrc/Obsidian2Typst/issues/113) — preset row with a gear and the preset screen (AC-6).
- [#114](https://github.com/JollyOrc/Obsidian2Typst/issues/114) — `O2T: ` prefix on the file and editor menu items (AC-10).
- [#115](https://github.com/JollyOrc/Obsidian2Typst/issues/115) — documents, test build `0.11.0-m19.1`, M19 (AC-13, AC-14).
