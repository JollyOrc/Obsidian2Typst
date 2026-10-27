# Typst markup escaping: verified behaviour

Measured on 2026-10-16 with the bundled compiler (typst.ts 0.7.0, Typst 0.14.2) by
`spikes/typst-wasm/s12-escape-probe.mjs` (throw-away). Each input was placed in
`[ ... ]` content and read back as plain text (`plain()` helper in the probe, which maps content elements to text).
This is the evidence behind US-013; change the story only together with this file.

## Characters that change meaning anywhere in markup

| Raw input | What Typst does | Escape |
|-----------|-----------------|--------|
| `$` | opens math; `a $5 b` fails with "unclosed delimiter" | `\$` |
| `#` | starts code: `item #3` renders `item 3`; `#a5d6a7` fails (unknown variable) | `\#` |
| `@word` | reference (`see @fig1` becomes a reference); `@` followed by a space stays text | `\@` |
| `<name>` | label; `see <here> ok` loses the label text | `\<` `\>` |
| `~` | becomes a no-break space U+00A0 | `\~` |
| `*` | strong delimiter; `a * b` fails (unclosed) | `\*` |
| `` ` `` | raw delimiter; fails when unclosed | `` \` `` |
| `[` `]` | content block delimiters; unbalanced `[` fails | `\[` `\]` |
| `\` | escape character | `\\` |
| `_` | emphasis delimiter only at word boundaries; `snake_case_x` stays literal | `\_` (always, harmless inside words) |
| `//` | line comment; `http://x.org` is also turned into an automatic link | `\/\/` |
| `/*` | block comment start; covered by the `*` rule (`/\*`) | none extra |
| `*/` | "unexpected end of block comment"; covered by the `*` rule (`\*/`) | none extra |
| `-?` | soft hyphen U+00AD | `\-?` |

## Not special (verified, left unchanged)

`{ } ( ) : % & ^ | = - + .` in the middle of a line, `"` and `'` (turn into smart
quotes; kept, as decided for US-001), `--` `---` `...` (turn into en dash, em
dash, ellipsis; kept), emoji, accented letters, NBSP U+00A0, `=5`, `==x`, a
`1.5 x`, `1) x`. A lone `=`, `-`, `+`, `/`, or `12.` is plain only at the very end of a content
block; followed by a line break it is an empty heading or list item (found by the round-trip
test), so it is escaped too.

## Special only at the start of a line (after spaces or tabs)

| Raw input at line start | What Typst does | Escape |
|-------------------------|-----------------|--------|
| `= x`, `== x` | heading | `\= x`, `\== x` |
| `- x` | bullet list item | `\- x` |
| `+ x` | numbered list item | `\+ x` |
| `/ x` | term list item | `\/ x` |
| `12. x` | numbered list item | `12\. x` |

"Line start" means: the first character of a content block, and the first
non-blank character after every newline inside a text. Leading spaces and tabs
do not protect (`  = x` is a heading).

## Where a line start exists

- `[ ... ]` content blocks start a new line context: `#highlight[= x]`,
  `#underline[1. x]`, `#footnote[- x]`, a table cell `[= x]`, a link label
  `#link("u")[= x]`, and `#quote[= x]` all produce a heading or list inside.
- A list item's content is a line start too: `- = x` is an item containing a
  heading.
- Inside `*...*` and `_..._` there is no line start: `*= x*`, `_- x_`, `*+ x*`,
  `_1. x_` stay literal text.
- After a heading marker (`= `) the text is mid-line.

## Raw (code) text — measured by `s13-raw-probe.mjs`

- `` `a b` `` keeps its content exactly, spaces included (`` ` a ` `` keeps both spaces). Content with a backtick cannot use it.
- A fence of exactly two backticks is not usable: ``` ``a`b`` ``` fails with "unclosed delimiter".
- Three or more backticks on one line: the first word after the fence is taken as the language (```` ```ab``` ```` is language `ab`, empty text). Padding with a space works for the start but the end is inconsistent (trailing space kept in one case, removed in another). So inline code that contains a backtick is not emitted with a fence; it is emitted as `#raw("…")` with a string literal.
- Block fences: length = longest backtick run in the content + 1 (minimum 3) works, also for content ending in a backtick and for content containing ```` ``` ````. A leading indentation and one trailing newline are kept.
- Language tag directly after the fence: `js`, `objective-c` work; `c++` is cut at `+` (language `c`, content `++…`). Tags with other characters than letters, digits, `_`, `-` therefore use `#raw(block: true, lang: "c++", "…")`, which keeps both the tag and the content exactly (also for `c#`).

## Bare web addresses — measured by `s14-url-probe.mjs`

Typst turns every `http://` and `https://` (lowercase, preceded by anything, also by letters or digits) into a link, and the address token swallows `_ ~ * $ @ # & ? = % + , ; : ! ' ( ) [ ]` characters. Consequences:

- Escaping inside an address breaks it: `https://x.org/a\_b` links only `https://x.org/a`.
- A closing delimiter right after an address is swallowed: `*https://x.org/a*` and `_https://x.org/a_` fail with "unclosed delimiter" (the final `*`/`_` becomes part of the address). The Markdown `**https://…**` would therefore produce invalid Typst.
- Other schemes and uppercase (`ftp://`, `HTTPS://`) and any other `//` are line comments and break the file unless escaped.
- Decision (user, 2026-10-16, conditional on "does not mess up Typst parsing"): `//` stays escaped everywhere, so addresses are plain text. Clickable links come only from `#link(...)` (US-004).
