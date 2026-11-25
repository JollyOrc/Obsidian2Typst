# The `o2t-encounter` block

**Draft** (2026-11-25), owned by [US-043](../user-stories/US-043-prefilled-encounter-rows.md).
This page is the one contract between the block's writer and its reader
(SCAR-040):

- **Writer:** the Obsidian Vault Compiler (its US-9.6), which turns an
  `[!encounter]` callout of a compiled note into this block.
- **Reader:** this plugin, Obsidian2Typst (US-043), which draws the block as
  prefilled encounter rows. One reader in `src` (SCAR-039).

Measured before it was written (2026-11-25, synthetic notes, Vault Compiler
0.25.0 core and Obsidian2Typst 0.16.0 core in Node): today the compiler turns
a link to a creature note that is not itself compiled into a warning comment,
so the name never reaches this plugin; and this plugin draws an
`[!encounter]` callout as the default box with `CALLOUT_TYPE_UNKNOWN`. The
block replaces both.

## What the block is

One fenced code block per encounter list, holding the list as YAML. It is
data, never text: the plugin does not print the YAML; it draws rows.

````markdown
## Mire Hollow
```o2t-encounter
title: Night watch
rows:
  - name: Fen Hare
    count: "2"
    note: nibbling reeds
    data:
      vigour: 11
      might: 4
      wits: 1
      speed: 5
      attacks:
        - "Kick: 2d6"
  - name: Bog Wight
    count: "1d4"
    data:
      vigour: 20
      might: 6
      states:
        - Fine
        - Down
        - Gone
      attacks:
        - "Claw: 3d8"
        - "Wail: Wits check, 2 successes"
  - name: Lost Pilgrim
    count: "1"
    note: no stats
```
````

## Syntax

1. **Info string:** exactly `o2t-encounter` (as `o2t-entry`, case and
   spacing rules of [entry-block.md](entry-block.md) item 1).
2. **Top level:** a YAML map with
   - `title` (optional): text; the callout's title as written after
     `[!encounter]`, trimmed. Absent or empty → no title.
   - `rows` (required): a list of maps, in the order of the callout's lines.
3. **A row:**
   - `name` (required): text. For a link, the target note's name (not the
     alias: `[[Bog Wight|wights]]` → `Bog Wight`); for a plain line, the text
     as written, trimmed.
   - `count` (required): text, always quoted, one of `N` (`"2"`, digits only)
     or `NdM` / `dM` (`"1d4"`, `"3d6"`, `"d6"`).
   - `note` (optional): text after ` — ` on the callout line, trimmed.
   - `data` (optional): the creature's properties, **exactly the map the
     compiler would write as that note's `o2t-entry` block** (same keys, order,
     exclusions and link flattening), except that asset keys (images) are left
     out. Absent when the line is not a link to an entry note.
4. **Text values** are written so that `yaml` 2.9 reads back the same string
   (quoted where YAML needs it); the reader reads `data` with the
   `o2t-entry` reader's rules (entry-block.md items 4 to 7).
5. **Anything else** at the top level or in a row is ignored by the reader,
   with one warning per block naming the keys (`ENCOUNTER_KEY_UNKNOWN`).

## Where it stands

Where the callout stood: after the compiler's other steps, in the place of
the `> [!encounter]` callout, at the callout's position under the room's
heading. Never inside a quote or another callout (the writer leaves a nested
callout alone, US-9.6).

## What the reader does with it

US-043: one prefilled row per creature, `count` rows for `N`, the highest
roll for `NdM` (`1d4` → 4). The row and its rules are in US-043; this page
only fixes the data.
