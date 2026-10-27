// US-010 AC-1, AC-3, AC-4, AC-7 — the plugin side of the fonts: the font
// information of the compile service (scripted workers), the font set of a
// preset (bundled fonts, vault folder, archives, invalid files, missing
// folder), the Defaults in data.json, and what the export command hands to the
// conversion and to the export run. The real compiler is used in
// tests/integration/us-010-fonts-pdf.test.ts. Source of truth:
// docs/user-stories/US-010-fonts.md.
import {describe, expect, it} from 'vitest';
import {createFontCatalog, type FaceInfo} from '../../src/core/fonts';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {
  exportCurrentNote,
  type ExportRequest,
} from '../../src/plugin/export-command';
import {createFontSet, type FontSet} from '../../src/plugin/fonts';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  loadPluginData,
  type PluginData,
} from '../../src/plugin/settings/data';
import {FakeVault} from '../support/fake-vault';
import {ScriptedWorker} from '../support/fake-worker';

const WASM = new Uint8Array([0, 97, 115, 109, 1, 2, 3]);

/** Coverage runs for inclusive code point ranges. */
function runs(...ranges: [number, number][]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const [from, to] of ranges) {
    out.push(from - at, to - from + 1);
    at = to + 1;
  }
  return out;
}
const ASCII = runs([32, 126]);

describe('US-010 AC-3 the font information of the compile service', () => {
  const face = (family: string): FaceInfo => ({family, coverage: ASCII});

  /** A worker that answers `font-info` like the real one. */
  const worker = (answer: (fonts: ArrayBuffer[]) => (FaceInfo[] | null)[]) =>
    new ScriptedWorker((message, w) => {
      if (message['type'] === 'init') {
        w.emit({type: 'ready', id: message['id']});
      } else if (message['type'] === 'font-info') {
        w.emit({
          type: 'font-info-result',
          id: message['id'],
          faces: answer(message['fonts'] as ArrayBuffer[]),
        });
      }
    });

  const setup = (make: () => ScriptedWorker) => {
    const workers: ScriptedWorker[] = [];
    const compiler = createTypstCompiler({
      createWorker: () => {
        const w = make();
        workers.push(w);
        return w;
      },
      compilerWasm: async () => WASM,
    });
    return {compiler, workers};
  };

  it('US-010 AC-3: sends the files to a worker after init and returns the faces of each file in order, null for a file that is not a font', async () => {
    const {compiler, workers} = setup(() =>
      worker((fonts) =>
        fonts.map((buf) =>
          new Uint8Array(buf)[0] === 1 ? [face('Cinzel')] : null,
        ),
      ),
    );
    const result = await compiler.fontInfo([
      new Uint8Array([1, 2]),
      new Uint8Array([9, 9]),
    ]);
    expect(result).toEqual([[face('Cinzel')], null]);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.received.map((m) => m['type'])).toEqual([
      'init',
      'font-info',
    ]);
    expect(workers[0]?.terminated).toBe(1);
  });

  it('US-010 AC-3: asks nothing and starts no worker when there are no files', async () => {
    const {compiler, workers} = setup(() => worker(() => []));
    expect(await compiler.fontInfo([])).toEqual([]);
    expect(workers).toHaveLength(0);
  });

  it('US-010 AC-3: a worker that fails rejects with "Typst compiler failed" and is terminated', async () => {
    const {compiler, workers} = setup(
      () =>
        new ScriptedWorker((message, w) => {
          if (message['type'] === 'init') {
            w.emit({type: 'failed', id: message['id'], message: 'boom'});
          }
        }),
    );
    await expect(compiler.fontInfo([new Uint8Array([1])])).rejects.toThrow(
      'Typst compiler failed: boom',
    );
    expect(workers[0]?.terminated).toBe(1);
  });
});

describe('US-010 AC-3 and AC-4 the font set of a preset', () => {
  const LIBERTINUS = new Uint8Array([1]);
  const DEJAVU = new Uint8Array([2]);
  const CINZEL = new Uint8Array([3]);
  const EXTRA = new Uint8Array([4]);
  const BROKEN = new Uint8Array([9]);

  const FACES = new Map<number, FaceInfo[] | null>([
    [1, [{family: 'Libertinus Serif', coverage: ASCII}]],
    [2, [{family: 'DejaVu Sans Mono', coverage: ASCII}]],
    [3, [{family: 'Cinzel', coverage: ASCII}]],
    [4, [{family: 'Cinzel Decorative', coverage: ASCII}]],
    [9, null],
  ]);

  const VAULT: Record<string, Uint8Array> = {
    'Layouting/Fonts/Cinzel.ttf': CINZEL,
    'Layouting/Fonts/sub/Deco.OTF': EXTRA,
    'Layouting/Fonts/broken.ttf': BROKEN,
    'Layouting/Fonts/Cinzel.zip': new Uint8Array([5]),
    'Layouting/Fonts/Old.zip': new Uint8Array([6]),
    'Layouting/Fonts/readme.txt': new Uint8Array([7]),
    'Layouting/Fonts2/Other.ttf': new Uint8Array([8]),
    'Elsewhere/Fonts/Else.ttf': new Uint8Array([8]),
  };

  function setup(folders: string[] = ['Layouting/Fonts']) {
    const calls: Uint8Array[][] = [];
    const reads: string[] = [];
    const set = createFontSet({
      bundled: async () => [LIBERTINUS, DEJAVU],
      vault: {
        files: () => Object.keys(VAULT),
        folderExists: async (path) => folders.includes(path),
        readBytes: async (path) => {
          reads.push(path);
          return VAULT[path] as Uint8Array;
        },
      },
      compiler: {
        fontInfo: async (fonts) => {
          calls.push([...fonts]);
          return fonts.map((bytes) => FACES.get(bytes[0] as number) ?? null);
        },
      },
    });
    return {set, calls, reads};
  }

  it('US-010 AC-3: without a folder only the bundled families are available and no vault file is read', async () => {
    const {set, reads} = setup();
    const result = await set(null);
    expect(result.catalog.families()).toEqual([
      'DejaVu Sans Mono',
      'Libertinus Serif',
    ]);
    expect(result.files).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(reads).toEqual([]);
  });

  it('US-010 AC-3: reads the .ttf and .otf files of the folder and below, any case of the extension, and no other file or folder', async () => {
    const {set, reads} = setup();
    const result = await set('Layouting/Fonts');
    expect(reads).toEqual(
      [
        'Layouting/Fonts/Cinzel.ttf',
        'Layouting/Fonts/broken.ttf',
        'Layouting/Fonts/sub/Deco.OTF',
      ].sort(),
    );
    expect(result.catalog.families()).toEqual([
      'Cinzel',
      'Cinzel Decorative',
      'DejaVu Sans Mono',
      'Libertinus Serif',
    ]);
  });

  it('US-010 AC-3: gives the bytes of the vault fonts that can be read, sorted by path, never the bundled ones or the invalid ones', async () => {
    const {set} = setup();
    const result = await set('Layouting/Fonts');
    expect(result.files).toEqual([CINZEL, EXTRA]);
  });

  it('US-010 AC-3: the bundled fonts are inspected once, however many times the set is asked for', async () => {
    const {set, calls} = setup();
    await set(null);
    await set('Layouting/Fonts');
    await set('Layouting/Fonts');
    const bundledCalls = calls.filter((c) =>
      c.some((b) => b === LIBERTINUS || b === DEJAVU),
    );
    expect(bundledCalls).toHaveLength(1);
  });

  it('US-010 AC-3: the vault files are read again every time (a font that was added is found)', async () => {
    const {set, reads} = setup();
    await set('Layouting/Fonts');
    await set('Layouting/Fonts');
    expect(reads).toHaveLength(6);
  });

  it('US-010 AC-3: reports every zip once, sorted by path, as FONT_ARCHIVE_IGNORED at line 0', async () => {
    const {set} = setup();
    const result = await set('Layouting/Fonts');
    expect(
      result.warnings.filter((w) => w.code === 'FONT_ARCHIVE_IGNORED'),
    ).toEqual([
      {
        code: 'FONT_ARCHIVE_IGNORED',
        message:
          'Font archive ignored, unzip it first: Layouting/Fonts/Cinzel.zip',
        line: 0,
      },
      {
        code: 'FONT_ARCHIVE_IGNORED',
        message:
          'Font archive ignored, unzip it first: Layouting/Fonts/Old.zip',
        line: 0,
      },
    ]);
  });

  it('US-010 AC-3: reports a file that is not a font as FONT_FILE_INVALID and goes on', async () => {
    const {set} = setup();
    const result = await set('Layouting/Fonts');
    expect(
      result.warnings.filter((w) => w.code === 'FONT_FILE_INVALID'),
    ).toEqual([
      {
        code: 'FONT_FILE_INVALID',
        message: 'Font file cannot be read: Layouting/Fonts/broken.ttf',
        line: 0,
      },
    ]);
  });

  it('US-010 AC-3: the warnings come in this order: zips (sorted), then invalid files', async () => {
    const {set} = setup();
    const result = await set('Layouting/Fonts');
    expect(result.warnings.map((w) => w.code)).toEqual([
      'FONT_ARCHIVE_IGNORED',
      'FONT_ARCHIVE_IGNORED',
      'FONT_FILE_INVALID',
    ]);
  });

  it('US-010 AC-3: a folder that does not exist is FONT_FOLDER_MISSING and the bundled fonts remain', async () => {
    const {set} = setup([]);
    const result = await set('Layouting/Fonts');
    expect(result.warnings).toEqual([
      {
        code: 'FONT_FOLDER_MISSING',
        message: 'Font folder not found: Layouting/Fonts',
        line: 0,
      },
    ]);
    expect(result.files).toEqual([]);
    expect(result.catalog.families()).toEqual([
      'DejaVu Sans Mono',
      'Libertinus Serif',
    ]);
  });

  it('US-010 AC-3: an empty folder gives no warning', async () => {
    const calls: number[] = [];
    const set = createFontSet({
      bundled: async () => [LIBERTINUS],
      vault: {
        files: () => [],
        folderExists: async () => true,
        readBytes: async () => new Uint8Array(),
      },
      compiler: {
        fontInfo: async (fonts) => {
          calls.push(fonts.length);
          return fonts.map(() => FACES.get(1) ?? null);
        },
      },
    });
    expect((await set('Empty')).warnings).toEqual([]);
  });

  it('US-010 AC-3: a failure of the compiler is not swallowed', async () => {
    const set = createFontSet({
      bundled: async () => [LIBERTINUS],
      vault: {
        files: () => [],
        folderExists: async () => true,
        readBytes: async () => new Uint8Array(),
      },
      compiler: {
        fontInfo: async () => {
          throw new Error('Typst compiler failed: boom');
        },
      },
    });
    await expect(set(null)).rejects.toThrow('Typst compiler failed: boom');
  });
});

describe('US-010 AC-1 the Defaults hold fonts in data.json', () => {
  const FONTS = {
    folder: 'Layouting/Fonts',
    default: 'EB Garamond',
    heading: {family: 'Cinzel', size: 18},
  };

  it('US-010 AC-1: reads valid fonts of the Defaults without a notice', () => {
    const {data, reset} = loadPluginData({
      ...DEFAULT_PLUGIN_DATA,
      defaults: {fonts: FONTS},
    });
    expect(reset).toBe(false);
    expect(data.defaults).toEqual({fonts: FONTS});
  });

  it('US-010 AC-1: replaces invalid fonts of the Defaults with the built-in ones, with the notice', () => {
    const {data, reset} = loadPluginData({
      ...DEFAULT_PLUGIN_DATA,
      defaults: {fonts: {body: {size: 0}}},
    });
    expect(reset).toBe(true);
    expect(data.defaults).toEqual({});
  });
});

describe('US-010 AC-7 the export command and the fonts', () => {
  const FOLDER = 'Obsidian2Typst/presets';
  const A5 = `${FOLDER}/A5 print.md`;
  const NOTE = 'Sample/Rules.md';
  const SOURCE = '# ☠ Title\n\nBody ☠ text.\n';
  const VAULT_FONT = new Uint8Array([42]);

  const catalog = createFontCatalog([
    {family: 'Libertinus Serif', coverage: ASCII},
    {family: 'DejaVu Sans Mono', coverage: ASCII},
    {family: 'Cinzel', coverage: ASCII},
  ]);

  async function rig(
    presetText: string,
    defaults: PluginData['defaults'] = {},
    fontSet: boolean = true,
  ) {
    const vault = new FakeVault({[A5]: presetText}, [FOLDER]);
    const data: PluginData = JSON.parse(
      JSON.stringify(DEFAULT_PLUGIN_DATA),
    ) as PluginData;
    data.defaults = defaults;
    data.activePreset = 'A5 print';
    const notices: string[] = [];
    const asked: (string | null)[] = [];
    const requests: ExportRequest[] = [];
    const store = createPresetStore({
      vault,
      folder: () => data.presetsFolder,
      defaults: () => data.defaults,
      notify: () => undefined,
    });
    await store.load();
    const fonts = async (folder: string | null): ReturnType<FontSet> => {
      asked.push(folder);
      return {
        catalog,
        files: [VAULT_FONT],
        warnings: [
          {
            code: 'FONT_FOLDER_MISSING',
            message: 'Font folder not found: X',
            line: 0,
          },
        ],
      };
    };
    const result = await exportCurrentNote({
      notes: {activePath: () => NOTE, read: async () => SOURCE},
      vault: {
        files: () => [NOTE],
        readHead: async () => new Uint8Array(16),
        readBytes: async () => new Uint8Array(),
        readText: async () => null,
      },
      presets: store,
      settings: {
        get data() {
          return data;
        },
        setLastExportFolder: async () => undefined,
      },
      chooseFolder: async () => '/out',
      run: async (request) => {
        requests.push(request);
        return {status: 'exported'};
      },
      notice: (text) => notices.push(text),
      ...(fontSet ? {fonts} : {}),
    });
    return {result, asked, requests, notices};
  }

  const preset = (...lines: string[]) =>
    ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

  it('US-010 AC-7: asks the font set for the folder of the preset', async () => {
    const r = await rig(preset('fonts:', '  folder: "Layouting/Fonts"'), {
      fonts: {folder: 'Other'},
    });
    expect(r.asked).toEqual(['Layouting/Fonts']);
  });

  it('US-010 AC-7: takes the folder of the Defaults when the preset has none, and null when neither has one', async () => {
    const fromDefaults = await rig(preset(), {fonts: {folder: 'Other'}});
    expect(fromDefaults.asked).toEqual(['Other']);
    const none = await rig(preset());
    expect(none.asked).toEqual([null]);
  });

  it('US-010 AC-7: hands the vault fonts to the export run', async () => {
    const r = await rig(preset());
    expect(r.requests[0]?.fonts).toEqual([VAULT_FONT]);
  });

  it('US-010 AC-7: writes the font lines and the warnings of the font set come before those of the conversion', async () => {
    const r = await rig(preset('fonts:', '  heading:', '    family: "Nope"'));
    const request = r.requests[0] as ExportRequest;
    expect(request.typ).toContain(
      '#show heading: set text(font: "Libertinus Serif")',
    );
    expect(request.warnings.map((w) => w.code)).toEqual([
      'FONT_FOLDER_MISSING',
      'FONT_MISSING',
      'FONT_GLYPH_MISSING',
    ]);
  });

  it('US-010 AC-7: without a font set the names are written as given, nothing is reported and no font is added', async () => {
    const r = await rig(
      preset('fonts:', '  heading:', '    family: "Nope"'),
      {},
      false,
    );
    const request = r.requests[0] as ExportRequest;
    expect(request.typ).toContain('#show heading: set text(font: "Nope")');
    expect(request.fonts).toEqual([]);
    expect(request.warnings).toEqual([]);
  });

  it('US-010 AC-1: an invalid fonts value stops the export with its line and starts no export', async () => {
    const r = await rig(preset('fonts:', '  heading:', '    size: 0'));
    expect(r.result).toEqual({status: 'invalid-preset'});
    expect(r.notices).toEqual([
      'Preset "A5 print" is invalid: fonts.heading.size must be a number of pt greater than 0 and at most 200 (line 5)',
    ]);
    expect(r.asked).toEqual([]);
    expect(r.requests).toEqual([]);
  });

  it('US-010 AC-1: the built-in presets still export with the built-in fonts', async () => {
    const r = await rig(BUILTIN_PRESET_TEXTS['A5 print']);
    expect(r.requests[0]?.typ).toContain(
      '#set text(font: "Libertinus Serif", size: 10pt)',
    );
  });
});
