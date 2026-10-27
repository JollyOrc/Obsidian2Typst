// US-002: labels and levels of the headings of a document. Pure and computed
// from the tree alone: no Obsidian, Node, or I/O imports. The emitter writes
// the labels and US-004 resolves links to them, so both use this one index.
import {isNoteEmbed} from './links';
import type {BlockNode, HeadingNode, InlineNode} from './types';

/** One non-empty heading of the document. */
export interface HeadingInfo {
  node: HeadingNode;
  depth: number;
  /** 1-based source line. */
  line: number;
  /** The visible text ({@link visibleText}). */
  text: string;
  /** The unique label without `<` and `>`, e.g. `h-tessera-2`. */
  label: string;
  /** The level of the previous heading when this one jumps by more than one. */
  skippedFrom: number | null;
}

/** The headings of a document in document order (not those in footnotes). */
export interface HeadingIndex {
  /** Non-empty headings only (US-002 AC-7). */
  list: readonly HeadingInfo[];
  byNode: ReadonlyMap<HeadingNode, HeadingInfo>;
}

/**
 * US-002 AC-2, AC-2b: the label of a heading text, without the duplicate
 * suffix. NFC first, so that a combined and a separate accent agree; only
 * `A-Z` are lower-cased (no locale rules); every run of characters outside
 * `a-z0-9` becomes one `-`, leading and trailing `-` are removed; nothing left
 * gives `section`. Always matches `^h-[a-z0-9]+(-[a-z0-9]+)*$`.
 */
export function slug(text: string): string {
  const body = text
    .normalize('NFC')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `h-${body === '' ? 'section' : body}`;
}

/**
 * US-002 AC-2c: the text a reader sees. Text, code, the children of emphasis
 * and links, the alt text of an image, the alias (or `file#anchor`) of a
 * wikilink; footnotes, embeds, tags and comments add nothing; a break (also
 * `<br>`) and a
 * run of blanks are one space; the result is trimmed.
 */
export function visibleText(
  nodes: readonly InlineNode[],
  options: {dropImages?: boolean} = {},
): string {
  const raw = (list: readonly InlineNode[]): string =>
    list
      .map((node): string => {
        switch (node.kind) {
          case 'text':
          case 'code-inline':
            return node.value;
          case 'softbreak':
          case 'break':
            return ' ';
          case 'html-inline':
            // `<br>` is a break, like in emitInline; `</br>` is dropped there.
            return node.name === 'br' && !node.closing ? ' ' : '';
          case 'strong':
          case 'emph':
          case 'delete':
          case 'mark':
          case 'link':
            return raw(node.children);
          case 'image':
            return options.dropImages === true ? '' : node.alt;
          case 'wikilink':
            return (
              node.alias ??
              [node.file, node.anchor ?? ''].filter((p) => p !== '').join('#')
            );
          default:
            return '';
        }
      })
      .join('');
  return raw(nodes).replace(/\s+/g, ' ').trim();
}

/** US-002 AC-7: true when something of the heading is left in the output. */
function hasContent(
  nodes: readonly InlineNode[],
  dropImages: boolean,
): boolean {
  return nodes.some((node): boolean => {
    switch (node.kind) {
      case 'text':
      case 'code-inline':
        return node.value.trim() !== '';
      case 'strong':
      case 'emph':
      case 'delete':
      case 'mark':
      case 'link':
        return hasContent(node.children, dropImages);
      case 'image':
        return !dropImages;
      case 'embed':
        return !dropImages || isNoteEmbed(node.file);
      case 'wikilink':
      case 'footnote-ref':
      case 'inline-footnote':
        return true;
      default:
        return false;
    }
  });
}

/**
 * US-002 AC-1 to AC-7: labels and levels of all headings, in document order,
 * including those inside quotes, list items and footnote definitions.
 *
 * A heading without content is left out (it is not emitted, so it takes no
 * label and does not change the previous level). A label that is already used
 * gets the first suffix `-2`, `-3`, ... that is not used either, so a title
 * like `Intro 2` never clashes with the second `Intro` (AC-3b). Never changes
 * `blocks`; the same input gives the same index.
 */
export function indexHeadings(
  blocks: readonly BlockNode[],
  options: {dropImages?: boolean} = {},
): HeadingIndex {
  const dropImages = options.dropImages === true;
  const list: HeadingInfo[] = [];
  const used = new Set<string>();
  const next = new Map<string, number>();
  let previous: number | null = null;

  const unique = (base: string): string => {
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let n = next.get(base) ?? 2;
    while (used.has(`${base}-${n}`)) n += 1;
    next.set(base, n + 1);
    const label = `${base}-${n}`;
    used.add(label);
    return label;
  };

  const visit = (nodes: readonly BlockNode[]): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case 'heading': {
          if (!hasContent(node.children, dropImages)) break;
          const text = visibleText(node.children, {dropImages});
          const jumped = previous !== null && node.depth > previous + 1;
          list.push({
            node,
            depth: node.depth,
            line: node.line,
            text,
            label: unique(slug(text)),
            skippedFrom: jumped ? previous : null,
          });
          previous = node.depth;
          break;
        }
        case 'blockquote':
        case 'list':
        case 'item':
          visit(node.children);
          break;
        default:
          break;
      }
    }
  };
  visit(blocks);
  return {list, byNode: new Map(list.map((info) => [info.node, info]))};
}
