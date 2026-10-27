// US-005 AC-4b footnote numbering per chapter against the real compiler
// (integration, offline). The printed number of every footnote is read from the
// compiled document (query and counter), the value the PDF shows, as in
// us-002-numbering-pdf.test.ts.
import {describe, expect, it} from 'vitest';
import {FOOTNOTE_RESTART_RULE} from '../../src/core/emit';
import {blocks} from '../support/blocks';
import {decodeTypstString, diagnose} from '../support/typst-node';

/** The printed numbers of all footnotes of `md`, joined by `|`. */
async function numbers(md: string, rule = FOOTNOTE_RESTART_RULE) {
  const {typ} = blocks(md);
  const source = `${rule}\n${typ}\n#context { let ns = query(footnote); assert.eq(ns.map(f => numbering("1", ..counter(footnote).at(f.location()))).join("|"), "@@") }\n`;
  const first = (await diagnose(source)).find((d) => d.severity === 'error');
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first?.message ?? '',
    );
  if (match === null) {
    throw new Error(`compile problem: ${first?.message ?? 'no error'}`);
  }
  return decodeTypstString(match[1] as string);
}

const WORKED =
  '# One\n\na[^1] b[^2] c^[three]\n\n# Two\n\nd^[x] e^[y]\n\n# Three\n\nf^[z]\n\n[^1]: n1\n\n[^2]: n2';

describe('US-005 AC-4b footnote numbers in the compiled document', () => {
  it('US-005 AC-4b: prints 1,2,3 in chapter 1, 1,2 in chapter 2, 1 in chapter 3 (including external-link footnotes)', async () => {
    expect(await numbers(WORKED)).toBe('1|2|3|1|2|1');
    // External-link footnotes (US-004) share the numbering of their chapter.
    const links =
      '# One\n\n[A](https://a.org) x^[n]\n\n# Two\n\n[B](https://b.org)\n\ny^[m] [C](https://c.org)';
    expect(await numbers(links)).toBe('1|2|1|2|3');
  });

  it('US-005 AC-4b: numbers footnotes before the first level-1 heading from 1', async () => {
    expect(await numbers('a^[x] b^[y]\n\n# One\n\nc^[z]')).toBe('1|2|1');
  });

  it('US-005 AC-4b: does not restart at a level-2 or deeper heading', async () => {
    expect(
      await numbers('# A\n\na^[x]\n\n## B\n\nb^[y]\n\n### C\n\nc^[z]'),
    ).toBe('1|2|3');
  });

  it('US-005 AC-4b: restarts at every level-1 heading, also when chapters have no footnote', async () => {
    expect(await numbers('# A\n\na^[x]\n\n# B\n\n# C\n\nb^[y] c^[z]')).toBe(
      '1|1|2',
    );
  });

  it('US-005 AC-4b: counts footnotes of headings, list items, quotes and table cells like any other', async () => {
    const md =
      '# A[^1]\n\n- a^[x]\n\n> q^[y]\n\n| h |\n|---|\n| c^[z] |\n\n[^1]: n';
    expect(await numbers(md)).toBe('1|2|3|4');
  });

  it('US-005 AC-4b: without the rule the numbers continue (guard: the rule is what restarts them)', async () => {
    expect(await numbers(WORKED, '')).toBe('1|2|3|4|5|6');
  });

  it('US-005 AC-4b: works together with the heading numbering rule and the heading labels', async () => {
    const {headingNumberingRule} = await import('../../src/core/emit');
    const rule = `${headingNumberingRule('1.1')}\n${FOOTNOTE_RESTART_RULE}`;
    expect(await numbers(WORKED, rule)).toBe('1|2|3|1|2|1');
    expect(
      (
        await diagnose(`${rule}\n${blocks('# A\n\nx^[y]\n\n[A](#a)').typ}\n`)
      ).filter((d) => d.severity === 'error'),
    ).toEqual([]);
  });
});
