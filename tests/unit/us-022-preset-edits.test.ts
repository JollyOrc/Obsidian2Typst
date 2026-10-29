// US-022 AC-1 to AC-5, AC-7 — changing one key of a preset note: the exact
// note texts before and after (measured with yaml 2.9.1), the smallest change
// for heading rules (the six cases of AC-2, the built-in rule honoured), the
// cover, the question texts, and which line of a note is a heading or holds
// images that the menus act on. The menus and the write are tested in
// tests/plugin/us-022-menus-write.test.ts.
// Source of truth: docs/user-stories/US-022-heading-and-image-menus.md.
import {describe, expect, it} from 'vitest';
import * as assets from '../../src/core/assets';
import * as presets from '../../src/core/presets';
import {png} from '../support/images';

/** US-022: shapes of code that does not exist yet (red until the code). */
type Change =
  | {kind: 'heading-rule'; text: string; rule: 'glossary' | 'none' | null}
  | {kind: 'cover'; file: string | null};
type Edit = (
  text: string,
  change: Change,
) => {ok: true; text: string} | {ok: false; error: string};
interface Plan {
  title: string;
  change: Change;
  question: string;
}
type HeadingAction = (
  fields: unknown,
  headingText: string,
  presetName: string,
) => Plan;
type CoverAction = (
  fields: unknown,
  path: string,
  presetName: string,
  several: boolean,
) => Plan;
interface LineContext {
  heading: {text: string; level: number} | null;
  images: string[];
}
type LineContextFn = (
  source: string,
  line: number,
  notePath: string,
  paths: readonly string[],
  rules?: Record<string, 'glossary' | 'none'>,
) => LineContext;

const fn = <T>(name: string): T =>
  (presets as unknown as Record<string, T>)[name] as T;
const LINE = '../../src/core/convert/line-context';
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;

const note = (yaml: string, body = ''): string => `---\n${yaml}\n---\n${body}`;

describe('US-022 AC-2, AC-4, AC-7 the text of the preset note after one change (measured)', () => {
  it('US-022 AC-2: Use on # Glossar adds the rule; comments and the other keys stay; the body stays byte for byte', () => {
    const editPresetField = fn<Edit>('editPresetField');
    expect(typeof editPresetField).toBe('function');
    const body = '\nThe notes of this preset.\n\n- keep me\n';
    const result = editPresetField(
      note(
        'schemaVersion: 1   # format\ngroup: Print\npage:\n  trimSize: A5 # the book',
        body,
      ),
      {kind: 'heading-rule', text: 'Glossar', rule: 'glossary'},
    );
    expect(result).toEqual({
      ok: true,
      text: note(
        'schemaVersion: 1 # format\ngroup: Print\npage:\n  trimSize: A5 # the book\nheadingRules:\n  Glossar: glossary',
        body,
      ),
    });
  });

  it('US-022 AC-2: Stop on ## Begriffe removes the key and the map that became empty', () => {
    const editPresetField = fn<Edit>('editPresetField');
    expect(
      editPresetField(
        note(
          'schemaVersion: 1\nheadingRules:\n  Begriffe: glossary\npage:\n  bleed: 3',
        ),
        {kind: 'heading-rule', text: 'Begriffe', rule: null},
      ),
    ).toEqual({ok: true, text: note('schemaVersion: 1\npage:\n  bleed: 3')});
  });

  it('US-022 AC-2: a key of the same comparison form is changed in place, not doubled', () => {
    const editPresetField = fn<Edit>('editPresetField');
    expect(
      editPresetField(
        note('schemaVersion: 1\nheadingRules:\n  GLOSSAR: none'),
        {
          kind: 'heading-rule',
          text: 'Glossar',
          rule: 'glossary',
        },
      ),
    ).toEqual({
      ok: true,
      text: note('schemaVersion: 1\nheadingRules:\n  GLOSSAR: glossary'),
    });
  });

  it('US-022 AC-4: Use as cover sets mode file and the file; the comment on the mode line stays', () => {
    const editPresetField = fn<Edit>('editPresetField');
    expect(
      editPresetField(
        note(
          'schemaVersion: 1\ncover:\n  mode: auto   # first image\n  blankPageAfter: true',
        ),
        {kind: 'cover', file: 'Sample/assets/cover.png'},
      ),
    ).toEqual({
      ok: true,
      text: note(
        'schemaVersion: 1\ncover:\n  mode: file # first image\n  blankPageAfter: true\n  file: Sample/assets/cover.png',
      ),
    });
  });

  it('US-022 AC-4: Stop using as cover sets mode auto and removes the file (with its comment)', () => {
    const editPresetField = fn<Edit>('editPresetField');
    expect(
      editPresetField(
        note(
          'schemaVersion: 1\ncover:\n  mode: file\n  file: "a/b.png" # here\n  blankPageAfter: true',
        ),
        {kind: 'cover', file: null},
      ),
    ).toEqual({
      ok: true,
      text: note(
        'schemaVersion: 1\ncover:\n  mode: auto\n  blankPageAfter: true',
      ),
    });
  });

  it('US-022 AC-7: a note with \\r\\n line ends and a byte-order mark keeps both; the body byte for byte', () => {
    const editPresetField = fn<Edit>('editPresetField');
    const text =
      '\uFEFF---\r\nschemaVersion: 1\r\ngroup: Print\r\n---\r\nBody line\r\n';
    expect(editPresetField(text, {kind: 'cover', file: 'a/c.png'})).toEqual({
      ok: true,
      text: '\uFEFF---\r\nschemaVersion: 1\r\ngroup: Print\r\ncover:\r\n  mode: file\r\n  file: a/c.png\r\n---\r\nBody line\r\n',
    });
  });

  it('US-022 AC-7: a note that is not YAML, or has no frontmatter, is not changed and gives a message', () => {
    const editPresetField = fn<Edit>('editPresetField');
    const change: Change = {kind: 'cover', file: 'a.png'};
    expect(
      editPresetField(
        '---\nschemaVersion: 1\npage:\n\tbleed: 2\n---\n',
        change,
      ),
    ).toMatchObject({ok: false});
    expect(editPresetField('Only a body.\n', change)).toEqual({
      ok: false,
      error: 'The preset note has no frontmatter',
    });
  });
});

describe('US-022 AC-2, AC-5 the smallest change for a heading and the question', () => {
  const cases: [string, string, unknown, string, Change, string][] = [
    [
      'glossary, nothing in the preset, no built-in rule',
      'Glossar',
      {},
      'Use as glossary section',
      {kind: 'heading-rule', text: 'Glossar', rule: 'glossary'},
      'Add "Glossar" → glossary to the heading rules of preset "Folios"?',
    ],
    [
      'glossary, the preset says none, the built-in rule applies',
      'Glossary',
      {headingRules: {Glossary: 'none'}},
      'Use as glossary section',
      {kind: 'heading-rule', text: 'Glossary', rule: null},
      'Remove "Glossary" from the heading rules of preset "Folios"?',
    ],
    [
      'glossary, the preset says none, no built-in rule',
      'Glossar',
      {headingRules: {Glossar: 'none'}},
      'Use as glossary section',
      {kind: 'heading-rule', text: 'Glossar', rule: 'glossary'},
      'Set "Glossar" → glossary in the heading rules of preset "Folios"?',
    ],
    [
      'stop, the preset says glossary, no built-in rule',
      'Begriffe',
      {headingRules: {Begriffe: 'glossary'}},
      'Stop using as glossary section',
      {kind: 'heading-rule', text: 'Begriffe', rule: null},
      'Remove "Begriffe" from the heading rules of preset "Folios"?',
    ],
    [
      'stop, nothing in the preset, the built-in rule applies',
      'Glossary',
      {},
      'Stop using as glossary section',
      {kind: 'heading-rule', text: 'Glossary', rule: 'none'},
      'Set "Glossary" → none in the heading rules of preset "Folios"?',
    ],
    [
      'stop, the preset says glossary, the built-in rule applies',
      'glossary',
      {headingRules: {Glossary: 'glossary'}},
      'Stop using as glossary section',
      {kind: 'heading-rule', text: 'glossary', rule: 'none'},
      'Set "glossary" → none in the heading rules of preset "Folios"?',
    ],
  ];
  for (const [name, text, fields, title, change, question] of cases) {
    it(`US-022 AC-2: ${name}`, () => {
      const headingRuleAction = fn<HeadingAction>('headingRuleAction');
      expect(typeof headingRuleAction).toBe('function');
      expect(headingRuleAction(fields, text, 'Folios')).toEqual({
        title,
        change,
        question,
      });
    });
  }
});

describe('US-022 AC-3, AC-4, AC-5 the cover item and its question', () => {
  it('US-022 AC-4: an image that is not the cover: Use as cover, mode file and the path', () => {
    const coverAction = fn<CoverAction>('coverAction');
    expect(typeof coverAction).toBe('function');
    expect(coverAction({}, 'Sample/assets/cover.png', 'Folios', false)).toEqual(
      {
        title: 'Use as cover',
        change: {kind: 'cover', file: 'Sample/assets/cover.png'},
        question:
          'Make "Sample/assets/cover.png" the cover of preset "Folios"?',
      },
    );
  });

  it('US-022 AC-3: the cover already (mode file and the same path): Stop using as cover, back to auto', () => {
    const coverAction = fn<CoverAction>('coverAction');
    expect(
      coverAction(
        {cover: {mode: 'file', file: 'a/front.png'}},
        'a/front.png',
        'Folios',
        false,
      ),
    ).toEqual({
      title: 'Stop using as cover',
      change: {kind: 'cover', file: null},
      question:
        'Set the cover of preset "Folios" back to auto (the first image of the note)?',
    });
  });

  it('US-022 AC-3: the same path with mode auto is not the cover yet (Use)', () => {
    const coverAction = fn<CoverAction>('coverAction');
    expect(
      coverAction(
        {cover: {mode: 'auto', file: 'a/front.png'}},
        'a/front.png',
        'Folios',
        false,
      ).title,
    ).toBe('Use as cover');
  });

  it('US-022 AC-3 (decision 1): several images on the line: titles with the file name', () => {
    const coverAction = fn<CoverAction>('coverAction');
    expect(coverAction({}, 'a/front.png', 'Folios', true).title).toBe(
      'Use "front.png" as cover',
    );
    expect(
      coverAction(
        {cover: {mode: 'file', file: 'a/back.png'}},
        'a/back.png',
        'Folios',
        true,
      ).title,
    ).toBe('Stop using "back.png" as cover');
  });
});

describe('US-022 AC-1, AC-3 which line is a heading or holds images', () => {
  // US-022 AC-3, AC-9 (amended 2026-10-22): the menu has the vault's file
  // list only (`vault.getFiles()`); no bytes are read when it opens.
  const FILES: readonly string[] = [
    'Sample/Rules.md',
    'Sample/assets/cover.png',
    'Sample/assets/the map.png',
    'Sample/assets/back.png',
    'Sample/a.pdf',
    'Sample/broken.png',
  ];
  const SOURCE = [
    '# Glossar', // 0
    '', // 1
    'A paragraph.', // 2
    '', // 3
    '> [!note] N', // 4
    '> ## Boxed', // 5
    '', // 6
    '# Glossary', // 7
    '', // 8
    '## Gambit', // 9
    '', // 10
    'Text ![[cover.png]] and ![Map](<assets/the map.png>).', // 11
    '', // 12
    '![](https://example.org/a.png) ![[a.pdf]] ![[missing.png]] ![[broken.png]]', // 13
    '', // 14
    '## Begriffe *A–Z*', // 15
    '', // 16
    '# Rules', // 17
    '', // 18
    '## Begriffe *A–Z*', // 19
    '', // 20
    '![](assets/back.png)', // 21
  ].join('\n');

  const at = async (
    line: number,
    rules?: Record<string, 'glossary' | 'none'>,
  ): Promise<LineContext> => {
    const {lineContext} = await load<{lineContext: LineContextFn}>(LINE);
    return lineContext(SOURCE, line, 'Sample/Rules.md', FILES, rules);
  };

  it('US-022 AC-1: a top-level heading is one, with its visible text', async () => {
    // US-027 AC-7 (TICKET-086): the heading carries its level too.
    expect((await at(0)).heading).toEqual({text: 'Glossar', level: 1});
    expect((await at(17)).heading).toEqual({text: 'Rules', level: 1});
    expect((await at(19)).heading).toEqual({text: 'Begriffe A–Z', level: 2});
  });

  it('US-022 AC-1: a paragraph, a heading in a callout and a term inside an open glossary section are not (decision 3)', async () => {
    expect((await at(2)).heading).toBeNull();
    expect((await at(5)).heading).toBeNull();
    expect((await at(9)).heading).toBeNull();
    // `## Begriffe` on line 15 is still inside the `# Glossary` section
    expect((await at(15)).heading).toBeNull();
  });

  it('US-022 AC-1: a deeper heading inside an open section before its first term is not one either (decision 3)', async () => {
    const {lineContext} = await load<{lineContext: LineContextFn}>(LINE);
    const source = '# Glossary\n\n### Notes\n\n## Term\n\nText.\n\n# After';
    const at = (line: number) =>
      lineContext(source, line, 'Sample/Rules.md', FILES).heading;
    expect(at(0)).toEqual({text: 'Glossary', level: 1});
    expect(at(2)).toBeNull();
    expect(at(4)).toBeNull();
    expect(at(8)).toEqual({text: 'After', level: 1});
  });

  it("US-022 AC-1: the sections follow the active preset's heading rules, under them the built-in mapping (SCAR-019)", async () => {
    // `Glossary: none` switches the built-in section off: its headings count
    expect((await at(9, {Glossary: 'none'})).heading).toEqual({
      text: 'Gambit',
      level: 2,
    });
    expect((await at(15, {Glossary: 'none'})).heading).toEqual({
      text: 'Begriffe A–Z',
      level: 2,
    });
    // a preset section: its opener counts, its term does not
    expect((await at(17, {Rules: 'glossary'})).heading).toEqual({
      text: 'Rules',
      level: 1,
    });
    expect((await at(19, {Rules: 'glossary'})).heading).toBeNull();
    // the built-in rule still applies next to a preset key
    expect((await at(9, {Rules: 'glossary'})).heading).toBeNull();
  });

  it('US-022 AC-3: the images of a line as vault paths, in the order of the line', async () => {
    expect((await at(11)).images).toEqual([
      'Sample/assets/cover.png',
      'Sample/assets/the map.png',
    ]);
    expect((await at(21)).images).toEqual(['Sample/assets/back.png']);
  });

  it('US-022 AC-3: a remote image, an unsupported type and an image that is not found give none; a file whose bytes are not its type is listed (checked after the click, AC-9)', async () => {
    expect((await at(13)).images).toEqual(['Sample/broken.png']);
    expect((await at(2)).images).toEqual([]);
  });

  it("US-022 AC-3, AC-10: the lookup is the asset resolver's without its byte check; with the check on (the default) a wrong file stays invalid", () => {
    const create = assets.createAssetResolver as unknown as (options: {
      notePath: string;
      files: ReadonlyMap<string, Uint8Array>;
      checkBytes?: boolean;
    }) => assets.AssetResolver & {uses(): assets.AssetUse[]};
    const files = new Map([
      ['Sample/broken.png', new TextEncoder().encode('not a png')],
      ['Sample/assets/cover.png', png(30, 20)],
    ]);
    const ask = (checkBytes?: boolean) => {
      const resolver = create({
        notePath: 'Sample/Rules.md',
        files,
        ...(checkBytes === undefined ? {} : {checkBytes}),
      });
      return [
        resolver.resolve({source: 'embed', target: 'broken.png', line: 1}),
        resolver.resolve({source: 'image', target: 'broken.png', line: 1}),
        resolver.resolve({source: 'embed', target: 'cover.png', line: 1}),
        resolver.resolve({source: 'embed', target: 'gone.png', line: 1}),
      ].map((result) => result.status);
    };
    expect(ask(false)).toEqual(['found', 'found', 'found', 'missing']);
    expect(ask()).toEqual(['invalid', 'invalid', 'found', 'missing']);
    expect(ask(true)).toEqual(['invalid', 'invalid', 'found', 'missing']);
  });
});
