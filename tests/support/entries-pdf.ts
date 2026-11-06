// Test support for the PDF tests of US-030 to US-036 (epic #121): converts a
// note with `entries` settings, compiles it with the bundled compiler, and
// reads the pages and the entry layout's test interface (`metadata`):
//   <o2t-statblock>  each statblock drawn (US-030): band, boxes, rows, cells, parts
//   <o2t-entry>      each entry placed (US-031 AC-14): heading, layout used,
//                    size ("page" | "spread" | "inline"), first page
//   <o2t-entry-end>  each entry's end: heading, last page
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

export interface CompiledEntries {
  pages: PdfPage[];
  bookmarks: PdfBookmark[];
  statblocks: StatblockFact[];
  places: EntryPlace[];
  ends: EntryEnd[];
  diagnostics: string[];
  result: ConvertResult;
}

export interface EntriesOptions {
  /** Settings over the book's (`entries` defaults to US-030's example). */
  over?: Record<string, unknown>;
  /** Image files by vault path (illustrations). */
  images?: Record<string, Uint8Array>;
  book?: BookOptions;
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
  const files: Record<string, Uint8Array> = {...images};
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
  const [diagnostics, blocks, places, ends] = await compiler.runWithWorld(
    {mainFilePath: path},
    async (w) => [
      (await w.compile({diagnostics: 'unix'})).diagnostics ?? [],
      await w.query({selector: '<o2t-statblock>', field: 'value'}),
      await w.query({selector: '<o2t-entry>', field: 'value'}),
      await w.query({selector: '<o2t-entry-end>', field: 'value'}),
    ],
  );
  return {
    pages: readPdfPages(pdf),
    bookmarks: readPdfBookmarks(pdf),
    statblocks: parse<StatblockFact>(blocks),
    places: parse<EntryPlace>(places),
    ends: parse<EntryEnd>(ends),
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
