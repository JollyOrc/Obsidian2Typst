// Test helpers for headings (US-002): Markdown in, index and Typst out,
// through the real parser (US-014) and the real code.
import {indexHeadings, parse, type HeadingIndex} from '../../src/core/parse';

/** The heading index of the whole of `md`. */
export const index = (md: string): HeadingIndex =>
  indexHeadings(parse(md).root);

/** The labels (without `<` `>`) of the non-empty headings, in document order. */
export const labels = (md: string): string[] =>
  index(md).list.map((info) => info.label);
