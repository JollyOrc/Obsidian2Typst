# US-022 — Heading and image menus that change the active preset

**Status:** Done (2026-10-22)
**Introduced:** v0.8.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.8.0 (test build `0.8.0-m12.1`, M12 passed 2026-10-22)
**Supersedes:** —

---

## Story

**As an** author,
**I want** to right-click a heading to make it a glossary section, and an
image to make it the cover, without opening the preset note,
**so that** the print settings follow the note I am looking at.

Decided by the user (`docs/state/00_governance.md`, 2026-10-21): story 3 of
Plugin UX. The items appear in the editor menu on a heading line (`Use as
glossary section`) and on a line with an image (`Use as cover`), and in the
file explorer menu on an image file (`Use as cover`). Before every write the
plugin asks, naming the preset note and the exact change (`Change preset` /
`Cancel`, `Cancel` focused). Only the one key changes; content, order and
comments of the rest stay (the `yaml` Document API, one atomic write; the
library's re-spacing is accepted). An item for a heading or image already in
use offers to stop. `Stop using as cover` goes back to `auto`. Heading rules
get the smallest change that gives the wanted result, honouring the built-in
rule `Glossary: glossary` (US-017).

Today (by grep, SCAR-017, 2026-10-21): preset notes are written only whole
(`create`, `rename`, `trash` in `src/plugin/presets/store.ts`); no code changes
a field inside one. The fields: `cover` (US-011: `mode: auto | file | none`;
`file` a vault path, needed with `mode: file`), `headingRules` (US-017: text →
`glossary` or `none`, compared by `headingRuleKey`; the built-in mapping is
`Glossary: glossary`; only top-level headings are matched, and none inside an
open glossary section). Images (US-003): `![[name.png]]` and `![](path)` of
the types png, jpg, jpeg, gif, webp, svg, found in the vault by the asset
resolver; remote addresses are not vault files.

Measured 2026-10-21 (`yaml` 2.9.1, the parser's library; scratch probe
`p022/yaml-probe.mjs`): `setIn` and `deleteIn` on the parsed frontmatter keep
the other keys, their order and their comments; a new key is appended at the
end of its map; a map that becomes empty can be removed; blanks before a
comment become one blank; a comment at the end of the frontmatter gets a
blank line before it; flow maps are written `{ a: b, c: d }`; a key with `: `
is quoted; a comment on a changed value stays on its line. Decided by the
user: this re-spacing is fine.

---

## Acceptance criteria

- **AC-1 (which heading gets an item):** In the editor menu of a Markdown note
  outside the presets folder, the line of the cursor when the menu opens (see
  AC-11) is a heading that US-017 can match: a top-level heading of the note
  (not inside a callout, quote or list), not empty, and not inside an open
  glossary section (where US-017 does not look at rules). Its text is its
  visible text as US-017 compares it (`visibleText`, images left out). The
  item is `Use as glossary section` when the active preset's rule table
  (`headingRuleTable`, the built-in mapping included) does not map the text's
  key to `glossary`, else `Stop using as glossary section`; icon `list`
  (added at G2, 2026-10-21).

  | Line under the cursor (note) | Active preset holds | Item |
  |---|---|---|
  | `# Glossar` | no `headingRules` | `Use as glossary section` |
  | `# Glossary` | no `headingRules` (the built-in rule) | `Stop using as glossary section` |
  | `## Begriffe *A–Z*` | `Begriffe A–Z: glossary` | `Stop using as glossary section` |
  | `# Glossary` | `Glossary: none` | `Use as glossary section` |
  | `> ## Boxed` (in a callout) | — | none |
  | `## Gambit` under an open `# Glossary` section (a term) | — | none (decided 2026-10-21: a rule there has no effect) |
  | a paragraph line | — | none |

- **AC-2 (what is written for a heading — the smallest change):**
  | Wanted | The preset holds for the key | Written |
  |---|---|---|
  | glossary | nothing, and the built-in rule does not apply | `<text>: glossary` added |
  | glossary | `<text>: none`, the built-in rule applies (`Glossary`) | the key removed |
  | glossary | `<text>: none`, no built-in rule | `<text>: glossary` (value changed) |
  | stop | `<text>: glossary`, no built-in rule | the key removed |
  | stop | nothing, the built-in rule applies | `<text>: none` added |
  | stop | `<text>: glossary`, the built-in rule applies | `<text>: none` (value changed) |

  The key is written as the heading's visible text (a preset key already
  present with another spelling of the same comparison form is changed or
  removed in place, not doubled). A `headingRules` map that becomes empty is
  removed. Examples (measured):
  ```
  before                         after `Use` on `# Glossar`
  schemaVersion: 1   # format    schemaVersion: 1 # format
  group: Print                   group: Print
  page:                          page:
    trimSize: A5 # the book        trimSize: A5 # the book
                                 headingRules:
                                   Glossar: glossary
  ```
  ```
  before                         after `Stop` on `## Begriffe`
  schemaVersion: 1               schemaVersion: 1
  headingRules:                  page:
    Begriffe: glossary             bleed: 3
  page:
    bleed: 3
  ```

- **AC-3 (which image gets an item):** In the editor menu, the line of the
  cursor holds an image that is a vault file of a supported type, found in
  the vault's file list by the asset resolver's lookup (US-003) without
  reading the file (amended 2026-10-22: the menu is built synchronously, see
  AC-9; the bytes are checked after the click): `![[cover.png]]`, `![](assets/cover.png)`,
  `![Map](<assets/the map.png>)`. No item for a remote image
  (`![](https://example.org/a.png)`), an unsupported type (`![[a.pdf]]`), an
  image that is not found, or a line without an image. A file whose bytes do
  not match its type (`broken.png` holding text) gets an item; the click
  refuses it (AC-9). Several images on the
  line (decided 2026-10-21): one item per image in the order of the line,
  each with the file name — `Use "front.png" as cover`, `Use "back.png" as
  cover` (or `Stop using "front.png" as cover`); a line with one image keeps
  the plain `Use as cover`. In the file explorer menu: an image file of a
  supported type (`Sample/assets/cover.png`). The item is `Use as cover`,
  or `Stop using as cover` when the active preset holds `cover.mode: file`
  and `cover.file` equal to that vault path; icon `image` (added at G2).

- **AC-4 (what is written for an image):** `Use as cover` sets `cover.mode:
  file` and `cover.file: <vault path>` (other `cover` keys kept); `Stop using
  as cover` sets `cover.mode: auto` and removes `cover.file`. Examples
  (measured):
  ```
  before                         after `Use as cover` on Sample/assets/cover.png
  schemaVersion: 1               schemaVersion: 1
  cover:                         cover:
    mode: auto   # first image     mode: file # first image
    blankPageAfter: true           blankPageAfter: true
                                   file: Sample/assets/cover.png
  ```
  ```
  before                         after `Stop using as cover`
  cover:                         cover:
    mode: file                     mode: auto
    file: "a/b.png" # here         blankPageAfter: true
    blankPageAfter: true
  ```

- **AC-5 (the question, SCAR-014):** Before every write, a question names the
  preset and the exact change; nothing is written before `Change preset` and
  nothing after `Cancel` or Escape. `Cancel` has the focus; Enter acts on the
  focused button. The dialog is titled `Change preset "<name>"`; its buttons
  read `Change preset` and `Cancel`. The verb follows the change (added at
  G2): `Add … to` for a new key with `glossary`, `Set … in` for a key whose
  value changes or a new key with `none`, `Remove … from` for a removed key.
  Texts:
  - `Add "Glossar" → glossary to the heading rules of preset "Folios"?`
  - `Set "Glossar" → glossary in the heading rules of preset "Folios"?`
    (the preset held `Glossar: none`)
  - `Remove "Begriffe" from the heading rules of preset "Folios"?`
  - `Set "Glossary" → none in the heading rules of preset "Folios"?` (the
    built-in rule would still apply)
  - `Make "Sample/assets/cover.png" the cover of preset "Folios"?`
  - `Set the cover of preset "Folios" back to auto (the first image of the
    note)?`
  The worst misplaced click is an item on the wrong line or note: the
  question names the heading text or the image path, so it can be cancelled.

- **AC-6 (which preset, SCAR-019):** the active preset (`pickActive`, as an
  export). With no preset the items are shown disabled as `Use as glossary
  section (no preset)`; with an invalid active preset disabled as `… (preset
  "Broken" is invalid)` — an invalid note is never written. A preset note
  itself (in the presets folder) gets no item.

- **AC-7 (the write):** one atomic write of the preset note (the vault's
  `process`), in which the frontmatter is parsed, the one key changed by
  `setIn`/`deleteIn`, and written back; the body of the note and the text
  outside the frontmatter stay byte for byte. The note is read again at the
  moment of the write (not when the question opened): a change made in
  between is kept. A note whose frontmatter is not YAML is not written (the
  parser's message as a notice); a note without frontmatter is not written
  either: `The preset note has no frontmatter` (added at G2: a preset that
  reads as valid without frontmatter sets nothing, and the plugin does not
  create one).

- **AC-8 (after the write, SCAR-016):** the store re-reads the note (it
  watches the vault), so every screen that shows the preset follows: the
  details pop-up, the panel's rows (`Set by preset "Folios"`), the preview
  (restarts after the delay, US-012 AC-5), the next export. A notice says
  `Preset "Folios" changed` (decided 2026-10-21: the change is in a note the
  author does not see).

- **AC-9 (state at the click, SCAR-016, SCAR-008):** Obsidian's editor and
  file explorer menus are built synchronously (the `editor-menu` and
  `file-menu` callbacks return before any file can be read), so the menu uses
  only what is in memory when it opens: the note's text and the cursor line
  (`editor.getValue()`, `getCursor()`), the vault's file list
  (`vault.getFiles()`), the active preset with its fields (the store), the
  settings. Everything else is read by the action (amended 2026-10-22):
  1. at the click of a `Use as cover` item, before the question: the image's
     first bytes, checked as US-003 checks them (`sniffImage`). A refusal
     comes before the question (SCAR-014) and writes nothing; the notice
     names the image's file name and the preset the item was built for:
     - bytes that do not match the type: `"broken.png" is not a valid .png
       image; preset "Folios" was not changed`;
     - the file deleted or renamed after the menu opened: `"cover.png" no
       longer exists; preset "Folios" was not changed` (decision 4, decided
       2026-10-22).

     `Stop using as cover` and the heading items read no file (nothing about
     an image is written).
  2. at `Change preset`: the active preset again; if it changed (or became
     invalid) in between, nothing is written and the notice says so (`The
     active preset changed; nothing was written`).
  3. at the write: the preset note (AC-7).

  | Order of events | Result |
  |---|---|
  | menu on `![[cover.png]]` (a PNG) → click `Use as cover` | the question of AC-5 |
  | menu on `![[broken.png]]` (text in a `.png`) → click | the notice `"broken.png" is not a valid .png image; preset "Folios" was not changed`, no question |
  | menu on `![[cover.png]]` → `cover.png` replaced by a text file → click | the same refusal for `cover.png` |
  | menu on `![[cover.png]]` → `cover.png` deleted → click | `"cover.png" no longer exists; preset "Folios" was not changed` |
  | menu on `![[front.png]] ![[broken.png]]` → click `Use "front.png" as cover` | the question (each item checks only its own image) |
  | file explorer on `broken.png` → click `Use as cover` | the refusal |
  | menu → the active preset switched to `Book` in the panel → `Change preset` | `The active preset changed; nothing was written` |

- **AC-10 (one writer, SCAR-017):** one pure function in `src/core/presets`
  changes one key of a preset note's text (`editPresetField(text, change)`),
  and one action in `src/plugin/actions.ts` writes it; a text check shows that
  no other file writes a preset note's frontmatter. The image's bytes are
  checked with the resolver's own `sniffImage`, and the menu's lookup is the
  resolver's lookup without its byte check — no copy of either (amended
  2026-10-22).

- **AC-11 (the line of the right-click, SCAR-008):** the items are for the
  line of the editor's cursor when the menu opens (`editor.getCursor()`); the
  editor-menu event has no mouse position. Whether Obsidian moves the cursor
  to a right-click is measured in the manual check (AC-12); the question of
  AC-5 names the heading or image, so a mismatch cannot write unseen.
  Measured in M12 (2026-10-22, Obsidian 1.14.4): a right-click does **not**
  move the cursor; the author clicks into the line first.

- **AC-12 (manual check):** in Obsidian, with a test build and backed-up
  preset notes: each item on the lines of AC-1 and AC-3 and on an image file,
  the question's texts and keys (Escape, Enter on `Cancel`), the change in the
  preset note (opened after the write: the key and its neighbours as in AC-2
  and AC-4), the pop-up and the panel following, an invalid active preset,
  an image whose bytes do not match its type and an image deleted after the
  menu opened (both refused before the question, AC-9; added 2026-10-22),
  whether a right-click moves the cursor; the open question (SCAR-015).

---

## Decisions (1 to 3 answered 2026-10-21; 4 answered 2026-10-22)

1. **Several images on one line.** *Decided: one item per image.* Proposed: one item per image, each titled
   with the image's file name (`Use "front.png" as cover`), in the order of
   the line. Alternative: only the first image of the line.
2. **A notice after the write.** *Decided: a notice.* Proposed: `Preset "Folios" changed` (the
   change is in another note the author does not see). Alternative: no
   notice (the panel and pop-up show it).
3. **A heading inside an open glossary section** *(decided: no item)* (a term such as `## Gambit`
   under `# Glossary`): US-017 does not look at rules there, so a rule for it
   would have no effect. Proposed: no item. Alternative: a disabled item with
   the reason (`… (inside the glossary "Glossary")`).
4. **An image deleted between opening the menu and the click** *(decided
   2026-10-22: the proposed notice)*. Proposed: the notice `"cover.png" no longer exists; preset
   "Folios" was not changed`, nothing written. Alternative: the notice of a
   missing image of US-003 (`Image file not found: cover.png`).

---

## Notes

- Measured from the types (SCAR-008, 2026-10-22): `Workspace.on('editor-menu',
  (menu, editor, info) => any)` and `on('file-menu', …)` are synchronous; the
  items are added before the callback returns. `Vault.readBinary` is the
  plugin's only way to read bytes (async, the whole file).
- New call sites (SCAR-001): `sniffImage` (the byte check at the click; added
  2026-10-22), `visibleText` and `headingRuleKey` (the key),
  `headingRuleTable` (in use or not), `findGlossary` (inside an open section),
  the asset resolver (the image's vault path), `pickActive`, the `yaml`
  Document API (a new use: writing), the vault's `process` (a new use: a
  preset field).
- Worst misplaced click (SCAR-014): an item for the wrong line or note —
  named in the question; `Change preset` on the wrong preset — the question
  names the preset.
- Out of this story: other fields from menus, several presets at once,
  undo inside the plugin (the author edits the preset note).

---

## Related tickets

- [TICKET-062](../tickets/TICKET-062-preset-field-edits.md) — one key of a
  preset note, the smallest change, the questions (AC-2, AC-4, AC-5, AC-7).
- [TICKET-063](../tickets/TICKET-063-line-context.md) — the line context
  (AC-1, AC-3 in the core); amended 2026-10-22: the file list and the
  resolver's lookup without its byte check (AC-3, AC-10).
- [TICKET-064](../tickets/TICKET-064-preset-edit-menus-and-action.md) — the
  items, the question, the write, the notice, the wiring (AC-1, AC-3, AC-5 to
  AC-10); amended 2026-10-22: the byte check at the click (AC-9), the menus
  built from memory, one preset-note predicate.
- [TICKET-065](../tickets/TICKET-065-preset-menus-build-and-m12.md) — test
  build `0.8.0-m12.1`, manual check M12 (AC-11, AC-12).
