// US-012 AC-10, AC-12, AC-13 — what the preview hands to the compiler: nothing
// is written, assets are read into memory under their export paths, images are
// made smaller only here, and the Typst text is the text the export writes.
// Source of truth: docs/user-stories/US-012-style-preview-panel.md.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import {
  exportCurrentNote,
  type ExportRequest,
} from '../../src/plugin/export-command';
import {compileFonts} from '../../src/plugin/compile-fonts';
import {prepareNote, type PrepareDeps} from '../../src/plugin/prepare-note';
import {
  buildPreviewRequest,
  preparePreview,
} from '../../src/plugin/preview/request';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {COMPOSED_NOTE, standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';
const NOTE = 'Sample/Rules.md';
const FILES = [NOTE, 'Sample/assets/map.png', 'Sample/assets/other.png'];
const NOTE_WITH_COVER = [
  '![](assets/cover.png)',
  '',
  '# Rules',
  '',
  '![Map](assets/map.png)',
  '',
  '![[other.png]]',
  '',
  '![Again](assets/map.png)',
].join('\n');

/** The deps of the export command and of the preview, over one fake vault. */
async function rig(note = COMPOSED_NOTE, files: readonly string[] = FILES) {
  const vault = new FakeVault(
    {
      [`${FOLDER}/A5 print.md`]: BUILTIN_PRESET_TEXTS['A5 print'],
      [`${FOLDER}/A4 digital.md`]: BUILTIN_PRESET_TEXTS['A4 digital'],
    },
    [FOLDER],
  );
  const data: PluginData = JSON.parse(
    JSON.stringify(DEFAULT_PLUGIN_DATA),
  ) as PluginData;
  const presets = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await presets.load();
  const bytesRead: string[] = [];
  const texts = new Map<string, string>([[NOTE, note]]);
  const deps: PrepareDeps = {
    notes: {
      activePath: () => NOTE,
      read: async (path) => texts.get(path) ?? '',
    },
    vault: {
      files: () => [...files],
      readHead: async (path, length = 16) => standIn(path).subarray(0, length),
      readBytes: async (path) => {
        bytesRead.push(path);
        return standIn(path);
      },
      readText: async (path) => texts.get(path) ?? null,
    },
    presets,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async () => undefined,
    },
  };
  return {deps, vault, data, bytesRead, texts};
}

describe('US-012 AC-13 one preparation for the export and the preview', () => {
  it('US-012 AC-13: the preview source is the text the export writes, with the same assets and warnings', async () => {
    const {deps} = await rig();
    const requests: ExportRequest[] = [];
    await exportCurrentNote({
      ...deps,
      chooseFolder: async () => '/out',
      run: async (request) => {
        requests.push(request);
        return {status: 'exported'};
      },
      notice: () => undefined,
    });
    const exported = requests[0] as ExportRequest;
    const prepared = await prepareNote(deps, NOTE);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.typ).toBe(exported.typ);
    expect(prepared.uses).toEqual(exported.uses);
    expect(prepared.warnings).toEqual(exported.warnings);
    expect(prepared.template).toBe(exported.template);
    expect(prepared.fonts).toEqual(exported.fonts);
  });

  it('US-012 AC-13: the preparation refuses a note in the presets folder, as the export does', async () => {
    const {deps} = await rig();
    const inPresets = await prepareNote(deps, `${FOLDER}/A5 print.md`);
    expect(inPresets).toMatchObject({ok: false, status: 'presets-note'});
    const nested = await prepareNote(deps, `${FOLDER}/sub/Deep.md`);
    expect(nested).toMatchObject({ok: false, status: 'presets-note'});
  });

  it('US-012 AC-13: an invalid active preset is refused with the error of the export', async () => {
    const {deps, vault, data} = await rig();
    vault.files.set(
      `${FOLDER}/A5 print.md`,
      '---\nschemaVersion: 1\npage:\n\tbleed: 3\n---\nbody',
    );
    await deps.presets.load();
    data.activePreset = 'A5 print';
    const refused = await prepareNote(deps, NOTE);
    expect(refused).toMatchObject({ok: false, status: 'invalid-preset'});
  });

  it('US-012 AC-13: the export command calls selectPreset and convertNote (the folder question stays between them) and has no second copy of the conversion', () => {
    const source = readFileSync('src/plugin/export-command.ts', 'utf8');
    expect(source).toContain('selectPreset(');
    expect(source).toContain('convertNote(');
    expect(source).not.toMatch(/\bconvert\(/);
    expect(source.indexOf('selectPreset(')).toBeLessThan(
      source.indexOf('deps.chooseFolder('),
    );
    expect(source.indexOf('deps.chooseFolder(')).toBeLessThan(
      source.indexOf('convertNote('),
    );
  });
});

describe('US-012 AC-10 the preview request', () => {
  it('US-012 AC-10: a note with 3 images and a cover gives 4 files under their export paths, each read once, nothing written', async () => {
    const {deps, vault, bytesRead} = await rig(NOTE_WITH_COVER, [
      ...FILES,
      'Sample/assets/cover.png',
    ]);
    const prepared = await preparePreview(deps, NOTE, {
      downsample: async () => null,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(Object.keys(prepared.request.files).sort()).toEqual([
      'assets/cover.png',
      'assets/map.png',
      'assets/other.png',
    ]);
    expect(prepared.request.file).toBe('Rules.typ');
    expect(bytesRead.sort()).toEqual([
      'Sample/assets/cover.png',
      'Sample/assets/map.png',
      'Sample/assets/other.png',
    ]);
    expect(vault.writes).toEqual([]);
  });

  it('US-012 AC-10: the template copy is part of the request under template.typ', async () => {
    const {deps, data, texts} = await rig();
    data.defaults = {template: 'Styles/template.typ'};
    texts.set('Styles/template.typ', '#let x = 1');
    const prepared = await preparePreview(deps, NOTE, {
      downsample: async () => null,
    });
    if (!prepared.ok) throw new Error(prepared.error);
    expect(
      new TextDecoder().decode(prepared.request.files['template.typ']),
    ).toBe('#let x = 1');
  });

  it('US-012 AC-10: the warning count is the number of warnings of the conversion; a strict-mode stop is an error', async () => {
    const {deps, data} = await rig('# Rules\n\n![](assets/missing.png)\n');
    const prepared = await preparePreview(deps, NOTE, {
      downsample: async () => null,
    });
    expect(prepared.ok && prepared.warnings).toBeGreaterThan(0);
    data.strictMode = true;
    const strict = await preparePreview(deps, NOTE, {
      downsample: async () => null,
    });
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.error).toContain('strict mode');
  });

  it('US-012 AC-10: no file of src/plugin/preview writes, copies, shows a notice or takes the export lock', () => {
    for (const name of readdirSync('src/plugin/preview')) {
      const source = readFileSync(join('src/plugin/preview', name), 'utf8');
      for (const forbidden of [
        'writeExportFile',
        'writeExportBytes',
        'writeVaultFile',
        'copyAssets',
        'new Notice',
        'notice(',
        'tryAcquire',
        'createExportLock',
        '.vault.create',
        '.vault.modify',
        'writeText(',
        'writeBytes(',
      ]) {
        expect(source, `${name} contains ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });
});

describe('US-012 AC-10 an asset used twice', () => {
  it('US-012 AC-10: two uses of one export path read and shrink the file once', async () => {
    const reads: string[] = [];
    const shrunk: string[] = [];
    const built = await buildPreviewRequest({
      noteName: 'Rules',
      typ: '',
      uses: [
        {from: 'v/a.png', to: 'assets/a.png'},
        {from: 'v/a.png', to: 'assets/a.png'},
      ],
      template: null,
      fonts: [],
      readAsset: async (path) => {
        reads.push(path);
        return new Uint8Array([1]);
      },
      downsample: async () => {
        shrunk.push('x');
        return null;
      },
    });
    expect(reads).toEqual(['v/a.png']);
    expect(shrunk).toHaveLength(1);
    expect(Object.keys(built.files)).toEqual(['assets/a.png']);
  });
});

describe('US-012 AC-12 images in the preview only', () => {
  const request = (
    downsample: (b: Uint8Array, e: string) => Promise<Uint8Array | null>,
  ) =>
    buildPreviewRequest({
      noteName: 'Rules',
      typ: '#image("a.png")',
      uses: [
        {from: 'v/a.png', to: 'assets/a.png'},
        {from: 'v/b.jpg', to: 'assets/b.jpg'},
        {from: 'v/c.JPEG', to: 'assets/c.JPEG'},
        {from: 'v/d.webp', to: 'assets/d.webp'},
        {from: 'v/e.svg', to: 'assets/e.svg'},
        {from: 'v/f.gif', to: 'assets/f.gif'},
      ],
      template: null,
      fonts: [],
      readAsset: async (path) => new TextEncoder().encode(path),
      downsample,
    });

  it('US-012 AC-12: only PNG and JPEG are given to the downsampler, with their extension; WebP, SVG and GIF never', async () => {
    const seen: string[] = [];
    await request(async (_bytes, extension) => {
      seen.push(extension);
      return null;
    });
    expect(seen.sort()).toEqual(['jpeg', 'jpg', 'png']);
  });

  it('US-012 AC-12: a smaller copy replaces the bytes; null (small or undecodable) keeps the original', async () => {
    const result = await request(async (_bytes, extension) =>
      extension === 'png' ? new Uint8Array([1, 2, 3]) : null,
    );
    expect([...(result.files['assets/a.png'] as Uint8Array)]).toEqual([
      1, 2, 3,
    ]);
    expect(new TextDecoder().decode(result.files['assets/b.jpg'])).toBe(
      'v/b.jpg',
    );
    expect(new TextDecoder().decode(result.files['assets/e.svg'])).toBe(
      'v/e.svg',
    );
  });

  it('US-012 AC-12: the Typst text is not changed by the request', async () => {
    const result = await request(async () => null);
    expect(result.source).toBe('#image("a.png")');
    expect(result.file).toBe('Rules.typ');
  });

  it('US-012 AC-12: the export code path never mentions the downsampler or the preview (SCAR-017)', () => {
    for (const file of [
      'src/plugin/export-command.ts',
      'src/plugin/run-export.ts',
      'src/plugin/copy-assets.ts',
      'src/plugin/warning-flow.ts',
      'src/plugin/prepare-note.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /downsample|core\/preview|plugin\/preview/i,
      );
    }
  });
});

describe('US-012 AC-13 fonts, active preset and edge-case names at the new call site', () => {
  const none = {downsample: async () => null};

  it('US-012 AC-13: the font list of the request is the list the export gives the compiler (bundled, then vault)', async () => {
    const {deps} = await rig();
    const bundled = [new Uint8Array([1]), new Uint8Array([2])];
    const prepared = await preparePreview(deps, NOTE, {
      ...none,
      bundledFonts: bundled,
    });
    if (!prepared.ok) throw new Error(prepared.error);
    expect(prepared.request.fonts).toEqual(compileFonts(bundled, []));
    expect(
      compileFonts([bundled[0] as Uint8Array], [bundled[1] as Uint8Array]),
    ).toEqual(bundled);
  });

  it('US-012 AC-13: export and preview both build the font list with compileFonts (text check, SCAR-017)', () => {
    // The export builds the list in main.ts, the preview inside the request
    // builder (`preparePreview`); neither joins the lists by hand.
    for (const file of [
      'src/plugin/main.ts',
      'src/plugin/preview/request.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source.match(/compileFonts\(/g)?.length ?? 0, file).toBe(1);
      expect(source, file).not.toMatch(/\.\.\.\(await embeddedFonts\(\)\)/);
      expect(source, file).not.toMatch(/\[\.\.\.bundled|\.\.\.request\.fonts/);
    }
  });

  it('US-012 AC-13: switching the active preset changes the preview source: A5 print then A4 digital', async () => {
    const {deps, data} = await rig();
    data.activePreset = 'A5 print';
    const a5 = await preparePreview(deps, NOTE, none);
    data.activePreset = 'A4 digital';
    const a4 = await preparePreview(deps, NOTE, none);
    if (!a5.ok || !a4.ok) throw new Error('prepared');
    expect(a5.request.source).toContain(
      '#set page(width: 154mm, height: 216mm',
    );
    expect(a4.request.source).toContain(
      '#set page(width: 210mm, height: 297mm',
    );
  });

  it('US-012 AC-10: asset names with spaces, hyphens, non-ASCII letters and a name that looks like a generated one give distinct files under the export paths (SCAR-001, SCAR-011)', async () => {
    const files = [
      NOTE,
      'Sample/assets/my-map 1.png',
      'Sample/assets/Café.png',
      'Sample/assets/x.png',
      'Sample/assets/x-2.png',
      'Other/assets/x.png',
    ];
    const {deps} = await rig(
      [
        '![](assets/my-map 1.png)',
        '![](assets/Café.png)',
        '![](assets/x.png)',
        '![](assets/x-2.png)',
        '![[x.png]]',
      ].join('\n\n'),
      files,
    );
    const exported: ExportRequest[] = [];
    await exportCurrentNote({
      ...deps,
      chooseFolder: async () => '/out',
      run: async (request) => {
        exported.push(request);
        return {status: 'exported'};
      },
      notice: () => undefined,
    });
    const prepared = await preparePreview(deps, NOTE, none);
    if (!prepared.ok) throw new Error(prepared.error);
    const expected = [
      ...new Set((exported[0] as ExportRequest).uses.map((u) => u.to)),
    ].sort();
    expect(Object.keys(prepared.request.files).sort()).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(4);
  });
});
