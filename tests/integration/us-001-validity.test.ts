// US-001 AC-11 — the generated Typst compiles (integration, bundled compiler).
// Source of truth: docs/user-stories/US-001-convert-markdown-to-typst.md.
// Every note of the sample vault (US-024) goes through the whole pipeline
// (US-015); its images are stand-ins of the same names.
import {describe, expect, it} from 'vitest';
import {FakeIndex, run, standIn} from '../support/convert';
import {SAMPLE_DIR, VAULT, listFiles, readSample} from '../support/sample';
import {diagnose} from '../support/typst-node';

const vault = listFiles(SAMPLE_DIR).map((f) => `${VAULT}/${f}`);

describe('US-001 validity of the generated Typst', () => {
  const notes = listFiles(SAMPLE_DIR).filter(
    (f) => f.endsWith('.md') && !f.includes('/'),
  );

  it('US-001 AC-11: the sample vault has its two notes, Book.md and Other.md', () => {
    expect(notes).toEqual(['Book.md', 'Other.md']);
  });

  for (const file of notes) {
    it(`US-001 AC-11: compiles every note of the sample vault with zero errors: ${file}`, async () => {
      const name = file.replace(/\.md$/, '');
      const result = await run(
        readSample(file),
        {
          noteName: name,
          notePath: `${VAULT}/${file}`,
          assets: new FakeIndex(vault),
        },
        vault,
      );
      const files = Object.fromEntries(
        result.assets.map((a) => [a.to, standIn(a.to)]),
      );
      const errors = (await diagnose(result.typ, files))
        .filter((d) => d.severity === 'error')
        .map((d) => d.message);
      expect(errors).toEqual([]);
    }, 120_000);
  }
});
