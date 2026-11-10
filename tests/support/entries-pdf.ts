// Test support for the PDF tests of US-030 to US-036 (epic #121): converts a
// note with `entries` settings, compiles it with the bundled compiler, and
// reads the pages and the entry layout's test interface (`metadata`):
//   <o2t-statblock>  each statblock drawn (US-030): band, boxes, rows, cells, parts
//   <o2t-entry>      each entry placed (US-031 AC-14): heading, layout used,
//                    size ("page" | "spread" | "inline"), first page
//   <o2t-entry-end>  each entry's end: heading, last page
//   <o2t-section>    each section opener (US-033): section, opener page,
//                    the page its intro ends on
//   <o2t-image>      each block image drawn (US-034 AC-2): file, drawn width (mm)
//   <o2t-wrap>       each statblock's wrap (US-030 AC-16a, #139): band, blocks
//                    beside, the split, column and statblock heights, page, top
//   <o2t-details>    each detail row drawn (US-038): the page it starts on and
//                    its badge count
// Source of truth: docs/user-stories/US-030-…, US-031-….
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {
  convert,
  type ConvertResult,
  type ConvertSettings,
} from '../../src/core/convert';
import {
  BOOK_FONTS,
  bookSettings,
  compileSource,
  type BookOptions,
} from './book';
import {FakeIndex, NOTE_PATH} from './convert';
import {ENTRIES, type StatblockFact} from './entries';
import {
  readPdfBookmarks,
  readPdfPages,
  type PdfBookmark,
  type PdfPage,
} from './pdf';

/** The five track icons at the preset's vault paths: simple shapes, #000. */
export const ICONS: Record<string, string> = {
  'Icons/fine.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>',
  'Icons/hurt.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#000"/></svg>',
  'Icons/down.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M5 1L9 9H1z" fill="#000"/></svg>',
  'Icons/fading.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 4h8v2H1z" fill="#000"/></svg>',
  'Icons/gone.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="#000"/></svg>',
};
const ICON_BYTES: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(ICONS).map(([p, s]) => [p, new TextEncoder().encode(s)]),
);

/** Where an entry was placed (US-031 AC-14). */
export interface EntryPlace {
  heading: string;
  /** The layout used. */
  layout: string;
  size: 'page' | 'spread' | 'inline';
  page: number;
  /** The layout the block asked for, when it was replaced (US-031 AC-4). */
  asked?: string;
  /** Why it was replaced: `no illustration`, `image is portrait`, … */
  reason?: string;
  /** US-032 AC-2: the layout was chosen by the automatic choice. */
  auto?: boolean;
  /** US-032 AC-4: the illustration's scale in percent (100 = not shrunk). */
  scale?: number;
  /**
   * US-031 AC-7b (#139): the portrait form used, and what it was chosen
   * from (mm): the columns picture's width at its scale, the stacked
   * picture's width, the columns picture's width at `minScale`, whether the
   * columns text fits at some scale, whether text is left.
   */
  form?: 'columns' | 'stacked';
  colW?: number;
  stackW?: number;
  minW?: number;
  colFits?: boolean;
  text?: boolean;
  /** US-031 AC-7a (#139): the landscape picture grew into the free space. */
  grown?: boolean;
}
export interface EntryEnd {
  heading: string;
  page: number;
  /** US-032 AC-5: body lines on pages after the layout's own (0 = none). */
  overflowLines?: number;
  /** US-032 AC-9: unused share of the right page's text height, percent; spread-text/-landscape/-portrait only. */
  rightEmpty?: number;
  /** US-032 AC-7: the would-be partner that moved to the next spread. */
  partnerMoved?: string;
}

/** US-030 AC-16a (#139): what the wrap around one statblock did. */
export interface WrapFact {
  band: string;
  /** Blocks wholly in the column. */
  beside: number;
  /** The split paragraph: its index in the blocks, the words in the column, its words. */
  split: {block: number; words: number; of: number} | null;
  /** The column's and the statblock's heights, mm. */
  column: number;
  statblock: number;
  /** US-030 AC-16c (#160): the leading added to the column's lines, mm (0 without). */
  fill: number;
  /** The page and the top of the statblock (mm from the page's top). */
  page: number;
  y: number;
}

/** US-038: what one detail row recorded: its first page and badges. */
export interface DetailsFact {
  page: number;
  badges: number;
}

/** A section opener (US-033 AC-1 to AC-4). */
export interface SectionPlace {
  section: string;
  page: number;
  introEnd: number;
}

export interface CompiledEntries {
  pages: PdfPage[];
  bookmarks: PdfBookmark[];
  statblocks: StatblockFact[];
  places: EntryPlace[];
  ends: EntryEnd[];
  sections: SectionPlace[];
  /** US-030 AC-16a (#139): the wraps, in document order. */
  wraps: WrapFact[];
  /** US-038: the detail rows, in document order. */
  details: DetailsFact[];
  images: {file: string; widthMm: number}[];
  /** US-036 AC-3, AC-6 (G4 #135): the sheet pages' `<o2t-sheet>` facts. */
  sheets: {form: string; rows: number; columns: number; boxMm: number}[];
  diagnostics: string[];
  result: ConvertResult;
  /** US-034 AC-7 (G4 #133): the compiled PDF, for the word-gap scan. */
  pdf: Uint8Array;
}

export interface EntriesOptions {
  /** Settings over the book's (`entries` defaults to US-030's example). */
  over?: Record<string, unknown>;
  /** Image files by vault path (illustrations). */
  images?: Record<string, Uint8Array>;
  book?: BookOptions;
  /** Files beside the `.typ` (a `template.typ`, US-023; G4 #133). */
  files?: Record<string, Uint8Array>;
}

let snippet: TypstSnippet | undefined;
let count = 0;
/** Frees the shared compiler (call in `afterAll`). */
export const disposeEntriesCompiler = (): void => {
  snippet = undefined;
};

const parse = <T>(raw: unknown): T[] =>
  (typeof raw === 'string' ? JSON.parse(raw) : raw) as T[];

/** Converts and compiles `source`; reads pages, bookmarks and the facts. */
export async function compileEntries(
  source: string,
  options: EntriesOptions = {},
): Promise<CompiledEntries> {
  const images = {...ICON_BYTES, ...options.images};
  const index = new FakeIndex([NOTE_PATH, ...Object.keys(images)]);
  for (const [path, bytes] of Object.entries(images))
    index.images.set(path, bytes);
  const settings = {
    ...bookSettings(options.book),
    entries: ENTRIES,
    ...options.over,
  } as unknown as ConvertSettings;
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {...images, ...options.files};
  for (const use of result.assets) {
    const bytes = images[use.from];
    if (bytes !== undefined) files[use.to] = bytes;
  }
  const pdf = await compileSource(result.typ, files);
  if (snippet === undefined) {
    snippet = new TypstSnippet();
    snippet.setCompilerInitOptions({
      getModule: () =>
        readFileSync(
          join(
            process.cwd(),
            'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
          ),
        ),
      beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
    });
  }
  for (const [name, data] of Object.entries(files)) {
    await snippet.mapShadow(`/${name}`, data);
  }
  const path = `/entries-${count++}.typ`;
  await snippet.addSource(path, result.typ);
  const compiler = (await snippet.getCompiler()) as unknown as {
    runWithWorld<T>(
      o: {mainFilePath: string},
      cb: (w: {
        compile(o: {diagnostics: 'unix'}): Promise<{diagnostics?: string[]}>;
        query(o: {selector: string; field: string}): Promise<unknown>;
      }) => Promise<T>,
    ): Promise<T>;
  };
  const [
    diagnostics,
    blocks,
    places,
    ends,
    sections,
    drawn,
    sheetFacts,
    wraps,
    rows,
  ] = await compiler.runWithWorld({mainFilePath: path}, async (w) => [
    (await w.compile({diagnostics: 'unix'})).diagnostics ?? [],
    await w.query({selector: '<o2t-statblock>', field: 'value'}),
    await w.query({selector: '<o2t-entry>', field: 'value'}),
    await w.query({selector: '<o2t-entry-end>', field: 'value'}),
    await w.query({selector: '<o2t-section>', field: 'value'}),
    await w.query({selector: '<o2t-image>', field: 'value'}),
    await w.query({selector: '<o2t-sheet>', field: 'value'}),
    await w.query({selector: '<o2t-wrap>', field: 'value'}),
    await w.query({selector: '<o2t-details>', field: 'value'}),
  ]);
  return {
    pdf,
    pages: readPdfPages(pdf),
    bookmarks: readPdfBookmarks(pdf),
    statblocks: parse<StatblockFact>(blocks),
    places: parse<EntryPlace>(places),
    ends: parse<EntryEnd>(ends),
    sections: parse<SectionPlace>(sections),
    wraps: parse<WrapFact>(wraps),
    details: parse<DetailsFact>(rows),
    images: parse<{file: string; widthMm: number}>(drawn),
    sheets: parse<{form: string; rows: number; columns: number; boxMm: number}>(
      sheetFacts,
    ),
    diagnostics: diagnostics as string[],
    result,
  };
}

/** True when `needles` occur in `text` in this order. */
export function inOrder(text: string, needles: readonly string[]): boolean {
  let at = 0;
  for (const n of needles) {
    const i = text.indexOf(n, at);
    if (i < 0) return false;
    at = i + n.length;
  }
  return true;
}
