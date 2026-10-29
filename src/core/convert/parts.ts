// US-026: the order of the book parts. Takes the colophon and back-notes
// sections that `findGlossary` found (the one decider of sections) and puts
// them before and after the body. Pure: no Obsidian, Node, or I/O imports.
import {DEFAULT_BOOK, type BookSettings} from '../layout/page-setup';
import {headingRuleKey, type BookPart} from '../markers';
import type {BlockNode, HeadingNode} from '../parse';

/** A warning about the book parts, with the source line of its heading. */
export interface PartWarning {
  code: 'BOOK_PART_JOINED' | 'BOOK_PART_EMPTY';
  message: string;
  line: number;
}

/** US-026: the top-level blocks in the order they are written. */
export interface ArrangedParts {
  /** Colophon parts, then the body, then the back-notes parts. */
  blocks: BlockNode[];
  /** The part headings that are written as a label marker only (AC-2). */
  hidden: ReadonlySet<HeadingNode>;
  /** The headings of the parts left out (AC-8): links to them are unresolved. */
  dropped: ReadonlySet<HeadingNode>;
  /** AC-3, AC-5: the first block of the colophon and of the back notes, kept. */
  colophon: BlockNode | null;
  backNotes: BlockNode | null;
  /**
   * AC-3: where the first chapter starts: the first top-level H1 of the
   * body, else the body's first block; null with an empty body.
   */
  chapter: BlockNode | null;
  /** AC-3, AC-5: the headings of the parts kept (no US-025 break). */
  partHeadings: ReadonlySet<HeadingNode>;
  /** US-027 AC-5: the blocks of the body, in order. */
  body: readonly BlockNode[];
  warnings: PartWarning[];
}

/** US-027 AC-4, AC-5: where the table of contents is written. */
export interface ContentsPlace {
  /** The block the contents stand before; null: at the end of the document. */
  at: BlockNode | null;
  /** Before the first chapter: front matter (US-026); else part of the body. */
  front: boolean;
  /** The picked heading is not in the note (`TOC_HEADING_MISSING`). */
  missing: boolean;
}

/**
 * US-027 | AC-4, AC-5 (decisions 1, 5): The place of the contents. Without a
 * picked `heading`: before the first chapter (front matter). With one: the
 * first top-level H1 of the body whose visible text
 * (`textOf`) compares equal by the heading-rule comparison (`headingRuleKey`,
 * US-017 AC-2; SCAR-017); `before` it (a missing `position` is read as
 * `before`), or `after` its whole section: before the next top-level H1 of
 * the body, else before the first block of the back notes, else at the end.
 * Front matter exactly when the contents stand before the first chapter.
 * A heading not found gives the default place with `missing`. A glossary
 * term is never a top-level H1 (it lies one level below its section, US-017),
 * so no term can be picked.
 */
export function placeContents(
  arranged: Pick<ArrangedParts, 'body' | 'chapter' | 'backNotes'>,
  toc: {heading?: string; position?: 'before' | 'after'},
  textOf: (heading: HeadingNode) => string | undefined,
): ContentsPlace {
  const fallback = {at: arranged.chapter, front: true, missing: false};
  if (toc.heading === undefined) return fallback;
  const key = headingRuleKey(toc.heading);
  const chapters = arranged.body.filter(
    (block): block is HeadingNode =>
      block.kind === 'heading' && block.depth === 1,
  );
  const found = chapters.findIndex((heading) => {
    const text = textOf(heading);
    return text !== undefined && headingRuleKey(text) === key;
  });
  if (found < 0) return {...fallback, missing: true};
  const at =
    toc.position === 'after'
      ? (chapters[found + 1] ?? arranged.backNotes)
      : (chapters[found] as HeadingNode);
  return {at, front: at === arranged.chapter, missing: false};
}

const NAMES = {
  colophon: {section: 'colophon section', joined: 'the colophon above'},
  'back-notes': {
    section: 'back-notes section',
    joined: 'the back notes above',
  },
} as const;

/**
 * US-026 | AC-1, AC-2, AC-8: Arranges `root` for writing: the blocks of every
 * colophon part (in note order, joined), the body (every block that belongs
 * to no part), the blocks of every back-notes part. A part keeps its heading
 * block; with the heading `hidden` (the built-in) the heading is in `hidden`,
 * so the emitter writes only its label. A part with no blocks and a hidden
 * heading is left out with `BOOK_PART_EMPTY`; each part of a kind after the
 * first one kept is joined to it with `BOOK_PART_JOINED`, both at the part's
 * heading line; a link to a part left out is unresolved (`dropped`; decided
 * by the user 2026-10-28). Never changes its input; with no parts `blocks` is `root`'s
 * blocks in their order. US-026 AC-3, AC-5: also says where the colophon,
 * the back notes and the first chapter (the first top-level H1 of the body,
 * else its first block) start, for the page lines.
 */
export function arrangeParts(
  root: readonly BlockNode[],
  parts: readonly BookPart[],
  book: Partial<BookSettings> = {},
): ArrangedParts {
  const hiddenOf = {
    colophon:
      (book.colophonHeading ?? DEFAULT_BOOK.colophonHeading) === 'hidden',
    'back-notes':
      (book.backNotesHeading ?? DEFAULT_BOOK.backNotesHeading) === 'hidden',
  };
  const inPart = new Set<BlockNode>();
  const hidden = new Set<HeadingNode>();
  const dropped = new Set<HeadingNode>();
  const warnings: PartWarning[] = [];
  const kept = {colophon: [] as BlockNode[], 'back-notes': [] as BlockNode[]};
  const partHeadings = new Set<HeadingNode>();
  const seen = {colophon: false, 'back-notes': false};
  for (const part of parts) {
    inPart.add(part.heading);
    for (const block of part.blocks) inPart.add(block);
    const names = NAMES[part.rule];
    if (part.blocks.length === 0 && hiddenOf[part.rule]) {
      warnings.push({
        code: 'BOOK_PART_EMPTY',
        message: `The ${names.section} "${part.text}" is empty and is left out`,
        line: part.line,
      });
      dropped.add(part.heading);
      continue;
    }
    if (seen[part.rule]) {
      warnings.push({
        code: 'BOOK_PART_JOINED',
        message: `The ${names.section} "${part.text}" is joined to ${names.joined}`,
        line: part.line,
      });
    }
    seen[part.rule] = true;
    if (hiddenOf[part.rule]) hidden.add(part.heading);
    partHeadings.add(part.heading);
    kept[part.rule].push(part.heading, ...part.blocks);
  }
  const body = root.filter((block) => !inPart.has(block));
  const chapter =
    body.find((block) => block.kind === 'heading' && block.depth === 1) ??
    body[0] ??
    null;
  return {
    blocks: [...kept.colophon, ...body, ...kept['back-notes']],
    hidden,
    dropped,
    colophon: kept.colophon[0] ?? null,
    backNotes: kept['back-notes'][0] ?? null,
    chapter,
    partHeadings,
    body,
    warnings,
  };
}
