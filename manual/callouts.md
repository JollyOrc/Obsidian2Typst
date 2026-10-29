# Callout styles

[Back to the manual](manual.md)

Obsidian callouts become boxes in the PDF. Each callout type has a style: a
fill colour, a border, an inner margin, a title line and, if you like, its
own font and an icon. The plugin brings styles for Obsidian's callout types,
and you can change them or add your own types in a preset note. This is the
way to mark examples, rules, sidebars and the like in your text.

## Writing a callout

```markdown
> [!example] Rolling dice
> Roll 6d6 and count the *sixes*.
```

- The type is the word in `[!…]`, case does not matter. It has no blanks.
- The title is the rest of the line, after at least one blank. Without a
  title, the style's title is used, else the type with a capital letter
  (`[!EXAMPLE]` gives `Example`).
- The fold signs `+` and `-` (`[!tip]-`) are ignored: in print the body is
  always shown.
- The body can hold anything: paragraphs, lists, tables, code, images,
  footnotes, headings, quotes and other callouts.

Not a callout, printed as an ordinary quote: `> [!note]Title` (no blank before
the title), a `[!note]` that is not on the first line, `> **[!note]**`,
`> [!]` and `> [!my type]`.

A box can break across pages; its title is kept with the first line of the
body.

## Built-in styles

The built-in styles use Obsidian's callout colours: a light fill (the colour
at 10 %), a 0.75 pt border and a bold title in the colour, 8 pt inner margin,
no icon, the body font.

| Style | Colour | Also used for |
| --- | --- | --- |
| `default` | grey `#9e9e9e` | every type without its own style |
| `note` | blue `#086ddd` | |
| `abstract` | cyan `#00bfbc` | `summary`, `tldr` |
| `info` | blue `#086ddd` | |
| `todo` | blue `#086ddd` | |
| `tip` | cyan `#00bfbc` | `hint`, `important` |
| `success` | green `#08b94e` | `check`, `done` |
| `question` | orange `#ec7500` | `help`, `faq` |
| `warning` | orange `#ec7500` | `caution`, `attention` |
| `failure` | red `#e93147` | `fail`, `missing` |
| `danger` | red `#e93147` | `error` |
| `bug` | red `#e93147` | |
| `example` | purple `#7852ee` | |
| `quote` | grey `#9e9e9e` | `cite` |

A type with no style and no alias, such as `[!banana]`, gets the `default`
box and the warning `CALLOUT_TYPE_UNKNOWN`. To give it a style, add one with
that name.

## Styles in a preset

Callout styles are set in preset notes only, under `callouts`, keyed by the
style name. Every field is optional:

```yaml
callouts:
  default:                       # for types without their own style
    fill: "#f5f5f5"
  example:
    fill: "#f3ead7"              # "#rrggbb" or "none"
    border: {color: "#8b5a2b", width: 1}   # width in pt, 0 to 10; 0 = no border
    inset: 8                     # inner margin in pt, 0 to 50
    title: {text: "Example", color: "#8b5a2b"}   # text: "" = no title line
    font: {family: "EB Garamond", size: 9.5}     # size in pt
    icon: "Layout/Icons/quill.png"               # vault path, or "none"
  rule-box:                      # your own type: > [!rule-box]
    fill: "#eeeeee"
```

A style name uses only `a-z`, `0-9`, `-` and `_`, and starts with a letter or
digit. Write colours in quotes.

### Which value is used

For each field of a style, the first of these that sets it wins:

1.  the preset's `callouts.<name>`;
2.  the built-in style `<name>`;
3.  the preset's `callouts.default`;
4.  the built-in `default`.

Example: the preset sets `callouts.example.fill: "#f3ead7"` and
`callouts.default.inset: 4`. The `example` box gets the new fill, the
built-in purple border and the built-in inset of 8 (the built-in `example`
sets an inset, so `default` is not reached). A new style `rule-box` with only
a fill takes border, inset and title colour from `default`.

A style of your own named like an alias (`summary`) wins over the alias.

### Fonts and icons

- `font.family` is looked up like the other fonts (see [Fonts](fonts.md)).
  A family that is not found gives `FONT_MISSING` and the box keeps the body
  font.
- `icon` is a vault path of an image (PNG, JPEG, GIF, WebP, SVG). It is shown
  1 em high before the title and copied into the export like other images. A
  missing icon gives `CALLOUT_ICON_MISSING` and the box is drawn without it. A
  box without a title has no icon.

## Seeing the result

The [style panel](preview-panel.md) redraws when you save a change to the
`callouts` of the active preset. The settings tab and the style panel have no
rows for callout styles; edit them in the preset note. The details pop-up
lists the names of the styles a preset sets.
