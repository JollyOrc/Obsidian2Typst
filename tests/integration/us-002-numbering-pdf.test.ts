// US-002 numbering against the real compiler (integration, offline).
// The numbers of the headings are read from the compiled document (query and
// counter), not from the PDF text: the same values the PDF shows.
import {describe, expect, it} from 'vitest';
import {headingNumberingRule} from '../../src/core/emit';
import {parse} from '../../src/core/parse';
import {blocks} from '../support/blocks';
import {readManifest, readSample, withCalloutHarness} from '../support/sample';
import {decodeTypstString, diagnose} from '../support/typst-node';

/**
 * Compiles `rule` + the Typst of `md` and returns what `expression` (Typst code
 * over the list `hs` of all headings) evaluates to. The value comes back
 * through the message of a deliberately failing assertion.
 */
async function ask(
  md: string,
  expression: string,
  rule = headingNumberingRule('1.1'),
): Promise<string> {
  const {typ} = blocks(md);
  const source = `${rule}\n${withCalloutHarness(typ)}\n#context { let hs = query(heading); assert.eq(${expression}, "@@") }\n`;
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

/** The number of every heading, as Typst prints it, joined by `|`. */
const NUMBERS =
  'hs.map(h => numbering(h.numbering, ..counter(heading).at(h.location()))).join("|")';

describe('US-002 AC-1b numbers in the compiled document', () => {
  it('US-002 AC-1b: shows 1 Reader Section, 1.1 Introduction, 1.2 Tessera, 2 Steward Section, 2.1 Intro for the worked example', async () => {
    const md =
      '# Reader Section\n\n## Introduction\n\n## Tessera\n\n# Steward Section\n\n## Intro';
    expect(await ask(md, NUMBERS)).toBe('1|1.1|1.2|2|2.1');
  });

  it('US-002 AC-1b: numbers nothing when headingNumbering is none', async () => {
    expect(
      await ask(
        '# A\n\n## B',
        'hs.map(h => repr(h.numbering == none)).join("|")',
        headingNumberingRule('none'),
      ),
    ).toBe('true|true');
  });

  it('US-002 AC-1b: numbers with the chosen pattern', async () => {
    expect(
      await ask('# A\n\n## B', NUMBERS, headingNumberingRule('(a.1)')),
    ).toBe('(a)|(a.1)');
  });

  it('US-002 AC-1b: the default rule and the none rule compile; a pattern without a counting symbol does not (why US-008 AC-13 checks it)', async () => {
    const ok = async (rule: string) =>
      (await diagnose(`${rule}\n= A`)).filter((d) => d.severity === 'error');
    expect(await ok(headingNumberingRule('1.1'))).toEqual([]);
    expect(await ok(headingNumberingRule('none'))).toEqual([]);
    expect(await ok(headingNumberingRule('x'))).not.toEqual([]);
  });
});

describe('US-002 AC-1b2 deeper levels and skipped levels', () => {
  it('US-002 AC-1b2: numbers levels 1 to 6 as 1, 1.1, 1.1.1 ... and restarts at 2 for the next chapter', async () => {
    const md = '# A\n## B\n### C\n#### D\n##### E\n###### F\n\n# G';
    expect(await ask(md, NUMBERS)).toBe(
      '1|1.1|1.1.1|1.1.1.1|1.1.1.1.1|1.1.1.1.1.1|2',
    );
  });

  it('US-002 AC-1b2: reads a heading === directly after = as 2.0.1', async () => {
    expect(await ask('# F\n\n# G\n\n### H', NUMBERS)).toBe('1|2|2.0.1');
  });

  it('US-002 AC-6: documents how Typst counts when levels are skipped (# then ###)', async () => {
    const result = blocks('# A\n\n### B\n\n##### C');
    expect(result.warnings.map((w) => w.code)).toEqual([
      'HEADING_LEVEL_SKIPPED',
      'HEADING_LEVEL_SKIPPED',
    ]);
    expect(await ask('# A\n\n### B\n\n##### C', NUMBERS)).toBe(
      '1|1.0.1|1.0.1.0.1',
    );
  });
});

describe('US-002 AC-1c the sample note', () => {
  const md = readSample('Book.md');
  const {headings} = readManifest();
  const h1 = headings['1'] ?? [];
  const total = Object.values(headings).reduce((n, l) => n + l.length, 0);
  const top = parse(md).root.filter(
    (b) => b.kind === 'heading' && b.depth === 1,
  );

  it('US-002 AC-1c: numbers the second top-level heading as chapter 2, and every top-level heading in order', async () => {
    expect(top).toHaveLength(h1.length);
    expect(h1.length).toBeGreaterThanOrEqual(8);
    const second = top[1];
    expect(
      second?.kind === 'heading' && second.children[0]?.kind === 'text'
        ? second.children[0].value
        : '',
    ).toBe(h1[1]);
    expect(
      await ask(
        md,
        'hs.filter(h => h.depth == 1).map(h => numbering(h.numbering, ..counter(heading).at(h.location()))).join("|")',
      ),
    ).toBe(h1.map((_, i) => String(i + 1)).join('|'));
  }, 60_000);

  it('US-002 AC-1c: numbers every heading of the sample note', async () => {
    expect(
      await ask(
        md,
        'str(hs.len()) + "/" + str(hs.filter(h => h.numbering != none).len())',
      ),
    ).toBe(`${total}/${total}`);
  }, 60_000);
});
