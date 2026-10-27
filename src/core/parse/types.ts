// US-014 AC-1b: the tree that `parse` returns. Plain data (no classes, no
// functions); every node has a 1-based `line` in the original file
// (frontmatter counted). Specified in docs/user-stories/US-014-markdown-parsing.md.

export type Align = 'left' | 'center' | 'right' | null;

interface Base {
  /** 1-based line in the original source (frontmatter lines counted). */
  line: number;
}

// ---- inline nodes ----------------------------------------------------------

export interface TextNode extends Base {
  kind: 'text';
  value: string;
  /** True (only then present) for the `^[` of a note that is never closed. */
  unclosedNote?: true;
}
export interface FormatNode extends Base {
  kind: 'strong' | 'emph' | 'delete' | 'mark';
  children: InlineNode[];
}
export interface CodeInlineNode extends Base {
  kind: 'code-inline';
  value: string;
}
export interface LinkNode extends Base {
  kind: 'link';
  /** As written in the source (not re-encoded). */
  href: string;
  title: string | null;
  /** `inline` = `[x](u)`, `autolink` = `<u>`, `linkify` = a bare address. */
  markup: 'inline' | 'autolink' | 'linkify';
  children: InlineNode[];
}
export interface ImageNode extends Base {
  kind: 'image';
  /** As written in the source (not re-encoded). */
  src: string;
  alt: string;
  title: string | null;
}
export interface WikilinkNode extends Base {
  kind: 'wikilink' | 'embed';
  /** Text before `#`; empty for `[[#Heading]]`. */
  file: string;
  anchor: string | null;
  /** Text after `|`: display text, or the size of an embed. */
  alias: string | null;
}
export interface FootnoteRefNode extends Base {
  kind: 'footnote-ref';
  label: string;
}
export interface InlineFootnoteNode extends Base {
  kind: 'inline-footnote';
  children: InlineNode[];
}
export interface CommentNode extends Base {
  kind: 'comment';
  /** The comment including `<!--` and `-->`. */
  value: string;
}
export interface HtmlInlineNode extends Base {
  kind: 'html-inline';
  /** Lower-case tag name; empty when the markup is not a tag. */
  name: string;
  closing: boolean;
  value: string;
}
export interface BreakNode extends Base {
  kind: 'break' | 'softbreak';
}

export type InlineNode =
  | TextNode
  | FormatNode
  | CodeInlineNode
  | LinkNode
  | ImageNode
  | WikilinkNode
  | FootnoteRefNode
  | InlineFootnoteNode
  | CommentNode
  | HtmlInlineNode
  | BreakNode;

// ---- block nodes -----------------------------------------------------------

export interface ParagraphNode extends Base {
  kind: 'paragraph';
  children: InlineNode[];
}
export interface HeadingNode extends Base {
  kind: 'heading';
  depth: number;
  children: InlineNode[];
}
export interface ListNode extends Base {
  kind: 'list';
  ordered: boolean;
  /** First number of an ordered list; null for a bullet list. */
  start: number | null;
  children: ItemNode[];
}
export interface ItemNode extends Base {
  kind: 'item';
  /** null for a normal item, true or false for a task item. */
  checked: boolean | null;
  children: BlockNode[];
}
export interface BlockquoteNode extends Base {
  kind: 'blockquote';
  children: BlockNode[];
}
export interface CodeNode extends Base {
  kind: 'code';
  lang: string;
  value: string;
}
export interface ThematicBreakNode extends Base {
  kind: 'thematic-break';
}
export interface TableNode extends Base {
  kind: 'table';
  align: Align[];
  children: RowNode[];
}
export interface RowNode extends Base {
  kind: 'row';
  header: boolean;
  /** Cells beyond the header that the parser cut (only present if > 0). */
  extraCells?: number;
  children: CellNode[];
}
export interface CellNode extends Base {
  kind: 'cell';
  children: InlineNode[];
}
export interface HtmlBlockNode extends Base {
  kind: 'html-block';
  value: string;
}
export interface FootnoteDefNode extends Base {
  kind: 'footnote-def';
  label: string;
  children: BlockNode[];
}

/** A comment on its own lines is a block; a comment in a line is inline. */
export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | ItemNode
  | BlockquoteNode
  | CodeNode
  | ThematicBreakNode
  | TableNode
  | RowNode
  | CellNode
  | HtmlBlockNode
  | CommentNode
  | FootnoteDefNode;

export type TreeNode = InlineNode | BlockNode;

export interface ParseResult {
  /** The YAML between the `---` lines, without the fences; null if none. */
  frontmatter: string | null;
  root: BlockNode[];
}
