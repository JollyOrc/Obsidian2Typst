// US-013 AC-12: write strong and emphasis so that Typst reads them as
// intended. Pure; the inner text is already escaped Typst and is never changed.
//
// Typst reads `*...*` and `_..._` as emphasis only when no word character
// touches the delimiter on exactly one side: `*b*c` and `a*b*` do not compile,
// `a*b*c` stays literal text, and a closing `*` right after a web address is
// swallowed by the address (probe s16, docs/technical/typst-escaping-findings.md).
// The function forms `#strong[...]` and `#emph[...]` are valid everywhere.
// A strong delimiter next to a slash is a comment marker (`a/*b*` opens one,
// `*b*/c` closes one), so `strong` also takes the function form when a slash is
// the last character before, the first after, or the first or last of the
// content (US-013 AC-12b, probe s22). `_` is not affected.
//
// Transforms:
//  - emphasis-delimiter: `*inner*` / `_inner_` when neither neighbour is a
//    letter, digit or combining mark and the content does not end in an address
//  - emphasis-function:  `#strong[inner]` / `#emph[inner]` in every other case
import type {Transform} from './escape-markup';

export const EMPHASIS_TRANSFORMS: readonly Transform[] = [
  {
    id: 'emphasis-delimiter',
    description:
      '*inner* or _inner_ when the neighbours are not word characters',
  },
  {
    id: 'emphasis-function',
    description:
      '#strong[inner] or #emph[inner] next to a word character or an address, and strong next to a slash',
  },
];

export interface EmphasisContext {
  /** Source text just before the mark; only its last character matters. */
  prev: string;
  /** Source text just after the mark; only its first character matters. */
  next: string;
  /** True when the content ends in a web address or a link. */
  endsWithAddress: boolean;
}

const WORD = /[\p{L}\p{N}\p{M}]/u;

const isWord = (ch: string | undefined): boolean =>
  ch !== undefined && WORD.test(ch);

export function wrapEmphasis(
  kind: 'strong' | 'emph',
  inner: string,
  ctx: EmphasisContext,
): string {
  const before = Array.from(ctx.prev).at(-1);
  const after = Array.from(ctx.next)[0];
  const slashClash =
    kind === 'strong' &&
    (before === '/' ||
      after === '/' ||
      inner[0] === '/' ||
      inner.at(-1) === '/');
  const safe =
    !ctx.endsWithAddress && !slashClash && !isWord(before) && !isWord(after);
  if (safe) {
    const mark = kind === 'strong' ? '*' : '_';
    return `${mark}${inner}${mark}`;
  }
  return `#${kind}[${inner}]`;
}
