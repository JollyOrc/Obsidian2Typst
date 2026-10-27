// US-011 AC-2: which block of a note is the cover image. Pure core.
import {extensionOf, SUPPORTED_IMAGE_EXTENSIONS} from '../assets';
import type {BlockNode, ImageNode, WikilinkNode} from '../parse';

/** The image in first position and its index in the root blocks. */
export interface CoverCandidate {
  index: number;
  node: ImageNode | (WikilinkNode & {kind: 'embed'});
}

const isRemote = (path: string): boolean =>
  /^[A-Za-z][A-Za-z0-9+.-]+:/.test(path);

/**
 * An embed of a file with a short extension that is not a note; the extension
 * does not need to be an image type (the conversion reports those, AC-7).
 */
function isFileEmbed(file: string): boolean {
  const extension = extensionOf(file);
  return (
    SUPPORTED_IMAGE_EXTENSIONS.includes(extension) ||
    (/^[a-z0-9]{2,5}$/.test(extension) && extension !== 'md')
  );
}

/**
 * US-011 AC-2: the first block after comment blocks, when it is a paragraph
 * of exactly one image (`![alt](path)` or `![[file|…]]`); otherwise null.
 * Not a cover: text with the image, two images, a link-wrapped image, a web
 * image, a note embed, or any block that is not a paragraph.
 */
export function findCoverImage(
  root: readonly BlockNode[],
): CoverCandidate | null {
  const index = root.findIndex((block) => block.kind !== 'comment');
  const block = index < 0 ? undefined : root[index];
  if (block === undefined || block.kind !== 'paragraph') return null;
  if (block.children.length !== 1) return null;
  const node = block.children[0]!;
  if (node.kind === 'image') {
    return isRemote(node.src) ? null : {index, node};
  }
  if (node.kind === 'embed' && isFileEmbed(node.file)) {
    return {index, node: node as CoverCandidate['node']};
  }
  return null;
}
