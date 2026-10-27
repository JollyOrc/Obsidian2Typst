// US-013: write a value as a Typst string literal (paths, addresses, family
// names, colours). A different transform from escapeMarkup; never mix them.
//
// Transforms: quote (`"` -> `\"`), backslash (`\` -> `\\`), newline (`\n`),
// tab (`\t`), control (other U+0000-U+001F and U+007F -> `\u{hex}`).
// Everything else, including non-ASCII, is kept.
import type {Transform} from './escape-markup';

export const STRING_TRANSFORMS: readonly Transform[] = [
  {id: 'quote', description: 'double quote becomes \\"'},
  {id: 'backslash', description: 'backslash is doubled'},
  {id: 'newline', description: 'newline becomes \\n'},
  {id: 'tab', description: 'tab becomes \\t'},
  {id: 'control', description: 'other control characters become \\u{hex}'},
];

export function typstString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`;
    else out += ch;
  }
  return `${out}"`;
}
