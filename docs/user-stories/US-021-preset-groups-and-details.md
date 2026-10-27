# US-021 — Preset groups and a details pop-up

**Status:** Done (2026-10-21)
**Introduced:** v0.7.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.7.0 (test builds `0.7.0-m11.1`, `0.7.0-m11.2`, M11 passed 2026-10-21)
**Supersedes:** —

---

## Story

**As an** author with many presets (print and screen, A5 and A4, languages),
**I want** the preset lists to show my presets in groups I name, and a
pop-up that shows what a preset sets and what an export with it would use,
**so that** I find and choose the right preset without opening its note.

Decided by the user (`docs/state/00_governance.md`, 2026-10-21): story 2 of
Plugin UX. All three preset lists are grouped by a new preset field `group:`
(UI only, no inheritance): the style panel's dropdown, the settings tab's
list, the ribbon menu. Groups in alphabetical order, ungrouped presets last
under `Other`; no headings while no preset has a group. Group names compared
with blanks trimmed, runs of blanks as one and case ignored; the heading is
spelled as the first preset in settings order writes it; `group: Other` joins
the ungrouped. The details pop-up shows the preset's own fields and the
effective value with its source, side by side, with `Use` and `Open the note`;
it opens from a button beside the panel's dropdown and from a `Details`
button on each preset row of the settings tab.

Today (read from the code and by grep for the value, SCAR-017, 2026-10-21):
presets are listed on three screens — the settings tab (`settings-tab.ts`:
one row per preset with `Use`, `Duplicate`, `Rename`, `Delete`), the style
panel (`addPresetDropdown` in `rows.ts`: a native select through Obsidian's
`addDropdown`, an invalid preset's option disabled with its error as tooltip),
the ribbon menu (`menus.ts`, US-020: inline, all presets under `Preset`).
`activePreset` is written only by `usePreset` (US-020) and by rename/delete
(the stored name). The order is `sortPresetNames`. The panel's rows already
say `Set by preset "<name>"; change it in the preset note` where the preset
owns a field (`core/presets/owner.ts`: preset, else Defaults, else built-in).
How each screen updates (SCAR-016): the settings tab and the panel redraw on
`presets.onChange` and on a change of the active preset; the ribbon menu is
built at each click.

Measured 2026-10-21 (Chromium 152, the engine of Obsidian's Electron; scratch
probe `p021/optgroup.html`): options placed in `<optgroup>` elements of the
select stay in `select.options` in document order; setting the value works,
also to a disabled option; the change event gives the option's value; a
group label is never a value. The look of the native menu on macOS is checked
by eye in the manual check (AC-11).

---

## Acceptance criteria

- **AC-1 (the field):** In preset notes only (the Defaults have no groups):
  ```
  group: Print        # text; blanks at the ends are not part of it
  ```
  Message with the line: `group must be text`. Examples (`---`,
  `schemaVersion: 1` first): `group: 5` on line 3 → `group must be text (line
  3)`; `group: [a]` → the same. `null`, `""` and `"   "` are no group (no
  message). In the Defaults the field is ignored, as `cover` is (US-011
  AC-1; decided 2026-10-21).

- **AC-2 (one grouping for all lists, SCAR-017):** One function in
  `src/core/presets` turns the store's entries (in settings order) into
  groups; all three screens call it and nothing else orders presets. The
  rules, with the examples below (SCAR-019: unset, empty, blanks, one group,
  several, case, `Other`):
  1. The key of a group is the text with blanks trimmed, runs of blanks as one
     blank, lower case (as `headingRuleKey` of US-017). `Print`, ` print`,
     `PRINT  ` are one group; `Print run` and `Print  run` are one group.
  2. The heading of a group is the spelling of its first preset in settings
     order.
  3. Groups are in alphabetical order of their key; presets in a group in
     settings order.
  4. Presets without a group, with an empty group, or with a group whose key
     is `other` are listed last under the heading `Other`.
  5. When no preset has a group (all are ungrouped), there are no headings at
     all: the list is today's list.

  | Presets (settings order) and `group:` | Groups |
  |---|---|
  | `A4 digital` —, `A5 print` —, `Minimal` — | no headings: A4 digital, A5 print, Minimal |
  | `A4 digital` `Screen`, `A5 print` `print`, `Book` `Print`, `Minimal` — | `print`: A5 print, Book · `Screen`: A4 digital · `Other`: Minimal |
  | `A5 print` `Print`, `Draft` `other`, `Minimal` `""` | `Print`: A5 print · `Other`: Draft, Minimal |
  | `Solo` `Print` (the only preset) | `Print`: Solo |
  | every preset `group: Other` | no headings (all are ungrouped) |

  An invalid preset keeps its group when its frontmatter is still YAML: the
  `group:` line is read on its own (decided 2026-10-21). Example: `Broken`
  with `group: Print` and `page.bleed: abc` is listed under `Print` as
  `Broken (invalid)`; a preset whose frontmatter is not YAML (an unclosed
  `---`, a tab in the indentation) is listed under `Other`. A `group: 5` in an
  otherwise invalid note is no group (`Other`).

- **AC-3 (the panel's dropdown):** With groups, the options are placed in one
  `<optgroup>` per group, labelled with its heading, in the order of AC-2;
  without groups, as today. The active preset is the selected option, also
  when it is invalid (as today). An invalid preset's option stays disabled
  with its error as tooltip. Choosing an option calls `usePreset(name)`
  (US-020 AC-1).

- **AC-4 (the settings tab's list):** With groups, each group starts with a
  heading row (its heading text) under `Presets`, and its presets follow as
  today's rows; without groups, as today. Each preset row gains a button
  `Details` right after `Use`, which opens the pop-up of that preset
  (AC-6).

- **AC-5 (the ribbon menu):** With groups, the `Preset` label is replaced by
  one label per group (its heading), each after a separator, followed by its
  presets (checked, disabled as in US-020 AC-3); without groups, as today
  (US-020 AC-3):
  ```
  Export current note
  Open style panel
  ───────────
  print                  (label)
  A5 print          ✓
  Book
  ───────────
  Screen                 (label)
  A4 digital
  ───────────
  Other                  (label)
  Minimal
  ```

- **AC-6 (the details pop-up):** A modal titled `Preset "<name>"`. For a valid
  preset, a table of three columns: `Setting`, `In this preset` (the value the
  note sets, or empty), `Used` (the value an export would use) with its source
  in brackets — `(preset)`, `(Defaults)`, `(built-in)` — by the rule of
  `owner.ts` (preset, else Defaults, else built-in; the trim size is one
  group, US-009 AC-14). The rows are the Defaults rows of the settings tab, in
  their order (US-008, US-009, US-010, US-018, US-019 — the labels of
  `DEFAULT_ROWS` and `FONT_ROWS`), then one row each for the preset-only
  groups: `Cover` (mode and file), `Callout styles` (their names), `Heading
  rules` — one summary row each (decided 2026-10-21): `Cover` (`auto,
  assets/cover.png`, `none`, or `auto` for the built-in value — the first
  image of the note, US-011; corrected at TICKET-060), `Callout styles` (their names, comma
  separated), `Heading rules` (`Glossary → glossary`, comma separated), source
  `(preset)` when the note sets the group, else `(built-in)`. Example: the preset `A5 print`
  sets `page.trimSize: A5` and `page.bleed: 3`; the Defaults set `bleed: 2`
  and `highlightColor: "#00ff00"`:
  ```
  Setting             In this preset   Used
  Highlight colour                     #00ff00 (Defaults)
  Trim size           A5               A5 (preset)
  Bleed (mm)          3                3 (preset)
  Slug (mm)                            0 (built-in)
  …
  ```
  Values are written as text (added at G2, 2026-10-21): text as written,
  numbers as written (`10`, `2.5`), `true` / `false`, and `—` for a value
  that is set nowhere (the built-in body font is "the default font": `—`,
  source `(built-in)`).
  An invalid preset: the pop-up shows its error (`page.bleed must be a number
  of at least 0 (line 4)`) instead of the table.

- **AC-7 (the pop-up's buttons and keys, SCAR-013, 014):** Buttons `Use`,
  `Open the note`, `Close`, in that order; `Close` has the focus when the
  pop-up opens; Escape closes; Enter acts on the focused button. `Use` calls
  `usePreset(name)` (US-020) and is disabled for the active preset (text `In
  use`) and for an invalid one; after `Use` the pop-up stays open and the
  button reads `In use` (decided 2026-10-21). `Open the note` opens the preset note in the
  editor (as a click on it in the file explorer does) and closes the pop-up.
  No button deletes or overwrites anything; the worst misplaced click is
  `Use` (undo: choose the earlier preset again, listed as in US-020 AC-4).

- **AC-8 (where the pop-up opens):** From the settings tab's `Details` (AC-4),
  for that row's preset; from a button with the icon `info` and the tooltip
  `Details of the preset` right of the panel's dropdown, for the selected
  (active) preset at the moment of the click (SCAR-016: read when clicked,
  not when the panel was drawn). Example: the panel was drawn with `A5 print`;
  `Book` is chosen in the ribbon menu; the button opens the pop-up of `Book`.

- **AC-9 (updates, SCAR-016 addendum):** When a preset note's `group:`
  changes (the author edits it), the settings tab and the panel redraw their
  lists (they follow `presets.onChange` today); the ribbon menu shows it at
  its next opening. An open pop-up redraws from the store while it is open
  (decided 2026-10-21): the pop-up of `A5 print` is open; the note gets
  `page.bleed: 4`; the row `Bleed (mm)` reads `4` / `4 (preset)` without
  reopening; when `A5 print` is renamed or deleted, the pop-up shows `Preset
  "A5 print" does not exist` and only `Close`. Example: the panel
  and the settings tab are open; `Book` gets `group: Screen`; both lists show
  `Book` under `Screen` without being reopened.
  Every screen that shows presets also follows the loading of the store
  (added after M11, 2026-10-21; the rule is for the whole class, SCAR-017):
  a screen drawn before the presets are read — the style panel that Obsidian
  restores at startup — shows them as soon as they are read, and after a
  change of the presets folder every open screen shows the new folder's
  presets (also when it has none). Example: the panel was open when Obsidian
  quit; after the restart its dropdown shows `Print`, `Screen`, `Other` with
  their presets without any other action. Found by M11 step 3 (the dropdown
  was empty until a later change); a gap since US-012.

- **AC-10 (composed, SCAR-002 widened):** every example is checked against
  US-008 (precedence of preset, Defaults, built-in), US-012 (the panel follows
  the active preset; an edit of a preset note restarts the preview after the
  delay, AC-5 — a `group:` edit does too, as every preset edit), US-020 (the
  actions; the menu built per click). Cases: an active preset inside a group;
  an invalid preset (open decision 5); a group of one; all presets in one
  group (one heading, no `Other`); the pop-up of the active preset from the
  panel while the settings tab is open (`Use` in the pop-up updates both).

- **AC-11 (manual check):** In Obsidian, with a test build: the three lists
  with and without groups (the dropdown's group headings in the native menu
  of macOS), the pop-up of a valid and of an invalid preset from both places,
  its keys (Escape, Enter on `Close`), `Use` and `Open the note`, a `group:`
  edit while the tab and the panel stay open. The check ends with the open
  question (SCAR-015).

---

## Decisions (answered 2026-10-21)

1. **An open pop-up while its preset note changes.** *Decided: redraw.*
   Proposed: the pop-up
   redraws from the store (it listens to `presets.onChange` while open);
   when the preset is deleted or renamed, it shows `Preset "<name>" does not
   exist` and only `Close`. Alternative: the pop-up keeps what it showed until
   it is reopened.
2. **`Use` in the pop-up.** *Decided: stays open.* Proposed: the pop-up stays open and its `Use`
   turns into `In use` (the author can close it or open the note).
   Alternative: `Use` closes the pop-up.
3. **The preset-only groups in the table.** *Decided: summary rows.*
   Proposed: one summary row each
   (`Cover`: mode and file; `Callout styles`: the style names; `Heading
   rules`: `key → rule` pairs), source `(preset)` or `(built-in)`.
   Alternative: one row per field of each group (many rows).
4. **The Defaults and `group:`.** *Decided: preset notes only.* Proposed: preset notes only; a `group` in
   the Defaults is ignored, as `cover`. Alternative: a default group for
   presets without one (would mean an inherited group).
5. **The group of an invalid preset.** *Decided: in its group when the
   frontmatter is still YAML.* Its note does not read, so its fields
   are unknown. Proposed: the `group:` line is read on its own when the rest
   of the frontmatter is invalid but is still YAML, so a broken preset stays in
   its group where the author looks for it; with frontmatter that is not
   YAML, it goes under `Other`. Alternative: every invalid preset under
   `Other`.

---

## Notes

- New controls (SCAR-013 to 017): the `Details` button and the `info` button
  (no field; they open the pop-up); the pop-up (no field; Escape, Enter on
  the focused button, focus on `Close`); its `Use` (an action of US-020) and
  `Open the note`. Worst misplaced click: `Use` (undo named in AC-7).
- New call sites (SCAR-001): `headingRuleKey` (the group key, AC-2 rule 1),
  `owner.ts` (the source column), `usePreset` (the pop-up), `sortPresetNames`
  (the order inside a group), the preset parser (the new field, and a read
  of `group:` alone for an invalid note, decision 5).
- Labels (SCAR-011): the generated heading `Other` cannot clash with a group
  the author names `Other` (it joins the ungrouped, decided).
- Out of this story: inheritance between presets; drag and drop between
  groups; groups in the Defaults (open decision 4); heading and image menus
  (story 3).

---

## Related tickets

- [TICKET-058](../tickets/TICKET-058-group-field-and-grouping.md) — the field,
  the group of an invalid note, `groupPresets` (AC-1, AC-2).
- [TICKET-059](../tickets/TICKET-059-grouped-preset-lists.md) — the three
  lists grouped (AC-3, AC-4 headings, AC-5, AC-9 lists).
- [TICKET-060](../tickets/TICKET-060-preset-details-popup.md) — the details
  pop-up (AC-4 Details, AC-6 to AC-10).
- [TICKET-061](../tickets/TICKET-061-groups-build-and-m11.md) — test build
  `0.7.0-m11.1`, manual check M11 (AC-11).
