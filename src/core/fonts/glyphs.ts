// US-010 AC-5: the glyph check of the source text. Each text goes to the role
// that sets it, and per family one warning lists the characters that the
// family cannot show. Pure core.
import type {BlockNode, InlineNode} from '../parse';
import type {Warning} from '../emit';
import type {ResolvedFonts} from './resolve';
import type {FontRole} from './types';

/** The part of the catalog that the check needs. */
export interface GlyphLookup {
  hasGlyph(family: string, codePoint: number): boolean;
}

/** How many characters one warning lists. */
export const GLYPH_LIST_LIMIT = 10;

const IMAGE_FILE = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;
const IMAGE_SIZE = /^\d+(?:x\d+)?$/;

/** Spaces, controls and invisible format characters are not checked. */
function ignored(code: number): boolean {
  return (
    code === 0x20 ||
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2060 ||
    code === 0xfeff ||
    (code >= 0xfe00 && code <= 0xfe0f)
  );
}

type Seen = Map<number, number>;

class Collector {
  readonly roles: Record<FontRole, Seen> = {
    body: new Map(),
    heading: new Map(),
    caption: new Map(),
    code: new Map(),
  };

  add(role: FontRole, text: string, line: number): void {
    const seen = this.roles[role];
    let at = line;
    for (const ch of text) {
      const code = ch.codePointAt(0) as number;
      if (ch === '\n') {
        at += 1;
        continue;
      }
      if (ignored(code)) continue;
      const first = seen.get(code);
      if (first === undefined || at < first) seen.set(code, at);
    }
  }
}

/** The text that an image shows as its caption (as `emitImage` reads it). */
function captionOf(node: InlineNode): string | null {
  if (node.kind === 'image') return (node.alt.split('|')[0] ?? '').trim();
  if (node.kind === 'embed' && IMAGE_FILE.test(node.file)) {
    for (const part of (node.alias ?? '').split('|')) {
      const text = part.trim();
      if (text !== '' && !IMAGE_SIZE.test(text)) return text;
    }
    return '';
  }
  return null;
}

function inline(
  nodes: readonly InlineNode[],
  role: FontRole,
  out: Collector,
): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out.add(role, node.value, node.line);
        break;
      case 'strong':
      case 'emph':
      case 'delete':
      case 'mark':
      case 'link':
      case 'inline-footnote':
        inline(node.children, role, out);
        break;
      case 'code-inline':
        out.add('code', node.value, node.line);
        break;
      case 'image':
      case 'embed': {
        const caption = captionOf(node);
        if (caption !== null) out.add('caption', caption, node.line);
        else if (node.kind === 'embed' && node.alias !== null) {
          out.add(role, node.alias, node.line);
        }
        break;
      }
      case 'wikilink':
        out.add(role, node.alias ?? node.file, node.line);
        break;
      default:
        break;
    }
  }
}

function blocks(nodes: readonly BlockNode[], out: Collector): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'paragraph':
        inline(node.children, 'body', out);
        break;
      case 'heading':
        inline(node.children, 'heading', out);
        break;
      case 'cell':
        inline(node.children, 'body', out);
        break;
      case 'code':
        out.add('code', node.value, node.line + 1);
        break;
      case 'list':
      case 'item':
      case 'blockquote':
      case 'table':
      case 'row':
      case 'footnote-def':
        blocks(node.children as BlockNode[], out);
        break;
      default:
        break;
    }
  }
}

const hex = (code: number): string =>
  code.toString(16).toUpperCase().padStart(4, '0');

/**
 * AC-5: per family one `FONT_GLYPH_MISSING` warning with the characters that
 * the family lacks, up to ten in code point order and `and N more`, and the
 * first source line where one occurs. A family used by two roles gets one
 * warning with the union.
 */
export function checkGlyphs(
  root: readonly BlockNode[],
  fonts: ResolvedFonts,
  catalog: GlyphLookup,
): Warning[] {
  const out = new Collector();
  blocks(root, out);

  const families = new Map<string, Seen>();
  for (const role of ['body', 'heading', 'caption', 'code'] as const) {
    const family = fonts[role].family;
    const union = families.get(family) ?? new Map<number, number>();
    for (const [code, line] of out.roles[role]) {
      if (catalog.hasGlyph(family, code)) continue;
      const first = union.get(code);
      if (first === undefined || line < first) union.set(code, line);
    }
    families.set(family, union);
  }

  const warnings: Warning[] = [];
  for (const [family, missing] of families) {
    if (missing.size === 0) continue;
    const codes = [...missing.keys()].sort((a, b) => a - b);
    const shown = codes
      .slice(0, GLYPH_LIST_LIMIT)
      .map((code) => `${String.fromCodePoint(code)} U+${hex(code)}`)
      .join(', ');
    const more =
      codes.length > GLYPH_LIST_LIMIT
        ? ` and ${codes.length - GLYPH_LIST_LIMIT} more`
        : '';
    const line = Math.min(...missing.values());
    const noun = codes.length === 1 ? 'character' : 'characters';
    warnings.push({
      code: 'FONT_GLYPH_MISSING',
      message: `Font "${family}" lacks ${codes.length} ${noun}: ${shown}${more} (first at line ${line})`,
      line,
    });
  }
  return warnings.sort((a, b) => a.line - b.line);
}
