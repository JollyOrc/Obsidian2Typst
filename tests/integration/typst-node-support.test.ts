// TICKET-007: the test support module that runs the bundled compiler in Node.
import {describe, expect, it} from 'vitest';
import {decodeTypstString, diagnose, plainText} from '../support/typst-node';

describe('TICKET-007 typst-node support', () => {
  it('TICKET-007: diagnose returns no diagnostics for valid Typst', async () => {
    expect(await diagnose('= Hello\n')).toEqual([]);
  });

  it('TICKET-007: plainText reads text and shows elements: "a *b* c" gives "a <strong>b</> c"', async () => {
    expect(await plainText('a *b* c')).toBe('a <strong>b</> c');
  });

  it('TICKET-007: plainText shows an unescaped heading as <heading>', async () => {
    expect(await plainText('= x')).toBe('<heading>x</>');
  });

  it('TICKET-007: plainText throws on a compile error in the markup', async () => {
    await expect(plainText('a $5')).rejects.toThrow(/unclosed delimiter/);
  });

  it('TICKET-007: plainText maps smart quotes back to straight quotes', async () => {
    expect(await plainText('say "hi" and it\'s')).toBe('say "hi" and it\'s');
  });

  it('TICKET-007: decodeTypstString decodes \\\\ \\" \\n and \\u{hex}', () => {
    expect(decodeTypstString('a\\\\b\\"c\\nd\\u{a0}')).toBe('a\\b"c\nd ');
  });
}, 60_000);
