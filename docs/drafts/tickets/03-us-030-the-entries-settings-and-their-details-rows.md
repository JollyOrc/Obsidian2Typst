<!-- Filed 2026-11-06 as #124 on the user's go (epic #121, ticket 3 of 16). -->

### User story

[US-030](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-030-entry-data-and-statblock.md), ACs addressed AC-8, AC-9

### Description

Read the `entries` group and `colorMode` from preset notes with their built-in values and messages, and list every set field in the Details view; no rows in the settings tab or the style panel (G0-C9).

### Acceptance criteria (from the user story)

The examples use one invented entry, `Fen Hare`, and a preset with these
`entries` settings (synthetic field names; the built-in defaults are empty):

```yaml
entries:
  statblock:
    stats: [{key: might, label: Might}, {key: wits, label: Wits}, {key: speed, label: Speed}]
    traits: [{key: move, label: Move}, {key: guard, label: Guard}]
    boxes: vigour
    track: [{label: Fine, icon: "Icons/fine.svg"}, {label: Hurt, icon: "Icons/hurt.svg"},
            {label: Down, icon: "Icons/down.svg"}, {label: Fading, icon: "Icons/fading.svg"},
            {label: Gone, icon: "Icons/gone.svg"}]
    trackKey: states
    trackLabel: STATE
    trackDefault: [Fine, Hurt, Down, Gone]
  tagLabels: {beast: Beast, magical: Magical}
```

and this compiled Markdown:

````markdown

- **AC-8 (the `entries` group):** Preset notes get a group `entries` (US-008
  AC-2: unknown fields are kept). This story adds:

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.statblock.stats` | list of `{key, label}` | empty |
  | `entries.statblock.traits` | list of `{key, label}` | empty |
  | `entries.statblock.boxes` | a key | unset |
  | `entries.statblock.track` | list of `{label, icon}` (icon: vault path of an SVG) | empty |
  | `entries.statblock.trackKey` | a key | unset |
  | `entries.statblock.trackLabel` | text | unset (no label line) |
  | `entries.statblock.trackDefault` | list of track labels | all cells of `track` |
  | `entries.statblock.sum` | `{total: key, of: [keys]}` | unset |
  | `entries.statblock.fill` | colour `#rrggbb` or `none` | `none` |
  | `entries.statblock.frame` | `{color, width}` (pt, 0 to 5) | `#000000`, 0.75 |
  | `entries.statblock.rules` | `{color, width}` | `#000000`, 0.4 |
  | `entries.statblock.boxFill` | colour or `none` | `#ffffff` |
  | `entries.statblock.fonts` | `{band, values, text, skills, tags}` family names | the body font |
  | `entries.statblock.sizes` | `{band, value, label, text, attacks, skills}` in pt | 11.5, 11, 5.5, 7, 7.5, 9 |
  | `entries.tagLabels` | map tag → label | empty |
  | `colorMode` | `color` or `grayscale` (top level) | `color` |

  Invalid values make the preset invalid (US-008 AC-4) with the line of the
  field and a message naming it, in the form of US-016 AC-7. Examples (note
  starts `---`, `schemaVersion: 1`, `entries:` on line 3, `statblock:` on
  line 4): `boxes: [vigour]` on line 5 → `entries.statblock.boxes must be a
  key (line 5)`; `trackDefault: [Fine, Lost]` → `entries.statblock.trackDefault
  names "Lost", which is not in entries.statblock.track (line 5)`;
  `frame: {width: 9}` → `entries.statblock.frame.width must be a number of pt
  from 0 to 5 (line 5)`. `null` is unset.

- **AC-9 (where they show):** The Details view (US-021 AC-6) lists every
  `entries.*` field the preset sets, with its source, in the order of the
  table. The settings tab's Defaults and the style panel get no rows
  (G0-C9).

## Decisions (answered by the user, 2026-11-06)

1. **Attack text without `: `:** printed whole on the left; `Name: dice` is
   the documented form (AC-10). `STAT_ATTACK_NO_DICE` still applies (AC-18).
2. **Track key as one word:** a one-item list, as every list key (AC-5);
   `none` means no track (AC-13).
3. **A block under a glossary term:** not supported; not read as an entry,
   `ENTRY_IN_GLOSSARY` (AC-21).
4. **Strict mode:** no entry warning stops the export (AC-19).

### Implementation notes

- `src/core/presets/parse.ts`: validators for every field of US-030 AC-8 in the form of US-016 AC-7's messages (`entries.statblock.boxes must be a key`, `… trackDefault names "<x>", which is not in entries.statblock.track`, `… frame.width must be a number of pt from 0 to 5`); `colorMode` top level (`color`, `grayscale`); `null` is unset; unknown fields kept (US-008 AC-2).
- Built-in values in one place (`src/core/settings` or the presets' built-ins), pure data.
- `src/plugin/settings/details.ts` `detailRows`: one row per set `entries.*` field labelled with its path (`entries.statblock.boxes`), and `colorMode`, in the table's order, with their source; nothing when the preset sets no `entries` field.
- The settings tab (`TAB_LAYOUT`) and the style panel (`PANEL_LAYOUT`) gain no row.

### Tests

- `tests/unit/us-030-entry-settings.test.ts` (all)
- Guards: `tests/unit/us-008-presets.test.ts`, `tests/plugin/us-021-groups-details.test.ts`, `tests/plugin/us-029-layout.test.ts`.

### SCAR check

- SCAR-019: every field at its built-in value and one other; `frame.width` at 0, 5 and just outside.
- SCAR-037 (dependency defaults applied after user input): the preset's values win over the built-ins and over a template's defaults (US-023).
- SCAR-017: one validator per kind of field (colour, width, key list), used for every field of that kind.
- SCAR-027: `detailRows`' existing rows and their order unchanged (US-021 tests).
- SCAR-020, SCAR-007: messages as the story writes them.
- Not applicable: UI SCARs 013, 014, 016, 022 (no control is added).

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
