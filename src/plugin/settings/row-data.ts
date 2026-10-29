// US-008, US-009, US-010, US-018, US-019 (moved by US-021, TICKET-060): the
// labels, paths, kinds and hints of the Defaults rows and the font rows. No
// Obsidian import: the row functions (`rows.ts`) draw them, and the details
// pop-up (`details.ts`) lists them in the same order.
import {BUNDLED_CODE_FAMILY, BUNDLED_DEFAULT_FAMILY} from '../../core/fonts';
import {BREAK_LEVELS, BREAK_RULES} from '../../core/layout/page-setup';
import type {FieldPath} from '../../core/presets';

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

const SIZE_HINT = 'pt, greater than 0 and at most 200';

export const FONT_ROWS: readonly FontRow[] = [
  {
    label: 'Font folder',
    path: ['fonts', 'folder'],
    kind: 'folder',
    hint: 'vault folder with .ttf and .otf files',
  },
  {
    label: 'Default font',
    path: ['fonts', 'default'],
    kind: 'family',
    builtin: BUNDLED_DEFAULT_FAMILY,
  },
  {
    label: 'Body font',
    path: ['fonts', 'body', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: 'Body size (pt)',
    path: ['fonts', 'body', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: 'Heading font',
    path: ['fonts', 'heading', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: 'Heading size (pt)',
    path: ['fonts', 'heading', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: 'Caption font',
    path: ['fonts', 'caption', 'family'],
    kind: 'family',
    unset: true,
  },
  {
    label: 'Caption size (pt)',
    path: ['fonts', 'caption', 'size'],
    kind: 'size',
    hint: SIZE_HINT,
  },
  {
    label: 'Code font',
    path: ['fonts', 'code', 'family'],
    kind: 'family',
    builtin: BUNDLED_CODE_FAMILY,
  },
  {
    label: 'Code size (pt)',
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
    label: 'Highlight colour',
    path: ['highlightColor'],
    kind: 'text',
    hint: '#rrggbb',
  },
  {
    label: 'Heading numbering',
    path: ['headingNumbering'],
    kind: 'text',
    hint: '1.1, a.1, (1.1) or none',
  },
  {
    label: 'Footnotes for external links',
    path: ['externalLinkFootnotes'],
    kind: 'toggle',
  },
  {
    label: 'Template file',
    path: ['template'],
    kind: 'text',
    hint: 'path of a .typ file in the vault',
  },
  {
    label: 'Trim size',
    path: ['page', 'trimSize'],
    kind: 'text',
    hint: 'A4, A5, A6 or US Letter',
  },
  {label: 'Trim width (mm)', path: ['page', 'trimWidth'], kind: 'number'},
  {label: 'Trim height (mm)', path: ['page', 'trimHeight'], kind: 'number'},
  {label: 'Top margin (mm)', path: ['page', 'margins', 'top'], kind: 'number'},
  {
    label: 'Bottom margin (mm)',
    path: ['page', 'margins', 'bottom'],
    kind: 'number',
  },
  {
    label: 'Inside margin (mm)',
    path: ['page', 'margins', 'inside'],
    kind: 'number',
  },
  {
    label: 'Outside margin (mm)',
    path: ['page', 'margins', 'outside'],
    kind: 'number',
  },
  {label: 'Bleed (mm)', path: ['page', 'bleed'], kind: 'number'},
  {label: 'Slug (mm)', path: ['page', 'slug'], kind: 'number'},
  {label: 'Facing pages', path: ['page', 'facingPages'], kind: 'toggle'},
  {label: 'Gutter (mm)', path: ['page', 'gutter'], kind: 'number'},
  // US-019 AC-2: the page furniture, through the same row paths as above.
  {label: 'Page numbers', path: ['page', 'folios'], kind: 'toggle'},
  {label: 'Running header', path: ['page', 'runningHeader'], kind: 'toggle'},
  {
    label: 'Running header level',
    path: ['page', 'runningHeaderLevel'],
    kind: 'number',
    hint: '1 to 6',
  },
  // US-018 AC-8: page numbers after internal links (they need the folios).
  {
    label: 'Page numbers in links',
    path: ['linkPageNumbers'],
    kind: 'toggle',
  },
  {
    label: 'Link page level',
    path: ['linkPageLevel'],
    kind: 'number',
    hint: '1 to 6',
  },
  {label: 'Link page word', path: ['linkPageWord'], kind: 'text', hint: 'p.'},
  // US-025 AC-7: the break rule per heading level (after the link rows: the
  // US-018 and US-019 tests pin the rows that follow the furniture rows).
  ...BREAK_LEVELS.map((level, i): FieldRow => ({
    label: `Break before H${i + 1}`,
    path: ['page', 'breakBefore', level],
    kind: 'dropdown',
    options: BREAK_RULES,
  })),
  // US-026 AC-9: the book fields, after the break rows (the US-025 test slices
  // the six break rows). The signature's whole numbers are saved as numbers.
  {
    label: 'Pages per signature',
    path: ['book', 'signature'],
    kind: 'dropdown',
    options: ['0', '4', '8', '16', '32'],
  },
  {
    label: 'Roman folios in the front matter',
    path: ['book', 'romanFrontMatter'],
    kind: 'toggle',
  },
  {
    label: 'First chapter',
    path: ['book', 'firstChapter'],
    kind: 'dropdown',
    options: ['left', 'right'],
  },
  {
    label: 'Colophon heading',
    path: ['book', 'colophonHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
  {
    label: 'Back notes heading',
    path: ['book', 'backNotesHeading'],
    kind: 'dropdown',
    options: ['hidden', 'printed'],
  },
  // US-027 AC-8: the contents fields, after the book rows (the US-026 test
  // slices the five book rows). The depth is saved as a number; the labels
  // say `Contents` (`Page numbers` is the folio switch of US-019).
  {
    label: 'Contents depth',
    path: ['toc', 'depth'],
    kind: 'dropdown',
    options: ['0', '1', '2', '3', '4', '5', '6'],
  },
  {label: 'Contents title', path: ['toc', 'title'], kind: 'text'},
  {
    label: 'Contents page numbers',
    path: ['toc', 'pageNumbers'],
    kind: 'toggle',
  },
  {
    label: 'Contents dot leaders',
    path: ['toc', 'dotLeaders'],
    kind: 'toggle',
  },
  // US-028 AC-9 (decision 4): the image fit, after the contents rows (the
  // US-027 test slices four rows from `Contents depth`). Saved as a number;
  // the AC-1 check refuses a value outside 10 to 100.
  {
    label: 'Smallest image size',
    path: ['images', 'minScale'],
    kind: 'number',
    hint: '%, 10 to 100',
  },
];
