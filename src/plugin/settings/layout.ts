// US-029 AC-1, AC-2, AC-4, AC-8: the layout of the settings tab and the style
// panel as data — sections of feature rows (name, description, an optional
// toggle field, the rows behind the gear) and plain rows (today's row as it
// is). No Obsidian import: the screens draw it, the details table reads its
// order (AC-9), the tests read it.
import {ownerNote} from '../../core/presets/owner';
import {DEFAULT_ROWS, FONT_ROWS} from './row-data';

/** A feature row: a toggle when `toggle` names a field, a gear when `rows` is not empty. */
export interface FeatureItem {
  kind: 'feature';
  name: string;
  desc: string;
  /** A Defaults path joined by dots, or `strictMode` (plugin data). */
  toggle?: string;
  /** The labels of the rows its gear opens, in order; empty: no gear. */
  rows: readonly string[];
}

/** One entry of a section. */
export type LayoutItem =
  | {kind: 'presets'}
  | {kind: 'cover'}
  | {kind: 'plain'; label: string}
  | FeatureItem;

/** A collapsible section of a screen. */
export interface LayoutSection {
  name: string;
  items: readonly LayoutItem[];
}

const PAGE: LayoutSection = {
  name: 'Page',
  items: [
    {
      kind: 'feature',
      name: 'Page setup',
      desc: 'Trim size, margins, bleed and facing pages.',
      rows: [
        'Trim size',
        'Trim width (mm)',
        'Trim height (mm)',
        'Top margin (mm)',
        'Bottom margin (mm)',
        'Inside margin (mm)',
        'Outside margin (mm)',
        'Bleed (mm)',
        'Slug (mm)',
        'Facing pages',
        'Gutter (mm)',
      ],
    },
    {
      kind: 'feature',
      name: 'Page numbers',
      desc: 'A page number at the foot of every body page.',
      toggle: 'page.folios',
      rows: [],
    },
    {
      kind: 'feature',
      name: 'Running header',
      desc: 'The chapter title at the head of the page.',
      toggle: 'page.runningHeader',
      rows: ['Running header level'],
    },
    {
      kind: 'feature',
      name: 'Page breaks',
      desc: 'A new page or spread before headings, by level.',
      rows: [1, 2, 3, 4, 5, 6].map((n) => `Break before H${n}`),
    },
  ],
};

const TEXT: LayoutSection = {
  name: 'Text',
  items: [
    {
      kind: 'feature',
      name: 'Fonts',
      desc: 'The font folder, families and sizes.',
      rows: FONT_ROWS.map((row) => row.label),
    },
    {kind: 'plain', label: 'Heading numbering'},
    {kind: 'plain', label: 'Highlight colour'},
    {
      kind: 'feature',
      name: 'Page numbers in links',
      desc: '(p. 42) after internal links.',
      toggle: 'linkPageNumbers',
      rows: ['Link page level', 'Link page word'],
    },
    {
      kind: 'feature',
      name: 'Footnotes for external links',
      desc: 'The address of an external link as a footnote.',
      toggle: 'externalLinkFootnotes',
      rows: [],
    },
    {kind: 'plain', label: 'Template file'},
  ],
};

const BOOK: LayoutSection = {
  name: 'Book',
  items: [
    {
      kind: 'feature',
      name: 'Book parts',
      desc: 'Colophon, back notes and where the first chapter starts.',
      rows: ['First chapter', 'Colophon heading', 'Back notes heading'],
    },
    {
      kind: 'feature',
      name: 'Roman folios in the front matter',
      desc: 'i, ii, iii before the first chapter.',
      toggle: 'book.romanFrontMatter',
      rows: [],
    },
    {
      kind: 'feature',
      name: 'Signatures',
      desc: 'Blank pages at the end to fill a signature.',
      rows: ['Pages per signature'],
    },
    {
      kind: 'feature',
      name: 'Contents',
      desc: 'A table of contents; off while its depth is 0.',
      rows: [
        'Contents depth',
        'Contents title',
        'Contents page numbers',
        'Contents dot leaders',
      ],
    },
    {
      kind: 'feature',
      name: 'Image fit',
      desc: 'Images shrink to stay with their text; off at 100 %.',
      rows: ['Smallest image size'],
    },
    {
      kind: 'feature',
      name: 'Print resolution',
      desc: 'Warns about images below this dpi; off at 0.',
      rows: ['Minimum print resolution'],
    },
  ],
};

/** US-029 | AC-1, AC-2, AC-4: the five sections of the settings tab. */
export const TAB_LAYOUT: readonly LayoutSection[] = [
  {name: 'Presets', items: [{kind: 'presets'}]},
  PAGE,
  TEXT,
  BOOK,
  {
    name: 'Export',
    items: [
      {
        kind: 'feature',
        name: 'Strict mode',
        desc: 'Conversion warnings abort the export.',
        toggle: 'strictMode',
        rows: [],
      },
      {kind: 'plain', label: 'Presets folder'},
      {kind: 'plain', label: 'Warnings note folder'},
    ],
  },
];

/** US-029 | AC-8: the panel's sections: Page, Text, Book as on the tab, then Cover. */
export const PANEL_LAYOUT: readonly LayoutSection[] = [
  PAGE,
  TEXT,
  BOOK,
  {name: 'Cover', items: [{kind: 'cover'}]},
];

/** The path of the Defaults or font row with this label, if there is one. */
function pathOf(label: string): readonly string[] | undefined {
  return (
    DEFAULT_ROWS.find((row) => row.label === label)?.path ??
    FONT_ROWS.find((row) => row.label === label)?.path
  );
}

/**
 * US-029 | AC-8 (decision 7): The note a panel feature row adds after its
 * description: `Set by preset "<name>": a, b.` with the labels of `rows`
 * (in their order) whose field the preset owns by the rule of `ownerNote` —
 * the trim size is one group, so a preset that sets one of the three owns all
 * three. Null when the preset owns none of them.
 */
export function ownedRowsNote(
  presetName: string,
  presetFields: unknown,
  rows: readonly string[],
): string | null {
  const owned = rows.filter((label) => {
    const path = pathOf(label);
    return (
      path !== undefined && ownerNote(presetName, presetFields, path) !== null
    );
  });
  return owned.length === 0
    ? null
    : `Set by preset "${presetName}": ${owned.join(', ')}.`;
}

/**
 * US-029 | AC-9: The labels of the tab's rows in layout order: section by
 * section, a feature's toggle row (its name) first, then its gear rows; plain
 * rows in place. Rows that are no Defaults or font row (Strict mode, the
 * folders) are left out.
 */
export function layoutRowOrder(): string[] {
  const labels: string[] = [];
  for (const section of TAB_LAYOUT) {
    for (const item of section.items) {
      if (item.kind === 'plain') labels.push(item.label);
      if (item.kind !== 'feature') continue;
      if (item.toggle !== undefined) labels.push(item.name);
      labels.push(...item.rows);
    }
  }
  return labels.filter((label) => pathOf(label) !== undefined);
}
