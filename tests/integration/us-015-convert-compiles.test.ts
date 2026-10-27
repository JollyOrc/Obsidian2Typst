// US-015 AC-10 — converted output compiles with the bundled compiler
// (integration, offline). Source of truth:
// docs/user-stories/US-015-conversion-pipeline.md.
import {describe, expect, it} from 'vitest';
import {
  COMPOSED_FILES,
  COMPOSED_NOTE,
  FakeIndex,
  SETTINGS,
  run,
  standIn,
} from '../support/convert';
import {png} from '../support/images';
import {
  SAMPLE_DIR,
  VAULT,
  listFiles,
  readManifest,
  readSample,
} from '../support/sample';
import {decodeTypstString, diagnose, type Files} from '../support/typst-node';

/** Compiles `typ` plus a check over the headings and footnotes. */
async function ask(typ: string, expression: string, files: Files = {}) {
  const source = `${typ}\n#context { let hs = query(heading); let ns = query(footnote); assert.eq(${expression}, "@@") }\n`;
  const first = (await diagnose(source, files)).find(
    (d) => d.severity === 'error',
  );
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first?.message ?? '',
    );
  if (match === null) {
    throw new Error(`compile problem: ${first?.message ?? 'no error'}`);
  }
  return decodeTypstString(match[1] as string);
}

const NUMBERS =
  'hs.map(h => numbering(h.numbering, ..counter(heading).at(h.location()))).join("|")';
const NOTES =
  'ns.map(f => numbering("1", ..counter(footnote).at(f.location()))).join("|")';
const TEMPLATE = new TextEncoder().encode('#let accent = rgb("#336699")\n');
const errorsOf = async (typ: string, files: Files) =>
  (await diagnose(typ, files))
    .filter((d) => d.severity === 'error')
    .map((d) => d.message);

describe('US-015 AC-10 the composed example against the compiler', () => {
  const files: Files = {'assets/map.png': png(40, 20)};

  it('US-015 AC-10: the typ of the composed example compiles with zero errors', async () => {
    const {typ} = await run(COMPOSED_NOTE);
    expect(await errorsOf(typ, files)).toEqual([]);
  });

  it('US-015 AC-10: the compiled text reads back as heading 1 Rules, 1.1 Tessera and footnotes 1 and 2', async () => {
    const {typ} = await run(COMPOSED_NOTE);
    expect(await ask(typ, NUMBERS, files)).toBe('1|1.1');
    expect(await ask(typ, NOTES, files)).toBe('1|2');
    expect(await ask(typ, 'hs.map(h => h.body.text).join("|")', files)).toBe(
      'Rules|Tessera',
    );
    expect(await ask(typ, 'str(query(image).len())', files)).toBe('1');
    expect(await ask(typ, 'str(query(table).len())', files)).toBe('1');
  });

  it('US-015 AC-10: the typ compiles with a template present', async () => {
    const {typ} = await run(COMPOSED_NOTE, {
      settings: {...SETTINGS, template: true},
    });
    expect(typ).toContain('#import "template.typ": *');
    expect(await errorsOf(typ, {...files, 'template.typ': TEMPLATE})).toEqual(
      [],
    );
    expect(await ask(typ, NUMBERS, {...files, 'template.typ': TEMPLATE})).toBe(
      '1|1.1',
    );
  });

  it('US-015 AC-10: with a template the template can use its own names in the note', async () => {
    const {typ} = await run('# T\n\ntext', {
      settings: {...SETTINGS, template: true},
    });
    const withUse = `${typ}\n#text(fill: accent)[uses the template]\n`;
    expect(await errorsOf(withUse, {'template.typ': TEMPLATE})).toEqual([]);
  });

  it('US-015 AC-10: the typ of an empty note compiles', async () => {
    for (const source of ['', '---\nt: 1\n---\n', '<!-- c -->']) {
      const {typ} = await run(source);
      expect(await errorsOf(typ, {})).toEqual([]);
    }
  });

  it('US-015 AC-10: a note without the image compiles without the helper', async () => {
    const {typ} = await run(
      COMPOSED_NOTE.replace('![Map](assets/map.png)\n\n', ''),
    );
    expect(await errorsOf(typ, {})).toEqual([]);
  });

  it('US-015 AC-10: headingNumbering none and a chosen highlight colour compile and read back', async () => {
    const {typ} = await run(COMPOSED_NOTE, {
      settings: {
        ...SETTINGS,
        headingNumbering: 'none',
        highlightColor: '#00ff00',
      },
    });
    expect(await errorsOf(typ, files)).toEqual([]);
    expect(
      await ask(typ, 'hs.map(h => repr(h.numbering == none)).join("|")', files),
    ).toBe('true|true');
  });

  it('US-015 AC-10: the edge inputs compile', async () => {
    for (const source of [
      '**unclosed',
      'x ^[unclosed',
      '[[unclosed',
      '<!-- unclosed',
      '\u0000\u0001 control \u007f',
      'a'.repeat(5000),
    ]) {
      const {typ} = await run(source);
      expect(await errorsOf(typ, {}), JSON.stringify(source)).toEqual([]);
    }
  });
});

describe('US-015 AC-10 the sample note against the compiler', () => {
  const md = readSample('Book.md');
  const names = listFiles(SAMPLE_DIR)
    .filter((f) => f.startsWith('assets/'))
    .map((f) => `${VAULT}/${f}`);

  it('US-015 AC-10: the typ of the sample note (fake AssetIndex, stand-in images) compiles with zero errors', async () => {
    const index = new FakeIndex(names);
    const result = await run(
      md,
      {
        assets: index,
        noteName: 'Book',
        notePath: `${VAULT}/Book.md`,
      },
      names,
    );
    expect(result.assets).toHaveLength(readManifest().images.files.length);
    const standIns = Object.fromEntries(
      result.assets.map((a) => [a.to, standIn(a.to)]),
    );
    expect(await errorsOf(result.typ, standIns)).toEqual([]);
  }, 120_000);

  it('US-015 AC-10: no generated file uses an @preview package', async () => {
    const real = await run(md, {}, names);
    const composed = await run(COMPOSED_NOTE, {
      settings: {...SETTINGS, template: true},
    });
    for (const {typ} of [real, composed]) {
      expect(typ).not.toContain('@preview');
    }
    expect(COMPOSED_FILES.length).toBeGreaterThan(0);
  });
});
