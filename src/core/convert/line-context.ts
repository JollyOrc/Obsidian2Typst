// US-022: which line of a note is a heading or holds images, for the editor
// menu items that change the active preset. Pure: no Obsidian, Node, or I/O
// imports; the vault is only read through the file heads passed in.
//
// Transforms used (shared-utility register): indexHeadings with dropImages
// (the visible text), findGlossary (terms and open sections), imageRequest
// (remote and unsupported refused, the path URL-decoded), the asset
// resolver's lookup without its byte check (`checkBytes: false`; its `uses()`
// give the vault path of a found file).
import {createAssetResolver} from '../assets';
import {imageRequest} from '../emit';
import {isImageNode} from '../emit/inline';
import {
  findGlossary,
  headingRuleTable,
  type HeadingRulesSettings,
} from '../markers';
import {indexHeadings, parse, type BlockNode, type InlineNode} from '../parse';

/** US-022 AC-1, AC-3: what the menus may act on at one line of a note. */
export interface LineContext {
  /**
   * A top-level heading the rules look at, with its visible text and its
   * level (US-027 AC-7: the contents items are offered on an H1).
   */
  heading: {text: string; level: number} | null;
  /** The vault paths of the line's images in the file list, in line order. */
  images: string[];
}

/**
 * US-022 | AC-1, AC-3, AC-10: The heading and the images at the 0-based
 * editor line `line` of the note `source` at `notePath`, with the vault's
 * file list `paths` and the active preset's heading `rules` (the built-in
 * mapping applies under them). Synchronous and without file reads: the editor
 * menu calls it while it is built (AC-9).
 *
 * The heading is a top-level, non-empty heading on that line (with its level,
 * US-027 AC-7) that is neither
 * a term (or a heading inside a term) nor inside an open glossary section;
 * `findGlossary` decides both (SCAR-017). A heading in a callout, quote or
 * list item is none. The images are every image and embed node on that line,
 * at any depth, that `imageRequest` asks for and the asset resolver's lookup
 * finds in `paths` (an ambiguous name gives its first file), as vault paths
 * without repeats. Remote, unsupported and missing images give none; a file
 * whose bytes are not its type is listed (the action checks it, AC-9).
 */
export function lineContext(
  source: string,
  line: number,
  notePath: string,
  paths: readonly string[],
  rules: HeadingRulesSettings = {},
): LineContext {
  const {root} = parse(source);
  const at = line + 1;
  const headings = indexHeadings(root, {dropImages: true});
  const plan = findGlossary(root, headings, headingRuleTable(rules));
  let heading: LineContext['heading'] = null;
  for (const block of root) {
    if (block.kind !== 'heading' || block.line !== at) continue;
    const info = headings.byNode.get(block);
    // a term or a heading in a term is inside its section too
    if (info === undefined || plan.inSection.has(block)) continue;
    heading = {text: info.text, level: block.depth};
  }

  const resolver = createAssetResolver({
    notePath,
    files: new Map(paths.map((path) => [path, new Uint8Array(0)])),
    checkBytes: false,
  });
  const images: string[] = [];
  const visit = (node: BlockNode | InlineNode): void => {
    if (isImageNode(node as InlineNode)) {
      const image = node as InlineNode & {kind: 'image' | 'embed'};
      if (image.line !== at) return;
      const asked = imageRequest(image);
      if ('refused' in asked) return;
      const result = resolver.resolve(asked.request);
      if (result.status !== 'found' && result.status !== 'ambiguous') return;
      const use = resolver.uses().find((u) => u.to === result.path);
      if (use !== undefined && !images.includes(use.from)) {
        images.push(use.from);
      }
      return;
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children as (BlockNode | InlineNode)[]) {
        if (typeof child === 'object' && child !== null && 'kind' in child) {
          visit(child);
        }
      }
    }
  };
  root.forEach(visit);
  return {heading, images};
}
