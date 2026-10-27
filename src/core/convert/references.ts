// US-015 AC-13: the first pass. Finds the images a note refers to and reads the
// first bytes of the vault files they can mean, nothing else. Pure: no
// Obsidian, Node, or I/O imports; files are only read through `AssetIndex`.
import {
  extensionOf,
  IMAGE_SIZE_READ_BYTES,
  SUPPORTED_IMAGE_EXTENSIONS,
} from '../assets';
import {isImageNode} from '../emit/inline';
import {
  findCallout,
  resolveCalloutStyle,
  type CalloutsSettings,
} from '../markers';
import type {BlockNode, InlineNode} from '../parse';
import type {AssetIndex} from './types';

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

const isRemote = (path: string): boolean =>
  /^[A-Za-z][A-Za-z0-9+.-]+:/.test(path);

const isSupported = (path: string): boolean =>
  SUPPORTED_IMAGE_EXTENSIONS.includes(extensionOf(path));

/**
 * The file names (NFC) that the images of `blocks` can mean: every image and
 * embed of the tree, in marks, links, headings, tables, quotes, items and
 * footnotes. Remote addresses and unsupported types are left out, because the
 * emitter does not ask the resolver for them.
 */
export function referencedImageNames(
  blocks: readonly BlockNode[],
): Set<string> {
  const names = new Set<string>();
  const visit = (node: BlockNode | InlineNode): void => {
    if (isImageNode(node as InlineNode)) {
      const image = node as InlineNode & {kind: 'image' | 'embed'};
      const target =
        image.kind === 'image'
          ? decode(image.src)
          : (image as {file: string}).file;
      if (
        !(image.kind === 'image' && isRemote(target)) &&
        isSupported(target)
      ) {
        names.add(nfc(nameOf(target)));
      }
      return;
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children as (BlockNode | InlineNode)[]) {
        visit(child);
      }
    }
  };
  blocks.forEach(visit);
  return names;
}

/**
 * US-016 | AC-13: The file names (NFC) of the icons of the styles that the
 * callouts of `blocks` use, so that the first pass reads their heads with the
 * images. Walks every block, also inside items, quotes, callouts and footnote
 * definitions. Icons set to `none` are left out. Only names: the icon is
 * looked up by its exact vault path later, as the cover file is.
 */
export function calloutIconNames(
  blocks: readonly BlockNode[],
  settings: CalloutsSettings = {},
): Set<string> {
  const names = new Set<string>();
  const visit = (node: BlockNode): void => {
    if (node.kind === 'blockquote') {
      const callout = findCallout(node);
      if (callout !== null) {
        const {icon} = resolveCalloutStyle(callout.header.type, settings).style;
        if (icon !== null) names.add(nfc(nameOf(icon)));
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children as BlockNode[]) {
        if (typeof child === 'object' && child !== null && 'kind' in child) {
          visit(child);
        }
      }
    }
  };
  blocks.forEach(visit);
  return names;
}

/**
 * Reads, once and together, the first bytes of every file of the index whose
 * name (NFC) is in `names`. A read that fails gives an empty head, so the file
 * is reported as not a valid image (US-015 AC-13). A file whose name is in
 * `wide` is read with `IMAGE_SIZE_READ_BYTES` instead of 16 (US-011 AC-6:
 * the cover's size), still once.
 */
export async function readHeads(
  index: AssetIndex,
  names: ReadonlySet<string>,
  wide: ReadonlySet<string> = new Set(),
): Promise<Map<string, Uint8Array>> {
  const paths = [...new Set(index.files)].filter((path) =>
    names.has(nfc(nameOf(path))),
  );
  const length = (path: string): number | undefined =>
    wide.has(nfc(nameOf(path))) ? IMAGE_SIZE_READ_BYTES : undefined;
  const heads = await Promise.all(
    paths.map(async (path): Promise<[string, Uint8Array]> => {
      try {
        return [path, await index.readHead(path, length(path))];
      } catch {
        return [path, new Uint8Array(0)];
      }
    }),
  );
  return new Map(heads);
}
