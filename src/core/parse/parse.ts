// US-014: Markdown source -> tree with source lines. Never throws; malformed
// constructs become literal text. Pure: no Obsidian, Node, or I/O imports.
import {TreeBuilder} from './build';
import {markdown} from './markdown';
import type {InlineNode, ParseResult} from './types';

// `---` on the first line, the YAML, `---`; an empty block is allowed.
const FRONTMATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

export function parse(source: string): ParseResult {
  const match = FRONTMATTER.exec(source);
  const frontmatter = match ? (match[1] ?? '') : null;
  const body = match ? source.slice(match[0].length) : source;
  const lineOffset = match ? (match[0].match(/\n/g) ?? []).length : 0;
  const env = {};
  const tokens = markdown().parse(body, env);
  return {frontmatter, root: new TreeBuilder(tokens, env, lineOffset).root()};
}

/**
 * US-030 AC-6: one line of text as inline nodes only (bold, italic, links),
 * never as a block: `- x`, `# x` or `1. x` stay text. Every node gets
 * `line` (the line of the source the text came from).
 */
export function parseInline(text: string, line = 1): InlineNode[] {
  const env = {};
  const tokens = markdown().parseInline(text, env);
  return new TreeBuilder(tokens, env, 0).inlineRoot(line);
}
