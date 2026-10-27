// Test support for US-015: a fake vault lookup that records every read, the
// A5 print settings, and a short way to run `convert`.
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
  type PageGeometry,
} from '../../src/core/layout/page-setup';
import {
  convert,
  type AssetIndex,
  type ConvertInput,
  type ConvertResult,
  type ConvertSettings,
} from '../../src/core/convert';
import {jpeg, png, svg} from './images';

/** A file of the right kind for `name`: png, jpeg or svg bytes. */
export function standIn(name: string): Uint8Array {
  if (/\.jpe?g$/i.test(name)) return jpeg();
  return /\.svg$/i.test(name) ? svg() : png(30, 20);
}

/** The resolved geometry of the built-in preset A5 print (US-009 AC-6). */
export const A5_PRINT: PageGeometry = (() => {
  const result = resolvePageSetup(BUILTIN_PAGE_PRESETS['A5 print']);
  if (!result.ok) throw new Error('A5 print must be valid');
  return result.value;
})();

export const SETTINGS: ConvertSettings = {page: A5_PRINT};

/** A vault lookup over `paths` that records the reads of `readHead`. */
export class FakeIndex implements AssetIndex {
  readonly reads: string[] = [];
  /** The length asked for in each read, in the order of `reads`. */
  readonly lengths: number[] = [];
  /** Bytes to give for a path instead of the stand-in image (US-011). */
  readonly images = new Map<string, Uint8Array>();
  readonly files: readonly string[];
  /** Paths whose read fails. */
  failing = new Set<string>();
  /** Milliseconds a read takes, by path (default 0). */
  delay: (path: string) => number = () => 0;
  constructor(paths: readonly string[]) {
    this.files = paths;
  }
  async readHead(path: string, length = 16): Promise<Uint8Array> {
    this.reads.push(path);
    this.lengths.push(length);
    await new Promise((resolve) => setTimeout(resolve, this.delay(path)));
    if (this.failing.has(path)) throw new Error(`cannot read ${path}`);
    return (this.images.get(path) ?? standIn(path)).subarray(0, length);
  }
}

export const NOTE_PATH = 'Sample/Rules.md';
/** The vault of the composed example of US-015 AC-5. */
export const COMPOSED_FILES = [
  NOTE_PATH,
  'Sample/assets/map.png',
  'Sample/assets/other.png',
  'Other/readme.md',
];

/** Runs `convert` for `source` with the defaults of the composed example. */
export function run(
  source: string,
  overrides: Partial<ConvertInput> = {},
  files: readonly string[] = COMPOSED_FILES,
): Promise<ConvertResult> {
  return convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: SETTINGS,
    assets: new FakeIndex(files),
    ...overrides,
  });
}

/** The composed example note of US-015 AC-5. */
export const COMPOSED_NOTE = [
  '# Rules',
  '',
  'Intro with **bold**, a [link](https://example.org) and a [[Tessera]] reference[^1].',
  '',
  '## Tessera',
  '',
  '- Strike',
  '- Parry',
  '',
  '![Map](assets/map.png)',
  '',
  '| Weapon | Cost |',
  '|:--|--:|',
  '| Sword | 10 |',
  '',
  '[^1]: See the table.',
].join('\n');
