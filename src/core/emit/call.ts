// US-013 AC-13: text that directly follows an embedded call.
//
// `#strike[a]` ends the code expression only at a blank, a `#` or an escape.
// Typst binds a following `.` (field access: `#strike[a].b` fails), `(` (call
// arguments) or `[` (more arguments) to the call, and a `;` is consumed and
// vanishes from the text (probes s20, s21, s22). A `;` between call and text
// stops all four and is itself invisible.
//
// Transforms:
//  - call-separator: `;` when the text after a call starts with `.`, `(`, `[` or `;`
import type {Transform} from './escape-markup';

export const CALL_TRANSFORMS: readonly Transform[] = [
  {
    id: 'call-separator',
    description: '; between a call and a following . ( [ or ;',
  },
];

const BINDING = new Set(['.', '(', '[', ';']);

/**
 * Returns the separator to write between an embedded call and the text
 * `next` that follows it directly: `;` or the empty string. Only the first
 * character of `next` matters.
 */
export function callSeparator(next: string): string {
  const first = next[0];
  return first !== undefined && BINDING.has(first) ? ';' : '';
}
