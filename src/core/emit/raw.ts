// US-013: emit code exactly. Code is never passed through escapeMarkup.
//
// Transforms:
//  - inline-plain:         no backtick and no newline -> `code`
//  - inline-function:      otherwise -> #raw("code") with a string literal
//  - block-fence:          fence = longest backtick run + 1 (at least 3);
//                          a tag of letters, digits, `_`, `-` follows the fence
//  - block-lang-function:  any other tag (c++, c#) -> #raw(block: true, lang: "...", "...")
// Callers pass block code without its final line break.
// Evidence: docs/technical/typst-escaping-findings.md (raw section).
import type {Transform} from './escape-markup';
import {typstString} from './typst-string';

export const RAW_TRANSFORMS: readonly Transform[] = [
  {
    id: 'inline-plain',
    description: 'code without backtick or newline in single backticks',
  },
  {id: 'inline-function', description: 'other inline code as #raw("...")'},
  {
    id: 'block-fence',
    description: 'fence one backtick longer than the longest run, at least 3',
  },
  {
    id: 'block-lang-function',
    description:
      'tags with other characters use the #raw(block: true, lang: ...) form',
  },
];

export function rawInline(code: string): string {
  if (code === '' || code.includes('`') || code.includes('\n')) {
    return `#raw(${typstString(code)})`;
  }
  return `\`${code}\``;
}

function longestBacktickRun(code: string): number {
  let longest = 0;
  let run = 0;
  for (const ch of code) {
    run = ch === '`' ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
}

export function rawBlock(code: string, lang: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(lang)) {
    return `#raw(block: true, lang: ${typstString(lang)}, ${typstString(code)})`;
  }
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1));
  return `${fence}${lang}\n${code}\n${fence}`;
}
