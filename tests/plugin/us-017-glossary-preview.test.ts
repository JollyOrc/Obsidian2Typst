// US-017 AC-12 — the preview of US-012 shows glossary terms as the export
// does: the heading rules of the active preset note reach the preview source,
// and an edit of `headingRules` in that note reaches the next preview request
// (SCAR-016: the state when it is used, not when the panel was drawn). Source
// of truth: docs/user-stories/US-017-heading-rules-glossary.md.
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
const SOURCE = '# Glossar\n\n## Gambit\n\nA thing you can do.\n';

const preset = (rule: string): string =>
  [
    '---',
    'schemaVersion: 1',
    'headingRules:',
    `  Glossar: ${rule}`,
    '---',
    '',
  ].join('\n');

async function rig() {
  const vault = new FakeVault({[PRESET]: preset('glossary')}, [FOLDER]);
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
const TERM = '#glossary-term[Gambit] <h-gambit> A thing you can do.';

describe('US-017 AC-12 the preview shows terms as the export', () => {
  it('US-017 AC-12: the preview source holds the term of the active preset rule and the helper', async () => {
    const {deps} = await rig();
    const prepared = await preparePreview(deps, NOTE, none);
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.request.source).toContain(TERM);
    expect(prepared.request.source).toContain('#let glossary-term(');
  });

  it('US-017 AC-12: an edit of headingRules from glossary to none reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await rig();
    const before = await preparePreview(deps, NOTE, none);
    vault.edit(PRESET, preset('none'));
    await presets.load();
    const after = await preparePreview(deps, NOTE, none);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain(TERM);
    expect(after.request.source).toContain('== Gambit <h-gambit>');
    expect(after.request.source).not.toContain('glossary-term');
  });
});
