// US-039 AC-11 — the reader compiles the answer: `prelude` + `data` of
// `api.statblockTypst`, at the card's text width (54 mm), with the pinned
// Typst; the statblock's parts are found in the PDF text and in the helper's
// own facts (`<o2t-statblock>`). The module is loaded at run time (it does not
// exist yet). Source of truth: docs/user-stories/US-039-statblock-typst-api.md.
// Red until US-039 is implemented (G2, 2026-11-11). Each compile takes about
// 0.1 s alone; the 60 s limit leaves room for the first WASM start (SCAR-030).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {CompileFormatEnum} from '@myriaddreamin/typst.ts/dist/esm/compiler.mjs';
import {describe, expect, it} from 'vitest';
import {BOOK_FONTS} from '../support/book';
import {ENTRIES} from '../support/entries';
import {ICONS, inOrder} from '../support/entries-pdf';
import {readPdfPages} from '../support/pdf';

const MODULE = '../../src/plugin/entries/typst-api';
interface Answer {
  ok: true;
  prelude: string;
  data: string;
  files: {path: string; bytes: Uint8Array}[];
}
const load = async (): Promise<{
  createStatblockTypstApi(deps: {
    settings(): Promise<{entries?: unknown}>;
    readIconBytes(path: string): Promise<Uint8Array | null>;
    fonts(): Promise<Uint8Array[]>;
  }): {
    statblockTypst(
      data: Record<string, unknown>,
      options?: {heading?: string},
    ): Promise<Answer | {ok: false; message: string}>;
  };
}> => {
  const path: string = MODULE;
  return (await import(/* @vite-ignore */ path)) as never;
};

let snippet: TypstSnippet | undefined;
let count = 0;
interface Fact {
  band: string;
  boxes: number;
  rows: number;
  cells: string[];
  parts: string[];
}
/** Compiles `source` (with `files` beside it) to a PDF; reads the statblock facts. */
async function compile(source: string, files: Record<string, Uint8Array>) {
  if (snippet === undefined) {
    snippet = new TypstSnippet();
    snippet.setCompilerInitOptions({
      getModule: () =>
        readFileSync(
          join(
            process.cwd(),
            'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
          ),
        ),
      beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
    });
  }
  for (const [name, data] of Object.entries(files))
    await snippet.mapShadow(`/${name}`, data);
  const path = `/us039-${count++}.typ`;
  await snippet.addSource(path, source);
  const compiler = (await snippet.getCompiler()) as unknown as {
    compile(o: {
      mainFilePath: string;
      format: unknown;
      diagnostics: string;
    }): Promise<{result?: Uint8Array; diagnostics?: unknown[]}>;
    runWithWorld<T>(
      o: {mainFilePath: string},
      cb: (w: {
        compile(o: {diagnostics: 'unix'}): Promise<{diagnostics?: string[]}>;
        query(o: {selector: string; field: string}): Promise<unknown>;
      }) => Promise<T>,
    ): Promise<T>;
  };
  const out = await compiler.compile({
    mainFilePath: path,
    format: CompileFormatEnum.pdf,
    diagnostics: 'full',
  });
  if (out.result === undefined)
    throw new Error(`no PDF: ${JSON.stringify(out.diagnostics)}`);
  const [diagnostics, facts] = await compiler.runWithWorld(
    {mainFilePath: path},
    async (w) => [
      (await w.compile({diagnostics: 'unix'})).diagnostics ?? [],
      await w.query({selector: '<o2t-statblock>', field: 'value'}),
    ],
  );
  const parsed = (
    typeof facts === 'string' ? JSON.parse(facts) : facts
  ) as Fact[];
  return {
    pdf: out.result,
    pages: readPdfPages(out.result),
    diagnostics: diagnostics as string[],
    facts: parsed,
  };
}

const iconBytes = (path: string): Uint8Array | null => {
  const svg = ICONS[path];
  return svg === undefined ? null : new TextEncoder().encode(svg);
};
/** The reader's step: the answer's prelude and data at 54 mm on a 62 x 88 mm page. */
async function card(data: Record<string, unknown>, icons: boolean) {
  const {createStatblockTypstApi} = await load();
  const api = createStatblockTypstApi({
    settings: async () => ({entries: ENTRIES}),
    readIconBytes: async (p) => (icons ? iconBytes(p) : null),
    fonts: async () => [],
  });
  const a = await api.statblockTypst(data, {heading: 'Fen Hare'});
  if (!a.ok) throw new Error(a.message);
  const files = Object.fromEntries(a.files.map((f) => [f.path, f.bytes]));
  const source = `#set page(width: 62mm, height: 88mm, margin: 4mm)\n${a.prelude}\n#block(width: 54mm, o2t-sb-box(${a.data}))\n`;
  return {answer: a, ...(await compile(source, files))};
}

const FEN_HARE = {
  vigour: 11,
  might: 4,
  wits: 2,
  speed: 5,
  attacks: ['Kick: 2d6', '**Bite**: 1d6'],
  skills: ['Quick Step', 'Keen Nose'],
  tags: ['beast'],
};

describe('US-039 AC-11: the answer compiles at 54 mm', () => {
  it('Fen Hare with its icons: one page, no diagnostic, the parts in the facts and in the text', async () => {
    const out = await card(FEN_HARE, true);
    // numbered by the track position (US-040 AC-1): Gone is the fifth entry
    expect(out.answer.files.map((f) => f.path)).toEqual(
      [1, 2, 3, 5].map((n) => `o2t-icons/${n}.svg`),
    );
    expect(out.diagnostics).toEqual([]);
    expect(out.pages).toHaveLength(1);
    expect(out.facts).toEqual([
      {
        band: 'Fen Hare',
        boxes: 11,
        rows: 1,
        cells: ['Fine', 'Hurt', 'Down', 'Gone'],
        parts: [
          'band',
          'boxes',
          'track',
          'attributes',
          'attacks',
          'skills',
          'tags',
        ],
      },
    ]);
    const text = out.pages[0]!.text;
    expect(
      inOrder(text, [
        'Fen Hare',
        'Might 4',
        'Wits 2',
        'Speed 5',
        'Kick',
        '2d6',
        'Bite',
        '1d6',
        'Skills:',
        'Quick Step',
        'Keen Nose',
        'Beast',
      ]),
      text,
    ).toBe(true);
  }, 60_000);

  it('Fen Hare with every icon missing still compiles, with the same parts', async () => {
    const out = await card(FEN_HARE, false);
    expect(out.answer.files).toHaveLength(0);
    expect(out.diagnostics).toEqual([]);
    expect(out.facts[0]!.parts).toEqual([
      'band',
      'boxes',
      'track',
      'attributes',
      'attacks',
      'skills',
      'tags',
    ]);
    expect(out.facts[0]!.cells).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
  }, 60_000);

  it('a creature with 35 boxes: three rows of boxes, every part present', async () => {
    const big = {
      vigour: 35,
      might: 20,
      wits: 3,
      speed: 12,
      move: 12,
      guard: 3,
      attacks: [
        'Claws: 6d8',
        'Pin: 7d4',
        'Bite (pinned foe): 8d4',
        'Tail: 3d6',
      ],
      skills: ['Quick Step', 'Keen Nose'],
      tags: ['beast', 'magical'],
    };
    const out = await card(big, true);
    expect(out.diagnostics).toEqual([]);
    expect(out.pages).toHaveLength(1);
    expect(out.facts[0]!.boxes).toBe(35);
    expect(out.facts[0]!.rows).toBe(3);
    expect(out.facts[0]!.parts).toEqual([
      'band',
      'boxes',
      'track',
      'attributes',
      'traits',
      'attacks',
      'skills',
      'tags',
    ]);
    const text = out.pages[0]!.text;
    expect(
      inOrder(text, [
        'Might 20',
        'Wits 3',
        'Speed 12',
        'Move 12',
        'Guard 3',
        'Claws',
        '6d8',
        'Tail',
        '3d6',
        'Skills:',
        'Beast',
        'Magical',
      ]),
      text,
    ).toBe(true);
  }, 60_000);

  it('guard: a statblock without the prelude does not compile (the answer needs its definitions)', async () => {
    const {createStatblockTypstApi} = await load();
    const api = createStatblockTypstApi({
      settings: async () => ({entries: ENTRIES}),
      readIconBytes: async () => null,
      fonts: async () => [],
    });
    const a = await api.statblockTypst(FEN_HARE, {heading: 'Fen Hare'});
    if (!a.ok) throw new Error(a.message);
    const source = `#set page(width: 62mm, height: 88mm, margin: 4mm)\n#block(width: 54mm, o2t-sb-box(${a.data}))\n`;
    await expect(compile(source, {})).rejects.toThrow();
  }, 60_000);
});
