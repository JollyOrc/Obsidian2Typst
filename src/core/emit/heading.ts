// US-002 AC-1b: the numbering rule of the preamble. Pure: no Obsidian, Node, or
// I/O imports.
import {typstString} from './typst-string';

/**
 * The preamble line that sets how headings are numbered. `pattern` is a Typst
 * numbering pattern (default `1.1`) or `none`. The pattern is written as a
 * Typst string (quote and backslash escaped); that it contains a counting
 * symbol is checked by the preset (US-008 AC-13), because Typst rejects
 * `"x"` with `invalid numbering pattern`.
 */
export function headingNumberingRule(pattern: string): string {
  const value = pattern === 'none' ? 'none' : typstString(pattern);
  return `#set heading(numbering: ${value})`;
}
