// US-039 AC-1 to AC-10 — `api.statblockTypst` and `api.compileFonts`: the
// statblock as Typst for another plugin (Game Card Creator, whose US-004 AC-3
// holds the contract). The module is loaded at run time (it does not exist
// yet). Expected values: the book's own converter (an independent producer of
// the same text, SCAR-023), the measured cases of the story (2026-11-11) and
// the story's examples. Source of truth:
// docs/user-stories/US-039-statblock-typst-api.md.
// Red until US-039 is implemented (G2, 2026-11-11).
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {describe, expect, it} from 'vitest';
import {
  ENTRIES,
  FEN_HARE_YAML,
  entry,
  runEntries,
  warningsOf,
} from '../support/entries';

const MODULE = '../../src/plugin/entries/typst-api';
const PROCESSOR = '../../src/plugin/entries/processor';
const DETAILS = '../../src/plugin/details/processor';

interface Answer {
  ok: true;
  prelude: string;
  data: string;
  files: {path: string; bytes: Uint8Array}[];
  credit: string | null;
  warnings: {code: string; message: string}[];
}
interface Refusal {
  ok: false;
  reason: 'no-settings' | 'no-statblock';
  message: string;
}
interface Deps {
  settings(): Promise<{entries?: unknown; colorMode?: string} | null>;
  readIconBytes(path: string): Promise<Uint8Array | null>;
  fonts(): Promise<Uint8Array[]>;
}
interface TypstApi {
  statblockTypst(
    data: Record<string, unknown>,
    options?: {heading?: string},
  ): Promise<Answer | Refusal>;
  compileFonts(): Promise<Uint8Array[]>;
  clearIconCache(): void;
}
const load = async (): Promise<{
  createStatblockTypstApi(deps: Deps): TypstApi;
}> => {
  const path: string = MODULE;
  return (await import(/* @vite-ignore */ path)) as never;
};

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const ICON_FILES: Record<string, Uint8Array> = {
  'Icons/fine.svg': bytes(
    '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>',
  ),
  'Icons/hurt.svg': bytes(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="8" height="8"/></svg>',
  ),
  'Icons/down.svg': bytes(
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M5 1L9 9H1z"/></svg>',
  ),
  'Icons/gone.svg': bytes(
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1l8 8"/></svg>',
  ),
};

/** Fake dependencies that count their calls; `current` can change between calls. */
function deps(over: Partial<Deps> = {}) {
  const calls = {settings: 0, icons: [] as string[], fonts: 0};
  const state: {
    current: {entries?: unknown; colorMode?: string} | null;
    icons: Record<string, Uint8Array | null>;
  } = {
    current: {entries: ENTRIES},
    icons: {...ICON_FILES},
  };
  const d: Deps = {
    settings: async () => {
      calls.settings++;
      return state.current;
    },
    readIconBytes: async (p) => {
      calls.icons.push(p);
      return state.icons[p] ?? null;
    },
    fonts: async () => {
      calls.fonts++;
      return [bytes('font-a'), bytes('font-b')];
    },
    ...over,
  };
  return {d, calls, state};
}

const FEN_HARE_DATA = {
  vigour: 11,
  might: 4,
  wits: 2,
  speed: 5,
  attacks: ['Kick: 2d6', '**Bite**: 1d6'],
  skills: ['Quick Step', 'Keen Nose'],
  tags: ['beast'],
};
const ok = (a: Answer | Refusal): Answer => {
  if (!a.ok) throw new Error(`refused: ${a.message}`);
  return a;
};
/** The data of the first statblock call the converter writes (text up to `, blocks:`). */
function converterData(typ: string): string {
  const at = typ.indexOf('#o2t-statblock(');
  if (at < 0) throw new Error('no statblock call in the converter output');
  const from = at + '#o2t-statblock('.length;
  const to = typ.indexOf(', blocks: (', from);
  return typ.slice(from, to < 0 ? typ.lastIndexOf(')') : to);
}
/** The data text the book writes for `yaml` under `entries`, with every icon missing. */
async function bookData(yaml: readonly string[], entries: unknown = ENTRIES) {
  const note = [
    entry('### Fen Hare', yaml),
    '',
    '#### Habits',
    '',
    'They gather at dusk.',
  ].join('\n');
  const result = await runEntries(note, {entries});
  return {data: converterData(result.typ), warnings: result.warnings};
}
/** Same data for the API with every icon missing. */
const noIcons = () => deps({readIconBytes: async () => null});

describe('US-039 AC-1: the answer for the Fen Hare note', () => {
  it('has the shape of the contract', async () => {
    const {createStatblockTypstApi} = await load();
    const a = ok(
      await createStatblockTypstApi(deps().d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(Object.keys(a).sort()).toEqual([
      'credit',
      'data',
      'files',
      'ok',
      'prelude',
      'warnings',
    ]);
    expect(typeof a.prelude).toBe('string');
    expect(a.data.startsWith('(band: "Fen Hare", look: (')).toBe(true);
    expect(Array.isArray(a.files)).toBe(true);
    expect(a.credit).toBeNull();
  });
  it('data is exactly the text the PDF export writes for the same statblock (icons missing in both)', async () => {
    const {createStatblockTypstApi} = await load();
    const book = await bookData(FEN_HARE_YAML);
    const a = ok(
      await createStatblockTypstApi(noIcons().d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(a.data).toBe(book.data);
  });
  it('prelude is the two definition texts of the book, no content of the note', async () => {
    const {createStatblockTypstApi} = await load();
    const {ENTRY_MARKS_DEF, STATBLOCK_HELPER_DEF} =
      await import('../../src/core/emit/entry');
    const a = ok(
      await createStatblockTypstApi(deps().d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(a.prelude).toBe(`${ENTRY_MARKS_DEF}\n${STATBLOCK_HELPER_DEF}`);
    expect(a.prelude).not.toContain('Fen Hare');
    expect(a.prelude).not.toContain('Kick');
  });
  it('the band is options.heading, else data.name, else a dash (as renderStatblock)', async () => {
    const {createStatblockTypstApi} = await load();
    const api = createStatblockTypstApi(deps().d);
    expect(
      ok(await api.statblockTypst(FEN_HARE_DATA, {heading: 'Marsh Hare'})).data,
    ).toContain('band: "Marsh Hare"');
    expect(
      ok(await api.statblockTypst({...FEN_HARE_DATA, Name: 'Reed Hare'})).data,
    ).toContain('band: "Reed Hare"');
    expect(ok(await api.statblockTypst(FEN_HARE_DATA)).data).toContain(
      'band: "—"',
    );
  });
  it('keys are read without case', async () => {
    const {createStatblockTypstApi} = await load();
    const a = ok(
      await createStatblockTypstApi(noIcons().d).statblockTypst(
        {VIGOUR: 11, Might: 4, WITS: 2, speed: 5, Attacks: ['Kick: 2d6']},
        {heading: 'Fen Hare'},
      ),
    );
    expect(a.data).toContain('Might 4');
  });
});

describe('US-039 AC-2: values as the book writes them', () => {
  // [attack item, literal in the data (measured 2026-11-11 with the book's writer)]
  const cases: [string, string][] = [
    ['**Bite**: 1d6', '([*Bite*], [1d6])'],
    ['Quick *Step*: 1d4', '([Quick _Step_], [1d4])'],
    ['[[Fen Hare|hare]] and [x](y.md): 1d4', '([hare and x], [1d4])'],
    ['a#b $c: 1d4', '([a\\#b \\$c], [1d4])'],
    ['= x: 1d4', '([\\= x], [1d4])'],
    ['- x: 1d4', '([\\- x], [1d4])'],
  ];
  it.each(cases)(
    'the attack %j is written as %s, and the book writes the same text',
    async (item, literal) => {
      const {createStatblockTypstApi} = await load();
      const yaml = [
        'vigour: 11',
        'might: 4',
        'wits: 2',
        'speed: 5',
        'attacks:',
        `  - ${JSON.stringify(item)}`,
      ];
      const book = await bookData(yaml);
      const a = ok(
        await createStatblockTypstApi(noIcons().d).statblockTypst(
          {vigour: 11, might: 4, wits: 2, speed: 5, attacks: [item]},
          {heading: 'Fen Hare'},
        ),
      );
      expect(a.data).toContain(literal);
      expect(a.data).toBe(book.data);
    },
  );
  it('a skill with emphasis is written as the book writes it', async () => {
    const {createStatblockTypstApi} = await load();
    const a = ok(
      await createStatblockTypstApi(noIcons().d).statblockTypst(
        {...FEN_HARE_DATA, skills: ['Quick *Step*']},
        {heading: 'Fen Hare'},
      ),
    );
    expect(a.data).toContain('skills: [Quick _Step_]');
  });
  it('<x> in a value is dropped with HTML_UNSUPPORTED, as in the book', async () => {
    const {createStatblockTypstApi} = await load();
    const yaml = [
      'vigour: 11',
      'might: 4',
      'wits: 2',
      'speed: 5',
      'attacks:',
      '  - "Kick <x>: 1d4"',
    ];
    const book = await bookData(yaml);
    const a = ok(
      await createStatblockTypstApi(noIcons().d).statblockTypst(
        {vigour: 11, might: 4, wits: 2, speed: 5, attacks: ['Kick <x>: 1d4']},
        {heading: 'Fen Hare'},
      ),
    );
    expect(a.data).toBe(book.data);
    const mine = a.warnings.filter((w) => w.code === 'HTML_UNSUPPORTED');
    expect(mine).toHaveLength(1);
    expect(mine[0]!.message).toContain('<x>');
    expect(warningsOf(book.warnings, ['HTML_UNSUPPORTED'])).toHaveLength(1);
  });
});

describe('US-039 AC-3: icons', () => {
  it('each track cell with an icon file: one file entry, the path the data names, the bytes unchanged', async () => {
    const {createStatblockTypstApi} = await load();
    const {d} = deps();
    const a = ok(
      await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    // trackDefault of the example: Fine, Hurt, Down, Gone
    expect(a.files.map((f) => f.path)).toEqual([
      'o2t-icons/1.svg',
      'o2t-icons/2.svg',
      'o2t-icons/3.svg',
      'o2t-icons/4.svg',
    ]);
    expect(a.files.map((f) => Array.from(f.bytes))).toEqual(
      [
        'Icons/fine.svg',
        'Icons/hurt.svg',
        'Icons/down.svg',
        'Icons/gone.svg',
      ].map((p) => Array.from(ICON_FILES[p]!)),
    );
    for (const f of a.files) expect(a.data).toContain(`icon: "${f.path}"`);
    expect(
      a.warnings.filter((w) => w.code === 'STATBLOCK_ICON_MISSING'),
    ).toEqual([]);
  });
  it('a missing icon: icon none in its cell and STATBLOCK_ICON_MISSING naming the path', async () => {
    const {createStatblockTypstApi} = await load();
    const {d, state} = deps();
    state.icons['Icons/hurt.svg'] = null;
    const a = ok(
      await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(a.data).toContain('(label: "Hurt", icon: none)');
    expect(a.files).toHaveLength(3);
    const missing = a.warnings.filter(
      (w) => w.code === 'STATBLOCK_ICON_MISSING',
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]!.message).toContain('Icons/hurt.svg');
  });
  it('the same icon file in two cells is one file entry (no two files share a path)', async () => {
    const {createStatblockTypstApi} = await load();
    const entries = {
      ...ENTRIES,
      statblock: {
        ...ENTRIES.statblock,
        track: ENTRIES.statblock.track.map((c) => ({
          ...c,
          icon: 'Icons/fine.svg',
        })),
      },
    };
    const {d, calls, state} = deps();
    state.current = {entries};
    const a = ok(
      await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(a.files).toHaveLength(1);
    expect(a.data.match(/icon: "o2t-icons\/1\.svg"/g)).toHaveLength(4);
    expect(calls.icons).toEqual(['Icons/fine.svg']); // read once
  });
  it('two icons with the same file name in different folders get different paths', async () => {
    const {createStatblockTypstApi} = await load();
    const entries = {
      ...ENTRIES,
      statblock: {
        ...ENTRIES.statblock,
        track: [
          {label: 'Fine', icon: 'A/icon.svg'},
          {label: 'Hurt', icon: 'B/icon.svg'},
          {label: 'Down', icon: 'A/icon.svg'},
          {label: 'Gone', icon: 'C/o2t-icons/1.svg'},
        ],
      },
    };
    const {d, state} = deps();
    state.current = {entries};
    state.icons = {
      'A/icon.svg': bytes('<svg a/>'),
      'B/icon.svg': bytes('<svg b/>'),
      'C/o2t-icons/1.svg': bytes('<svg c/>'),
    };
    const a = ok(
      await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
        heading: 'Fen Hare',
      }),
    );
    expect(new Set(a.files.map((f) => f.path)).size).toBe(3);
    expect(a.files.map((f) => new TextDecoder().decode(f.bytes))).toEqual([
      '<svg a/>',
      '<svg b/>',
      '<svg c/>',
    ]);
  });
  it("a creature with an entry-level track (its own cells) writes only those cells' icons", async () => {
    const {createStatblockTypstApi} = await load();
    const a = ok(
      await createStatblockTypstApi(deps().d).statblockTypst(
        {...FEN_HARE_DATA, states: ['Fine', 'Gone']},
        {heading: 'Fen Hare'},
      ),
    );
    expect(a.files.map((f) => f.path)).toEqual([
      'o2t-icons/1.svg',
      'o2t-icons/2.svg',
    ]);
  });
});

describe('US-039 AC-4: the credit', () => {
  it("the preset's credit text, or null (empty counts as none)", async () => {
    const {createStatblockTypstApi} = await load();
    const text = 'Icons by A. Nobody, CC BY 3.0';
    const {d, state} = deps();
    state.current = {entries: {...ENTRIES, encounterSheetText: {credit: text}}};
    expect(
      ok(
        await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
          heading: 'x',
        }),
      ).credit,
    ).toBe(text);
    state.current = {entries: {...ENTRIES, encounterSheetText: {credit: ''}}};
    expect(
      ok(
        await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
          heading: 'x',
        }),
      ).credit,
    ).toBeNull();
    state.current = {entries: ENTRIES};
    expect(
      ok(
        await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
          heading: 'x',
        }),
      ).credit,
    ).toBeNull();
  });
});

describe('US-039 AC-5: nothing to draw', () => {
  it("no active preset, no entries settings, no stats: reason no-settings with the preview's notice", async () => {
    const {createStatblockTypstApi} = await load();
    const {NO_SETTINGS} = (await import(
      /* @vite-ignore */ PROCESSOR as string
    )) as {NO_SETTINGS: string};
    for (const current of [
      null,
      {},
      {entries: {}},
      {entries: {statblock: {boxes: 'vigour'}}},
    ]) {
      const {d, state} = deps();
      state.current = current;
      const r = await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
        heading: 'x',
      });
      expect(r).toEqual({
        ok: false,
        reason: 'no-settings',
        message: NO_SETTINGS,
      });
    }
  });
  it("no stat and no attack in the data: reason no-statblock with the preview's notice, no Typst", async () => {
    const {createStatblockTypstApi} = await load();
    const {NO_STATS} = (await import(
      /* @vite-ignore */ PROCESSOR as string
    )) as {NO_STATS: string};
    const r = await createStatblockTypstApi(deps().d).statblockTypst(
      {tags: ['beast']},
      {heading: 'x'},
    );
    expect(r).toEqual({ok: false, reason: 'no-statblock', message: NO_STATS});
    expect(r).not.toHaveProperty('prelude');
    expect(r).not.toHaveProperty('data');
  });
});

describe('US-039 AC-6: the data checks, as the book reports them', () => {
  const entries = {
    ...ENTRIES,
    statblock: {
      ...ENTRIES.statblock,
      sum: {total: 'vigour', of: ['might', 'wits', 'speed']},
    },
  };
  it("STAT_SUM_MISMATCH and TAG_UNMAPPED once each, with the book's code and message", async () => {
    const {createStatblockTypstApi} = await load();
    const yaml = [
      'vigour: 12',
      'might: 4',
      'wits: 2',
      'speed: 5',
      'tags:',
      '  - beast',
      '  - odd',
    ];
    const book = await bookData(yaml, entries);
    const {d, state} = deps();
    state.current = {entries};
    const a = ok(
      await createStatblockTypstApi(d).statblockTypst(
        {vigour: 12, might: 4, wits: 2, speed: 5, tags: ['beast', 'odd']},
        {heading: 'Fen Hare'},
      ),
    );
    const codes = ['STAT_SUM_MISMATCH', 'TAG_UNMAPPED'];
    const mine = a.warnings
      .filter((w) => codes.includes(w.code))
      .map((w) => `${w.code} ${w.message}`);
    expect(mine).toHaveLength(2);
    expect(mine).toEqual(warningsOf(book.warnings, codes));
  });
  it('a creature without problems has no warnings', async () => {
    const {createStatblockTypstApi} = await load();
    expect(
      ok(
        await createStatblockTypstApi(deps().d).statblockTypst(FEN_HARE_DATA, {
          heading: 'Fen Hare',
        }),
      ).warnings,
    ).toEqual([]);
  });
});

describe('US-039 AC-7: the fonts', () => {
  it('compileFonts returns the list the dependency gives (bundled first), read at each call', async () => {
    const {createStatblockTypstApi} = await load();
    const {d, calls} = deps();
    const api = createStatblockTypstApi(d);
    const first = await api.compileFonts();
    expect(first.map((f) => new TextDecoder().decode(f))).toEqual([
      'font-a',
      'font-b',
    ]);
    await api.compileFonts();
    expect(calls.fonts).toBe(2);
  });
});

describe('US-039 AC-8: read at each call (SCAR-016, SCAR-022)', () => {
  it('a change of the preset between two calls changes the answer; settings are read once per call', async () => {
    const {createStatblockTypstApi} = await load();
    const {d, calls, state} = deps();
    const api = createStatblockTypstApi(d);
    const one = ok(
      await api.statblockTypst(FEN_HARE_DATA, {heading: 'Fen Hare'}),
    );
    state.current = {
      entries: {...ENTRIES, statblock: {...ENTRIES.statblock, fill: '#fbe2c5'}},
    };
    const two = ok(
      await api.statblockTypst(FEN_HARE_DATA, {heading: 'Fen Hare'}),
    );
    expect(one.data).not.toBe(two.data);
    expect(two.data).toContain('#fbe2c5');
    expect(calls.settings).toBe(2);
  });
  it('icons are read once per path until clearIconCache', async () => {
    const {createStatblockTypstApi} = await load();
    const {d, calls} = deps();
    const api = createStatblockTypstApi(d);
    await api.statblockTypst(FEN_HARE_DATA, {heading: 'a'});
    await api.statblockTypst(FEN_HARE_DATA, {heading: 'b'});
    expect(calls.icons).toEqual([
      'Icons/fine.svg',
      'Icons/hurt.svg',
      'Icons/down.svg',
      'Icons/gone.svg',
    ]);
    api.clearIconCache();
    await api.statblockTypst(FEN_HARE_DATA, {heading: 'c'});
    expect(calls.icons).toHaveLength(8);
  });
  it('a failing dependency gives a refusal, never a throw or a half answer', async () => {
    const {createStatblockTypstApi} = await load();
    const {d} = deps({
      settings: async () => {
        throw new Error('boom');
      },
    });
    const r = await createStatblockTypstApi(d).statblockTypst(FEN_HARE_DATA, {
      heading: 'x',
    });
    expect(r.ok).toBe(false);
  });
});

describe('US-039 AC-9: deterministic', () => {
  it('two calls give the same answer', async () => {
    const {createStatblockTypstApi} = await load();
    const api = createStatblockTypstApi(deps().d);
    const one = await api.statblockTypst(FEN_HARE_DATA, {heading: 'Fen Hare'});
    const two = await api.statblockTypst(FEN_HARE_DATA, {heading: 'Fen Hare'});
    expect(two).toEqual(one);
  });
  it('two fresh processes, 1.1 s apart, print the same answer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'o2t-039-'));
    try {
      const bundle = join(dir, 'cli.mjs');
      await build({
        entryPoints: ['tests/support/us-039-answer-cli.ts'],
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile: bundle,
        banner: {
          js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);",
        },
        logLevel: 'silent',
      });
      const run = (): string => {
        const r = spawnSync('node', [bundle], {
          cwd: process.cwd(),
          encoding: 'utf8',
        });
        expect(r.status, r.stderr).toBe(0);
        return r.stdout;
      };
      const first = run();
      await new Promise((r) => setTimeout(r, 1100));
      const second = run();
      expect(first.length).toBeGreaterThan(500);
      expect(second).toBe(first);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }, 60_000);
});

describe('US-039 AC-10: composed with the rest of the API', () => {
  it('composeApi keeps version 1, renderStatblock and renderDetails, adds the two functions, and clearIconCache clears all three', async () => {
    const {composeApi} = (await import(
      /* @vite-ignore */ DETAILS as string
    )) as {
      composeApi(
        e: unknown,
        d: unknown,
        t?: unknown,
      ): Record<string, unknown> & {clearIconCache(): void};
    };
    let cleared = 0;
    const renderStatblock = () => 'sb';
    const renderDetails = () => 'dt';
    const statblockTypst = () => 'ty';
    const compileFonts = () => 'cf';
    const api = composeApi(
      {version: 1, renderStatblock, clearIconCache: () => void cleared++},
      {renderDetails, clearIconCache: () => void cleared++},
      {statblockTypst, compileFonts, clearIconCache: () => void cleared++},
    );
    expect(api.version).toBe(1);
    expect(api.renderStatblock).toBe(renderStatblock);
    expect(api.renderDetails).toBe(renderDetails);
    expect(api.statblockTypst).toBe(statblockTypst);
    expect(api.compileFonts).toBe(compileFonts);
    api.clearIconCache();
    expect(cleared).toBe(3);
  });
  it('without the third part composeApi works as before (the US-038 test stays as it is)', async () => {
    const {composeApi} = (await import(
      /* @vite-ignore */ DETAILS as string
    )) as {
      composeApi(e: unknown, d: unknown, t?: unknown): Record<string, unknown>;
    };
    const api = composeApi(
      {
        version: 1,
        renderStatblock: () => 'sb',
        clearIconCache: () => undefined,
      },
      {renderDetails: () => 'dt', clearIconCache: () => undefined},
    );
    expect(api).not.toHaveProperty('statblockTypst');
    expect(api.version).toBe(1);
  });
  it('main.ts only hands over: the api is composed with the new part, the preset change clears its icons too', () => {
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    expect(main).toMatch(
      /this\.api\s*=\s*composeApi\(\s*createEntriesApi\(this\.entryDeps\),\s*createDetailsApi\(this\.detailsDeps\),\s*createStatblockTypstApi\(this\.typstDeps\),?\s*\)/,
    );
    expect(main).not.toContain('statblockTypst(');
  });
  it('the manual documents both functions, with the example', () => {
    const manual = readFileSync('manual/entries.md', 'utf8');
    expect(manual).toContain('api.statblockTypst');
    expect(manual).toContain('api.compileFonts');
    expect(manual).toContain('Fen Hare');
  });
});
