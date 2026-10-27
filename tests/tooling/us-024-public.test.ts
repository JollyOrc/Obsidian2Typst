// US-024 AC-4, AC-5, AC-10, AC-11 — nothing private is read by the tests or
// included in a publish.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {ignoreMatcher, listFiles, publishedFiles} from '../support/sample';

// Written in parts so that this file does not contain what it looks for.
const VAULT_NAME = ['The', 'Rules'].join(' ');
const REAL_FILE = ['fixtures', 'compiledtext'].join('/');
/**
 * AC-10: the private words, base64-encoded for the same reason: the family
 * name and the employer's short name as words, and the macOS user name only as
 * a home path (it is also the public GitHub handle, the repository's owner;
 * amended 2026-10-27 with the user's licence decision).
 */
const decode = (b: string): string => Buffer.from(b, 'base64').toString('utf8');
const PRIVATE = [
  decode('YnVnZ2VkZWk='),
  `/users/${decode('am9sbHlvcmM=')}`,
  decode('Y2hhcml0ZQ=='),
];

/** AC-10: the index of each private word found in `text`, in any case. */
const privateHits = (text: string): number[] => {
  const lower = text.toLowerCase();
  return PRIVATE.flatMap((word, i) => (lower.includes(word) ? [i] : []));
};

/** AC-11: what `.gitignore` must keep out of a publish. */
const EXCLUDED = [
  `${VAULT_NAME}/`,
  `tests/${REAL_FILE}.md`,
  'spikes/',
  'docs/state/',
  'releases/*.zip',
  'node_modules/',
  'main.js',
  '.DS_Store',
];

const READERS = [
  'readFileSync',
  'readdirSync',
  'statSync',
  'existsSync',
  'walk',
  'snapshot',
  'heads',
];

/**
 * US-024 AC-4: every call of a disk reader in `text`, with its argument text
 * up to the matching parenthesis.
 */
function readerCalls(text: string): {name: string; args: string}[] {
  const out: {name: string; args: string}[] = [];
  const re = new RegExp(`\\b(${READERS.join('|')})\\(`, 'g');
  for (const m of text.matchAll(re)) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    out.push({name: m[1] as string, args: text.slice(start, i - 1)});
  }
  return out;
}

/** US-024 AC-4: an argument that names the private vault or the real file. */
const privateRead = (args: string): boolean =>
  args.includes(VAULT_NAME) || args.includes('compiledtext.md');

const testFiles = (): string[] =>
  publishedFiles().filter((f) => f.startsWith('tests/'));

describe('US-024 AC-11 .gitignore keeps the private files out', () => {
  it('US-024 AC-11: .gitignore lists every excluded path', () => {
    const lines = readFileSync('.gitignore', 'utf8')
      .split('\n')
      .map((l) => l.trim());
    for (const entry of EXCLUDED) expect(lines, entry).toContain(entry);
  });

  it('US-024 AC-11: the matcher reads the pattern forms of this project', () => {
    const ignored = ignoreMatcher(
      [
        'node_modules/',
        'main.js',
        '*.log',
        'spikes/typst-wasm/scratch-vault/',
        'spikes/typst-wasm/results/*.log',
        'vitest.config.ts.timestamp-*',
        `tests/${REAL_FILE}.md`,
      ].join('\n'),
    );
    for (const path of [
      'node_modules/a/b.js',
      'x/node_modules/y.js',
      'main.js',
      'a/b.log',
      'spikes/typst-wasm/scratch-vault/n.md',
      'spikes/typst-wasm/results/r.log',
      'vitest.config.ts.timestamp-1-2.mjs',
      `tests/${REAL_FILE}.md`,
    ]) {
      expect(ignored(path), path).toBe(true);
    }
    for (const path of [
      'src/main.ts',
      'spikes/typst-wasm/lib/x.ts',
      'spikes/typst-wasm/results/r.txt',
      'tests/fixtures/sample/Book.md',
      'vitest.config.ts',
    ]) {
      expect(ignored(path), path).toBe(false);
    }
    expect(() => ignoreMatcher('!keep.md')).toThrow(/unsupported/);
  });
});

describe('US-024 AC-4 no test reads the private vault', () => {
  it('US-024 AC-4: no disk read in tests/ names the vault or the real file', () => {
    const files = testFiles();
    expect(files).toContain('tests/support/convert.ts');
    expect(files).toContain('tests/tooling/us-024-public.test.ts');
    let examined = 0;
    let counted = 0;
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const calls = readerCalls(text);
      examined += calls.length;
      counted += (
        text.match(new RegExp(`\\b(${READERS.join('|')})\\(`, 'g')) ?? []
      ).length;
      for (const {name, args} of calls) {
        if (privateRead(args)) {
          hits.push(`${file}: ${name}(${args.slice(0, 60)})`);
        }
      }
      if (text.includes(REAL_FILE)) hits.push(`${file}: ${REAL_FILE}`);
    }
    // Every reader call was examined, counted independently (SCAR-023).
    expect(examined).toBe(counted);
    expect(examined).toBeGreaterThan(100);
    expect(hits).toEqual([]);
  });

  it('US-024 AC-4: the check finds a planted read (guard)', () => {
    const planted = `const md = readFileSync(\n  'tests/${REAL_FILE}.md',\n  'utf8',\n);\nwalk(join('${VAULT_NAME}', 'assets'));`;
    const calls = readerCalls(planted);
    expect(calls.map((c) => c.name)).toEqual(['readFileSync', 'walk']);
    expect(calls.map((c) => privateRead(c.args))).toEqual([true, true]);
    // Not wider than the criterion (SCAR-023): a temporary output named
    // after a note is not the private file.
    const output = readerCalls(
      "readFileSync(join(vault, 'Reports/compiledtext export warnings.md'))",
    );
    expect(output.map((c) => privateRead(c.args))).toEqual([false]);
  });
});

describe('US-024 AC-5 neutral fake paths', () => {
  it(`US-024 AC-5: no file of tests/, src/ or build/ names the vault`, () => {
    const files = publishedFiles().filter((f) =>
      /^(tests|src|build)\//.test(f),
    );
    expect(files).toContain('src/core/report/index.ts');
    const hits = files.filter((f) =>
      readFileSync(f, 'utf8').includes(VAULT_NAME),
    );
    expect(hits).toEqual([]);
  });
});

describe('US-024 AC-10 no personal data', () => {
  it('US-024 AC-10: no published file contains a private word', () => {
    const files = publishedFiles();
    expect(files).toContain('package.json');
    expect(files).toContain('tests/fixtures/sample/Book.md');
    const hits: string[] = [];
    for (const file of files) {
      for (const i of privateHits(readFileSync(file).toString('latin1'))) {
        hits.push(`${file}: #${i}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('US-024 AC-10: the scan finds each private word in any case, the user name as a home path, and lets the public handle pass (guard)', () => {
    const user = decode('am9sbHlvcmM=');
    expect(privateHits(`path /Users/${user.toUpperCase()}/x`)).toEqual([1]);
    expect(privateHits(`Copyright (c) 2026 ${user}`)).toEqual([]);
    expect(privateHits(PRIVATE[0]!.toUpperCase())).toEqual([0]);
    expect(privateHits(`x ${PRIVATE[2]!} y`)).toEqual([2]);
    expect(listFiles('tests/support').length).toBeGreaterThan(0);
  });
});

/** US-024 AC-11: every `it(` and `it.skipIf(…)(` call: [form, condition, name]. */
const itCalls = (text: string) => [
  ...text.matchAll(/^\s*(it(?:\.skipIf\(([^)]*\)?)\))?)\(\s*'([^']+)'/gm),
];

describe('US-024 AC-11 the state-directory tests in a public copy', () => {
  it('US-024 AC-11: the matcher reads a skipped and a plain test (guard)', () => {
    const planted = [
      "  it.skipIf(!existsSync('docs/state'))('reads the ledger', () => {",
      "  it('reads CLAUDE.md', () => {",
    ].join('\n');
    expect(itCalls(planted).map((m) => [m[1], m[2], m[3]])).toEqual([
      [
        "it.skipIf(!existsSync('docs/state'))",
        "!existsSync('docs/state')",
        'reads the ledger',
      ],
      ['it', undefined, 'reads CLAUDE.md'],
    ]);
  });

  it('US-024 AC-11: the four docs/state tests skip when the folder is absent, with a ticket link; the CLAUDE.md test runs', () => {
    const text = readFileSync('tests/tooling/state-directory.test.ts', 'utf8');
    const tests = itCalls(text);
    expect(tests).toHaveLength(5);
    const skipped = tests.filter((m) => m[1]?.startsWith('it.skipIf'));
    expect(skipped.map((m) => m[2])).toEqual(
      Array(4).fill("!existsSync('docs/state')"),
    );
    const plain = tests.filter((m) => m[1] === 'it');
    expect(plain.map((m) => m[3])).toEqual([
      'is named in CLAUDE.md with the gates G0 to G5 and the bootloader rule',
    ]);
    expect(text).toMatch(
      /TICKET-\d{3}[^\n]*docs\/state|docs\/state[^\n]*TICKET-\d{3}/,
    );
  });
});
