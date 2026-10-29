// Test support for US-025 to US-028 (the Book structure stories): converts a
// note with the given settings, compiles it with the bundled compiler and the
// bundled fonts, and reads the pages, the bookmarks and the links. The new
// settings of the four stories do not exist in `ConvertSettings` yet; the
// tests pass them through `extra` (red until the code reads them).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  convert,
  type ConvertResult,
  type ConvertSettings,
} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {A5_PRINT, FakeIndex, NOTE_PATH, SETTINGS} from './convert';
import {LoopbackWorker} from './fake-worker';
import {png} from './images';
import {
  readPdfBookmarks,
  readPdfLinks,
  readPdfPages,
  type PdfBookmark,
  type PdfLink,
  type PdfPage,
} from './pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const FONT_FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

/** The bundled fonts the compile uses (body, bold, italic, code). */
export const BOOK_FONTS: readonly Uint8Array[] = FONT_FILES;

export const COVER_PATH = 'Sample/assets/cover.png';
export const MAP_PATH = 'Sample/assets/map.png';
export const WIDE_PATH = 'Sample/assets/wide.png';
export const TALL_PATH = 'Sample/assets/tall.png';
/** The images of the book notes: a cover, a 300 × 200, an 800 × 400 px map. */
export const BOOK_IMAGES: Record<string, Uint8Array> = {
  [COVER_PATH]: png(40, 56),
  [MAP_PATH]: png(300, 200),
  [WIDE_PATH]: png(800, 400),
  [TALL_PATH]: png(200, 300),
};

/** US-019: folios and the running header on (level 2). */
export const FURNITURE_ON = {
  folios: true,
  runningHeader: true,
  runningHeaderLevel: 2,
};

let shared: ReturnType<typeof createTypstCompiler> | undefined;
/** The one compiler of a test file; dispose it in `afterAll`. */
export const bookCompiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
export const disposeBookCompiler = (): void => {
  shared?.dispose();
  shared = undefined;
};

/** What a book note is converted with. */
export interface BookOptions {
  /** `none` (default), a cover, or a cover with its blank page. */
  cover?: 'none' | 'cover' | 'blank';
  facingPages?: boolean;
  /** US-019 furniture; default on. `null` = unset. */
  furniture?: typeof FURNITURE_ON | null;
  /** The settings of the four stories, as `convert` should read them. */
  extra?: Record<string, unknown>;
  /** More settings of existing stories (heading rules, numbering, …). */
  over?: Partial<ConvertSettings>;
  /** Files beside the `.typ` (a `template.typ`, US-023). */
  files?: Record<string, Uint8Array>;
}

/** The settings for `options`. */
export function bookSettings(options: BookOptions = {}): ConvertSettings {
  const cover = options.cover ?? 'none';
  return {
    ...SETTINGS,
    page: {...A5_PRINT, facingPages: options.facingPages ?? true},
    fonts: structuredClone(DEFAULT_FONTS),
    cover:
      cover === 'none'
        ? undefined
        : {...DEFAULT_COVER, blankPageAfter: cover === 'blank'},
    pageFurniture:
      options.furniture === null
        ? undefined
        : (options.furniture ?? FURNITURE_ON),
    ...options.over,
    ...options.extra,
  } as ConvertSettings;
}

/** Converts `source` (a cover image line is put first when asked). */
export async function convertBook(
  source: string,
  options: BookOptions = {},
): Promise<ConvertResult> {
  const index = new FakeIndex([NOTE_PATH, ...Object.keys(BOOK_IMAGES)]);
  for (const [path, bytes] of Object.entries(BOOK_IMAGES)) {
    index.images.set(path, bytes);
  }
  const cover = options.cover ?? 'none';
  const body = cover === 'none' ? source : `![](assets/cover.png)\n\n${source}`;
  return convert({
    source: body,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: bookSettings(options),
    assets: index,
  });
}

/** The compiled book: pages, bookmarks, links, the source and the result. */
export interface CompiledBook {
  pages: PdfPage[];
  bookmarks: PdfBookmark[];
  links: PdfLink[];
  typ: string;
  result: ConvertResult;
  pdf: Uint8Array;
}

/** Compiles Typst source; throws with the source on a compile error. */
export async function compileSource(
  source: string,
  files: Record<string, Uint8Array> = {},
): Promise<Uint8Array> {
  const compiled = await bookCompiler().compile({
    file: 'main.typ',
    source,
    files,
    fonts: FONT_FILES,
  });
  if (!compiled.ok) throw new Error(`${compiled.error}\n${source}`);
  return compiled.pdf;
}

/** Converts and compiles `source`. */
export async function compileBook(
  source: string,
  options: BookOptions = {},
): Promise<CompiledBook> {
  const result = await convertBook(source, options);
  const files: Record<string, Uint8Array> = {...options.files};
  for (const use of result.assets) {
    files[use.to] = BOOK_IMAGES[use.from] as Uint8Array;
  }
  const pdf = await compileSource(result.typ, files);
  return {
    pages: readPdfPages(pdf),
    bookmarks: readPdfBookmarks(pdf),
    links: readPdfLinks(pdf),
    typ: result.typ,
    result,
    pdf,
  };
}

/** `n` filler paragraphs, each about two lines on A5. */
export const filler = (n: number, word = 'Filler'): string =>
  Array.from(
    {length: n},
    (_, i) =>
      `${word} ${i} lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
  ).join('\n\n');

/** The 1-based page whose text contains `needle`; 0 when none does. */
export const pageOf = (pages: readonly PdfPage[], needle: string): number =>
  pages.findIndex((p) => p.text.includes(needle)) + 1;

/**
 * True for a page with nothing but its folio: no body text, no running header
 * (`text` does not hold the header; `header` does), no image.
 */
export const isBlank = (page: PdfPage | undefined): boolean =>
  page !== undefined &&
  page.text.trim() === '' &&
  page.header.trim() === '' &&
  !page.hasImage;
