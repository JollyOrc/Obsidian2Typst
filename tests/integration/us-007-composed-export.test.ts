// US-007 AC-7 — the composed export with the real compiler on a real disk: a
// note with a cover (US-011), a font from the vault (US-010), an image in a
// list item (US-003), a wikilink (US-004) and a table (US-005) exports exactly
// the files of AC-1, the PDF has the cover as page 1 and the vault font, and
// the log of warnings is empty (SCAR-015: content, not only success). Source of
// truth: docs/user-stories/US-007-in-plugin-typst-compilation.md.
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createDiskWriter} from '../../src/plugin/disk-writer';
import {exportCurrentNote} from '../../src/plugin/export-command';
import {createFontSet} from '../../src/plugin/fonts';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  createExportLock,
  runExport,
  type RunExportHost,
} from '../../src/plugin/run-export';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {FakeVault} from '../support/fake-vault';
import {LoopbackWorker} from '../support/fake-worker';
import {VAULT_FAMILY, bundledFontFile, vaultTestFont} from '../support/fonts';
import {png} from '../support/images';
import {readPdfPages} from '../support/pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const BUNDLED = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map(bundledFontFile);

const PRESETS = 'Obsidian2Typst/presets';
const NOTE = 'Sample/Rules.md';
const SOURCE = [
  '![](assets/cover.png)',
  '',
  '# Rules',
  '',
  'Intro with a [[Tessera]] reference.',
  '',
  '## Tessera',
  '',
  '- Strike',
  '- ![Map](assets/map.png)',
  '',
  '| Weapon | Cost |',
  '|:--|--:|',
  '| Sword | 10 |',
  '',
].join('\n');
const PRESET = [
  '---',
  'schemaVersion: 1',
  'fonts:',
  '  folder: "Layouting/Fonts"',
  '  heading:',
  `    family: "${VAULT_FAMILY}"`,
  '---',
  '',
].join('\n');

const IMAGES = new Map<string, Uint8Array>([
  ['Sample/assets/cover.png', png(71, 100)],
  ['Sample/assets/map.png', png(30, 20)],
]);
const FONT_PATH = 'Layouting/Fonts/VaultTest.ttf';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'o2t-us007-'));
});
afterEach(() => rmSync(root, {recursive: true, force: true}));

/** Lists the files below `dir`, relative, sorted. */
function listing(dir: string, prefix = ''): string[] {
  return readdirSync(dir)
    .flatMap((name) =>
      statSync(join(dir, name)).isDirectory()
        ? listing(join(dir, name), `${prefix}${name}/`)
        : [`${prefix}${name}`],
    )
    .sort();
}

function baseFonts(pdf: Uint8Array): string[] {
  const text = Buffer.from(pdf).toString('latin1');
  return [
    ...new Set(
      [...text.matchAll(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/[\]<>]+)/g)].map(
        (m) => m[1] as string,
      ),
    ),
  ];
}

async function exportComposed(): Promise<{
  out: string;
  notices: string[];
  status: string;
}> {
  const out = join(root, 'export');
  const vault = new FakeVault({[`${PRESETS}/Composed.md`]: PRESET}, [PRESETS]);
  const data: PluginData = JSON.parse(
    JSON.stringify(DEFAULT_PLUGIN_DATA),
  ) as PluginData;
  data.activePreset = 'Composed';
  const store = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await store.load();
  const compiler = createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });
  const files = [NOTE, FONT_PATH, ...IMAGES.keys()];
  const bytes = (path: string): Uint8Array =>
    path === FONT_PATH ? vaultTestFont() : (IMAGES.get(path) as Uint8Array);
  const notices: string[] = [];
  const writer = createDiskWriter(out);
  const host: RunExportHost = {
    notice: (text) => notices.push(text),
    writeExportFile: (path, text) => writer.writeText(path, text),
    writeExportBytes: (path, data) => writer.writeBytes(path, data),
    writeVaultFile: async () => undefined,
  };
  const fonts = createFontSet({
    bundled: async () => BUNDLED,
    vault: {
      files: () => files,
      folderExists: async (path) => path === 'Layouting/Fonts',
      readBytes: async (path) => bytes(path),
    },
    compiler,
  });
  const result = await exportCurrentNote({
    notes: {activePath: () => NOTE, read: async () => SOURCE},
    vault: {
      files: () => files,
      readHead: async (path, length = 16) => bytes(path).subarray(0, length),
      readBytes: async (path) => bytes(path),
      readText: async () => null,
    },
    presets: store,
    fonts,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async () => undefined,
    },
    chooseFolder: async () => out,
    notice: (text) => notices.push(text),
    run: (request) =>
      runExport({
        ...request,
        host,
        compiler,
        fonts: [...BUNDLED, ...request.fonts],
        lock: createExportLock(),
      }),
  });
  return {out, notices, status: result.status};
}

describe('US-007 AC-7 the composed export', () => {
  it('US-007 AC-7: writes exactly the files of AC-1, and no font file and no warnings log', async () => {
    const {out, status} = await exportComposed();
    expect(status).toBe('exported');
    expect(listing(out)).toEqual([
      'Rules.pdf',
      'Rules.typ',
      'assets/cover.png',
      'assets/map.png',
      'export-warnings.md',
    ]);
    const log = readFileSync(join(out, 'export-warnings.md'), 'utf8');
    expect(log).toBe('# Export warnings\n\nNo warnings.\n');
  });

  it('US-007 AC-7: the PDF opens with the cover as page 1, then the text', async () => {
    const {out} = await exportComposed();
    const pages = readPdfPages(
      new Uint8Array(readFileSync(join(out, 'Rules.pdf'))),
    );
    expect(pages[0]?.hasImage).toBe(true);
    expect(pages[0]?.hasText).toBe(false);
    const text = (pages[1]?.text ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Rules');
    expect(text).toContain('Strike');
    expect(text).toContain('Sword');
  });

  it('US-007 AC-7: the vault font is embedded for the headings', async () => {
    const {out} = await exportComposed();
    const names = baseFonts(
      new Uint8Array(readFileSync(join(out, 'Rules.pdf'))),
    );
    expect(names.some((n) => n.startsWith('DejaVuSansMono'))).toBe(true);
    expect(names.some((n) => n.startsWith('LibertinusSerif'))).toBe(true);
  });
});
