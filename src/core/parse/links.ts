// US-004: where a link points. Pure and computed from the tree alone: no
// Obsidian, Node, or I/O imports. The link emitter writes the Typst; this module
// decides what an address is and which heading an internal link finds.
import type {HeadingIndex, HeadingInfo} from './headings';
import type {WikilinkNode} from './types';

/** What an address of a Markdown link is (US-004 AC-1f, AC-3, AC-8, AC-9). */
export type Href =
  | {kind: 'empty'}
  /** `#Heading`: the decoded text after `#`. */
  | {kind: 'anchor'; target: string}
  /** A `.md` note: the decoded anchor, else the file name without `.md`. */
  | {kind: 'note'; target: string}
  /** Starts with a scheme (two or more letters, then `:`). */
  | {kind: 'external'}
  /** Everything else: a file on disk; `path` is URL-decoded. */
  | {kind: 'file'; path: string};

/** URL-decodes `text`; an invalid `%` sequence leaves it as written. */
function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** US-004 AC-1f, AC-3, AC-8, AC-9: classifies the address of a link. */
export function classifyHref(href: string): Href {
  const h = href.trim();
  if (h.startsWith('#')) {
    const target = decode(h.slice(1));
    return target === '' ? {kind: 'empty'} : {kind: 'anchor', target};
  }
  if (h === '') return {kind: 'empty'};
  if (/^[a-z][a-z0-9+.-]+:/i.test(h)) return {kind: 'external'};
  const hash = h.indexOf('#');
  const path = decode(hash < 0 ? h : h.slice(0, hash));
  if (/\.md$/i.test(path)) {
    const anchor = hash < 0 ? '' : decode(h.slice(hash + 1));
    const stem = (path.split('/').pop() ?? '').replace(/\.md$/i, '');
    return {kind: 'note', target: anchor === '' ? stem : anchor};
  }
  return {kind: 'file', path: decode(h)};
}

const norm = (text: string): string =>
  text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** GitHub-style slug: letters, digits and `-` stay, blanks become `-`. */
const githubSlug = (text: string): string =>
  norm(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

const LEADING_NUMBER = /^\d+(?:\.\d+)*\.?[\s-]+/;

/** Which rule found the headings, and the headings in document order. */
export interface Resolution {
  rule: 1 | 2 | 3;
  matches: readonly HeadingInfo[];
}

/** Rules 1 and 2 of US-004 AC-8b for one target. */
function matchTarget(
  target: string,
  list: readonly HeadingInfo[],
): readonly HeadingInfo[] {
  const text = norm(target);
  const byText = list.filter((h) => norm(h.text) === text);
  if (byText.length > 0) return byText;
  const slug = githubSlug(target);
  if (slug === '') return [];
  return list.filter((h) => {
    const own = githubSlug(h.text);
    return own === slug || own === text;
  });
}

/**
 * US-004 AC-2, AC-3, AC-8b: the headings an internal link finds. Rule 1
 * compares the heading text, rule 2 the GitHub-style slug, rule 3 repeats both
 * with a leading number removed from the target; the first rule that finds a
 * heading wins. `null` when nothing matches. Never changes `index`.
 */
export function resolveHeading(
  target: string,
  index: HeadingIndex,
): Resolution | null {
  const first = matchTarget(target, index.list);
  if (first.length > 0) {
    const rule = norm(first[0]?.text ?? '') === norm(target) ? 1 : 2;
    return {rule, matches: first};
  }
  const stripped = target.replace(LEADING_NUMBER, '');
  if (stripped !== target && stripped.trim() !== '') {
    const third = matchTarget(stripped, index.list);
    if (third.length > 0) return {rule: 3, matches: third};
  }
  return null;
}

/**
 * US-004 AC-2: the target of a wikilink: the text after the last `#`, else the
 * file part. `null` for a block reference (`[[Note#^id]]`) or an empty target.
 */
export function wikilinkTarget(node: WikilinkNode): string | null {
  const target =
    node.anchor !== null && node.anchor !== ''
      ? (node.anchor.split('#').pop() ?? '')
      : node.file;
  return target.trim() === '' || target.startsWith('^') ? null : target;
}

/**
 * US-004 AC-1d: removes a backslash in front of an ASCII punctuation character
 * (the parser keeps the escapes of a bare address as written).
 */
export function unescapeAddress(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

/**
 * US-004 AC-7: true when the name of an embed is a note (no file extension, or
 * `.md`). An extension is a dot, a letter and up to four letters or digits.
 */
export function isNoteEmbed(file: string): boolean {
  return /\.md$/i.test(file) || !/\.[A-Za-z][A-Za-z0-9]{0,4}$/.test(file);
}
