// US-008, US-009, US-010, US-018, US-019 (moved by US-021, TICKET-060): the
// labels, paths, kinds and hints of the Defaults rows and the font rows. No
// Obsidian import: the row functions (`rows.ts`) draw them, and the details
// pop-up (`details.ts`) lists them in the same order.
import {BUNDLED_CODE_FAMILY, BUNDLED_DEFAULT_FAMILY} from '../../core/fonts';
import {BREAK_LEVELS, BREAK_RULES} from '../../core/layout/page-setup';
import type {FieldPath} from '../../core/presets';
import {STRINGS} from '../strings';

/** US-010 AC-6: one row of the Fonts section. */
export interface FontRow {
  label: string;
  path: FieldPath;
  kind: 'folder' | 'family' | 'size';
  /** A role dropdown has an entry for the default family. */
  unset?: boolean;
  /** The family that is used when the row has no value. */
  builtin?: string;
  hint?: string;
}

const SIZE_HINT = STRINGS.hints.size;

export const FONT_ROWS: readonly FontRow[] = [
  {
    label: STRINGS.labels.fontFolder,
    path: ['fonts', 'folder'],
    kind: 'folder',
    hint: STRINGS.hints.fontFolder,
  },
  {
    label: STRINGS.labels.defaultFont,
    path: ['fonts', 'default'],
    kind: 'family',
    builtin: BUNDLED_DEFAULT_FAMILY,
  },
  {
    label: STRINGS.labels.bodyFont,
    path: ['fonts', 'body', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: STRINGS.labels.bodySize,
    path: ['fonts', 'body', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: STRINGS.labels.headingFont,
    path: ['fonts', 'heading', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: STRINGS.labels.headingSize,
    path: ['fonts', 'heading', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: STRINGS.labels.captionFont,
    path: ['fonts', 'caption', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: STRINGS.labels.captionSize,
    path: ['fonts', 'caption', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: STRINGS.labels.codeFont,
    path: ['fonts', 'code', 'family'],
    kind: 'family',
    builtin: BUNDLED_CODE_FAMILY,
  },
  {
    label: STRINGS.labels.codeSize,
    path: ['fonts', 'code', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
];

/** One field of the Defaults: its label and where it is in the settings. */
export interface FieldRow {
  label: string;
  path: FieldPath;
  kind: 'text' | 'number' | 'toggle' | 'dropdown';
  hint?: string;
  /** US-025 AC-7: the values of a `dropdown` row, in the order shown. */
  options?: readonly string[];
}

export const DEFAULT_ROWS: readonly FieldRow[] = [
  {
    label: STRINGS.labels.highlightColour,
    path: ['highlightColor'],
    kind: 'text',
    hint: STRINGS.hints.highlightColour,
  },
  {
    label: STRINGS.labels.headingNumbering,
    path: ['headingNumbering'],
    kind: 'text',
    hint: STRINGS.hints.headingNumbering,
  },
  {
    label: STRINGS.labels.footnotesForExternalLinks,
    path: ['externalLinkFootnotes'],
    kind: 'toggle',
  },
  {
    label: STRINGS.labels.templateFile,
    path: ['template'],
    kind: 'text',
    hint: STRINGS.hints.templateFile,
  },
  {
    label: STRINGS.labels.trimSize,
    path: ['page', 'trimSize'],
    kind: 'text',
    hint: STRINGS.hints.trimSize,
  },
  {
    label: STRINGS.labels.trimWidth,
    path: ['page', 'trimWidth'],
    kind: 'number',
  },
  {
    label: STRINGS.labels.trimHeight,
    path: ['page', 'trimHeight'],
    kind: 'number',
  },
  {
    label: STRINGS.labels.topMargin,
    path: ['page', 'margins', 'top'],
    kind: 'number',
  },
  {
    label: STRINGS.labels.bottomMargin,
    path: ['page', 'margins', 'bottom'],
    kind: 'number',
  },
  {
    label: STRINGS.labels.insideMargin,
    path: ['page', 'margins', 'inside'],
    kind: 'number',
  },
  {
    label: STRINGS.labels.outsideMargin,
    path: ['page', 'margins', 'outside'],
    kind: 'number',
  },
  {label: STRINGS.labels.bleed, path: ['page', 'bleed'], kind: 'number'},
  {label: STRINGS.labels.slug, path: ['page', 'slug'], kind: 'number'},
  {
    label: STRINGS.labels.facingPages,
    path: ['page', 'facingPages'],
    kind: 'toggle',
  },
  {label: STRINGS.labels.gutter, path: ['page', 'gutter'], kind: 'number'},
  // US-019 AC-2: the page furniture, through the same row paths as above.
  {label: STRINGS.labels.pageNumbers, path: ['page', 'folios'], kind: 'toggle'},
  {
    label: STRINGS.labels.runningHeader,
    path: ['page', 'runningHeader'],
    kind: 'toggle',
  },
  {
    label: STRINGS.labels.runningHeaderLevel,
    path: ['page', 'runningHeaderLevel'],
    kind: 'number',
    hint: STRINGS.hints.runningHeaderLevel,
  },
  // US-018 AC-8: page numbers after internal links (they need the folios).
  {
    label: STRINGS.labels.pageNumbersInLinks,
    path: ['linkPageNumbers'],
    kind: 'toggle',
  },
  {
    label: STRINGS.labels.linkPageLevel,
    path: ['linkPageLevel'],
    kind: 'number',
    hint: STRINGS.hints.linkPageLevel,
  },
  {
    label: STRINGS.labels.linkPageWord,
    path: ['linkPageWord'],
    kind: 'text',
    hint: STRINGS.hints.linkPageWord,
  },
  // US-025 AC-7: the break rule per heading level (after the link rows: the
  // US-018 and US-019 tests pin the rows that follow the furniture rows).
  ...BREAK_LEVELS.map((level, i): FieldRow => ({
    label: STRINGS.labels.breakBefore(i + 1),
    path: ['page', 'breakBefore', level],
    kind: 'dropdown',
    options: BREAK_RULES,
  })),
  // US-026 AC-9: the book fields, after the break rows (the US-025 test slices
  // the six break rows). The signature's whole numbers are saved as numbers.
  {
    label: STRINGS.labels.pagesPerSignature,
    path: ['book', 'signature'],
    kind: 'dropdown',
    options: ['0', '4', '8', '16', '32'],
  },
  {
    label: STRINGS.labels.romanFoliosInTheFrontMatter,
    path: ['book', 'romanFrontMatter'],
    kind: 'toggle',
  },
  {
    label: STRINGS.labels.firstChapter,
    path: ['book', 'firstChapter'],
    kind: 'dropdown',
    options: ['left', 'right'],
  },
  {
    label: STRINGS.labels.colophonHeading,
    path: ['book', 'colophonHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
  {
    label: STRINGS.labels.backNotesHeading,
    path: ['book', 'backNotesHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
  // US-027 AC-8: the contents fields, after the book rows (the US-026 test
  // slices the five book rows). The depth is saved as a number; the labels
  // say `Contents` (`Page numbers` is the folio switch of US-019).
  {
    label: STRINGS.labels.contentsDepth,
    path: ['toc', 'depth'],
    kind: 'dropdown',
    options: ['0', '1', '2', '3', '4', '5', '6'],
  },
  {label: STRINGS.labels.contentsTitle, path: ['toc', 'title'], kind: 'text'},
  {
    label: STRINGS.labels.contentsPageNumbers,
    path: ['toc', 'pageNumbers'],
    kind: 'toggle',
  },
  {
    label: STRINGS.labels.contentsDotLeaders,
    path: ['toc', 'dotLeaders'],
    kind: 'toggle',
  },
  // US-028 AC-9 (decision 4): the image fit, after the contents rows (the
  // US-027 test slices four rows from `Contents depth`). Saved as a number;
  // the AC-1 check refuses a value outside 10 to 100.
  {
    label: STRINGS.labels.smallestImageSize,
    path: ['images', 'minScale'],
    kind: 'number',
    hint: STRINGS.hints.smallestImageSize,
  },
  // US-034 AC-1: the print resolution check; 0 turns it off.
  {
    label: STRINGS.labels.minimumPrintResolution,
    path: ['images', 'minDpi'],
    kind: 'number',
    hint: STRINGS.hints.minimumPrintResolution,
  },
];
