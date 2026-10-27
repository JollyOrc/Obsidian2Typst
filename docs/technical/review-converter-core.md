# Review: converter core stories (US-001 … US-006, US-013)

Status: **Decisions taken 2026-10-16 (section 5). Story files not yet changed.**
Method: stories read against SCAR-001/002/003/006/007/008/009 and the real
input `The Rules/compiledtext.md` (census counts below are from that file).

## 1. Findings

| # | Gap | Evidence | Story | Severity |
|---|-----|----------|-------|----------|
| G1 | Anchor-only links `[x](#anchor)` have no rule | 149 links, 75 distinct targets. 52 match heading text, 51 match a GitHub-style slug, 36 match only after stripping a numeric prefix (14 of those ambiguous), 10 unresolved (5 distinct targets) | US-004 | High |
| G2 | Inline footnotes `^[…]` not covered | 15 occurrences | US-005 | Medium |
| G3 | HTML comments have no rule | 41 (TextMapper render failures, TBLFM lines) | US-001 | Medium |
| G4 | Obsidian `#tags` have no rule; `#` is a Typst special char, so they must at least be escaped | ~400, many in table cells | US-001 | Medium |
| G5 | `<br>` inside table cells contradicts "multi-line cells out of scope" | 18 rows with `<br><br>` | US-005 | High |
| G6 | Warning volume: skipped heading levels warn by default | 36 skipped levels, 56 duplicate titles, 14 ambiguous anchors | US-002, US-006 | Medium |
| G7 | Emphasis emission is unsafe next to word characters (probe s16) | see section 2 | US-001, US-013 | High |
| G8 | AC examples miss real constructs: tab-indented nested lists (7), `*` list markers, bare URLs (14, end rule at `…X-Card]`) | census | US-001 | Medium |
| G9 | Markdown parser not chosen; no story or ticket owns it | n/a | new | High |

## 2. Emphasis probe (s16), measured with Typst 0.14.2

| Source | Result |
|--------|--------|
| `*b*`, `_b_`, `(*b*)`, `*b*,`, `*b*.`, `"*b*"`, `—*b*—`, `日*本*語` | strong / emph, fine |
| `a*b*c`, `a_b_c`, `5*b*5` | literal text, no emphasis |
| `*b*c`, `a*b*`, `_b_c`, `a_b_`, `_word_s` | **error: unclosed delimiter** |
| `*see https://x.org*` | **error**: the autolink swallows the closing `*` |
| `a#strong[b]c`, `a#emph[b]c` | correct in every position |

Consequences:

1. Markdown `a*b*c` (intraword emphasis) would silently lose its emphasis
   with `*` delimiters. With one-sided adjacency the document does not compile.
2. Emphasis ending in a URL breaks compilation.
3. The function forms `#strong[…]` / `#emph[…]` are safe everywhere.

Proposed rule (new US-013 AC-12): the emitter uses `*…*` / `_…_` only when
both neighbours are not word characters (whitespace, punctuation, line
start/end) **and** the content does not end in a URL; otherwise it emits
`#strong[…]` / `#emph[…]`. Test: round-trip harness over the cases above.
Alternative: always emit the function forms (simplest, less readable output).

## 3. Proposed changes per gap

- **G1 anchors.** New US-004 AC: resolve `#x` by (1) URL-decode, (2) exact
  heading text, (3) GitHub-style slug, (4) slug with leading numeric prefix
  stripped. Ambiguous (more than one match) → first in document order plus
  warning `LINK_AMBIGUOUS`. No match → plain text plus warning
  `LINK_UNRESOLVED`. Example data: the 5 unresolved targets.
- **G2.** Inline footnote `^[text]` → same footnote output as `[^1]`, text
  parsed as inline Markdown; numbering shares the per-chapter counter.
- **G3.** HTML comments are dropped from the output; one summary warning
  with the count (not one per comment).
- **G4.** `#tag` is kept as literal text (escaped, so `\#tag`); a later story
  may style it. No warning.
- **G5.** `<br>` in a table cell → `#linebreak()`; two in a row → a
  paragraph-like gap. Remove "multi-line cells out of scope" for this form.
- **G6.** Skipped-level warnings stay (US-002 AC-6 as decided) but US-006
  gets a grouped report: one line per code with a count, details expandable.
- **G7.** See section 2.
- **G8.** Add examples for tab-indented nesting, `*` markers and bare URLs.
  URL end rule: ends before whitespace, and before a trailing `. , ; : ! ? )`
  `]` unless balanced.
- **G9.** New story US-014 "Markdown parsing" plus a spike: evaluate a
  parser library (e.g. markdown-it or mdast-based) against the zero-dependency
  policy, measuring bundle size and coverage of the constructs above.

## 4. Open decisions

1. Emphasis emission: conditional (proposed) or always function forms.
2. Markdown parser: library (spike first) or hand-written subset parser.
3. Anchor ambiguity: first match plus warning (proposed) or treat as unresolved.
4. `#tags`: keep literal (proposed), strip, or style.
5. HTML comments: drop with one summary warning (proposed) or drop silently.

After decisions: update US-001/002/004/005/006/013, the test stubs and
`docs/technical/tests.md`, then write tickets for the converter core.

## 5. Decisions (2026-10-16)

1. Emphasis: conditional emission (`*…*`/`_…_` only when safe, else `#strong[…]`/`#emph[…]`).
2. Parser: spike a library first (new story US-014 plus spike ticket) before any parser code.
3. Ambiguous anchors: first match in document order plus warning `LINK_AMBIGUOUS`.
4. `#tags` stay literal (escaped); HTML comments dropped with one summary warning.

Next: update US-001/002/004/005/006/013 and add US-014, then test stubs, AC map and tickets.

## 6. Applied (2026-10-16)

Stories changed: US-001 (AC-2b, AC-5, AC-14, AC-15), US-002 (note), US-004
(AC-1b end rule, AC-8), US-005 (AC-2b, AC-4c), US-006 (AC-8), US-013 (AC-12,
status reopened to In Progress). New: US-014, TICKET-008 (parser spike),
TICKET-009 (`wrapEmphasis`). Test stubs and AC map updated; gate green.
Open: `HEADING_DUPLICATE` (US-006 AC-8 example) is a proposal; US-014 size
limit of 200 kB is a proposal.

## 7. Corrections (2026-10-16, after the parser landed)

- G6 used wrong counts. Measured on the parsed tree: **0 skipped heading levels**
  (not 36) and 47 repeated titles with 158 repeats (not 56). Stories US-002 and
  US-006 are corrected. The `HEADING_DUPLICATE` warning proposed in section 5 is
  withdrawn pending a decision: it would raise 158 warnings for a normal book
  and make strict mode unusable.
- US-004 AC-8 rule 3 stripped the number from the heading; the real links carry
  the number (`#1.3.1-tessera`), the headings do not. Rule 3 now strips it from
  the anchor. The counts 52/51/36/10/14 were re-measured and are unchanged.
