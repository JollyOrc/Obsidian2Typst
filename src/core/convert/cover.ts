// US-011: the cover in the conversion. Decides which block is taken out of the
// body, resolves the cover image, reports the `COVER_*` warnings and writes the
// cover pages. Pure: no Obsidian, Node, or I/O imports.
import {
  extensionOf,
  readImageSize,
  SUPPORTED_IMAGE_EXTENSIONS,
  type AssetResolver,
  type AssetUse,
} from '../assets';
import {
  cropMessage,
  cropPercent,
  emitCoverPages,
  findCoverImage,
  type CoverSettings,
} from '../cover';
import type {EmitContext} from '../emit';
import type {PageGeometry} from '../layout/page-setup';
import type {BlockNode} from '../parse';

/** The image that is asked for as the cover. */
export interface CoverTarget {
  /** As written: decoded for `![](…)`, the file name for `![[…]]`, the vault path for a cover file. */
  path: string;
  source: 'image' | 'embed';
  /** `true` for a cover file: an exact vault path, not a search by name. */
  exact: boolean;
  /** Line of the image for an auto cover; 0 for a cover file. */
  line: number;
}

export interface CoverPlan {
  /** The blocks of the body: without the image in first position. */
  root: BlockNode[];
  target: CoverTarget | null;
}

const nfc = (text: string): string => text.normalize('NFC');
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** URL-decodes like the image emitter; an invalid sequence stays as written. */
function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * US-011 AC-2, AC-3: takes the image in first position out of the body (modes
 * `auto` and `file`) and says which image is the cover. No settings or mode
 * `none`: nothing is removed and there is no cover.
 */
export function planCover(
  root: BlockNode[],
  cover: CoverSettings | undefined,
): CoverPlan {
  if (cover === undefined || cover.mode === 'none') {
    return {root, target: null};
  }
  const found = findCoverImage(root);
  const body =
    found === null ? root : root.filter((_, index) => index !== found.index);
  if (cover.mode === 'file') {
    const file = cover.file;
    const target: CoverTarget | null =
      file === null || file === ''
        ? null
        : {path: file, source: 'image', exact: true, line: 0};
    return {root: body, target};
  }
  if (found === null) return {root: body, target: null};
  const node = found.node;
  return {
    root: body,
    target: {
      path: node.kind === 'image' ? decode(node.src) : node.file,
      source: node.kind,
      exact: false,
      line: node.line,
    },
  };
}

/** The file names (NFC) of the cover that are read with more than 16 bytes. */
export function coverNames(target: CoverTarget | null): Set<string> {
  const names = new Set<string>();
  if (
    target !== null &&
    SUPPORTED_IMAGE_EXTENSIONS.includes(extensionOf(target.path))
  ) {
    names.add(nfc(nameOf(target.path)));
  }
  return names;
}

/**
 * US-011 AC-4 to AC-7, AC-9, AC-10: resolves the cover before any image of the
 * body, so that the cover gets its name first (US-003 AC-4b), reports the
 * problems and returns the cover pages, or null when there is no cover.
 * Never reports an `ASSET_*` problem for the cover, except `ASSET_AMBIGUOUS`.
 */
export function resolveCover(options: {
  target: CoverTarget | null;
  cover: CoverSettings | undefined;
  resolver: AssetResolver & {uses(): AssetUse[]};
  heads: ReadonlyMap<string, Uint8Array>;
  page: PageGeometry;
  ctx: EmitContext;
  /** US-019 AC-3: true when folios are on (`numbering: none` on the cover). */
  numberingNone?: boolean;
  /**
   * US-026 AC-3, AC-7: true when front matter (a colophon) follows: with
   * facing pages the cover's back is always written, so the colophon is on
   * the next right page; the counter is not reset (the first chapter does).
   */
  frontMatter?: boolean;
}): string | null {
  const {target, cover, resolver, heads, page, ctx} = options;
  if (cover === undefined) return null;
  if (cover.back) {
    ctx.warn(
      'COVER_BACK_UNSUPPORTED',
      'cover.back is not supported yet and is ignored',
      0,
    );
  }
  if (target === null) return null;
  const extension = extensionOf(target.path);
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
    ctx.warn(
      'COVER_TYPE_UNSUPPORTED',
      extension === ''
        ? `Cover image type is not supported: ${target.path}`
        : `Cover image type .${extension} is not supported: ${target.path}`,
      target.line,
    );
    return null;
  }
  const result = resolver.resolve({
    source: target.source,
    target: target.exact ? `/${target.path}` : target.path,
    line: target.line,
  });
  if (result.status === 'missing') {
    ctx.warn(
      'COVER_MISSING',
      `Cover image not found: ${target.path}`,
      target.line,
    );
    return null;
  }
  if (result.status === 'invalid') {
    ctx.warn(
      'COVER_TYPE_UNSUPPORTED',
      `Cover image is not a valid .${extension} image: ${target.path}`,
      target.line,
    );
    return null;
  }
  if (result.status === 'ambiguous') {
    ctx.warn(
      'ASSET_AMBIGUOUS',
      `"${target.path}" matches ${result.count} files; the first is used`,
      target.line,
    );
  }
  const from = resolver.uses().find((use) => use.to === result.path)?.from;
  const head = from === undefined ? undefined : heads.get(from);
  const size = head === undefined ? null : readImageSize(extension, head);
  if (size !== null) {
    // The cover fills trim + bleed; the slug stays empty (US-009 AC-11).
    const sheet = {
      width: page.pageWidth - 2 * page.slug,
      height: page.pageHeight - 2 * page.slug,
    };
    const percent = cropPercent(size, sheet);
    if (percent > cover.cropWarningPercent) {
      ctx.warn('COVER_CROPPED', cropMessage(percent, size, sheet), target.line);
    }
  }
  const front = options.frontMatter === true;
  return emitCoverPages({
    path: result.path,
    blankPageAfter: cover.blankPageAfter || (front && page.facingPages),
    slug: page.slug,
    numberingNone: options.numberingNone === true,
    resetCounter: !front,
  });
}
