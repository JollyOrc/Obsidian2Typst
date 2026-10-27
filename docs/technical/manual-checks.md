# Manual checks

> What only a real Obsidian can show. The automated tests use fakes or the
> compiler in Node and do not replace these. Keep this file coherent with
> `tests.md` (section "Manual smoke tests") and the user stories.

---

## M1 — Compiler worker in Obsidian (US-007 AC-3, AC-3b, AC-9, AC-12)

**When:** before every release, and after any change to the worker, the
embedded compiler or the build.

**Needs:** Obsidian desktop; the plugin built into a scratch vault (a vault
without real notes): `npm run build`, then copy `main.js` and `manifest.json` into
`<scratch vault>/.obsidian/plugins/obsidian2typst/` and enable the plugin.

### Steps

1. Run the command `Obsidian2Typst: Check compiler (developer)` from the command
   palette. The notice `Compiling…` appears; while it runs, type in a note: the
   window must stay usable.
2. Read the result notice and the line it appends to `o2t-check.md` in the
   vault root: the PDF header (`%PDF-`), the compile time, and the longest gap between two event-loop turns on
   the main thread (`longest gap`).
3. Run the command a second time while the first still runs: the notice
   `An export is already running` appears, and nothing else happens.
4. Turn Wi-Fi off (or disconnect the network) and run the command once more:
   it must compile exactly as before.
5. Run the command, and disable the plugin while `Compiling…` is shown. Obsidian
   must stay responsive; the Obsidian process memory (Activity Monitor or Task
   Manager) must fall back after a few seconds.
6. After a normal run, check the Obsidian process memory again: it must fall
   back to about the value before the run (the worker was terminated, AC-3b).

### Pass criteria

- `longest gap` is at most 100 ms (US-007 AC-9).
- The offline run (step 4) works (US-007 AC-2, AC-10).
- The PDF header is `%PDF-` and the file the plugin reports has a size above 0.
- The second command in step 3 is refused with `An export is already running`
  (US-007 AC-3).
- Memory falls back after steps 5 and 6 (US-007 AC-3b).
- The plugin folder contains no `.wasm` and no `worker.js`: the compiler runs
  from the copy inside `main.js` (US-007 AC-12).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section (create it if missing)
"Manual runs": date, Obsidian version, operating system, `longest gap`,
compile time, memory before and after.

---

## M2 — Presets, the settings tab and the style panel in Obsidian (US-008 AC-1, AC-3, AC-4, AC-5, AC-6, AC-8, AC-13, AC-16, AC-18; US-009 AC-11 to AC-13; US-012 AC-1 to AC-9, AC-11 to AC-15)

**When:** before every release, and after any change to the preset store, the
vault port or the settings tab.

**Needs:** Obsidian desktop; the plugin built into a scratch vault (as M1) that
has no folder `Obsidian2Typst/presets`. For step 12 a second device with the
same vault synced (Obsidian Sync or another sync).

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** the one named in the handover; it is the first line of the settings
tab and the version in the plugin list. If it differs, stop: the wrong build is
installed (SCAR-012), run `npm run install:scratch` and restart Obsidian.

### Steps

1. Enable the plugin. Expected: the folder `Obsidian2Typst/presets` exists with
   `A5 print.md` and `A4 digital.md`; no notice appears.
2. Open the settings tab `Obsidian2Typst`. Expected: the sections `Presets`,
   `Defaults`, `Folders and warnings`; both presets are listed, `A5 print` as
   `Active`.
3. Click `New preset`, type `Tryout`, press `OK`. Expected: a note `Tryout.md`
   with only `schemaVersion: 1` appears in the folder and in the list. Type
   `a/b` instead: the dialog says `A preset name cannot contain / \ : * ? " < > |`
   and creates nothing; type `tryout` once `Tryout` exists: `A preset with this
   name already exists`. Do all of it with the keyboard: Enter in the field has
   the effect of `OK` (a refused name shows its message and the dialog stays
   open), Escape closes the dialog without any change (US-008 AC-17).
4. Click `Duplicate` on `A5 print`. Expected: `A5 print copy.md` with the same
   text; a second click gives `A5 print copy 2`.
5. Link to `[[Tryout]]` from another note, then `Rename` it to `Trial`.
   Expected: the note is renamed and the link is updated.
6. Click `Use` on `A4 digital`; close and reopen Obsidian. Expected: it is still
   `Active`.
7. Open `A5 print.md` and change `bleed: 3` to `bleed: 5`. Expected: within
   2 seconds nothing else is needed; run M3 afterwards to see the new page size
   (158 × 220 mm).
8. In `A5 print.md` put a tab in front of `bleed`. Expected: one notice
   `Preset "A5 print": Tabs are not allowed as indentation (line N)`; the list
   marks the preset `invalid` with the same text; `Use` is disabled; the other
   preset still works. Remove the tab: the marker disappears without notice.
9. In `Defaults` type `red` as highlight colour and leave the field. Expected:
   the message `highlightColor must be a colour written #rrggbb`, and the field
   shows the previous value. Type `#a5d6a7`: accepted. Type `x` as heading
   numbering: the notice `Invalid heading numbering; "1.1" is used`.
10. Click `Delete` on `Trial`. Expected: a dialog `Delete preset "Trial"?` with
    the text about the trash and the buttons `Delete` and `Cancel`, the focus on
    `Cancel`. Press Enter (or Escape, or click `Cancel`): nothing is deleted.
    Click `Delete` again and then the button `Delete`: the note is in Obsidian's
    trash (or deleted, according to the setting `Deleted files`). Deleting the
    active preset also names the preset that becomes active. Delete all but one
    preset: the last one cannot be deleted (`The last preset cannot be
    deleted`).
11. Delete the folder `Obsidian2Typst/presets` in the file explorer and restart
    Obsidian. Expected: it is created again with the two built-in presets.
    Restart again after deleting `A4 digital.md` only: it is not created again.
12. On the second device, rename `A5 print.md` while the first one is open.
    Expected: after the sync the list on the first device shows the new name
    within a few seconds.
13. Defaults reset icons (US-008 AC-18). Every row of `Defaults` has the reset
    icon next to its field or switch (tooltip `Use the built-in value`): highlight
    colour, heading numbering, footnotes for external links, template file, trim
    size, trim width and height, the four margins, gutter, bleed, slug, facing
    pages. Type `5` into `Bleed (mm)`, leave the field, and click its icon at once, without closing the
    tab (it must work the first time, also a moment after typing). Expected: a
    dialog `Reset "Bleed (mm)"?` with `The value "5" is removed from the Defaults.
    Presets that do not set this field use the built-in value.`, the buttons
    `Reset` and `Cancel`, the focus on `Cancel`. Enter (or Escape, or `Cancel`):
    the field still shows `5`. Click the icon again, then `Reset`: the field is
    empty. Do the same with `Highlight colour` (`#a5d6a7`, the quoted value is the
    colour) and with the switch `Facing pages` turned on (the text says `The value
    "on"`; after `Reset` the switch is off). The icon of a row without a value
    (for example `Slug (mm)`) opens no dialog. Emptying a field by typing asks
    nothing. The three rows of `Folders and warnings` have no icon. The Fonts
    rows ask in the same way (M5).

14. Page setup in the settings tab and the PDF (US-009 AC-11 to AC-14, US-008
    AC-19, AC-20). Prepared by the developer: the preset `Slug 5` (the page settings of
    `A5 print` with `slug: 5`, no `cover` field) and the empty export folder
    `spikes/typst-wasm/m6-export`; the Defaults hold no page values. Keep the
    tab open for all of it, do not close it between the steps (SCAR-016), and
    scroll down to the page rows first: no change in this step may throw the tab
    back to the top (US-008 AC-19).
    (a) `Trim size` is a dropdown with `(built-in)`, `A4`, `A5`, `A6`, `US Letter`
    and `Custom`, showing `(built-in)`; the rows `Trim width (mm)` and `Trim
    height (mm)` are there too but greyed out (`Used only with a custom trim
    size`). (b) Choose `Custom`: both rows become usable at once. Type `160` into
    the width: no notice appears and the row says `Enter width and height; they
    are saved together`; type `240` into the height: no notice, the hints are
    gone. Choose `A5`: a dialog `Remove the custom trim size?` with `The values
    "160 × 240 mm" are removed from the Defaults. Presets that do not set them
    use the trim size "A5".`, the buttons `Remove` and `Cancel`, the focus on
    `Cancel`. `Cancel` (or Enter, or Escape): the dropdown shows `Custom` again
    with 160 and 240. Choose `A5` again and `Remove`: the dropdown shows `A5` and
    the two rows are greyed out and empty. (c) Choose `A4`, then `(built-in)`: no
    question. Choose `Custom` and then `A6` without typing sizes: no question.
    (d) `Gutter (mm)` stands directly under `Facing pages`, is greyed out and
    says `Used only with facing pages`. Turn `Facing pages` on: the field is
    usable at once; type `5`. Turn it off: the field is greyed out again; turn it
    on: it still holds `5`. Then empty the field and turn `Facing pages` off
    again. (e) A preset keeps its own size: choose `Custom`, enter 160 and 240;
    the preset list shows no `invalid` mark and no notice appears (`A5 print`
    still sets `trimSize: A5`); then choose `A5` and `Remove` as in (b).
    (f) Make `Slug 5` the active preset and export `Sample/Book.md` (the
    generated sample note, US-024) into `m6-export`. Expected in the PDF: every page is 164 × 226 mm (document
    properties); page 1 is the cover with an empty white strip of about 5 mm
    around the image, the image itself 154 × 216 mm (no image at the page edge);
    the text of the body pages starts about 28 mm from the left edge on
    right-hand pages and about 23 mm on left-hand pages; `export-warnings.md`
    shows no new warning compared with `A5 print`.
    (g) Fields are saved when they are left (US-008 AC-20): choose `Custom`,
    enter 160 and 240 and leave the fields. Click into `Trim height (mm)`, select
    all, and type `200` digit by digit: no notice appears while typing; leave the
    field (Tab or click elsewhere): saved, no notice. Type `20` and leave: now
    notices appear (`trimHeight must be at least 50 mm`, one per preset); that is
    right, the value is refused. Type `240` again and leave: no notice. Do the
    same with `Heading numbering` (type `1.1` digit by digit: no notice before you
    leave) and with `Body size (pt)` in Fonts (type `12`). Last, in `Folders and
    warnings`, type `Obsidian2Typst/presets2` into `Presets folder` and leave the
    field: the folder `Obsidian2Typst/presets2` appears once with the two
    built-in presets and no folder `O`, `Ob`, `Obs` and so on; set the field back
    to `Obsidian2Typst/presets` (the folder `presets2` may stay). Then choose
    `A5` and `Remove` as in (b).

15. The style panel with the preview (US-012 AC-1 to AC-9, AC-11 to AC-15).
    **Where it runs:** on your computer, in Obsidian with the scratch vault
    `spikes/typst-wasm/scratch-vault`. **Build:** version `0.1.0-m6.1`
    (first line of the settings tab), `main.js` sha256 starts `3cf9db45`. If the
    version differs, stop (SCAR-012). Restart Obsidian once, open the panel once
    and **keep it open for the whole step** (SCAR-016); keep the developer
    console open (Ctrl+Shift+I, Cmd+Option+I on a Mac) with the filter
    `[o2t preview]`. Prepared by the developer: `data.json` reset (Defaults
    empty, active preset `A5 print`); presets `A5 print`, `A4 digital`, `Slug 5`
    (all three set every page field), `Bleed 5` (sets only `page.bleed: 5`),
    `Minimal` (sets nothing) and `Broken` (`page.bleed: abc`, invalid); notes
    `Preview/Six pages.md` (6 pages in A5 print), `Preview/Cover note.md` (the
    first image is the cover) and `Sample/Book.md` (the generated sample note,
    the reference, 419 pages in `A5 print`); empty export folder `spikes/typst-wasm/m7-export`.
    Take note of the files in the vault and in `m7-export` now (step (j)).
    (a) Open `Preview/Six pages.md` in the editor and run the command `Open style
    panel`. A panel opens in the right sidebar; from top to bottom: `Preset`
    (shows `A5 print`; `Broken` is greyed out, shows its error when you hover,
    and cannot be chosen), the groups `Page`, `Fonts` and `Cover`, `Pages`,
    `Refresh`, the status line, the pages. Every row of `Page` is greyed out
    and says `Set by preset "A5 print"; change it in the preset note`, none has a
    reset icon; the `Fonts` rows are usable. The status line reads `Preview of:
    Six pages` and `Compiling…`, then `no warnings`; 6 pages of A5 shape with
    text appear. Run the command again: no second panel. (b) The `Cover` group
    shows `Cover`, `Cover image`, `Blank page after cover` and `Crop warning (%)`
    as text only (`auto; built-in value; set it in a preset note`, and so on):
    cover settings exist in preset notes only, so they cannot be edited here.
    (c) Open `Sample/Book.md`: the panel shows the hint `Note changed;
    press Refresh` after the name, the pages of the first note stay but are
    greyed (faint). Nothing compiles by itself. Click `Refresh`: `Compiling…`,
    then `Preview of: Book · <n> warnings` and the pages. Scroll to page 3:
    text, a table and a callout box, not white. The console shows `page 3
    drawn, … % non-white` with about 15 to 18 % (measured from the export at
    two drawing sizes; anything between 10 and 20 % is right; `(blank)` is a
    defect) and `canvas …` lines. (d) Page range, keyboard only: click into
    `Pages`, type `3-5` and press Enter: exactly three pages (3, 4, 5) are
    shown. Type `5-3` and press Tab: the message `Enter all, a page such as 4,
    or a range such as 3-5` appears under the field, no notice, the three pages
    stay. Type `3-` slowly: nothing changes before Tab (the range stays 3-5).
    Type `99999-100000` and Enter: `The document has <N> pages` (write N down).
    Type `all` and Enter: all pages again. (e) Choose the preset `Minimal`: the
    `Page` rows are usable and empty. Choose `Trim size` `A4`, then `Custom`
    (`Trim width` and `Trim height` become usable), then `A6`: no question and
    no dialog; about half a second after the last change the status shows
    `Compiling…` and the pages are laid out again; with `Six pages.md` the page
    count changes between A4 and A6 (more pages at A6). Click the reset icon of
    `Trim size`: the question appears (`Cancel` has the focus); `Cancel` changes
    nothing, `Reset` shows `(built-in)`. Leave the preset `Minimal` active.
    (f) Choose `Bleed 5`: `Bleed (mm)` shows `5`, is greyed out with `Set by
    preset "Bleed 5"; change it in the preset note` and has no reset icon;
    `Trim size` is still usable. Choose `Minimal` again. (g) Keep the panel open,
    open the settings tab (`Obsidian2Typst`) and set `Bleed (mm)` to `4`
    (leave the field): the panel shows `4` in its `Bleed (mm)` row without being
    reopened and compiles again. Now type `3` into the `Bleed (mm)` row **of the
    panel** and press Enter: no flicker, the field keeps its place, and the
    settings tab shows `3` after you open it (no reopening needed). Type `-1`:
    the message under the row, the value `3` stays. (h) An invalid preset: open
    `Obsidian2Typst/presets/Minimal.md`, add the lines `page:` and `  bleed:
    abc`, then click back into `Preview/Six pages.md` and click `Refresh`: the
    status line shows an error text, the old pages are greyed, nothing is
    drawn. Remove the two lines again and click `Refresh`: the error and the
    grey are gone. (i) Export first: preview `Sample/Book.md` with
    `A5 print` active (choose it). Click `Refresh` and at once run the command
    `Export current note` into `spikes/typst-wasm/m7-export`: while the export
    runs the status line says `Export running; the preview updates afterwards`;
    when the export has finished the preview compiles again and shows its pages.
    The PDF `Book.pdf` has as many pages as the preview (compare with
    the `N` of step (d)). (j) Compare the files of the vault and of `m7-export`
    with the list from the start: the only new files are those of the export
    (`Book.pdf`, and a warnings note if the export wrote one); the
    preview wrote nothing and showed no notice. (k) Close the panel with its
    close button and run `Open style panel` again: the panel opens and shows the
    last active note again without another command. Scroll fast through the
    reference: pages near the visible part get a picture within a moment, no
    page stays blank, the console shows `page … released` lines for far pages
    and no `(blank)` line. (l) `Preview/Cover note.md`: click `Refresh` after
    opening it: page 1 is the cover image filling the page inside the bleed
    (not text); the next page starts the text.
    **Known limits:** pictures in the preview are softer than in the PDF (images
    over 1200 px are made smaller; WebP is left as it is, so a big WebP makes
    the preview slower); the cover cannot be edited in the panel.
    **Please report** what you see on page 1 of `Cover note.md` and on page 3 of
    the reference (a few words each), the number `N` and the PDF page count,
    and anything else that looked wrong. **Open question (SCAR-015):** is
    anything missing, odd or ugly in the panel that this list did not ask about?

### Pass criteria

- Every `Expected` holds.
- Is anything missing, odd or ugly in the settings tab that this list did not
  ask about? Report it even if it seems unrelated (SCAR-015).
- No preset note changes by itself while the plugin only exports or lists
  (compare the modification time of the notes before and after M3).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, Obsidian version, operating system, the steps that failed (none).

---

## M3 — Export current note end to end (US-008 AC-9, AC-11, AC-12, AC-15, US-007 AC-1, AC-6)

**When:** before every release, and after any change to the export command, the
template handling or the build.

**Needs:** Obsidian desktop. Everything below is prepared by the developer
before the handover (SCAR-012): the build is installed in the scratch vault
(`npm run install:scratch`, which also installs the generated sample vault as
`Sample/`), the vault holds `Sample/Book.md` with its `Sample/assets` folder
and `Styles/template.typ` (containing
`#let accent = rgb("#336699")`), the presets are the two built-in ones with
`A5 print` active, and there is an empty folder for the export:
`spikes/typst-wasm/m3-export` in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded. (M3 is repeated on this build because the default preset
now makes the first image of the note a cover page, see M4.)

### Steps

1. Open `Sample/Book.md` and run `Obsidian2Typst: Export current note`.
   Expected: a folder dialog opens; choose an empty folder on disk. The notice
   `Compiling…` appears, then the notice of the finished export.
2. Expected in the folder: `Book.typ`, `Book.pdf`, an `assets`
   folder with the images, and `export-warnings.md`; no other file. The PDF
   opens and has the pages of the book at A5 plus 3 mm bleed (154 × 216 mm).
   Page 1 is the cover picture (the first line of the note,
   `assets/cover.png`, a striped picture) filling the page, page 2 starts the
   text. The text is readable: select a word in the PDF viewer and copy it,
   headings such as `1 Mollit` and `2 Incididunt Occaecat` are in the pages, body text is in a serif
   face (Libertinus Serif), and code in a monospace face (DejaVu Sans Mono); the
   images are in place. Known limits of this build: no vault fonts or font
   choice (US-010), no table of contents unless the note has one.
3. Run the command again. Expected: the dialog starts in the folder of step 1.
   Switch the active preset to `A4 digital` in the settings tab and run it
   again: the dialog starts without a folder (remembered per preset), and the
   PDF has A4 pages.
4. Open the settings tab and enter `Styles/template.typ` as `Template file` in
   `Defaults`; export again. Expected: `template.typ` is in the folder, equal to
   the vault file; the first lines of the `.typ` are the header comment and
   `#import "template.typ": *`.
5. Change the template to start with `#let quote(body) = block(body)` and export.
   Expected: the export works and `export-warnings.md` lists
   `TEMPLATE_SHADOWS_BUILTIN` for the line of the definition.
6. Enter `Styles/missing.typ` as `Template file`. Expected: the export works
   without `template.typ` and `export-warnings.md` lists `TEMPLATE_MISSING`.
7. Open `A5 print.md` (a preset) and run the command. Expected: the notice
   `Presets are not exported`. Close all notes and run it: `Open a note to
   export it`.
8. Make the active preset invalid (tab in `A5 print.md`) and run the command.
   Expected: the notice `Preset "A5 print" is invalid: …` and no dialog.
9. Turn Wi-Fi off and repeat step 1. Expected: identical result.
10. Cancel the folder dialog. Expected: nothing is written, no notice.
11. Last, open the PDF once more and look through it for anything missing,
    odd or ugly that this list did not ask about (SCAR-015). Report it even if
    it seems unrelated or you think it is known.

### Pass criteria

- Every `Expected` holds; the export of `Sample/Book.md` (419 pages) finishes in
  about 30 seconds or less and has no compile error.
- The folder dialog works on the platform of the tester (if Obsidian offers no
  dialog the notice says `The folder dialog is not available`; then US-008
  stays open).
- The vault copy of the template and the preset notes are unchanged
  (modification times).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, Obsidian version, operating system, time of the export of The
Rules, platform of the folder dialog.

---

## M4 — The cover in the PDF (US-011 AC-2 to AC-9, US-007 AC-7)

**When:** after any change to the cover, the page setup of the first pages, the
image handling or the reading of image sizes.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
the vault holds `Sample/Book.md` with `Sample/assets`, the
cover image `Layouting/Cover/wide.png` (1600 × 1000 px, landscape, with a red
frame so a crop is visible), and these presets in `Obsidian2Typst/presets`:
`A5 print` (built in, active), `Cover blank page` (`cover.blankPageAfter:
true`), `Cover off` (`cover.mode: none`), `Cover missing file`
(`cover.mode: file`, `Layouting/Cover/nothere.png`) and `Cover cropped`
(`cover.mode: file`, `Layouting/Cover/wide.png`). All have the page settings
of `A5 print` (154 × 216 mm with bleed). The export folder is empty:
`spikes/typst-wasm/m4-export` in the project folder. The plugin data starts
clean (no remembered folders).

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.1.0-m4.1`. If it differs, stop. Restart Obsidian once.

### Steps

Export `Sample/Book.md` (command `Obsidian2Typst: Export current note`) into
an empty folder for every step; the PDF is opened each time.

1. Preset `A5 print`. Expected: page 1 is the picture of the cover filling the
   whole page, edge to edge, with no margin and no text; page 2 starts the text
   (`1 Mollit` heading, serif text); the cover picture is not shown a second
   time right after; the folder's `assets` holds `cover.png` once;
   `export-warnings.md` has no `COVER_*` line (the picture is 148 × 210 px,
   about 1 % off the page shape; measured: no `COVER_CROPPED` in `A5 print`).
2. Preset `Cover blank page`. Expected: page 1 cover, page 2 completely blank
   (no text, no picture), the text starts on page 3.
3. Preset `Cover off`. Expected: page 1 shows the text; the cover picture is
   somewhere in the text as a normal image (not full page).
4. Preset `Cover missing file`. Expected: no cover page, the text is page 1,
   the first line's picture is not in the text; `export-warnings.md` lists
   `COVER_MISSING` (`Cover image not found: Layouting/Cover/nothere.png`) and
   no image problem for the first picture.
5. Preset `Cover cropped`. Expected: page 1 is the landscape picture filling the
   portrait page (cut at the sides, nothing stretched: the red frame is cut off
   left and right, circles stay round); `export-warnings.md` lists one
   `COVER_CROPPED` with the text `Cover image is cropped by 55.4% (image 1600×1000 px, page 154×216 mm)`; the cover picture of the note's first line is not in the text.
6. Last, look through the PDFs once more for anything missing, odd or ugly that
   this list did not ask about (fonts, picture position, page numbers,
   notices). Report it even if it seems unrelated or you think it is known
   (SCAR-015).

### Pass criteria

- Every `Expected` holds and no export has a compile error. This build prints no
  page numbers yet (no numbering setting exists); that is not a finding. The
  restart of the page counter after the cover is checked by the automated PDF
  tests with numbering switched on.
- The vault files, presets and the note are unchanged by the exports
  (modification times).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system
(ask for them; they were not recorded in M2 and M3), result per step.

---

## M5 — Fonts from the vault, in the settings tab and in the PDF (US-010 AC-3 to AC-6, AC-8, US-007 AC-7)

**When:** after any change to the fonts, the font folder, the glyph check or the
Fonts section of the settings tab.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
and the vault holds:

- `Sample/Book.md` with `Sample/assets` (the long test note) and
  `Glyph check.md` at the vault root (a heading, a task list with one open and one done
  task, inline code, and the characters ☠ and ⚔ in the text).
- The font folder `Layouting/Fonts` with: `NimbusRoman-*.otf` (family `Nimbus
  Roman`, four files), `C059-Roman.otf` and `C059-Bold.otf` (family `C059`) in
  `Layouting/Fonts/headings/` (a subfolder), `DejaVuSans.ttf` and
  `DejaVuSans-Bold.ttf` (family `DejaVu Sans`, the only one with ☐ and ☒),
  `Cinzel.zip` (a zip file, not a font), and `broken.ttf` (not a font).
  `Nimbus Roman` and `C059` have neither ☐ nor ☒.
- The presets in `Obsidian2Typst/presets`: `A5 print` (built in, active),
  `Fonts vault` (`fonts.folder: Layouting/Fonts`, `fonts.default: Nimbus
  Roman`, `fonts.heading.family: C059`, `fonts.body.size: 12`), `Fonts with task
  glyphs` (`fonts.folder: Layouting/Fonts`, `fonts.default: DejaVu Sans`),
  `Fonts missing` (no folder; `fonts.default: Nope Serif`,
  `fonts.heading.family: Nope Display`, `fonts.code.family: Nope Mono`) and
  `Fonts folder missing` (`fonts.folder: Layouting/NoFonts`). The older cover
  presets of M4 are still there; ignore them.

The export folder is empty: `spikes/typst-wasm/m5-export` in the project
folder. The plugin data starts clean (no Defaults, no remembered folders).

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.1.0-m6.1`. If it differs, stop. Restart Obsidian once.

### Steps

Export with the command `Obsidian2Typst: Export current note` into an empty
folder for every export step; open the PDF and `export-warnings.md` each time.

1. Settings tab, section Fonts. Expected: rows `Font folder`, `Default font`,
   `Body font`, `Body size (pt)`, `Heading font`, `Heading size (pt)`, `Caption
   font`, `Caption size (pt)`, `Code font`, `Code size (pt)`. Type
   `Layouting/Fonts` into `Font folder` and leave the field (click elsewhere or press
   Tab); the settings tab draws itself again at once, without closing it, and
   the dropdowns then list `C059`, `DejaVu
   Sans`, `DejaVu Sans Mono`, `Libertinus Serif`, `Nimbus Roman` (sorted, once
   each). Choose `Nimbus Roman` as `Default font`: under it appears `Missing: ☐
   U+2610, ☒ U+2612. Task lists will use [ ] and [x].`; choose `DejaVu Sans`: the
   message is gone at once. Type `0` into `Body size (pt)`: the row shows `fonts.body.size
   must be a number of pt greater than 0 and at most 200`, and the value is not
   saved. Click the reset icon of `Default font`: a question `Reset "Default
   font"?` with `Reset` and `Cancel` appears; `Cancel` keeps `DejaVu Sans`;
   again, `Reset` removes it (the dropdown shows `Libertinus Serif`). The reset
   icon of a row without a value asks nothing. Last, empty the `Font folder`
   field again and leave it: the dropdowns shrink back to `DejaVu Sans Mono` and
   `Libertinus Serif` at once. Check in the Defaults that no font folder is set
   before step 2 (step 2 expects the built-in fonts only).
2. Preset `A5 print`, export `Sample/Book.md`. Expected: as before (cover,
   text); `export-warnings.md` has no `FONT_` line; the text is in the serif
   of the earlier builds, 10 pt.
3. Preset `Fonts vault`, export `Sample/Book.md`. Expected: the body is in
   Nimbus Roman (visibly the Times-like face of that font), a little bigger than
   in step 2 (12 pt), the headings are in C059 (bold, a different face than the
   body); the export folder holds no font file and no folder `Layouting`;
   `export-warnings.md` lists `FONT_ARCHIVE_IGNORED` (`Font archive ignored,
   unzip it first: Layouting/Fonts/Cinzel.zip`) and `FONT_FILE_INVALID` (`Font
   file cannot be read: Layouting/Fonts/broken.ttf`) and no `FONT_MISSING`.
4. Preset `Fonts missing`, export `Sample/Book.md`. Expected: the PDF is made
   with the default fonts; three `FONT_MISSING` lines: `Default font "Nope
   Serif" was not found; "Libertinus Serif" is used`, `Font "Nope Display" for
   heading was not found; "Libertinus Serif" is used`, `Font "Nope Mono" for code
   was not found; "DejaVu Sans Mono" is used`.
5. Preset `Fonts folder missing`, export `Sample/Book.md`. Expected: a `FONT_
   FOLDER_MISSING` line (`Font folder not found: Layouting/NoFonts`); the PDF is
   made with the bundled fonts.
6. Preset `Fonts vault`, export `Glyph check.md`. Expected: one `FONT_GLYPH_MISSING`
   for `Nimbus Roman` that reads `Font "Nimbus Roman" lacks 2 characters: ☠
   U+2620, ⚔ U+2694 (first at line 3)`; the task list shows `[ ]` and `[x]` in the PDF, and a second
   `FONT_GLYPH_MISSING` line says `Font "Nimbus Roman" lacks U+2610; task lists
   use [ ] / [x]`; the heading is in C059.
7. Preset `Fonts with task glyphs`, export `Glyphs.md`. Expected: the task list
   shows the boxes ☐ and ☒ in the PDF, and the ☠ and ⚔ of the text are drawn
   (DejaVu Sans has them); `export-warnings.md` has no `FONT_GLYPH_MISSING`.
8. Last, look through the PDFs once more for anything missing, odd or ugly that
   this list did not ask about (fonts, spacing, sizes, bold or italic faces
   that look synthetic, notices). Report it even if it seems unrelated or you
   think it is known (SCAR-015).

### Pass criteria

- Every `Expected` holds and no export has a compile error.
- No font file and no `Layouting` folder is written to an export folder.
- The vault files, presets and notes are unchanged by the exports
  (modification times).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

---

## M6 — Callouts in the PDF and the preview (US-016 AC-1, AC-13 to AC-16)

**When:** after any change to callouts, callout styles, the preamble helpers or
the template warnings.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
and the vault holds:

- `Callouts.md` at the vault root: a composed box (`example` "Rolling dice"
  holding `note` "Inner"), a `faq` callout "Why?" inside a list item, an
  unknown type `banana` "Ripe", a user style `rule-note` "House", a box "Pools"
  with the heading "Two pools" inside, six header shapes, and a box "Long" of
  120 paragraphs.
- `Layouting/Icons/quill.png` (64 × 64, a dark-brown diamond).
- The preset `Obsidian2Typst/presets/Callouts.md` (A5; `callouts.example.fill:
  "#f3ead7"`; `callouts.rule-note` with font `DejaVu Sans Mono` and the icon),
  set as the active preset (the previous plugin data is in
  `spikes/typst-wasm/m6-state-backup/data.before-m6-callouts.json`).
- An empty export folder `spikes/typst-wasm/m6-export` in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitation:** Obsidian's own callout icons are not printed (they come
from an icon set that is not bundled); only a style's `icon` is.

### Steps

1. Check the version (above) and that the settings tab shows the active preset
   `Callouts`.
2. Open `Callouts.md` in reading view and scroll to "Header shapes". For each of
   the six shapes write down whether Obsidian draws a callout box. Expected by
   the plugin: shapes 1 and 2 are boxes; shapes 3, 4, 5 and 6 are plain quotes
   (their text `[!note]Title`, `[!my type] T`, `**[!note]** T` and
   `text [!note]` is printed as written). Report every shape where Obsidian
   differs: that is a finding against US-016 AC-1 (SCAR-009).
3. Run `Obsidian2Typst: Export current note` and choose
   `spikes/typst-wasm/m6-export`. Expected: the notice `Exported with 1
   warning. Report: …/m6-export/export-warnings.md`; the report and the vault
   note `Callouts export warnings.md` list exactly one warning,
   `CALLOUT_TYPE_UNKNOWN` "No style for callout type "banana"; the default box
   is used" at line 19. The export folder holds `Callouts.pdf`,
   `Callouts.typ`, `Layouting/Icons/quill.png` and `export-warnings.md`.
4. Open `Callouts.pdf` (7 A5 pages). On page 1:
   - "Rolling dice" in a parchment box (`#f3ead7`) with a violet border and a
     violet bold title; inside it the box "Inner" in light blue with a blue
     border;
   - in the list item, the box "Why?" in light orange with an orange title;
   - "Ripe" in a grey box (the default style), "House" in a grey box with the
     diamond icon before the title and its body "Monospace text." in a
     monospace font;
   - the box "Pools" holds the heading "Two pools", and its link "the pools
     heading" jumps to that heading.
   Each title appears exactly once.
5. The box "Long" starts near the bottom of page 2 with its title and the first
   paragraphs (the title is not alone at the page bottom), and continues in
   parchment boxes on pages 3 to 7; page 7 ends with "The end." outside the box.
6. Open the style panel (`Obsidian2Typst: Open style panel`) on `Callouts.md`.
   The preview shows the same boxes. **Without closing the panel**, open the
   preset note `Callouts`, change `fill: "#f3ead7"` to `fill: "#ffffff"`, and
   save. Expected: the preview redraws within about a second, and the "Rolling
   dice" box and the long box are white. Change it back to `"#f3ead7"`; the
   preview turns parchment again (SCAR-016).
7. Is anything missing, odd or ugly that this list did not ask about? Report it
   even if it seems unrelated (SCAR-015).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step (step 2: the six shapes as Obsidian shows them).

## M7 — Glossary terms in the PDF and the preview (US-017 AC-4, AC-10 to AC-14)

**When:** after any change to heading rules, glossary terms, the heading
emitter or the preamble helpers.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
the active preset was written with Obsidian closed (the previous plugin data is
in `spikes/typst-wasm/m7-state-backup/data.before-m7.json`), and the vault
holds:

- `Glossary.md`: `# Rules` with a link to the term `Tidal Basin`,
  `# Glossary` with an introduction and 27 terms (among them `Rapid Basin`,
  which starts with a list, `Break`, which is empty, `Wandering` with two
  paragraphs, `Tessera Round` with the sub-heading `### Order of a round`, and
  `Pool **of** \`dice\``), then `# End notes` with a link back to `Gambit`.
- `Sample/Book.md`: the generated sample note (US-024); its `# Glossary` holds
  42 terms, among them `Veniam`, linked 4 times from the `Appendix`.
- `Glossar.md`: a German note with the heading `# Glossar`.
- The preset `Obsidian2Typst/presets/Glossary terms.md` (A5;
  `headingRules: {Glossar: glossary}`), set as the active preset.
- An empty export folder `spikes/typst-wasm/m7-export` in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitation:** a link to a term prints no page number ("see p. 42" is a
later story); internal links work as links only.

### Steps

1. Check the version (above) and that the settings tab shows the active preset
   `Glossary terms`. If another preset is active, stop and report it.
2. Run `Obsidian2Typst: Export current note` on `Glossary.md` and choose
   `spikes/typst-wasm/m7-export`. Expected: the notice `Exported with 1
   warning`; the report lists exactly one warning, `HEADING_IN_TERM` "Heading
   "Order of a round" is inside the glossary term "Tessera Round"; it is printed
   without number and outline entry" at line 38.
3. Open `Glossary.pdf` (4 A5 pages):
   - page 1 shows `1 Rules`, then `2 Glossary`, the introduction, and run-in
     lines such as `Gambit — The action decides …` with the term in bold;
   - `Rapid Basin` and `Break` stand on a line of their own, without ` — `;
     the list follows `Rapid Basin`;
   - `Order of a round` is a heading without a number (no `2.0.1`);
   - `Pool of dice` is bold with `dice` in the code font;
   - the PDF bookmarks list only `1 Rules`, `2 Glossary`, `3 End notes` (no
     term);
   - the link "Tidal Basin" on page 1 jumps to the term on page 2; "Gambit"
     in the end notes jumps to the term on page 1;
   - no page ends with a term alone (look at the bottom of pages 1 to 3).
4. Export `Sample/Book.md`. Expected: 419 pages; the glossary on pages 413 to
   419, every one of its 42 terms run-in (`Reprehenderit Ultricies — …`); the
   report lists 148 entries: 80 `LINK_AMBIGUOUS` and 64 `LINK_UNRESOLVED`
   (the generated note's own link cases), 2 `CALLOUT_TYPE_UNKNOWN` (`rule-box`
   and `mystery`; the vault's presets do not style `rule-box`), 1
   `EMBED_NOTE_UNEXPANDED` and 1 `COMMENT_DROPPED`; the four links to `Veniam`
   in the `Appendix` jump to the term.
5. Export `Glossar.md`. Expected: no warning; `Aktion — Etwas, das …` and
   `Zug — Der Teil …` run-in, bookmarks `1 Regeln`, `2 Glossar` only.
6. Open the style panel (`Obsidian2Typst: Open style panel`) on `Glossar.md`.
   **Without closing the panel**, open the preset note `Glossary terms`, change
   `Glossar: glossary` to `Glossar: none`, and save. Expected: the preview
   redraws within about a second and shows `2.1 Aktion` and `2.2 Zug` as
   numbered headings. Change it back to `glossary`; the preview shows the
   run-in lines again (SCAR-016).
7. Is anything missing, odd or ugly that this list did not ask about? Report it
   even if it seems unrelated (SCAR-015).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M8 — Folios and running headers (US-019 AC-2, AC-4, AC-5, AC-9 to AC-11)

**When:** after any change to the page fields, the rule `page-furniture`, the
cover pages or the Defaults rows.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
the active preset was written with Obsidian closed (the previous plugin data is
in `spikes/typst-wasm/m8-state-backup/data.before-m8.json`), and the vault
holds:

- `Folios.md` at the vault root: a cover image, an introduction, `# Player
  Section` with `## Tessera` (with a footnote in the title) and `## Prism *arts*
  \`x\`` (with `### Spell circles`), a callout holding `## Boxed chapter`,
  `# Appendix` with `## Late chapter`, and `# Glossary` with one term.
- The preset `Obsidian2Typst/presets/Folios.md` (A5, facing pages, folios and
  header on, level 2, cover auto), set as the active preset; the preset
  `Folios single.md` (A5, single pages, level 3, cover auto).
- `Sample/Book.md`, the generated sample note (US-024), with a cover image.
- An empty export folder `spikes/typst-wasm/m8-export` in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitations:** no ornaments or chapter symbols in header and footer
(backlog "Decoration"); links print no page number yet (US-018).

### Steps

1. Check the version (above) and that the settings tab shows the active preset
   `Folios`. If another preset is active, stop and report it.
2. Settings tab, Defaults, **without closing the tab** (SCAR-016): the rows
   `Page numbers`, `Running header` (switches) and `Running header level`
   (field, hint `1 to 6`) come right after `Gutter (mm)`. Using **the keyboard
   only** (SCAR-013), type `7` into `Running header level` and press Enter: the
   message `page.runningHeaderLevel must be a whole number from 1 to 6` shows
   and the field keeps the old value. Type `3`, press Enter; then click its
   reset icon at once: the question reads `The value "3" is removed from the
   Defaults. …`, with `Cancel` focused (SCAR-014); choose `Cancel`, then reset
   it with `Reset`. Open the style panel: the three rows are in its Page group,
   disabled with `Set by preset "Folios"` (the preset sets them).
3. Export `Folios.md` into `spikes/typst-wasm/m8-export`. Expected: no
   warning. In `Folios.pdf` (15 pages):
   - page 1, the cover, has no number and no header, and the PDF viewer's page
     list shows no number for it;
   - pages 2 to 15 carry the numbers 1 to 14 at the bottom, at the left edge
     on even PDF pages and the right edge on odd ones (the outer edges of a
     spread);
   - headers, centred, page by page: 2 none; 3 `Reader Section`; 4 `Tessera`;
     5, 6, 7 `Prism arts x` (`arts` in italics, `x` in the code font); 8, 9
     `Boxed chapter`; 10 none (`Appendix` starts there); 11, 12 `Appendix`;
     13 `Late chapter`; 14 none (`Glossary` starts there); 15 `Glossary`;
   - the footnote mark of `Tessera` appears once, in the heading on page 4,
     never in a header; its note is numbered 1;
   - `Gambit` (a glossary term) never appears in a header.
4. Choose the preset `Folios single` and export `Folios.md` again. Expected:
   every number centred; headers: 2 none; 3, 4 `Reader Section`; 5 `Tessera`;
   6, 7, 8 `Spell circles`; 9 `Boxed chapter`; 10 none; 11, 12, 13
   `Appendix`; 14 none; 15 `Glossary`. Choose `Folios` again.
5. Open the style panel on `Folios.md`. **Without closing the panel**, open the
   preset note `Folios`, change `runningHeaderLevel: 2` to `3`, save: the
   preview redraws within about a second and page 6 shows `Spell circles`.
   Change it back to `2`: page 6 shows `Prism arts x` again (SCAR-016).
6. Export `Sample/Book.md`. Expected: 419 pages; the cover without a
   number; numbers from 1 on page 2 to 418 on the last page; chapter titles in
   the headers (for example `Cras Ac` on pages 3 to 6), none on the pages where a `#`
   section starts. Leaf through a few spreads.
7. Is anything missing, odd or ugly that this list did not ask about? Report it
   even if it seems unrelated (SCAR-015).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M9 — Page numbers for internal links (US-018 AC-4, AC-5, AC-7 to AC-9)

**When:** after any change to the link page fields, the `page-ref` call, the
rule `page-refs`, the glossary explanations or the Defaults rows.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared),
the active preset was written with Obsidian closed (the previous plugin data is
in `spikes/typst-wasm/m9-state-backup/data.before-m9.json`), and the vault
holds:

- `PageRefs.md` at the vault root: a cover image; `# Rules` with the
  paragraphs `StepA` (plain links to `## Tessera`, `### Moss`, `## Prism`, the
  glossary term `Gambit` and its own chapter `Rules`), `StepB` (a bold link,
  and a link inside a bold sentence) and `StepC` (a footnote, a callout and a
  table cell, each with a link); `## Tessera`, `### Moss`, `## Prism`, a
  heading `## See [Tessera](#tessera)` holding a link; `# Glossary` with the
  terms `Gambit` and `Bonus`.
- The preset `Obsidian2Typst/presets/PageRefs.md` (A5, folios and header on,
  cover auto, the built-in page-number values), set as the active preset; the
  preset `PageRefs deep.md` (the same with `linkPageLevel: 3` and
  `linkPageWord: "S."`).
- `Sample/Book.md`, the generated sample note (US-024).
- An empty export folder `spikes/typst-wasm/m9-export` in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitations:** no `see p.` wording, no page ranges, no chapter numbers
as references (story Notes). The preview downsamples large images (US-012);
`PageRefs.md` has only the full-page cover, so its preview numbers equal the
export's; in a note with large images inside the text a preview number could
differ from the PDF (not seen in the dry run, which checked the export).

The numbers below come from a dry run in Node of the same conversion with
these presets and the vault's Defaults (2026-10-21).

### Steps

1. Check the version (above) and that the settings tab shows the active preset
   `PageRefs`. If another preset is active, stop and report it.
2. Settings tab, Defaults, **without closing the tab** (SCAR-016): the rows
   `Page numbers in links` (switch), `Link page level` (field, hint `1 to 6`)
   and `Link page word` (field, hint `p.`) come right after `Running header
   level`. Using **the keyboard only** (SCAR-013), type `7` into `Link page
   level` and press Enter: the message `linkPageLevel must be a whole number
   from 1 to 6` shows and the field keeps the old value. Type `S.` into `Link
   page word`, press Enter; then click its reset icon at once: the question
   reads `The value "S." is removed from the Defaults. …`, with `Cancel`
   focused (SCAR-014); choose `Cancel`, then reset it with `Reset`. Open the
   style panel: the three rows are there too.
3. Export `PageRefs.md` into `spikes/typst-wasm/m9-export`. Expected: no
   warning. In `PageRefs.pdf` (7 pages; the cover has no number; folios 1 to 6
   on pages 2 to 7):
   - page 2 (folio 1), `StepA`: `Tessera (p. 2)`, `Moss` with no number (a
     `###` target), `Prism (p. 4)`, `Gambit (p. 6)`, and `Rules (p. 1)` — the
     chapter is on this same page and still gets its number;
   - `StepB`: in `see Tessera (p. 2) now` the word `Tessera` is bold and
     `(p. 2)` is not; in `see Prism (p. 4) here.` everything is bold,
     `(p. 4)` included;
   - `StepC`: `Tessera (p. 2)` in the box, `Prism (p. 4)` in the table cell,
     and the footnote at the bottom reads `Footnote: see Prism (p. 4).`;
   - the targets: `Tessera` starts on page 3 (folio 2), `Moss` on page 4
     (folio 3), `Prism` on page 5 (folio 4), the glossary on page 7 (folio 6);
   - page 6: the heading `See Tessera` has no number, and neither has the
     running header `See Tessera` above it; no header anywhere shows `(p.`;
   - page 7, the glossary: `Gambit — An act; see Moss (p. 3) and Tessera
     (p. 2).` and `Bonus — A bonus; see Gambit (p. 6).` (every link of an
     explanation is numbered, also the `###` one and the one on its own page).
4. Choose the preset `PageRefs deep` and export `PageRefs.md` again. Expected:
   the same pages, every number written `(S. N)`, and in `StepA` now also
   `Moss (S. 3)`. Choose `PageRefs` again.
5. Open the style panel on `PageRefs.md`. **Without closing the panel**, open
   the preset note `PageRefs`, add the line `linkPageLevel: 3` before the
   closing `---`, save: the preview redraws within about a second and page 2
   shows `Moss (p. 3)`. Remove the line again: `Moss` has no number again
   (SCAR-016). The numbers in the preview are the ones of step 3.
6. Settings tab, Defaults: switch `Page numbers in links` off. The preview
   shows no numbers; export `PageRefs.md` again: no `(p.` anywhere, and the
   links are still there (`see Tessera, Moss, Prism and Gambit`). Switch it on
   again.
7. Export `Sample/Book.md`. Expected (measured with the preset at the
   built-in values, `linkPageLevel` 2): 419 pages; 178 numbers in all, many on
   the glossary pages (every link in an explanation) and the others after
   links to `#` and `##` chapters elsewhere; none in a header. The warnings
   note lists 148 entries: 144 about the note's own links (ambiguous or
   unresolved), 2 unknown callout types, 1 note embed and 1 dropped comment;
   they are not about this check. Before the run, check that `PageRefs.md`
   does not set `linkPageLevel` (found set to 3 on 2026-10-27; with 3 the
   export has 420 pages and 436 numbers). Leaf
   through the glossary and a few spreads.
8. Is anything missing, odd or ugly that this list did not ask about? Report it
   even if it seems unrelated (SCAR-015).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M10 — Ribbon and note menus (US-020 AC-3, AC-5 to AC-10)

**When:** after any change to the actions, the menu entries, the ribbon icon,
the file explorer or editor menu, or the preset dropdown of the style panel.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared);
the plugin data is unchanged since M9 (active preset `PageRefs`); the vault
holds the notes `PageRefs.md` and `Folios.md` at its root,
`Sample/Book.md`, an image `Sample/assets/cover.png`,
and 12 presets, of which `Broken` is invalid (`page.bleed must be a number of
at least 0 (line 4)`); an empty export folder `spikes/typst-wasm/m10-export`
is in the project folder.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitations:** Obsidian has no public submenu, so all presets are
listed in the ribbon menu itself; there is no export of several selected files
(decided 2026-10-21); headings and images get no menu items yet (story 3).

### Steps

1. Check the version (above) and that the settings tab shows the active preset
   `PageRefs`. If another preset is active, stop and report it.
2. The left ribbon shows a printer icon; hovering it shows `Obsidian2Typst`.
   Click it. The menu reads, top to bottom: `Export current note` (with an
   icon), `Open style panel` (with an icon), a separator line, `Preset` (a
   heading, not clickable), then `A4 digital`, `A5 print`, `Bleed 5`, `Broken
   (invalid)` (greyed out, not clickable), `Callouts`, `Folios`, `Folios
   single`, `Glossary terms`, `Minimal`, `PageRefs` (with a check mark),
   `PageRefs deep`, `Slug 5`. Press Escape: the menu closes. Open it again and
   use **the keyboard only** (SCAR-013): arrow keys move through the items,
   Enter on `A5 print` chooses it; the menu closes. Report any icon that is
   missing (a blank space where an icon should be).
3. Open the settings tab of Obsidian2Typst and, in the right sidebar, the
   style panel (command or ribbon `Open style panel`). **Without closing
   either** (SCAR-016): click the ribbon icon and choose `PageRefs`. At once
   the settings tab marks `PageRefs` as active (`In use`) and the panel's
   preset dropdown shows `PageRefs`. Choose `Folios` from the panel's
   dropdown: the settings tab follows; open the ribbon menu: `Folios` has the
   check mark. Choose `PageRefs` again in the ribbon menu (this is the undo of
   a misplaced choice, SCAR-014).
4. In the file explorer, right-click: `PageRefs.md` — the menu has `Export to
   PDF` and `Preview` together, each with an icon; the folder `Sample` — no
   such items; the image `Sample/assets/cover.png` — none; the
   preset note `Obsidian2Typst/presets/A5 print.md` — none.
5. Open `Folios.md` (it is the active note). In the file explorer, right-click
   `PageRefs.md`, `Export to PDF`, choose `spikes/typst-wasm/m10-export`.
   Expected: `PageRefs.pdf` is written; it is the 7-page PDF of M9 (page 2
   starts with `StepA`), and it has no text of `Folios.md` (no `Player
   Section`); `Folios.md` is still the open, active note (SCAR-015).
6. The panel is still open from step 3. With `Folios.md` active, right-click
   `PageRefs.md` in the file explorer, `Preview`: `PageRefs.md` opens in the
   editor; the panel reads `Preview of: PageRefs` with the hint `Note changed;
   press Refresh` over the greyed pages of the earlier note (US-012 AC-4,
   confirmed 2026-10-21). Press `Refresh`: the pages of `PageRefs` are drawn.
   Close the panel, make `Folios.md` active again and choose `Preview` on
   `PageRefs.md` once more: the panel opens and draws `PageRefs` at once.
7. Split view: open `Folios.md` in a second pane beside `PageRefs.md`; click
   into `PageRefs.md` so it is active. Right-click in the text of `Folios.md`:
   the editor menu has `Export to PDF` and `Preview`. Choose `Preview`: the
   `Folios.md` pane becomes active and the panel reads `Preview of: Folios`
   with `Note changed; press Refresh`; `Refresh` draws `Folios`.
8. Start `Export current note` from the ribbon on `Sample/Book.md`
   (419 pages; choose `m10-export`). While it runs (a few seconds), right-click
   `PageRefs.md`, `Export to PDF`, choose the same folder: the notice `An
   export is already running` appears; the first export finishes normally.
9. Open the command palette: `Obsidian2Typst: Export current note`,
   `Obsidian2Typst: Open style panel` and `Obsidian2Typst: Check compiler
   (developer)` are still there; a hotkey set on one of them still works.
10. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated (SCAR-015).

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M11 — Preset groups and the details pop-up (US-021 AC-3 to AC-11)

**When:** after any change to the `group:` field, the grouping, the three
preset lists, or the details pop-up.

**Needs:** Obsidian desktop and a plain text editor outside Obsidian (for
example TextEdit in plain-text mode). Prepared by the developer (SCAR-012):
the build is installed in the scratch vault (`npm run install:scratch`,
checksum compared); the plugin data is unchanged (active preset `Folios`);
seven preset notes in `Obsidian2Typst/presets/` got a `group:` line right
after `schemaVersion: 1` (their earlier versions are in
`spikes/typst-wasm/m11-state-backup/`, with checksums):

| Preset note | Line added |
|---|---|
| `A5 print.md`, `Folios.md`, `PageRefs.md`, `PageRefs deep.md` | `group: Print` |
| `Folios single.md` | `group: print` (lower case: the same group) |
| `Broken.md` (invalid: `page.bleed: abc`) | `group: Print` |
| `A4 digital.md` | `group: Screen` |

`Bleed 5`, `Callouts`, `Glossary terms`, `Minimal`, `Slug 5` have no group.

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitations:** the pop-up and the settings window are modal, so a
note cannot be edited inside Obsidian while they are open; the steps that
change a note while they are open use the text editor outside Obsidian. The
lists without any group are those of M10 (no change; also guarded by tests).

The lists and the table below were computed from the vault's notes and plugin
data with the plugin's own functions (2026-10-21).

### Steps

1. Check the version (above) and that the active preset is `Folios`. If
   another preset is active, stop and report it.
2. Settings tab, `Presets`: a heading `Print` with the rows `A5 print`,
   `Broken` (its description `invalid: page.bleed must be a number of at least
   0 (line 5)`), `Folios` (`In use`), `Folios single`, `PageRefs`,
   `PageRefs deep`; a heading `Screen` with `A4 digital`; a heading `Other`
   with `Bleed 5`, `Callouts`, `Glossary terms`, `Minimal`, `Slug 5`. Each row
   has the buttons `Use`, `Details`, `Duplicate`, `Rename`, `Delete`, in that
   order.
3. Close the settings window. Open the style panel (if it is not open), then
   quit Obsidian and start it again; the panel comes back with the workspace.
   **Without any other action** (build `m11.2` fixed this: the dropdown was
   empty after a restart until a later change), open the panel's preset
   dropdown. The native menu shows the group headings `Print`, `Screen`,
   `Other` (not selectable) with the same presets under them; `Broken` is
   greyed out; `Folios` is selected. Right of the dropdown is an `info` icon;
   hovering it shows `Details of the preset`.
   Then, with the panel open, Settings → `Folders and warnings` → `Presets
   folder`: type `Obsidian2Typst/presets-m11` and press Enter (the folder does
   not exist; the plugin creates it with `A4 digital` and `A5 print`). Close
   the settings window: the panel's dropdown lists `A4 digital` and `A5
   print`, no headings, without reopening the panel. Set the field back to
   `Obsidian2Typst/presets` and press Enter: the grouped list is back. (The
   folder `Obsidian2Typst/presets-m11` may be deleted afterwards.)
4. Ribbon menu (the printer icon): `Export current note`, `Open style panel`,
   a separator, `Print` (heading) with `A5 print`, `Broken (invalid)`
   (greyed), `Folios` (check mark), `Folios single`, `PageRefs`, `PageRefs
   deep`; a separator, `Screen` with `A4 digital`; a separator, `Other` with
   `Bleed 5`, `Callouts`, `Glossary terms`, `Minimal`, `Slug 5`. There is no
   `Preset` heading any more.
5. Settings tab, row `PageRefs deep`, `Details`. A pop-up titled `Preset
   "PageRefs deep"` with the columns `Setting`, `In this preset`, `Used`.
   Check these rows (in this order among the others): `Footnotes for external
   links` — empty — `true (Defaults)`; `Trim size` — `A5` — `A5 (preset)`;
   `Trim width (mm)` — empty — `— (preset)`; `Bleed (mm)` — empty — `0
   (built-in)`; `Link page level` — `3` — `3 (preset)`; `Link page word` —
   `S.` — `S. (preset)`; `Code font` — empty — `DejaVu Sans Mono (Defaults)`;
   last three: `Cover` — `auto` — `auto (preset)`; `Callout styles` — empty —
   `— (built-in)`; `Heading rules` — empty — `Glossary → glossary (built-in)`.
   The buttons read `Use`, `Open the note`, `Close`; `Close` has the focus:
   press Enter — the pop-up closes. Open it again and press Escape — it
   closes (SCAR-013).
6. Open `Details` of `PageRefs deep` again and click `Use`: the pop-up stays
   open and the button reads `In use` (greyed); behind it the settings tab
   row of `PageRefs deep` reads `In use`. Close the pop-up. In the panel the
   dropdown shows `PageRefs deep`. Choose `Folios` again in the ribbon menu
   (the undo of a misplaced `Use`, SCAR-014).
7. Panel, `info` icon: the pop-up of `Folios` opens. Close it. Choose
   `PageRefs` in the ribbon menu, then click the `info` icon at once
   (without redrawing anything else): the pop-up of `PageRefs` opens
   (SCAR-016). Close it and choose `Folios` again.
8. Settings tab, row `Broken`, `Details`: the pop-up shows `page.bleed must be
   a number of at least 0 (line 5)` instead of the table; `Use` is greyed;
   `Open the note` opens `Broken.md` in the editor and closes the pop-up.
9. Settings tab, row `PageRefs deep`, `Details`, and leave the pop-up open.
   In the text editor outside Obsidian, change `linkPageLevel: 3` to
   `linkPageLevel: 4` in `Obsidian2Typst/presets/PageRefs deep.md` and save:
   within a second the pop-up's row `Link page level` reads `4` — `4
   (preset)`, without reopening it. Change it back to `3` and save; close the
   pop-up.
10. Keep the settings tab and the style panel open. In the text editor
    outside Obsidian, change `group: Screen` to `group: Print` in
    `A4 digital.md` and save: the settings tab shows `A4 digital` as the
    first row under `Print` (settings order: before `A5 print`) and no
    `Screen` heading any more; the panel's dropdown shows the same,
    without reopening either (SCAR-016). Change it back to `group: Screen`
    and save: `Screen` is back.
11. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated (SCAR-015).

After the check, the developer restores the seven preset notes from the
backup (checksums compared) when the user asks for it.

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M12 — Heading and image menus that change the active preset (US-022 AC-1, AC-3, AC-5 to AC-12)

**When:** after any change to the editor or file explorer menu items of
US-022, the question, the write of a preset note, or the image check.

**Needs:** Obsidian desktop and a plain text editor outside Obsidian (for
example TextEdit in plain-text mode). Prepared by the developer (SCAR-012):
the build is installed in the scratch vault (`npm run install:scratch`,
checksum compared); the plugin data is unchanged (active preset `Folios`,
presets folder `Obsidian2Typst/presets`; the `group:` lines of M11 are still
in place); new in the vault: the note `Menus.md` at its root and the file
`Menus/m12-broken.png` (text, not a PNG image); `Obsidian2Typst/presets/
Folios.md` is backed up in `spikes/typst-wasm/m12-state-backup/` with a
checksum (the check changes it through the plugin and puts it back).

`Menus.md`, with the line numbers the editor shows:

| Line | Text |
|---|---|
| 1 | `# Glossar` |
| 3 | `A paragraph without images.` |
| 5, 6 | `> [!note] A box`, `> ## Boxed` |
| 8 | `# Glossary` |
| 10 | `## Gambit` (a term of the built-in glossary section) |
| 12 | `Explains the action.` |
| 14 | `# Pictures` |
| 16 | `![[wide.png]]` (`Layouting/Cover/wide.png`) |
| 18 | `Two: ![Quill](Layouting/Icons/quill.png) and ![[m12-broken.png]]` |
| 20 | `![](https://example.org/a.png)` (remote) |

`Folios.md` at the start (call it **S0**):

```
---
schemaVersion: 1
group: Print
page:
  trimSize: A5
  folios: true
  runningHeader: true
  runningHeaderLevel: 2
cover:
  mode: auto
---
```

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin list).
If it differs, stop: the wrong build is installed. Restart Obsidian once so the
new build is loaded.

**Known limitations:** an image deleted or replaced after the menu opened,
and the active preset switched while the question is open, cannot be done by
hand (the menu and the question hold the window); tests cover them. The
editor menu lists the US-020 items `Export to PDF` and `Preview` first; the
US-022 items follow in the same group. The preview's content is not part of
this check (glossary output: M7; cover page: M4).

The titles, questions and note texts below were computed from these files
with the plugin's own functions (2026-10-22).

### Steps

1. Check the version (above) and that the active preset is `Folios`. If
   another preset is active, stop and report it. Open `Menus.md` in the left
   pane and `Obsidian2Typst/presets/Folios.md` in a pane to the right of it
   (in source mode, so the frontmatter shows as text); open the style panel.
2. The editor menu of `Menus.md`, line by line: click into the line, then
   right-click on it.
   - Line 1: `Use as glossary section` (a list icon).
   - Lines 3, 6, 10 and 20: no item beyond `Export to PDF` and `Preview`.
   - Line 8: `Stop using as glossary section` (the built-in rule).
   - Line 14: `Use as glossary section`.
   - Line 16: `Use as cover` (an image icon).
   - Line 18: `Use "quill.png" as cover`, then `Use "m12-broken.png" as cover`.
3. AC-11: click into line 3, then right-click directly on line 1 without
   clicking first. Report which items appear: `Use as glossary section` means
   the right-click moved the cursor; no US-022 item means it did not. Either
   is a result, not a failure; report it. Press Escape to close the menu.
4. The question and its keys (SCAR-013, SCAR-014). Line 1, `Use as glossary
   section`: a dialog titled `Change preset "Folios"` with the line `Add
   "Glossar" → glossary to the heading rules of preset "Folios"?` and the
   buttons `Change preset` and `Cancel`; `Cancel` has the focus. Press Escape:
   the dialog closes and `Folios.md` is still S0. Open it again and press
   Enter: it closes (Enter acts on `Cancel`) and `Folios.md` is still S0; no
   notice appears either time.
5. Open it again and click `Change preset`. The notice `Preset "Folios"
   changed`. `Folios.md` now ends with these lines before the closing `---`
   (the rest as in S0):
   ```
   cover:
     mode: auto
   headingRules:
     Glossar: glossary
   ```
   In the panel, click the `info` icon: the pop-up's last row reads `Heading
   rules` — `Glossar → glossary` — `Glossar → glossary (preset)`. Close it.
6. Right-click line 1 again: `Stop using as glossary section`. Its question:
   `Remove "Glossar" from the heading rules of preset "Folios"?`. Click
   `Change preset`: `Folios.md` is S0 again (no `headingRules` lines), and the
   pop-up's row reads `Heading rules` — empty — `Glossary → glossary
   (built-in)`.
7. Line 8, `Stop using as glossary section`: `Set "Glossary" → none in the
   heading rules of preset "Folios"?`; `Change preset`. `Folios.md` ends with
   `headingRules:` and `  Glossary: none`. Now line 10 (`## Gambit`, no
   longer a term) offers `Use as glossary section` with `Add "Gambit" →
   glossary to the heading rules of preset "Folios"?` — click `Cancel`
   (nothing written). Line 8 now offers `Use as glossary section`: `Remove
   "Glossary" from the heading rules of preset "Folios"?`; `Change preset`:
   `Folios.md` is S0 again.
8. Line 16, `Use as cover`: `Make "Layouting/Cover/wide.png" the cover of
   preset "Folios"?`; `Change preset`. The `cover` lines of `Folios.md` read:
   ```
   cover:
     mode: file
     file: Layouting/Cover/wide.png
   ```
   In the panel's `Cover` group, without reopening the panel (SCAR-016):
   `Cover` reads `file; set by preset "Folios"; change it in the preset note`,
   `Cover image` reads `Layouting/Cover/wide.png; set by preset "Folios";
   change it in the preset note`. Line 16 now offers `Stop using as cover`;
   line 18 still offers `Use "quill.png" as cover` and `Use "m12-broken.png"
   as cover`.
9. Line 18, `Use "m12-broken.png" as cover`: no dialog; the notice
   `"m12-broken.png" is not a valid .png image; preset "Folios" was not
   changed`; `Folios.md` unchanged (still `wide.png`).
10. File explorer: right-click `Layouting/Cover/wide.png`: `Stop using as
    cover`; its question `Set the cover of preset "Folios" back to auto (the
    first image of the note)?`; `Change preset`: `Folios.md` is S0 again; the
    panel's `Cover` reads `auto; set by preset "Folios"; change it in the
    preset note` and `Cover image` reads `none; built-in value; set it in a
    preset note`. Right-click `Menus/m12-broken.png`: `Use as cover`; click
    it: the same refusal notice as in step 9, no dialog. Right-click
    `Menus.md`: no `Use as cover` (only `Export to PDF` and `Preview`).
11. A preset note gets no item (AC-6): right-click in the `Folios.md` pane on
    the line `group: Print`: no `Export to PDF`, `Preview` or US-022 item.
12. An invalid active preset (AC-6, SCAR-019). In the text editor outside
    Obsidian, add the line `  bleed: abc` right under `page:` in
    `Obsidian2Typst/presets/Folios.md` and save. In `Menus.md`: line 1 shows
    `Use as glossary section (preset "Folios" is invalid)` and line 16 `Use
    as cover (preset "Folios" is invalid)`, both greyed out and doing nothing
    when clicked. Remove the line `  bleed: abc` again and save: line 1 offers
    `Use as glossary section` again.
13. A preset note without frontmatter is not written (AC-7). In the text
    editor, select all of `Folios.md`, cut it (keep it on the clipboard),
    type `Notes only.` and save. In `Menus.md`, line 1, `Use as glossary
    section`, `Change preset`: the notice `The preset note has no
    frontmatter`; `Folios.md` still reads `Notes only.`. In the text editor,
    select all, paste the clipboard back and save: `Folios.md` is S0 again.
14. Is anything missing, odd or ugly that this list did not ask about? Report
    it even if it seems unrelated (SCAR-015).

After the check, the developer compares `Folios.md` with the backup (checksum)
and restores it from `spikes/typst-wasm/m12-state-backup/` if it differs; the
fixtures `Menus.md` and `Menus/` stay unless the user asks to remove them.

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

## M13 — A template that styles the document: A5 MU Print (US-023 AC-1, AC-3, AC-5, AC-7, AC-11)

**When:** after any change to the template hook, the warning for top-level
template rules, or the A5 MU Print template.

**Needs:** Obsidian desktop. Prepared by the developer (SCAR-012): the build is
installed in the scratch vault (`npm run install:scratch`, checksum compared);
the plugin data is unchanged (active preset `Folios`); new in the vault: the
note `MU check.md` at its root, the folder `Obsidian2Typst/templates/` with
`A5 MU Print.typ` (the template, with `#let template(doc)`) and
`MU top-level rule.typ` (one `#set` at the top level, line 3); the preset
`A5 MU Print` selects the template (`template: Obsidian2Typst/templates/A5 MU
Print.typ`). The preset note as handed over is backed up in
`spikes/typst-wasm/m13-state-backup/handover/` with a checksum (step 6 changes
it and puts it back); `m13-state-backup/before/` holds it as it was before
this check (without the `template:` line). An empty export folder `spikes/typst-wasm/m13-export` is in the
project folder. The new names exist once in the vault (listing, 2026-10-22).

**Run in the scratch vault** (`spikes/typst-wasm/scratch-vault`). **Expected
version:** `0.9.1` (first line of the settings tab, also the plugin
list). If it differs, stop: the wrong build is installed. Restart Obsidian once
so the new build is loaded.

**Known limitations:** the four fonts of the style guide are not in the vault
(`Layouting/Fonts/MU` does not exist), so every text uses the default fonts
(Libertinus Serif, DejaVu Sans Mono for code) and the export reports the four
font warnings of step 4. The footnote font of the template is one of them: the
footnote shows in the default font. The template's blue line rule also draws
the short line above the footnotes. Ornaments, columns, margin notes and
illuminated initials are not part of this check. The style panel shows no
warnings; they are in the warnings note of an export.

The texts, colours and warnings below were computed from these files with the
plugin's own preparation, font set and compiler (2026-10-22).

### Steps

1. Check the version (above). The active preset is `Folios`.
2. Ribbon menu (the printer icon): choose `A5 MU Print` (under `Print`). Open
   `MU check.md` and the style panel; the preview shows two pages:
   - **Page 1:** the whole page in a light parchment colour, darker toward
     all four edges (the fade), smoothly and without seams: no hard edge
     where the side fades meet the top and bottom ones (fixed after the first
     run, 2026-10-22); the title `The Code of Honor`, larger than the
     other headings and not numbered; `Tessera` in gold; the text in near-black
     ink; `See Glossary (p. 2) for the terms.`; eight paragraphs `The rules of
     combat, part 1:` … `part 8:`; at the bottom a short blue line, the
     footnote `1 Wisdom through study.` and the page number `1` at the right.
     No header on this page (it starts with the title).
   - **Page 2:** the header `Glossary` at the top centre; `Attacks` in bold,
     `Detail` not bold; a blue line across the text (the `---`); the box
     `Mechanics box` with a parchment fill and a brown (Burnt Umber) border
     and title, two bullet points inside; the table `Name / Mind / Body` with
     a gold header row, the rows `Fox`, `Bear`, `Owl` on alternating parchment
     colours and thin brown lines; the list `one`, `two`, `three` on three
     levels; the quill image; `Glossary` in gold with the term `Moss` and
     `The sum of Mind, Body and Agility.`; the page number `2` at the left.
3. Guard (SCAR-015): ribbon menu, choose `A5 print`: the preview turns white,
   the headings are numbered (`1 The Code of Honor`, `1.1 Tessera`) and black,
   the table has no colours. Choose `A5 MU Print` again: the parchment page is
   back, without reopening the panel.
4. With `A5 MU Print` active and `MU check.md` open: `Export current note`,
   folder `spikes/typst-wasm/m13-export`. The PDF `MU check.pdf` shows the
   same two pages as the preview (step 2). The warnings note
   `MU check export warnings.md` lists exactly four warnings and no
   `TEMPLATE_…` one:
   - `FONT_FOLDER_MISSING`  `Font folder not found: Layouting/Fonts/MU`
   - `FONT_MISSING`  `Font "Crimson Pro" for body was not found; "Libertinus Serif" is used`
   - `FONT_MISSING`  `Font "IM Fell English SC" for heading was not found; "Libertinus Serif" is used`
   - `FONT_MISSING`  `Font "Inter" for code was not found; "DejaVu Sans Mono" is used`
5. Edit the template with the panel open (SCAR-016): in a text editor outside
   Obsidian, in `Obsidian2Typst/templates/A5 MU Print.typ` change
   `#let mu-gold = rgb("#C9A44A")` to `#let mu-gold = rgb("#2F4F9E")` and
   save. In the panel click `Refresh`: `Tessera` and `Glossary` turn blue, and
   so does the table's header row. Change it back to `#C9A44A`, save, click
   `Refresh`: gold again.
6. The warning for a top-level rule (AC-5): open the preset note
   `Obsidian2Typst/presets/A5 MU Print.md` and change its `template:` line to
   `template: Obsidian2Typst/templates/MU top-level rule.typ`. The preview of
   `MU check.md` turns white (that template's only rule is at the top level,
   so it does not apply; the headings stay unnumbered and the `Mechanics box`
   keeps its parchment fill and brown border, which come from the preset). Export again into the same folder: the warnings note now
   starts with `TEMPLATE_RULE_IGNORED`  `Template rule at line 3 does not
   apply; put it inside template(doc)`, followed by the four font warnings of
   step 4. Change the `template:` line back to
   `template: Obsidian2Typst/templates/A5 MU Print.typ`: the parchment page
   is back.
7. Is anything missing, odd or ugly that this list did not ask about? Report
   it even if it seems unrelated (SCAR-015).

After the check, the developer compares the preset note with
`m13-state-backup/handover/` (checksum) and restores it if it differs; the
template files, `MU check.md` and the export folder stay unless the user asks
to remove them.

### Record

Append a dated line to `docs/technical/spike-typst-wasm.md`, section "Manual
runs": date, build version and checksum, Obsidian version and operating system,
result per step.

