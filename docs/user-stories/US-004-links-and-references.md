# US-004 — Convert links, wikilinks, and anchors into PDF links

**Status:** Done (2026-10-17, AC-by-AC check; the preset field `externalLinkFootnotes` is delivered by US-008)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As a** reader of the final PDF,
**I want** links in the book to be clickable and to jump to the right chapter,
**so that** I can navigate the rulebook digitally.

---

## Acceptance criteria

- **AC-1 (external links stay clickable; the address is spelled out in a
  footnote):** In print the address must be readable, so a link whose text is
  not the address itself gets a footnote with the address:
  ```
  md : [Site](https://example.org/a?b=1)
  typ: #link("https://example.org/a?b=1")[Site]#footnote[#link("https://example.org/a?b=1")]
  ```
  The footnote shows the address as text (a `#link` without body displays the
  URL). Footnotes share one numbering with the footnotes of US-005.
  A call that is followed by `.`, `(`, `[` or `;` gets a `;` after it
  (`callSeparator`, SCAR-010; measured: `#link("u")(a)` calls `a`, and
  `#link("u")[a]` takes `a` as the body; the `;` is invisible):
  ```
  md : [Site](https://example.org).
  typ: #link("https://example.org")[Site]#footnote[#link("https://example.org")];.
  ```

- **AC-1b (no footnote when the text already is the address):** The footnote is
  omitted when the link text equals the address (after removing a leading
  `mailto:` from the address, and ignoring `<u>`/`<span>` formatting):
  ```
  md : <https://example.org>                          typ: #link("https://example.org")
  md : https://example.org                            typ: #link("https://example.org")
  md : [<u><span>raiders@orkpiraten.de</span></u>](mailto:raiders@orkpiraten.de)
  typ: #link("mailto:raiders@orkpiraten.de")[#underline[raiders\@orkpiraten.de]]
  ```
  Where a bare address ends is decided by the parser (linkify-it, measured in
  TICKET-010 follow-up probes): before whitespace, before trailing `.` `,` `;`
  `!` and before a closing `)` or `]` without an opening partner inside the
  address (`…/X-Card]` ends before the `]`; `…/a(b)c.` keeps `(b)`).
  ```
  md : see https://example.org/a_b.        typ: see #link("https://example.org/a_b");.
  md : (https://example.org)               typ: (#link("https://example.org"))
  md : [https://example.org/X-Card]        typ: \[#link("https://example.org/X-Card")\]
  ```
  The last two lines of the first example are taken from the colophon in `The Rules/compiledtext.md`.
  The `;` after the call in the first line is the call separator (AC-1).
  `mailto:` links whose text differs get a footnote showing the address without
  `mailto:`.

- **AC-1d (backslash escapes in bare addresses):** A bare address may contain
  Markdown escapes that the parser keeps (`Ancient\_tooling`). A backslash
  in front of an ASCII punctuation character is removed from the address and
  from the text before the rules above apply (decided by the user 2026-10-16):
  ```
  md : https://en.wikipedia.org/wiki/Ancient\_tooling
  typ: #link("https://en.wikipedia.org/wiki/Ancient_tooling")
  ```
  This applies only to links the parser marks as `linkify`; addresses inside
  `[x](…)` and `<…>` are not touched.

- **AC-1c (switch):** The preset field `externalLinkFootnotes` (boolean, default
  `true`) turns the footnotes of AC-1 off; the links stay clickable. Example:
  `A4 digital` can switch it off while `A5 print` keeps it on.

- **AC-1e (when the link has no body):** A link whose text equals its address
  and consists of plain text only is written without a body (Typst then shows
  the address itself; `mailto:` and `tel:` are shown without the prefix,
  measured). A link with formatted text keeps its body. Autolinks `<…>` and bare
  addresses never get a footnote (the parser recognizes bare addresses with a
  scheme only; `www.example.org` stays text). An empty text (`[](https://x.org)`) is a link without body and gets no footnote.
  ```
  md : [https://example.org](https://example.org)   typ: #link("https://example.org")
  md : [**https://example.org**](https://example.org)
  typ: #link("https://example.org")[*https:\/\/example.org*]   (`//` is escaped in text, US-013 AC-5)
  md : [](https://example.org)                      typ: #link("https://example.org")
  ```
  (An empty text is a link without body and needs no footnote: Typst shows the
  address.)

- **AC-1f (every URL scheme is external, decided by the user 2026-10-16):** A
  target that starts with `scheme:` (two or more letters, so `C:\x` is not a
  scheme) is an external link like `https:`: clickable, with the footnote of
  AC-1; `tel:` and `mailto:` are shown without the prefix. Only a target
  without a scheme can be a local file (AC-9).
  ```
  md : [Call us](tel:+4930123)
  typ: #link("tel:+4930123")[Call us]#footnote[#link("tel:+4930123")]
  ```

- **AC-2 (wikilinks to headings in the same file):** With headings
  `# Tessera` (`<h-tessera>`) in the document:
  ```
  md : [[Tessera]]            typ: #link(<h-tessera>)[Tessera]
  md : [[Tessera|fighting]]   typ: #link(<h-tessera>)[fighting]
  md : [[#Tessera]]           typ: #link(<h-tessera>)[Tessera]
  md : [[Rules#Tessera]]      typ: #link(<h-tessera>)[Tessera]
  ```
  Matching uses the one resolver of AC-8b (decided by the user 2026-10-16: the
  same rules for wikilinks, `.md` links and `#anchor` links). The target is the
  text after the last `#`, or the file part when there is no `#`; the text is
  the alias, else the target. A block reference (`[[Note#^id]]`) is never a
  heading: it is unresolved (AC-4). If several headings match, the first in
  document order is used and warning `LINK_AMBIGUOUS` is reported (AC-10).

- **AC-3 (Markdown links to files with anchors, as in compiled output):**
  `[x](../../Texts/01%20Reader%20Section/1.3.2%20Prism.md#Prism%20Variants)`
  resolves by the anchor text `Prism Variants` and becomes
  `#link(<h-prism-variants>)[x]`. A link to a `.md` file without an anchor
  resolves to the heading named like the file (without extension), with the
  rules of AC-8b: `[x](Texts/1.3.2%20Prism.md)` finds the heading `Prism`
  (rule 3 removes the number of the file name). The path is URL-decoded first;
  an invalid `%` sequence is kept as written.

- **AC-4 (unresolved targets):** If no heading matches, the link text is emitted
  without the link, converted like any other text (formatting is kept, decided
  by the user 2026-10-16), and warning `LINK_UNRESOLVED` is reported with the
  original target and the source line (AC-10).
  ```
  md : [[Nowhere]]                 typ: Nowhere
  md : [**Tessera**](#nowhere)      typ: *Tessera*
  md : [[Note#^abc]]               typ: ^abc           (block reference)
  md : [x]()                       typ: x    warning LINK_UNRESOLVED "Link without target"
  ```

- **AC-5 (composed: link inside a heading and inside a table cell):** In
  `## See [[Tessera]]` the heading text contains the link, and the heading's own
  label uses the plain text `See Tessera` (`<h-see-tessera>`). A link in a table
  cell is emitted inside that cell (US-005 writes the cell).
  ```
  md : # Tessera⏎## See [[Tessera]]
  typ: = Tessera <h-tessera>⏎⏎== See #link(<h-tessera>)[Tessera] <h-see-tessera>
  ```

- **AC-6 (composed: external link inside a footnote or a heading):** An
  external link inside footnote text is written with its address in
  parentheses and no extra footnote. (Decided by the user 2026-10-16. The first
  version of this story said Typst does not allow a footnote inside a footnote;
  measured with Typst 0.14.2, a nested footnote compiles without error or
  warning. The parentheses stay as a design choice: a note inside a note is hard
  to read in print.)
  ```
  md : text[^1]
       [^1]: See [Site](https://example.org).
  typ: text#footnote[See #link("https://example.org")[Site] (#link("https://example.org")).]
  ```
  An external link inside a heading gets no footnote (it would appear in the
  table of contents); the link stays clickable and warning
  `LINK_URL_NOT_SPELLED` is reported with the source line. Both rules apply only
  where a footnote would have been written: with `externalLinkFootnotes: false`,
  or when the text is the address (AC-1e), there is no parenthesis and no
  warning.
  ```
  md : ## Visit [Site](https://example.org)
  typ: == Visit #link("https://example.org")[Site] <h-visit-site>
       + warning LINK_URL_NOT_SPELLED
  ```

- **AC-8 (links to an anchor in the same file, as in compiled output):**
  `[x](#Prism%20Variants)` points at a heading of the document. The anchor
  is resolved in this order; the first rule that finds a heading wins:
  1. URL-decode the anchor, then compare with the heading plain text
     (case-insensitive);
  2. compare with the heading's GitHub-style slug (lower case, spaces → `-`,
     punctuation removed);
  3. strip a leading number from the **anchor** (`1.3.2-` or `4-`; the vault
     compiler removed the numbers from the headings but not from the links)
     and repeat rules 1 and 2.
  ```
  headings: ## Prism Variants        (label <h-prism-variants>)
            ## Prism                     (label <h-prism>)
  md : [x](#Prism%20Variants)   typ: #link(<h-prism-variants>)[x]
  md : [x](#prism-variants)     typ: #link(<h-prism-variants>)[x]
  md : [x](#1.3.2-prism)            typ: #link(<h-prism>)[x]
  md : [x](#nowhere)                typ: x       + warning LINK_UNRESOLVED
  ```
  If a rule finds several headings, the first in document order is used and
  `LINK_AMBIGUOUS` is reported with the number of candidates (decided by the
  user 2026-10-16). In the author's real file (re-measured on the parsed tree)
  149 such links occur, 75 distinct: 52 resolve by rule 1, 51 by rule 2, 36 by
  rule 3, 10 are unresolved (5 distinct targets), and 14 links are ambiguous.
  The regression test uses the same counts of the sample note `Book.md`
  (US-024: its manifest's `anchors`, each at least the real file's) and checks
  that every unresolved target holds a word no heading has.

- **AC-8b (one resolver, decided by the user 2026-10-16):** The three rules of
  AC-8 serve every internal link. The target is, by kind of link: the decoded
  anchor of `#anchor`; the decoded anchor of a `.md` link, else the file name
  without `.md`; the target of a wikilink (AC-2). Details fixed by the
  measurement on the real file:
  - rule 1 compares the heading plain text (US-002 AC-2c) with the target,
    NFC-normalized, lower-cased, runs of blanks as one blank;
  - rule 2 compares the GitHub-style slug of both: lower case, every character
    that is not a letter, digit, blank or `-` removed (Unicode letters stay),
    trimmed, runs of blanks to one `-`;
  - rule 3 applies when rules 1 and 2 found nothing and the target starts with a
    number (`^\d+(\.\d+)*\.?[\s-]+`): the number is removed and rules 1 and 2
    are repeated.
  The candidates of the first rule that finds any are in document order; the
  label is the one of AC-3b of US-002 (the first candidate).

- **AC-9 (links to local files):** A link whose address is not `http(s):`,
  `mailto:`, `#…` or a `.md` note points to a file on disk (the real input has
  one: `assets/roa_charactersheet_hex_skillmap.pdf`). It is not clickable in
  print and the file is not copied. The text stays and a footnote shows the
  decoded path, like external links (decided by the user 2026-10-16); the
  switch `externalLinkFootnotes` of AC-1c also turns this footnote off, then
  only the text remains:
  ```
  md : [Download and print out the character sheet here](assets/roa_charactersheet_hex_skillmap.pdf)
  typ: Download and print out the character sheet here#footnote[assets/roa\_charactersheet\_hex\_skillmap.pdf]
  ```
  The footnote text is escaped with `escapeMarkup` (US-013). No warning. Inside
  a heading there is no footnote and no warning; inside footnote text the path
  follows in parentheses, escaped the same way. A target counts as a local file
  when it has no scheme (AC-1f) and is not a `.md` note (AC-3).

- **AC-7 (embeds of notes):** `![[Other Note]]` in an already-compiled file is
  not expanded; it produces warning `EMBED_NOTE_UNEXPANDED` and the text
  `Other Note`. An embed is a note when its name has no file extension or ends
  in `.md` (an extension is a dot followed by a letter and up to four letters or
  digits, so `Version 1.2` is a note); every other embed is an asset and belongs
  to US-003.
  ```
  md : ![[Other Note]]        typ: Other Note     + EMBED_NOTE_UNEXPANDED
  md : ![[Other#Part|x]]      typ: Other\#Part
  ```

- **AC-10 (texts of the warnings):** Source line is that of the link.
  ```
  LINK_UNRESOLVED        No heading matches "[[Nowhere]]"      (wikilink as written)
                         No heading matches "#nowhere"         (target as written)
                         Link without target                   (empty address)
  LINK_AMBIGUOUS         "#intro" matches 3 headings; the first is used
  LINK_URL_NOT_SPELLED   Address of "https://example.org" is not spelled out in a heading
  EMBED_NOTE_UNEXPANDED  Note embed "![[Other Note]]" is not expanded
  ```

---

## Notes

- Page numbers in references ("see page 12") are a later feature.
- Decided by the user: links to the web are spelled out in footnotes (print
  readers cannot click). Wikilink resolution by heading text, as in AC-2, is
  confirmed.

---

- Heading targets come from `indexHeadings` and `slug(visibleText(...))` of US-002
  (TICKET-014): the pipeline builds the index once and passes it to both the
  heading emitter and the link resolver, so a link to a later heading finds its
  label. A heading link target is matched by `slug` of its text, and the same
  text order (first match plus `LINK_AMBIGUOUS`) applies as the labels are given
  in document order.

## Related tickets

- [TICKET-015](../tickets/TICKET-015-links-and-references.md) — the link
  resolver and the link, wikilink and note-embed emitters (all ACs except the
  table-cell example, US-005, and the preset switch, US-008).
