// US-016 AC-16 — the preview of US-012 shows callouts as the export does: the
// callout styles of the active preset note reach the preview source, and an
// edit of `callouts` in that note reaches the next preview request (SCAR-016:
// the state when it is used, not when the panel was drawn). Source of truth:
// docs/user-stories/US-016-callout-styles.md.
import {describe, expect, it} from 'vitest';
import {type PrepareDeps} from '../../src/plugin/prepare-note';
import {preparePreview} from '../../src/plugin/preview/request';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';
const PRESET = `${FOLDER}/Book.md`;
const NOTE = 'Sample/Rules.md';
const SOURCE = '# Rules\n\n> [!example] Rolling dice\n> Roll 6d6.\n';

const preset = (fill: string): string =>
  [
    '---',
    'schemaVersion: 1',
    'callouts:',
    '  example:',
    `    fill: "${fill}"`,
    '---',
    '',
  ].join('\n');

async function rig() {
  const vault = new FakeVault({[PRESET]: preset('#f3ead7')}, [FOLDER]);
  const data: PluginData = JSON.parse(
    JSON.stringify(DEFAULT_PLUGIN_DATA),
  ) as PluginData;
  data.activePreset = 'Book';
  const presets = createPresetStore({
    vault,
    folder: () => data.presetsFolder,
    defaults: () => data.defaults,
    notify: () => undefined,
  });
  await presets.load();
  const deps: PrepareDeps = {
    notes: {activePath: () => NOTE, read: async () => SOURCE},
    vault: {
      files: () => [NOTE],
      readHead: async (path, length = 16) => standIn(path).subarray(0, length),
      readBytes: async (path) => standIn(path),
      readText: async () => null,
    },
    presets,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async () => undefined,
    },
  };
  return {vault, presets, deps};
}

const none = {downsample: async () => null};

describe('US-016 AC-16 the preview shows callouts as the export', () => {
  it('US-016 AC-16: the preview source holds the callout and the style of the active preset', async () => {
    const {deps} = await rig();
    const prepared = await preparePreview(deps, NOTE, none);
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.request.source).toContain(
      '#callout("example", title: [Rolling dice])[',
    );
    expect(prepared.request.source).toContain('fill: rgb("#f3ead7")');
  });

  it('US-016 AC-16: an edit of callouts.example.fill in the preset note reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await rig();
    const before = await preparePreview(deps, NOTE, none);
    vault.edit(PRESET, preset('#ffffff'));
    await presets.load();
    const after = await preparePreview(deps, NOTE, none);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain('fill: rgb("#f3ead7")');
    expect(after.request.source).toContain('fill: rgb("#ffffff")');
    expect(after.request.source).not.toContain('#f3ead7');
  });
});
