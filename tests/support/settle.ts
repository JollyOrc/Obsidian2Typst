// Test support for US-028 AC-14 to AC-18 (#116): the generated notes that do
// not settle in one compile, and a reader of Typst's own warnings. Measured
// 2026-11-03 (scratch probes `bn/sweep`, `bn/hintloop`): with these notes at
// A5, facing pages, 70 %, 10 images 2 of 3 seeds and 60 images 20 of 20 do
// not settle in one compile; at 100 all settle.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {BOOK_FONTS, filler} from './book';

/** The image kinds of `tests/support/book.ts`, in the order the seed picks. */
const KINDS = ['map', 'wide', 'tall'] as const;

/**
 * US-028 AC-18: a note of `images` images: a chapter (`# Chapter k`) every 10
 * images, before each image 1 to 7 filler paragraphs (word `S<i>`), the image
 * `map`, `wide` or `tall` — both choices from one linear congruential
 * sequence of `seed` (a = 1103515245, c = 12345, m = 2^31), then two `End`
 * paragraphs. The same seed gives the same note.
 */
export function generatedNote(seed: number, images: number): string {
  let state = seed;
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const parts: string[] = [];
  for (let i = 0; i < images; i++) {
    if (i % 10 === 0) parts.push(`# Chapter ${i / 10 + 1}`);
    parts.push(filler(1 + Math.floor(next() * 7), `S${i}`));
    parts.push(`![](assets/${KINDS[Math.floor(next() * 3)]}.png)`);
  }
  parts.push(filler(2, 'End'));
  return parts.join('\n\n');
}

/** What Typst's world says about a compile of `source`. */
export interface WorldFacts {
  /** False when Typst warns `layout did not converge`. */
  settled: boolean;
  /** Every diagnostic in Typst's `unix` form. */
  diagnostics: string[];
  /** The values of the `<o2t-fit-decision>` metadata, in document order. */
  decisions: Record<string, unknown>[];
}

let snippet: TypstSnippet | undefined;
let count = 0;

/**
 * Compiles `source` in a typst.ts world with the book fonts and `files` and
 * returns its warnings and decisions (`runWithWorld` → `world.compile({
 * diagnostics: 'unix'})`, measured 2026-11-03: the one call that returns
 * them). One shared instance; call `disposeWorld` in `afterAll`.
 */
export async function worldFacts(
  source: string,
  files: Readonly<Record<string, Uint8Array>> = {},
): Promise<WorldFacts> {
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
  const typst = snippet;
  for (const [name, data] of Object.entries(files)) {
    await typst.mapShadow(`/${name}`, data);
  }
  const path = `/world-${count++}.typ`;
  await typst.addSource(path, source);
  const compiler = await typst.getCompiler();
  // The typings of `runWithWorld` do not carry the world's own options.
  const world = compiler as unknown as {
    runWithWorld<T>(
      options: {mainFilePath: string},
      cb: (world: {
        compile(o: {diagnostics: 'unix'}): Promise<{diagnostics?: string[]}>;
        query(o: {selector: string; field: string}): Promise<unknown>;
      }) => Promise<T>,
    ): Promise<T>;
  };
  const [diagnostics, raw] = await world.runWithWorld(
    {mainFilePath: path},
    async (w) => [
      (await w.compile({diagnostics: 'unix'})).diagnostics ?? [],
      await w.query({selector: '<o2t-fit-decision>', field: 'value'}),
    ],
  );
  const values: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    settled: !diagnostics.some((d) => d.includes('layout did not converge')),
    diagnostics,
    decisions: Array.isArray(values)
      ? (values as Record<string, unknown>[])
      : [],
  };
}

/** Frees the shared world compiler. */
export const disposeWorld = (): void => {
  snippet = undefined;
};
