// US-011 AC-4, AC-5: the Typst text of the cover pages. Pure core.
//
// Transforms used (shared-utility register): typstString (the image path).
import {typstString} from '../emit/typst-string';
import {formatMm} from '../layout/page-setup';

/** The cover page margin: the slug (US-009 AC-11) or 0pt without one. */
const page = (slug: number | undefined, numberingNone: boolean): string =>
  `#page(margin: ${slug === undefined || slug === 0 ? '0pt' : formatMm(slug)}, header: none, footer: none${numberingNone ? ', numbering: none' : ''})`;

/**
 * The cover page, the blank page when asked for, and the reset of the page
 * counter; with a slug both pages have it as margin (US-009 AC-11). The reset comes after the last front page, so the first body page
 * has the value 1 (measured: before the blank page it would be 2).
 */
export function emitCoverPages(options: {
  path: string;
  blankPageAfter: boolean;
  /** The slug in mm (US-009 AC-9, AC-11); the page margin keeps it empty. */
  slug?: number;
  /**
   * US-019 AC-3: with folios on, the cover pages get `numbering: none`, so a
   * PDF viewer lists them without a page label. Default false: the text is as
   * before (US-011 AC-4; AC-8 of US-019).
   */
  numberingNone?: boolean;
  /**
   * US-026 AC-3: false before front matter: the pages count from the cover
   * (roman `iii` on the colophon) and the first chapter resets the counter.
   * Default true: the text is as before.
   */
  resetCounter?: boolean;
}): string {
  const PAGE = page(options.slug, options.numberingNone === true);
  const lines = [
    `${PAGE}[`,
    `  #image(${typstString(options.path)}, width: 100%, height: 100%, fit: "cover")`,
    ']',
  ];
  if (options.blankPageAfter) lines.push(`${PAGE}[]`);
  if (options.resetCounter !== false) lines.push('#counter(page).update(1)');
  return lines.join('\n');
}
