# US-016 — Callouts become styled boxes, with built-in and user-defined styles

**Status:** Done (2026-10-19)
**Introduced:** v0.2.0 (planned; a new feature bumps the minor version)
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author of a rulebook,
**I want** Obsidian callouts (`> [!example] Title`) to be printed as boxes whose
look (fill, border, inset, title, font, icon) I set per callout type in my preset,
**so that** examples and remarks that are not part of the rules stand apart from
the rule text in the PDF, as Style Guide §6.8 asks, without leaving Obsidian.

Decided by the user 2026-10-18 (`docs/state/00_governance.md`): callouts first
(this story); heading rules such as `Glossary` are US-017; the wrap-selection
command is a later story. An unknown type gives a warning and the default box. A
style sets the box, the title line, fonts and an icon.

Notation as in US-001: `⏎` is a line break, `md :` the note, `typ:` the output.

---

## Acceptance criteria

- **AC-1 (what is a callout header; every position, SCAR-009):** A blockquote is
  a callout when the first line of its first paragraph matches
  `[!TYPE]` + optional fold sign + optional title, with
  `TYPE` = one or more characters that are not `]` or white space, the fold sign
  `+` or `-` directly after `]`, and the title = the rest of the line after at
  least one blank, trimmed. Blanks between `>` and `[!` are allowed (none or any).
  The type is compared in lower case. The header line is removed from the
  content; the following lines of that paragraph start the body.
  ```
  md : > [!example] Rolling dice⏎> Roll 6d6.     callout, type example, title "Rolling dice", body "Roll 6d6."
  md : >[!NOTE]⏎> text                            callout, type note, no title
  md : > [!tip]- Hidden by default⏎> text         callout, type tip, title "Hidden by default" (fold sign ignored, AC-4)
  md : > [!tip]+⏎> text                           callout, type tip, no title
  md : > [!note]Title                             not a callout (no blank before the title): quote with text "[!note]Title", escaped as \[!note\]Title
  md : > text⏎> [!note]                           not a callout (header not on the first line): quote "text [!note]"
  md : > ⏎> [!note] T                             callout, type note, title "T" (a leading empty quote line starts no paragraph)
  md : > **[!note]** T                            not a callout (the first line starts with markup, not with "[!")
  md : > [!] T                                     not a callout (empty type)
  md : > [!my type] T                              not a callout (blank inside the type)
  md : - > [!note] T                               callout inside a list item (AC-6)
  md : [!note] T                                   not a callout (no blockquote): paragraph "\[!note\] T"
  ```
  The literal text of every case marked "not a callout" is kept and escaped as
  today (US-001, US-013).

- **AC-2 (Typst shape of a callout):** A callout is written as one call of the
  `callout` helper (AC-11) with the style name, the title and the body, in the
  layout of a quote (US-001 AC-6b): the call on its own line, the body indented
  by 2, `]` alone on a line at the indentation of the call.
  ```
  md : > [!example] Rolling dice
       > Rolling 6d6 and getting *two* sixes.
  typ: #callout("example", title: [Rolling dice])[
         Rolling 6d6 and getting _two_ sixes.
       ]
  ```
  A callout with an empty body (only the header line) is
  `#callout("note", title: [Note])[⏎]`. The style name is the name of the style
  that is used (AC-8, AC-10), written with `typstString` (US-013). Nothing
  follows `]` on its line, as for `#quote(block: true)[…]` (US-001 AC-6b).

- **AC-3 (title text):** The title comes from, in this order: the title on the
  header line; the style's `title.text` (AC-7); the type with its first
  character in upper case and the rest in lower case (`[!EXAMPLE]` → `Example`,
  `[!my-box]` → `My-box`). The header title is inline Markdown and goes through
  `emitInline` with `atBlockStart: true` (a new call site of `escapeMarkup`,
  SCAR-001); the other two go through `escapeMarkup` with `atBlockStart: true`.
  ```
  md : > [!tip] Use **bold** and `code`    typ: #callout("tip", title: [Use *bold* and `code`])[⏎]
  md : > [!note] - not a list              typ: #callout("note", title: [\- not a list])[⏎]
  md : > [!note] # 5 and $3                typ: #callout("note", title: [\# 5 and \$3])[⏎]
  md : > [!note] see [[Tessera]]            typ: title holds the link of US-004 to the Tessera heading
  md : > [!note] x[^1]                     typ: title holds the footnote call (US-005)
  md : > [!quote]                          typ: #callout("quote", title: [Quote])[⏎]
  ```
  A style with `title.text: ""` gives `title: none`: the box has no title line.

- **AC-4 (fold sign, print):** `+` and `-` are ignored: the body is always
  printed. No warning.

- **AC-5 (body):** The body holds every block the emitter supports, in the same
  form as at top level: paragraphs, lists, task lists, tables, code, images
  (with `fit-image`), footnotes, headings, quotes and callouts. Blocks are
  separated by one blank line (US-015 AC-4).
  ```
  md : > [!example] Pools⏎> - Mind⏎> - Body⏎>⏎> | a | b |⏎> |---|---|⏎> | 1 | 2 |
  typ: #callout("example", title: [Pools])[⏎  - Mind⏎  - Body⏎⏎  #table(…)⏎]
  ```

- **AC-6 (composed, SCAR-002):** Each case shows the exact nesting.
  ```
  md : > [!example] Outer⏎> a⏎>⏎> > [!note] Inner⏎> > b
  typ: #callout("example", title: [Outer])[⏎  a⏎⏎  #callout("note", title: [Inner])[⏎    b⏎  ]⏎]

  md : - item⏎⏎  > [!note] N⏎  > q
  typ: - item⏎⏎  #callout("note", title: [N])[⏎    q⏎  ]

  md : > quoted⏎>⏎> > [!tip] T⏎> > x
  typ: #quote(block: true)[⏎  quoted⏎⏎  #callout("tip", title: [T])[⏎    x⏎  ]⏎]

  md : > [!note] N⏎> > plain quote inside
  typ: #callout("note", title: [N])[⏎  #quote(block: true)[⏎    plain quote inside⏎  ]⏎]

  md : > [!example] E⏎> ## Two pools⏎> text
  typ: #callout("example", title: [E])[⏎  == Two pools <h-two-pools>⏎⏎  text⏎]
  ```
  A heading inside a callout keeps its level, number, label and outline entry
  (US-002), and `[x](#two-pools)` from outside the callout links to it (US-004).
  Three levels (callout in callout in list item) indent 2 per level as US-001
  AC-6b. A footnote inside a callout is numbered in document order with the
  others (US-005).

- **AC-7 (style fields in the preset note):** Field `callouts` is a group of
  styles keyed by style name. Every field of a style is optional.
  ```
  callouts:
    default:                      # the style for types without their own style
      fill: "#f5f5f5"
    example:
      fill: "#f3ead7"             # colour "#rrggbb" or "none"
      border: {color: "#8b5a2b", width: 1}   # width in pt, 0 to 10; 0 = no border
      inset: 8                    # pt, 0 to 50
      title: {text: "Example", color: "#8b5a2b"}
      font: {family: "IM Fell English", size: 9.5}   # size in pt, > 0 and ≤ 200
      icon: "Layouting/Icons/quill.png"              # vault path of an image, or "none"
  ```
  A style name matches `^[a-z0-9][a-z0-9_-]*$`. Invalid values make the preset
  invalid (US-008 AC-4) with the line of the field and the first of:
  `callouts must be a group of styles`;
  `callouts.<name> is not a valid style name (use a-z, 0-9, - and _)`;
  `callouts.<name> must be a group of settings`;
  `callouts.<name>.fill must be a colour "#rrggbb" or "none"`;
  `callouts.<name>.border must be a group of settings`;
  `callouts.<name>.border.color must be a colour "#rrggbb"`;
  `callouts.<name>.border.width must be a number of pt from 0 to 10`;
  `callouts.<name>.inset must be a number of pt from 0 to 50`;
  `callouts.<name>.title must be a group of settings`;
  `callouts.<name>.title.text must be text`;
  `callouts.<name>.title.color must be a colour "#rrggbb"`;
  `callouts.<name>.font must be a group of settings`;
  `callouts.<name>.font.family must be a font family name written as text`;
  `callouts.<name>.font.size must be a number of pt greater than 0 and at most 200`;
  `callouts.<name>.icon must be a vault path written as text, or "none"`.
  Examples (the note starts `---`, `schemaVersion: 1`, `callouts:` on line 3):
  `Example: {}` on line 4 → `callouts.Example is not a valid style name (use a-z,
  0-9, - and _) (line 4)`; `fill: red` → `callouts.example.fill must be a colour
  "#rrggbb" or "none" (line 5)`; `border: {width: 12}` →
  `callouts.example.border.width must be a number of pt from 0 to 10 (line 6)`.
  `null` is unset. Unknown fields inside a style are ignored and kept (US-008 AC-2).

- **AC-8 (which style, field by field):** For a callout of type `T`:
  1. the style name is `T` if the preset or the built-in set (AC-9) has a
     style `T`; else the built-in alias of `T` (AC-9);
     else `default` with the warning of AC-10;
  2. each field of the style is taken from the first place that sets it: preset
     `callouts.<name>`, built-in `<name>`, preset `callouts.default`, built-in
     `default`. Styles are preset fields only; the Defaults of the settings tab
     have no `callouts` (decided by the user 2026-10-18, as the cover).

  Example: built-in `example` = fill `#f2eefd`, border `#7852ee` 0.75 pt, inset 8;
  the preset sets `callouts.example.fill: "#f3ead7"` and `callouts.default.inset: 4`
  → `example` uses fill `#f3ead7`, border `#7852ee` 0.75 pt, inset 8 (built-in
  `example` sets inset, so `default` is not reached). A user style `rule-note`
  with only `fill: "#ffffff"` takes border, inset and title colour from
  `default`. A user style named like an alias (`summary`) wins over the alias.

- **AC-9 (built-in styles; decided by the user 2026-10-18):** Built-in styles follow Obsidian's
  callout types and colours: fill = the colour at 10 % on white (rounded half up
  per channel), border = the colour, 0.75 pt, inset 8 pt, title colour = the
  colour, bold, no icon, no font of its own (the body font).
  ```
  name      colour   fill      aliases
  default   #9e9e9e  #f5f5f5   —
  note      #086ddd  #e6f0fc   —
  abstract  #00bfbc  #e6f9f8   summary, tldr
  info      #086ddd  #e6f0fc   —
  todo      #086ddd  #e6f0fc   —
  tip       #00bfbc  #e6f9f8   hint, important
  success   #08b94e  #e6f8ed   check, done
  question  #ec7500  #fdf1e6   help, faq
  warning   #ec7500  #fdf1e6   caution, attention
  failure   #e93147  #fdeaed   fail, missing
  danger    #e93147  #fdeaed   error
  bug       #e93147  #fdeaed   —
  example   #7852ee  #f2eefd   —
  quote     #9e9e9e  #f5f5f5   cite
  ```
  An alias writes the style name of its target: `> [!faq] Why?` →
  `#callout("question", title: [Why?])[…]`; without a title it is titled by the
  alias as typed (`[!FAQ]` → `Faq`).

- **AC-10 (unknown type):** A type with no style and no alias uses `default`,
  is titled as AC-3, and gives one warning per callout at the header's line:
  `CALLOUT_TYPE_UNKNOWN  No style for callout type "banana"; the default box is used`.
  ```
  md : > [!banana] Ripe⏎> x      typ: #callout("default", title: [Ripe])[⏎  x⏎]
  md : > [!Banana]               typ: #callout("default", title: [Banana])[⏎]
  ```
  The type in the message is as typed in the note and escaped for the report
  (US-006). In strict mode it counts like any warning (US-006).

- **AC-11 (preamble rule `callouts`, order 85):** When the body holds at least
  one callout, the preamble gets the rule `callouts` (order 85: after `fit-image`
  80, before `cover` 90; US-015 AC-2). It defines `callout-styles` with the
  styles that the body uses, sorted by name (deterministic, rule 7), and the
  helper `callout`. Worked example for one `example` callout with the built-in
  style:
  ```
  #let callout-styles = (
    "example": (fill: rgb("#f2eefd"), stroke: 0.75pt + rgb("#7852ee"), inset: 8pt, title-color: rgb("#7852ee"), font: none, size: none, icon: none),
  )
  #let callout(style, title: none, body) = {
    let s = callout-styles.at(style)
    let txt = (:)
    if s.font != none { txt.insert("font", s.font) }
    if s.size != none { txt.insert("size", s.size) }
    block(width: 100%, breakable: true, fill: s.fill, stroke: s.stroke, inset: s.inset, {
      set text(..txt)
      if title != none {
        block(sticky: true, below: 0.6em, text(fill: s.title-color, weight: "bold", {
          if s.icon != none { box(image(s.icon, height: 1em), baseline: 0.15em); h(0.4em) }
          title
        }))
      }
      body
    })
  }
  ```
  `fill: none` writes `fill: none`; border width 0 writes `stroke: none`;
  numbers are written without trailing zeros (`9.5pt`, `8pt`); colours as
  `rgb("#rrggbb")` in lower case; family and icon path with `typstString`.
  Without a callout in the body the rule is not written.
  Names the plugin defines (decided by the user 2026-10-18; the class covers
  `fit-image` of US-003 too, SCAR-017): the plugin's helpers come after the
  template import, so they replace a template's definition of the same name.
  Each top-level definition of `fit-image`, `callout` or `callout-styles` in the
  template (found by the scan of US-008 AC-10) gives, on every export, whether or
  not the note uses the helper:
  `TEMPLATE_NAME_TAKEN  Template line 3 defines "callout", which the plugin also defines; the plugin's definition is used`
  at line 0. The names are one list in the source (`PLUGIN_NAMES`), and a text
  check shows that every `#let` of a preamble rule defines a name of that list. Measured 2026-10-18 with the bundled
  Typst 0.14.2: this helper compiles for a simple, untitled, empty, nested,
  list-item, quoted, list/table/code, heading-with-label and footnote callout;
  `callout("banana")` fails with `dictionary does not contain key "banana"`
  (guard: AC-10 must map unknown types before emitting).

- **AC-12 (font per style):** `font.family` is resolved by the font module of
  US-010 (`resolveFonts`, same font set, case-insensitive, the name the file
  reports is written). A family that is not found gives one `FONT_MISSING`
  warning per family (US-010 AC-4 wording, role `callout <name>`) and the style
  writes `font: none` (the text keeps the body font). `font.size` is written as
  `size: 9.5pt`; without it `size: none`. The glyph check of US-010 is not run
  for callout families in this version (Notes).

- **AC-13 (icon):** `icon` is a vault path of an image file. It is resolved and
  copied by the asset resolver and copier of US-003, as an image linked by that
  vault path: same type check (PNG, JPEG, GIF, WebP, SVG by first bytes), same
  destination rules (AC-4, AC-4b of US-003: the relative path from the note's
  folder is kept; outside the note's folder `assets/_external/<name>`, with `-2`
  for a clash), copied once even when several styles or callouts use it. Only
  the icons of styles that the body uses are looked up, copied or warned about. The
  style writes the destination path. Example: note `Rules.md` at vault root,
  icon `Layouting/Icons/quill.png` → `icon: "Layouting/Icons/quill.png"` and the
  file copied to `<export>/Layouting/Icons/quill.png` (to be confirmed against the
  copier in G2). A missing file or a file that is not an image gives
  `CALLOUT_ICON_MISSING  Icon "Layouting/Icons/quill.png" of callout style
  "example" was not found; the box is drawn without it` (or `… is not an image
  …`) once per style per export, at line 0, and writes `icon: none`. No red
  placeholder. The icon is 1em high, before the title, 0.4em gap; a box without
  a title has no icon.

- **AC-14 (page breaks):** A callout box breaks across columns and pages
  (`breakable: true`, Style Guide §6.8); the title line is kept with the first
  line of the body (`sticky: true`). Measured: a callout of 120 short paragraphs
  on A5 compiles to 3 pages. The end-to-end test checks that the title is never
  the last line on a page in a case built to put it there.

- **AC-15 (composed export, content; SCAR-015):** A test note with the composed
  cases of AC-6, one alias, one unknown type, one user style with font and icon,
  exported with a preset that sets `callouts.example`, compiles with no error,
  and the PDF:
  - holds the title texts `Rolling dice`, `Inner`, `Why?`, `Ripe` and the body
    text `Rolling 6d6` exactly once each;
  - fills a rectangle with the colour of the preset's `example` fill
    (`#f3ead7` = `0.953 0.918 0.843` in the content stream) and one with the
    built-in `question` fill;
  - embeds the style's font and holds the icon image (image count + 1);
  - has the warnings `CALLOUT_TYPE_UNKNOWN` (1) and no other new code.

  Guard tests: the same note converted as plain quotes (the `callout` rule
  switched off) has none of the fill colours; the dictionary without the
  unknown-type mapping fails to compile (AC-11).

- **AC-16 (preview panel):** The preview of US-012 shows callouts as in the
  export (same `convert`, same helper). Editing `callouts` in the active preset
  note redraws the preview (US-012 AC-14 already listens to preset changes; a test
  shows a change of `callouts.example.fill` reaches the next preview request).
  The panel and the settings tab get no callout rows (styles are preset fields
  only, AC-8).

- **AC-17 (a note without callouts, and determinism):** The sample note
  `Other.md` (US-024) has no callout header, and its export has no `callouts`
  rule and no callout call; the same check on `Book.md`, which has callouts,
  shows the check in effect. (When this story was written, the author's real
  file had no callouts and its export was byte-identical before and after the
  story.) Callout tests use their own notes, never a private vault.

---

## Notes

- Decisions 2026-10-18: styles are set in preset notes only (a list editor for
  the Defaults would be a story of its own: SCAR-013, 014, 016, 017 apply);
  built-in styles use Obsidian's colours so a note looks alike in Obsidian and
  in print.
- The header rules of AC-1 (no blank before the title, blanks inside the type)
  are to be compared with Obsidian's own rendering in the manual check, because
  Obsidian is the other consumer of the same text (SCAR-009).
- Not in this version: glyph check for callout fonts; per-style text colour;
  title font different from the body font of the box; collapsible output (print
  has no folding); icons of Obsidian's built-in callouts (Lucide; not bundled).
- New call sites (SCAR-001): `emitInline` for the title (`atBlockStart: true`),
  `escapeMarkup` for default titles, `typstString` for style names, families and
  icon paths, `emitBlocks` for the body, the asset resolver and copier for icons,
  `resolveFonts` for families. Each is listed in the shared-utilities register
  when the tickets are written.
- New piece type for the join table (SCAR-010): the `#callout(…)[…]` call; its
  neighbours are the same as for `#quote(block: true)[…]`.
- Labels (SCAR-011): this story makes no labels and no new file names except
  icon destinations, which use the US-003 rule with its used-name set.
- Worst misplaced click (SCAR-014): none; there is no new control. No dialog
  (SCAR-013), no settings rows (SCAR-016, SCAR-017): styles are preset fields only.
- Known environment fact (2026-10-18): `node_modules` on this Mac has only the
  Linux rolldown bindings, so `vitest` does not start here; the measurements
  above were run with plain Node and `tests/support/typst-node.ts`. The gate needs
  a reinstall of the dependencies before G2.

---

## Related tickets

- [TICKET-041](../tickets/TICKET-041-callout-markers-core.md) — Callout markers core: header, built-in styles, aliases, style resolution
- [TICKET-042](../tickets/TICKET-042-callouts-preset-field.md) — Preset field `callouts`: schema, validation, effective settings
- [TICKET-043](../tickets/TICKET-043-callout-emission-and-pipeline.md) — Callout emission, preamble rule `callouts`, fonts, icons, warnings
- [TICKET-044](../tickets/TICKET-044-template-plugin-names.md) — Template names the plugin defines: `PLUGIN_NAMES`, `TEMPLATE_NAME_TAKEN`
- [TICKET-045](../tickets/TICKET-045-callouts-preview-build-and-m6.md) — Callouts in the preview, test build `0.2.0-m6.1`, manual check M6
