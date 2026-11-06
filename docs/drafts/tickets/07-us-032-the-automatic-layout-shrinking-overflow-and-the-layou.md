<!-- Filed 2026-11-06 as #128 on the user's go (epic #121, ticket 7 of 16). -->

### User story

[US-032](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-032-entry-fit-overflow-and-auto-layout.md), ACs addressed AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12

### Description

Choose `auto` layouts by orientation and measured fit, shrink illustrations in 5 % steps down to `entries.image.minScale`, let entries overflow with a moved partner and a "(continued)" header line, and report the layout warnings from the compile's facts through a pure report function.

### Acceptance criteria (from the user story)

Examples use the preset and outline of US-031 (A5, text area 105 × 165 mm,
facing pages, `headingRules: {Menagerie: entries}`) with
`entries.image.minScale: 70` and `entries.emptyWarn: 50` unless stated.

- **AC-1 (settings):** Two `entries` fields (US-030 AC-8's group, its
  messages, the Details view):

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.image.minScale` | whole percent, 10 to 100 | 70 |
  | `entries.emptyWarn` | whole percent, 0 to 100; 0 = off | 50 |

  `images.minScale` (US-028) does not apply inside entries, and
  `entries.image.minScale` does not apply outside them. Example:
  `images.minScale: 40` with `entries.image.minScale: 90` → a body image
  outside the chapter may shrink to 40 %, an entry's illustration to 90 %.

- **AC-2 (the automatic choice, D6):** For `layout: auto` (or missing), and
  for a layout replaced by US-031 AC-4, the layout is chosen top to bottom:

  | Illustration | Fits one page (at some scale ≥ `minScale`) | Chosen |
  |---|---|---|
  | none | yes | `page-text` |
  | none | no | `spread-text` |
  | landscape (width ≥ height) | yes | `page-landscape` |
  | landscape | no | `spread-landscape` |
  | portrait | yes | `page-portrait` |
  | portrait | no | `spread-portrait` |

  "Fits one page" is decided by AC-4's measurement for the page layout of
  that row. `full-image` is never chosen. This replaces US-031 AC-3's interim
  rule. Each choice gives `ENTRY_AUTO "<heading>": <layout>` (the author
  copies it into the note to fix it). Example: an entry with a 3:2
  illustration whose text and illustration fit one page at 85 % →
  `ENTRY_AUTO "Marsh Owl": page-landscape`.

- **AC-3 (pairing left alone, BL-C6 AC-3):** The choice is made per entry and
  never changed to avoid an unpaired page entry (US-031 AC-10); the
  unpaired warning tells the author.

- **AC-4 (fit and shrink):** For an entry with an illustration, in a layout
  that has an illustration slot other than `full-image`, the scale is the
  largest of 100 %, 95 %, … down to `entries.image.minScale` at which the
  entry **as laid out** — heading, opening paragraph and statblock, body,
  the illustration at that scale with its caption — fits the pages of its
  layout (`page-*`: one page; `spread-*`: the two pages). The whole entry is
  measured at each step (`measure()` of the composed content), never the sum
  of its parts. Shrinking gives no warning. Examples (`page-landscape`, A5,
  3:2 illustration at most 66 mm high):

  | Text and statblock | `minScale` | Result |
  |---|---|---|
  | fits with the image at 100 % | 70 | 100 %, one page |
  | fits with the image at 85 % | 70 | 85 %, one page, no warning |
  | fits only at 60 % | 70 | 70 %, overflows (AC-5) |
  | fits only at 60 % | 10 | 60 %, one page |
  | any length | 100 | 100 %; no shrinking |

- **AC-5 (overflow):** An entry that does not fit at `minScale` (or a
  text-only entry that does not fit its pages) runs on to the next page(s)
  with its illustration at `minScale`. The next entry starts on the next
  free page its own layout allows (US-031's parity breaks). Warning, from
  the real positions: `ENTRY_OVERFLOW "<heading>": <layout>, about <N> lines
  over`, where N is the body lines on the pages after the layout's own
  (rounded, at least 1). This includes the rare spread that `measure()`
  judged to fit but that needs a third page once laid out (decision 2: no
  safety margin; the warning names it). Example: `ENTRY_OVERFLOW "Cave Wyrm":
  spread-landscape, about 6 lines over`.

- **AC-6 (`full-image`):** The full-page illustration is never shrunk for
  text. Text that does not fit the left page runs on after the image page
  (the page after the spread), with `ENTRY_OVERFLOW`.

- **AC-7 (an overflowing page entry in a pair):** A page-sized entry that
  overflows (an explicit `page-*` layout with too much text) keeps its
  overflow page(s); the entry that would have been its partner starts on the
  next left page and pairs with the entry after it. The warning names both:
  `ENTRY_OVERFLOW "Fen Hare": page-text, about 4 lines over (partner "Marsh
  Owl" moved)`.

- **AC-8 ("(continued)", D31; decision 1):** On every page after an
  entry's own pages that the entry runs on, the page header shows
  `<heading> (continued)` in the sub-heading style of US-031 AC-11, in place
  of the running header for that page (the folio stays). It is not in the
  TOC and not a link target; links to the entry point to its first page
  (US-033).

- **AC-9 (near miss, D45):** After the compile, a `spread-text`,
  `spread-landscape` or `spread-portrait` entry (not `full-image`, whose
  right page is the image) whose right page leaves at least
  `entries.emptyWarn` % of the text height unused gives `ENTRY_SPREAD_EMPTY
  "<heading>": <layout>, right page <P> % empty – consider an illustration or
  trimming`, whether the layout was chosen or set. "Unused" is the text
  height below the entry's last element (text or illustration) on the right
  page, from the real end position. Examples: a `spread-text` entry of one
  page and 6 lines (right page about 85 % empty) → warning at 50, also at 80,
  none at 90; `emptyWarn: 0` → no warning ever.

- **AC-10 (warnings):** The codes of this story (`ENTRY_AUTO`,
  `ENTRY_OVERFLOW`, `ENTRY_SPREAD_EMPTY`) are in `warning-codes.md` with a
  source line, given once per entry and export (also when an entry is laid
  out twice in the preview), never stop an export (US-030 decision 4), and
  come from the compile's real positions (`metadata` at each entry's start
  and end, read with `world.query`; US-031 AC-14). Measuring an entry at its
  candidate layouts and scales (AC-2, AC-4) reports nothing and writes no
  `metadata`; only the placed entry does (SCAR-038: a measurement that also
  reported would repeat each warning once per candidate).

- **AC-11 (with other rules):**
  - an overflowing last entry of a section followed by US-033's next
    section opener: the opener takes the next right page after the overflow
    (it never shares a page with the overflow);
  - `page.facingPages: false` (US-031 AC-15): overflow pages follow
    directly; no blank page; the "(continued)" line as on facing pages;
  - a nested entry (US-031 decision 3) is part of its parent's measured
    content and is never measured or reported on its own;
  - `layout: page-portrait` with a landscape image (US-031 AC-4) → the
    choice of AC-2, reported as `ENTRY_LAYOUT_CONFLICT` (not also as
    `ENTRY_AUTO`).

- **AC-12 (tests, SCAR-019):** `entries.image.minScale` at 10, 70, 95, 100;
  `entries.emptyWarn` at 0, 1, 50, 90, 100; illustration ratios 1:4, 1:2,
  1:1, 3:2, 4:1 in each slot; text lengths just under and just over each
  boundary (one page, two pages); an overflowing entry in each layout, as the
  first and the second of a pair, and as the last of a section. The PDF
  tests read each entry's pages, the drawn size of each illustration, the
  header text of each page (the "(continued)" line) and the warnings as an
  exact list (SCAR-015, SCAR-038), on the generated fixture (US-024
  amendment, D-03).

## Decisions (answered by the user, 2026-11-06)

1. **"(continued)" line:** in the page header, in place of the running
   header on the overflow pages (AC-8). D31's "small heading at the top" is
   met by the header line; no heading is added to the body.
2. **Near the two-page boundary:** no safety margin; the rare spread that
   needs a third page overflows with `ENTRY_OVERFLOW` (AC-5).

### Implementation notes

- Settings: `entries.image.minScale` (10 to 100, built-in 70) and `entries.emptyWarn` (0 to 100, 0 = off, built-in 50), with their messages; `images.minScale` stays for body images outside entries.
- Inside the compile (#127's helper): for each candidate layout and scale (100, 95, … down to `minScale`), `measure()` of the **composed** entry (heading, opening and statblock, body, illustration with caption); the auto table of US-032 AC-2 replaces #127's interim rule; `full-image` never chosen and never shrunk.
- Facts: `<o2t-entry>` gains `auto` and `scale`; `<o2t-entry-end>` gains `overflowLines`, `rightEmpty`, `partnerMoved`; candidates write no `metadata` (SCAR-038).
- The "(continued)" line: in the page header on overflow pages, in place of the running header (decision 1), found by `query` of the entries' start and end facts; not in the outline.
- `src/core/entries/report.ts` (new): `entryLayoutWarnings(places, ends, {emptyWarn})` → `ENTRY_AUTO`, `ENTRY_LAYOUT_CONFLICT`, `ENTRY_OVERFLOW` (with the moved partner), `ENTRY_SPREAD_EMPTY`; once per entry; pure.
- Plugin: after each compile (preview and export), the facts are read with `world.query` (as US-028's decisions) and the report's warnings added once.

### Tests

- `tests/unit/us-032-fit.test.ts` (all)
- `tests/integration/us-032-fit-pdf.test.ts` (all)
- `tests/integration/us-031-layouts-pdf.test.ts`: the AC-3 interim test (`until US-032, auto is page-text …`) is replaced by US-032 AC-2's table (its expectation changes with decision 1 of US-031).

### SCAR check

- SCAR-021: decisions from `measure()` of the composed entry inside one compile; the fit spike (360 entries, CLI and WASM equal) is the reference; the tests assert settling.
- SCAR-038 (a lookup that also reports): measuring candidates records nothing; warnings come once per entry from the placed entry's facts.
- SCAR-022: the facts are read after the compile, where the compiler's world is available (as US-028 AC-14).
- SCAR-019: `minScale` 10, 70, 90, 100 and refused values; `emptyWarn` 0, 1, 50, 80, 90, 100 and refused values.
- SCAR-024, SCAR-032: the fit spike's scope (page-landscape swept; portrait and full-page slots computed).
- SCAR-030: no new time limit; the compile count stays one.
- SCAR-027: the US-031 interim test is changed in this ticket, named here.
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
