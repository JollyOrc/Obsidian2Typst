# US-013 — One escaping module that keeps every generated Typst file valid

**Status:** Done (approved by the user 2026-10-16; implemented by TICKET-004 to TICKET-009 and TICKET-011)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** the escaping rules inside US-001 AC-3 and AC-4 (those two ACs stay as end-to-end examples and now point here)

---

## Story

**As an** author,
**I want** every piece of text, path, and code that the plugin writes into a Typst file to be escaped by one tested module,
**so that** my text appears exactly as I wrote it and the compiler never fails or silently changes my words.

Evidence: `docs/technical/typst-escaping-findings.md` (measured with the bundled compiler).

---

## Acceptance criteria

The module `core/emit` has three functions for three different contexts; they are
not interchangeable (SCAR-001): `escapeMarkup(text, {atBlockStart})` for text in
markup, `typstString(value)` for a Typst string literal, and `rawBlock(...)` /
`rawInline(...)` for code.

- **AC-1 (markup characters):** In `escapeMarkup` each of `\ $ # @ < > [ ] ~ * _ `` ` ``
  gets a backslash in front. Nothing else is touched on a line that does not start
  with a marker (AC-3).
  ```
  in : Price: $5 for item #3 @ home, see <here> and [there] ~ ok
  out: Price: \$5 for item \#3 \@ home, see \<here\> and \[there\] \~ ok
  in : snake_case, 2*3, a\b, `x`
  out: snake\_case, 2\*3, a\\b, \`x\`
  in : {a} (b): 5% & a^b | "q" 'r' café ☃ 😀
  out: {a} (b): 5% & a^b | "q" 'r' café ☃ 😀
  ```
  `_` is escaped everywhere, also inside words, because `snake\_case` renders the
  same and the rule stays simple (decided in this draft; see Notes).

- **AC-2 (slashes and web addresses):** `//` becomes `\/\/` (both slashes); a
  single `/` stays. `/*` and `*/` need no extra rule because `*` is escaped.
  A bare web address is therefore plain text, not an automatic link.
  ```
  in : see http://x.org/a_b and a/b and /* c */
  out: see http:\/\/x.org/a\_b and a/b and /\* c \*/
  ```

- **AC-3 (line start):** At the start of the text when `atBlockStart` is true, and
  after every newline in the text, the first non-blank character is escaped when
  it begins a marker: a `=` run, or `-`, `+`, `/`, or digits followed by `.`,
  when a space, a tab, or the end of the line comes next (a marker at the end of
  a line is an empty list item or heading in Typst; found by the round-trip
  test). Leading spaces and tabs are kept.
  ```
  in : = 5 apples            out: \= 5 apples
  in : == x                  out: \== x
  in : - x   + x   / x       out: \- x   \+ x   \/ x           (one per line)
  in : 12. one               out: 12\. one
  in : =   -   +   /   12.   out: \=   \-   \+   \/   12\.     (one per line)
  in :   = x                 out:   \= x
  in : a\n= b\n- c           out: a\n\= b\n\- c
  ```
  Not escaped (the marker is followed by something else): `=5`, `==x`, `1.5 x`,
  `1) x`, and `a = b`.

- **AC-4 (inline position):** With `atBlockStart: false` the first line is not
  treated as a line start; after a newline the rule of AC-3 still applies.
  ```
  atBlockStart false:  in : = x\n= y   out: = x\n\= y
  atBlockStart true :  in : = x\n= y   out: \= x\n\= y
  ```

- **AC-5 (typography kept):** `--`, `---`, `...`, straight quotes, and NBSP are
  left unchanged; `-?` becomes `\-?`.
  ```
  in : wait -- what --- really... "x" a-?b
  out: wait -- what --- really... "x" a\-?b
  ```

- **AC-6 (composed: every `[ ... ]` block and list item is a line start):** The
  caller passes `atBlockStart: true` for the first text of a paragraph, a list
  item, a quote, a table cell, a footnote, a caption, a link label, and
  `#highlight[…]`/`#underline[…]` content, and `false` after a heading marker and
  inside `*…*` or `_…_`. Rendered plain text must equal the Markdown text:
  ```
  md : ==marked== with text "= x"       typ: #highlight[\= x]
  md : [= x](https://a.org)             typ: #link("https://a.org")[\= x]
  md : - = x                            typ: - \= x
  md : | - a | + b |                    typ: [\- a], [\+ b]
  md : *= x*                            typ: *= x*          (no escape inside strong)
  md : = 1. x   (a heading "1. x")      typ: = 1. x         (after the heading marker)
  ```
  The call-site table is part of the shared-utility register (README).

- **AC-7 (string literals):** `typstString(value)` returns the value in double
  quotes with `\` → `\\`, `"` → `\"`, newline → `\n`, tab → `\t`, other control
  characters (U+0000–U+001F, U+007F) → `\u{hex}`. Nothing else changes.
  ```
  a"b.png          → "a\"b.png"
  C:\x\y.png       → "C:\\x\\y.png"
  Cover Draft.png  → "Cover Draft.png"
  line1\nline2     → "line1\nline2"        (written with an escaped newline)
  ```
  Used for image paths, link addresses, font family names, and colour values.

- **AC-8 (code):** `rawInline(code)` and `rawBlock(code, lang)` keep the content
  byte for byte (evidence: findings file, raw section).
  - Inline: content without a backtick and without a newline is written as
    `` `code` `` (spaces kept); any other content is written as `#raw("code")`
    with a string literal (AC-7), because a fence of two backticks does not work
    and a fence of three or more reads the first word as a language.
  - Block: the fence has one backtick more than the longest backtick run in the
    content, at least three. If `lang` is empty or consists only of letters,
    digits, `_` and `-`, it follows the fence directly. Any other tag (`c++`,
    `c#`) is written with the function form so that the tag and the content
    stay exact.
  ````
  rawInline("a b")                → `a b`
  rawInline("a`b")                → #raw("a`b")
  rawBlock("let a = `x`;", "js")  → ```js\nlet a = `x`;\n```
  rawBlock("a ```b``` c", "")     → ````\na ```b``` c\n````
  rawBlock("int x;", "c++")       → #raw(block: true, lang: "c++", "int x;")
  ````

- **AC-9 (round trip against the real compiler):** For every printable ASCII
  character c, each of `c`, `x c y`, `c` at line start, and `c` after a space at
  line start, wrapped as `[` + `escapeMarkup(...)` + `]`, compiles without error
  and reads back as exactly the original text. The reading helper `plain()` (first version in
  `spikes/typst-wasm/s12-escape-probe.mjs`, to be rewritten as a test helper in
  TICKET-007) maps a smart quote back to its straight character,
  because Typst typography is kept on purpose (AC-5). The same holds for the
  AC-1 to AC-3 examples, for every call-site shape of AC-6, and for these
  hostile strings: `\n`, `\\`, `//` at the end of a line, a text that is
  only `=`, `-`, `- ` or `1. `, and 5000 repeated special characters. Typography has
  its own expectations: `--` reads back as `–`, `---` as `—`, `...` as `…`. A
  failure is a compile error or a different text, so no silent difference
  remains.

- **AC-10 (pure and deterministic):** The three functions import nothing from
  Obsidian, Node, or I/O (enforced by lint), return the same output for the same
  input, and are not idempotent: escaping twice is a bug. `core/emit` exports the
  list of its transforms (`MARKUP_TRANSFORMS`, `STRING_TRANSFORMS`,
  `RAW_TRANSFORMS`); each id appears in the shared-utility register (SCAR-001).

- **AC-11 (what it is not):** The warning report (US-006) escapes `|` for a
  Markdown table; that is Markdown, not Typst, and is not done here. Heading
  labels `<h-slug>` come from the slug utility, not from this module.

- **AC-12 (emphasis wrappers):** `wrapEmphasis(kind, inner, ctx)` (`kind`:
  `strong` or `emph`; `inner`: already escaped Typst; `ctx`: `prev` and `next`
  source characters, empty at a boundary, and `endsWithAddress`) returns the
  delimiter form `*inner*` / `_inner_` when neither `prev` nor `next` is a
  letter or digit and `endsWithAddress` is false, otherwise `#strong[inner]` /
  `#emph[inner]`. Measured with the compiler (probe `s16`):
  ```
  prev ' ' next ','   *b*            -> *b*
  prev 'a' next 'c'   *b*            -> #strong[b]     (a*b*c would stay literal)
  prev '' next 's'    _b_            -> #emph[b]       (_b_s fails: unclosed delimiter)
  prev ' ' next ''    ends in URL    -> #strong[…]     (*…https://x.org* fails)
  ```
  Only the last character of `prev` and the first of `next` count; a letter,
  digit or combining mark (any script, so CJK too) is a word character. This
  errs towards the function form, which is always valid.
  Round trip: every row above, nested forms, both marks at line start/end, and
  a Unicode set (CJK, em dash, curly quotes) compile and read back as the
  intended text and emphasis (`plain()` extended to show `<strong>`/`<emph>`).
  Transform ids: `emphasis-delimiter`, `emphasis-function`.

- **AC-12b (strong next to a slash):** In Typst `/*` opens and `*/` closes a
  comment, also when the `*` is a strong delimiter (probe `s22`: `a/*b*` and
  `*b*/c` fail with "unclosed delimiter"; `_` is not affected: `a/_b_` and
  `_b_/c` compile; two strong marks side by side, `*a**b*`, read as two
  strong elements). `wrapEmphasis` therefore returns `#strong[inner]` for
  `kind` `strong` when the last character of `prev`, the first of `next`, the
  first or the last of `inner` is `/`. `emph` is unchanged. This errs towards
  the function form, which is always valid (`a\/\/` as inner ends in `/` and
  also takes the function form).
  ```
  strong, inner b,  prev 'a/' next ' '   -> #strong[b]
  strong, inner b,  prev ' '  next '/c'  -> #strong[b]
  strong, inner /x, prev ' '  next ' '   -> #strong[/x]
  emph,   inner b,  prev 'a/' next ' '   -> _b_
  ```

- **AC-13 (text directly after an embedded call):** An embedded call such as
  `#strike[a]`, `#strong[a]`, `#raw("a")` or `#link("u")[a]` ends the code
  expression only at a whitespace, a `#` or an escape. Measured with the
  compiler (probes `s20`, `s21`, `s22`): when the next character is `.` (and a
  name follows: `#strike[a].b` fails with "strike does not have field"), `(`
  (`#strike[a](x)` fails with "unknown variable: x") or `[` (`#strike[a][x]`
  fails with "unexpected argument"), Typst binds it to the call; a `;` right
  after a call is consumed and disappears from the text (`#strike[a];b` reads
  `a b` without the `;`). A `;` between call and text stops all four and is
  itself invisible (`#strike[a];.b` reads `a.b`; `#strike[a];;b` reads `a;b`);
  `#[]`, `#h(0pt)`, `#{}`, `#none` and `#""` were tried and fail.
  The function `callSeparator(next)` (`core/emit`) returns `;` when the first
  character of `next` (the text that follows the call directly) is `.`, `(`, `[`
  or `;`, and the empty string otherwise (also for an empty `next`, a blank,
  a letter, `,`, `*`, `_`, `\` or `#`). It never looks further than one
  character, so it also separates `.5` and `. b` (harmless: the `;` is
  invisible). Every emitter that appends text to a call uses it; calls at the
  end of a line or before a blank need none.
  ```
  callSeparator('.b') -> ';'      callSeparator('(x)') -> ';'
  callSeparator('[x]') -> ';'     callSeparator('; b') -> ';'
  callSeparator(' b') -> ''       callSeparator(', b') -> ''
  callSeparator('') -> ''         callSeparator('\\[x') -> ''
  ```
  Round trip: for each of the call forms above plus `#footnote[a]`, `#line(length: 100%)`
  and `#linebreak()`, each of the followers `.b`, `(x)`, `;`, `[x]`, `, x`,
  `/`, ` x` is emitted as call + `callSeparator(follower)` + follower; the
  compiled text is the call's own text followed by the follower unchanged.
  Transform id: `call-separator`.

---

## Notes

- Reopened 2026-10-16 and closed again with TICKET-009 for AC-12 (found in the converter-core review,
  `docs/technical/review-converter-core.md`); AC-1 to AC-11 are unchanged. Reopened a second time the same day
  for AC-12b and AC-13 (found while specifying the inline emitter, probes `s20` to `s22`) and closed with TICKET-011.
- Decided by the user (2026-10-16): `_` always escaped (AC-1); `12. ` at line
  start escaped (AC-3); quotes and dashes kept (US-001). The user asked to leave
  `//` in addresses alone unless that breaks Typst parsing. It does: Typst
  links every `http(s)://` address, escapes inside it break the link, and a
  closing `*` or `_` right after an address is swallowed (`**https://…**` would
  not compile; see the findings file). So `//` stays escaped (AC-2) and
  addresses are plain text; clickable links come from `#link` (US-004).
- US-001 AC-3/AC-4 stay as end-to-end examples of a paragraph; their module-level
  rules are these.
- Math (`$…$`) is not converted (US-001 notes); a literal `$` is escaped.

---

## Related tickets

- [TICKET-004](../tickets/TICKET-004-escape-markup.md) — `escapeMarkup` (AC-1 to AC-6, AC-10)
- [TICKET-005](../tickets/TICKET-005-typst-string-literal.md) — `typstString` (AC-7)
- [TICKET-006](../tickets/TICKET-006-raw-code-emission.md) — `rawInline` / `rawBlock` (AC-8)
- [TICKET-007](../tickets/TICKET-007-escaping-roundtrip-harness.md) — round trip against the compiler (AC-9)
- [TICKET-009](../tickets/TICKET-009-emphasis-wrappers.md) — `wrapEmphasis` (AC-12)
- [TICKET-011](../tickets/TICKET-011-call-separator-and-slash-rule.md) — `wrapEmphasis` slash rule and `callSeparator` (AC-12b, AC-13)
