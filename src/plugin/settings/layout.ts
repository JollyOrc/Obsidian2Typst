// US-029 AC-1, AC-2, AC-4, AC-8: the layout of the settings tab and the style
// panel as data — sections of feature rows (name, description, an optional
// toggle field, the rows behind the gear) and plain rows (today's row as it
// is). No Obsidian import: the screens draw it, the details table reads its
// order (AC-9), the tests read it.
import {ownerNote} from '../../core/presets/owner';
import {DEFAULT_ROWS, FONT_ROWS} from './row-data';
import {STRINGS} from '../strings';

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
  name: STRINGS.sections.page,
  items: [
    {
      kind: 'feature',
      name: STRINGS.features.pageSetup,
      desc: STRINGS.featureDescs.pageSetup,
      rows: [
        STRINGS.labels.trimSize,
        STRINGS.labels.trimWidth,
        STRINGS.labels.trimHeight,
        STRINGS.labels.topMargin,
        STRINGS.labels.bottomMargin,
        STRINGS.labels.insideMargin,
        STRINGS.labels.outsideMargin,
        STRINGS.labels.bleed,
        STRINGS.labels.slug,
        STRINGS.labels.facingPages,
        STRINGS.labels.gutter,
      ],
    },
    {
      kind: 'feature',
      name: STRINGS.labels.pageNumbers,
      desc: STRINGS.featureDescs.pageNumbers,
      toggle: 'page.folios',
      rows: [],
    },
    {
      kind: 'feature',
      name: STRINGS.labels.runningHeader,
      desc: STRINGS.featureDescs.runningHeader,
      toggle: 'page.runningHeader',
      rows: [STRINGS.labels.runningHeaderLevel],
    },
    {
      kind: 'feature',
      name: STRINGS.features.pageBreaks,
      desc: STRINGS.featureDescs.pageBreaks,
      rows: [1, 2, 3, 4, 5, 6].map((n) => STRINGS.labels.breakBefore(n)),
    },
  ],
};

const TEXT: LayoutSection = {
  name: STRINGS.sections.text,
  items: [
    {
      kind: 'feature',
      name: STRINGS.features.fonts,
      desc: STRINGS.featureDescs.fonts,
      rows: FONT_ROWS.map((row) => row.label),
    },
    {kind: 'plain', label: STRINGS.labels.headingNumbering},
    {kind: 'plain', label: STRINGS.labels.highlightColour},
    {
      kind: 'feature',
      name: STRINGS.labels.pageNumbersInLinks,
      desc: STRINGS.featureDescs.pageNumbersInLinks,
      toggle: 'linkPageNumbers',
      rows: [STRINGS.labels.linkPageLevel, STRINGS.labels.linkPageWord],
    },
    {
      kind: 'feature',
      name: STRINGS.labels.footnotesForExternalLinks,
      desc: STRINGS.featureDescs.footnotesForExternalLinks,
      toggle: 'externalLinkFootnotes',
      rows: [],
    },
    {kind: 'plain', label: STRINGS.labels.templateFile},
  ],
};

const BOOK: LayoutSection = {
  name: STRINGS.sections.book,
  items: [
    {
      kind: 'feature',
      name: STRINGS.features.bookParts,
      desc: STRINGS.featureDescs.bookParts,
      rows: [
        STRINGS.labels.firstChapter,
        STRINGS.labels.colophonHeading,
        STRINGS.labels.backNotesHeading,
      ],
    },
    {
      kind: 'feature',
      name: STRINGS.labels.romanFoliosInTheFrontMatter,
      desc: STRINGS.featureDescs.romanFoliosInTheFrontMatter,
      toggle: 'book.romanFrontMatter',
      rows: [],
    },
    {
      kind: 'feature',
      name: STRINGS.features.signatures,
      desc: STRINGS.featureDescs.signatures,
      rows: [STRINGS.labels.pagesPerSignature],
    },
    {
      kind: 'feature',
      name: STRINGS.features.contents,
      desc: STRINGS.featureDescs.contents,
      rows: [
        STRINGS.labels.contentsDepth,
        STRINGS.labels.contentsTitle,
        STRINGS.labels.contentsPageNumbers,
        STRINGS.labels.contentsDotLeaders,
      ],
    },
    {
      kind: 'feature',
      name: STRINGS.features.imageFit,
      desc: STRINGS.featureDescs.imageFit,
      rows: [STRINGS.labels.smallestImageSize],
    },
    {
      kind: 'feature',
      name: STRINGS.features.printResolution,
      desc: STRINGS.featureDescs.printResolution,
      rows: [STRINGS.labels.minimumPrintResolution],
    },
  ],
};

/** US-029 | AC-1, AC-2, AC-4: the five sections of the settings tab. */
export const TAB_LAYOUT: readonly LayoutSection[] = [
  {name: STRINGS.sections.presets, items: [{kind: 'presets'}]},
  PAGE,
  TEXT,
  BOOK,
  {
    name: STRINGS.sections.export,
    items: [
      {
        kind: 'feature',
        name: STRINGS.features.strictMode,
        desc: STRINGS.featureDescs.strictMode,
        toggle: 'strictMode',
        rows: [],
      },
      {kind: 'plain', label: STRINGS.tab.presetsFolder},
      {kind: 'plain', label: STRINGS.tab.warningsFolder},
    ],
  },
];

/** US-029 | AC-8: the panel's sections: Page, Text, Book as on the tab, then Cover. */
export const PANEL_LAYOUT: readonly LayoutSection[] = [
  PAGE,
  TEXT,
  BOOK,
  {name: STRINGS.sections.cover, items: [{kind: 'cover'}]},
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
    : STRINGS.panel.ownedRows(presetName, owned.join(', '));
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
