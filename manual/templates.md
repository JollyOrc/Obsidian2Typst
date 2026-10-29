# Typst templates

[Back to the manual](manual.md)

A template is a Typst file (`.typ`) in your vault that adds styling the
preset fields do not cover: page colours, heading colours, table styles,
decorative backgrounds, your own Typst functions. It is meant for readers who
know some [Typst](https://typst.app/docs/).

## Contents

- [Selecting a template](#selecting-a-template)
- [How the template is used](#how-the-template-is-used)
- [The template function](#the-template-function)
- [The preset wins on a conflict](#the-preset-wins-on-a-conflict)
- [Names to avoid](#names-to-avoid)
- [Warnings](#warnings)

## Selecting a template

Set the vault path of the file in a preset, or in the **Template file** row of
the Defaults:

```yaml
template: "Layout/Templates/book.typ"
```

If the file does not exist, the export continues without it and reports
`TEMPLATE_MISSING`.

## How the template is used

At each export the template is copied to `template.typ` in the export folder
(your vault file is never changed), and the generated file starts with:

```typst
#import "template.typ": *
```

So everything the template defines with `#let` (colours, functions) is
available in the document. The preview uses the same template, so what you
see in the [style panel](preview-panel.md) is what you get.

`#set` and `#show` rules at the top level of the template do **not** apply
to the document, because Typst does not carry rules across an import. Put
them inside the template function.

## The template function

If the template defines a function named `template`, the plugin applies it to
the whole document by writing `#show: template` right after the import:

```typst
#let accent = rgb("#C9A44A")

#let template(doc) = {
  set page(fill: rgb("#FEFCF0"))
  show heading.where(level: 2): set text(fill: accent)
  doc
}
```

The function takes the document as its argument and must return it at the
end. Use the `{ … }` form shown above. Defining `template` as something that
is not a function (`#let template = 5`) makes the compile fail with Typst's
message.

## The preset wins on a conflict

The template's rules apply first; every rule the plugin writes from the
preset, the Defaults or the built-in values comes after them and wins for the
same property. What the plugin does not write, the template keeps.

| The template sets | The preset | In the PDF |
| --- | --- | --- |
| a page fill colour | (the plugin sets no page fill) | the template's fill |
| a heading font | a heading font | the preset's heading font |
| page margins | margins (always set, at least by the built-in values) | the preset's margins |
| a page header | `runningHeader: false` | the template's header |
| a page header | `runningHeader: true` (built-in) | the running header |

So to use your own header or footer, switch the plugin's running header or
page numbers off in the preset.

## Names to avoid

The generated document defines some helpers of its own. If your template
defines one of these names at the start of a line, the plugin's definition is
used and the export reports `TEMPLATE_NAME_TAKEN`:

`callout`, `callout-styles`, `fit-flow`, `fit-image`, `glossary-term`,
`o2t-blank`, `o2t-fit`, `o2t-fit-decision`, `o2t-part`, `page-ref`,
`running-text`, `running-title`.

If your template redefines a name of Typst's standard library (such as
`quote`), your definition stays in effect, but the export reports
`TEMPLATE_SHADOWS_BUILTIN` so that you know.

## Warnings

All template warnings show the template line:

```text
template.typ:
12: #set page(fill: rgb("#FEFCF0"))

warning: TEMPLATE_RULE_IGNORED  Template rule at line 12 does not apply; put it inside template(doc)
```

| Warning | Cause |
| --- | --- |
| `TEMPLATE_MISSING` | the template file does not exist |
| `TEMPLATE_RULE_IGNORED` | a `#set` or `#show` at the start of a line; it does not apply |
| `TEMPLATE_NAME_TAKEN` | the template defines a name the plugin defines |
| `TEMPLATE_SHADOWS_BUILTIN` | the template redefines a Typst built-in |

The checks read the template line by line. They find definitions and rules
only at the start of a line; a rule at the start of a line inside a content
block (`#let template(doc) = [ … ]`) is reported although it applies. Use the
`{ … }` form to avoid that.

A Typst error in the template is shown with the template's file name, for
example `Typst error at template.typ:4:3: …`.
