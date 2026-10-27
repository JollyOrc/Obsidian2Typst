// US-008 AC-13: the check of a heading numbering pattern. Pure core.

/**
 * The characters that Typst 0.14.2 accepts as counting symbols in a numbering
 * pattern, measured with the bundled compiler over the code points U+0020 to
 * U+27FFF (`tests/integration/us-008-typst-facts.test.ts` compiles every one).
 */
export const COUNTING_SYMBOLS: readonly string[] = [
  '*',
  '1',
  'A',
  'I',
  'a',
  'i',
  'Α',
  'α',
  'א',
  '١',
  '۱',
  '१',
  'ক',
  '১',
  '①',
  '⓵',
  'あ',
  'い',
  'ア',
  'イ',
  'ㄱ',
  '一',
  '壹',
  '가',
];

const SYMBOLS = new Set(COUNTING_SYMBOLS);

/**
 * True when `pattern` is `none` or holds at least one counting symbol. Typst
 * reads everything before the first symbol as a prefix and the text between
 * and after symbols as separators, so the symbol may stand anywhere
 * (`(1.1)`, `Chapter 1:`, `§a`). Without a symbol Typst fails with
 * `invalid numbering pattern`.
 */
export function isValidNumbering(pattern: string): boolean {
  if (pattern === 'none') return true;
  for (const char of pattern) {
    if (SYMBOLS.has(char)) return true;
  }
  return false;
}
