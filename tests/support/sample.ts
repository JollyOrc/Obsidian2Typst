// Test support for US-024: the generated sample vault, its manifest, the
// census walker and the list of files a publish would include.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {readFileSync, readdirSync} from 'node:fs';
import {join, relative} from 'node:path';
import {CALLOUT_HELPER} from '../../src/core/emit/callout';
import {parse} from '../../src/core/parse';

/** US-024 AC-1: the committed sample vault (D7). */
export const SAMPLE_DIR = 'tests/fixtures/sample';
/** US-024 AC-1: the generator module, loaded at run time (not written yet). */
export const GENERATOR_MODULE = '../fixtures/generate';
/** US-024 AC-5: the neutral vault name of the fake paths (D6). */
export const VAULT = 'Sample';

/** US-024 AC-1: what the generator module exports. */
export interface GeneratorModule {
  /** Writes the whole sample vault below `outDir` (created when missing). */
  generateSample(outDir: string): void | Promise<void>;
}

/** US-024 AC-1: loads the generator; fails with a clear message without it. */
export async function loadGenerator(): Promise<GeneratorModule> {
  // A string variable keeps tsc from resolving a module that the ticket adds.
  const path: string = GENERATOR_MODULE;
  return (await import(/* @vite-ignore */ path)) as GeneratorModule;
}

/** US-024 AC-2: counts by key. */
export type Counts = Record<string, number>;

/** US-024 AC-2: the census of a note, as the census probe of 2026-10-27. */
export interface Census {
  lines: number;
  bytes: number;
  kinds: Counts;
  depths: Counts;
  lists: {bullet: number; ordered: number; maxNest: number};
  tables: number;
  maxCols: number;
  aligns: Counts;
  html: Counts;
  hrefs: Counts;
  images: Counts;
  blockPairs: Counts;
  inlinePairs: Counts;
  textStart: Counts;
  textEnd: Counts;
  nonAscii: Counts;
}

/** US-024 AC-3: the manifest the generator writes while writing the vault. */
export interface SampleManifest {
  seed: number;
  /** Every file of the vault, relative to it, sorted; without the manifest. */
  files: string[];
  /** The census of `Book.md`, counted by the generator (AC-2, AC-3). */
  census: Census;
  images: {
    total: number;
    withCaption: number;
    withoutCaption: number;
    /** The distinct image files `Book.md` uses, relative to the vault. */
    files: string[];
  };
  /** Heading texts of `Book.md` by level `'1'` to `'6'`, in order. */
  headings: Record<string, string[]>;
  glossary: {heading: string; terms: string[]};
  /** Five known sentences, each the first sentence after its heading. */
  sentences: {heading: string; text: string}[];
  /** The AC-2b features, counted by the generator. */
  features: Counts;
  /** US-024 AC-2c: links to headings by the US-004 resolution rule. */
  anchors: {
    byText: number;
    bySlug: number;
    byNumberStripped: number;
    ambiguous: number;
    unresolved: number;
  };
  /** US-024 AC-2c: titles that occur more than once; their extra uses. */
  repeatedTitles: {titles: number; extra: number};
  /** US-024 AC-2c: links US-018 numbers at `linkPageLevel` `'1'`…`'6'`. */
  numberedLinks: Record<string, number>;
  /** US-024 AC-2c: a glossary term and how many links point to it. */
  linkedTerm: {term: string; links: number};
  /** US-024 AC-2c: the comments and the line of the first (1-based). */
  comments: {count: number; firstLine: number};
  /** US-024 AC-2c: table rows with more cells than the header. */
  longRows: number;
}

/** US-024 AC-3: reads the committed manifest. */
export const readManifest = (): SampleManifest =>
  JSON.parse(
    readFileSync(join(SAMPLE_DIR, 'manifest.json'), 'utf8'),
  ) as SampleManifest;

/** US-024 AC-2: reads a note of the committed vault. */
export const readSample = (name: string): string =>
  readFileSync(join(SAMPLE_DIR, name), 'utf8');

/** Every file below `dir`, relative to it, sorted. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, {withFileTypes: true})) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.push(relative(dir, path));
    }
  };
  walk(dir);
  return out.sort();
}

// The parse tree, as plain data (US-014 AC-1b).
interface Node {
  kind: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  align?: (string | null)[];
  name?: string;
  src?: string;
  href?: string;
  markup?: string;
  children?: Node[];
}

const add = (counts: Counts, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/** US-024 AC-2: the class of a character, as the census probe names it. */
export function charClass(c: string): string {
  if (/[A-Za-z]/.test(c)) return 'letter';
  if (/[0-9]/.test(c)) return 'digit';
  if (c === ' ') return 'space';
  return c.charCodeAt(0) > 127 ? 'non-ascii' : c;
}

const BLOCK_SCOPES = new Set([
  'blockquote',
  'item',
  'cell',
  'footnote-def',
  'heading',
]);
const WRAPPERS = new Set([
  'strong',
  'emph',
  'delete',
  'mark',
  'link',
  'inline-footnote',
]);

/**
 * US-024 AC-2: the census of `source`, with the walker of the census probe
 * (2026-10-27): node kinds; heading depths; the nearest block scope
 * (`root`, `blockquote`, `blockquote>blockquote`, `item`, `cell`,
 * `footnote-def`, `heading`) × node kind; the nearest inline wrapper × node
 * kind; the class of the first and last character of every text run; every
 * non-ASCII character. Uses the plugin's parser on purpose: the census is
 * about the structure the converter sees. The counts it is compared with come
 * from the real file's measurement or from the generator, never from it.
 */
export function census(source: string): Census {
  const result: Census = {
    lines: source.split('\n').length,
    bytes: Buffer.byteLength(source),
    kinds: {},
    depths: {},
    lists: {bullet: 0, ordered: 0, maxNest: 0},
    tables: 0,
    maxCols: 0,
    aligns: {},
    html: {},
    hrefs: {},
    images: {},
    blockPairs: {},
    inlinePairs: {},
    textStart: {},
    textEnd: {},
    nonAscii: {},
  };
  const walk = (
    n: Node,
    scope: string,
    wraps: string[],
    nest: number,
  ): void => {
    add(result.kinds, n.kind);
    add(result.blockPairs, `${scope} > ${n.kind}`);
    const wrap = wraps[wraps.length - 1];
    if (wrap !== undefined) add(result.inlinePairs, `${wrap} > ${n.kind}`);
    if (n.kind === 'heading') add(result.depths, `h${n.depth}`);
    if (n.kind === 'text' && n.value) {
      add(result.textStart, charClass(n.value[0] as string));
      add(result.textEnd, charClass(n.value[n.value.length - 1] as string));
    }
    if (n.kind === 'image' && n.src !== undefined) {
      add(result.images, (/\.(\w+)$/.exec(n.src)?.[1] ?? '?').toLowerCase());
      add(result.hrefs, /^https?:/.test(n.src) ? 'image:url' : 'image:local');
    }
    if (n.kind === 'link' && n.href !== undefined) {
      const target = /^https?:/.test(n.href)
        ? 'web'
        : n.href.startsWith('#')
          ? 'anchor'
          : n.href.startsWith('mailto:')
            ? 'mail'
            : 'other';
      add(result.hrefs, `link:${n.markup}:${target}`);
    }
    if (n.kind === 'list') {
      if (n.ordered) result.lists.ordered++;
      else result.lists.bullet++;
      result.lists.maxNest = Math.max(result.lists.maxNest, nest + 1);
    }
    if (n.kind === 'table') {
      result.tables++;
      result.maxCols = Math.max(result.maxCols, n.align?.length ?? 0);
      for (const a of n.align ?? []) add(result.aligns, String(a));
    }
    if (n.kind === 'html-inline') add(result.html, `html-inline:${n.name}`);
    let inner = scope;
    if (BLOCK_SCOPES.has(n.kind)) {
      inner =
        n.kind === 'blockquote' && scope.includes('blockquote')
          ? 'blockquote>blockquote'
          : n.kind;
    }
    const nextWraps = WRAPPERS.has(n.kind) ? [...wraps, n.kind] : wraps;
    for (const c of n.children ?? []) {
      walk(c, inner, nextWraps, n.kind === 'list' ? nest + 1 : nest);
    }
  };
  for (const block of parse(source).root as Node[]) walk(block, 'root', [], 0);
  for (const ch of source) if (ch.charCodeAt(0) > 127) add(result.nonAscii, ch);
  return result;
}

/**
 * US-024 AC-10, AC-11: the patterns of `.gitignore` that decide what a
 * publish includes, as this project writes them: `name/` (a folder anywhere),
 * `path/` (a folder at that path), `*.ext` and `prefix*` (a file name
 * anywhere) and a plain path. Other pattern forms are refused, so a new form
 * in `.gitignore` fails the test instead of being read wrongly (SCAR-023).
 */
export function ignoreMatcher(gitignore: string): (path: string) => boolean {
  const rules = gitignore
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  const tests = rules.map((rule): ((p: string) => boolean) => {
    if (/[!?[\]\\]/.test(rule) || rule.includes('**')) {
      throw new Error(`unsupported .gitignore pattern: ${rule}`);
    }
    const dir = rule.endsWith('/');
    const body = rule.replace(/^\//, '').replace(/\/$/, '');
    const glob = new RegExp(
      `^${body.replace(/[.+^${}()|]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
    );
    const anchored = body.includes('/');
    return (p: string) => {
      const parts = p.split('/');
      if (anchored) {
        return dir
          ? p.startsWith(`${body}/`)
          : glob.test(p) || p.startsWith(`${body}/`);
      }
      const names = dir ? parts.slice(0, -1) : parts;
      return names.some((name) => glob.test(name));
    };
  });
  return (path) => tests.some((t) => t(path));
}

/** US-024 AC-10, AC-11: every file a publish includes, project-relative. */
export function publishedFiles(root = '.'): string[] {
  const ignored = ignoreMatcher(readFileSync(join(root, '.gitignore'), 'utf8'));
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(join(root, at), {withFileTypes: true})) {
      const path = at === '' ? entry.name : `${at}/${entry.name}`;
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) {
        if (!ignored(`${path}/x`)) walk(path);
      } else if (!ignored(path)) {
        out.push(path);
      }
    }
  };
  walk('');
  return out.sort();
}

/**
 * US-024 AC-4: the definitions the pipeline's preamble adds for callouts
 * (US-016), for tests that compile emitted blocks without the preamble: the
 * helper and one plain style for every callout type `typ` uses, in front of
 * `typ`. Returns `typ` unchanged when it has no callout. Transforms: none of
 * `typ` itself; the line numbers of compiler messages shift by the lines
 * added.
 */
export function withCalloutHarness(typ: string): string {
  const types = [
    ...new Set([...typ.matchAll(/#callout\("([^"]+)"/g)].map((m) => m[1])),
  ];
  if (types.length === 0) return typ;
  const style =
    '(fill: rgb("#f5f5f5"), stroke: 0.75pt + rgb("#9e9e9e"), inset: 8pt, title-color: rgb("#9e9e9e"), font: none, size: none, icon: none)';
  return [
    '#let callout-styles = (',
    ...types.map((t) => `  "${t}": ${style},`),
    ')',
    CALLOUT_HELPER,
    typ,
  ].join('\n');
}
