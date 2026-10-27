// US-018 AC-8 — the three new Defaults rows (settings tab and the style
// panel, which draws the same rows) and the preview: the rows have the kinds,
// hints and place of the story, refused values keep the saved value with their
// message, the reset question reads the value at the click (SCAR-016: draw,
// change, use), and a preset edit of linkPageLevel reaches the next preview
// request. Source of truth:
// docs/user-stories/US-018-page-numbers-for-internal-links.md.
import {describe, expect, it, vi} from 'vitest';
import {validateFields} from '../../src/core/presets';
import {type PrepareDeps} from '../../src/plugin/prepare-note';
import {preparePreview} from '../../src/plugin/preview/request';
import {createPresetStore} from '../../src/plugin/presets/store';
import {resetDefaultField} from '../../src/plugin/settings/dialog';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {DEFAULT_ROWS} from '../../src/plugin/settings/rows';
import {standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

describe('US-018 AC-8 the Defaults rows', () => {
  it('US-018 AC-8: Page numbers in links, Link page level and Link page word follow Running header level, with their kinds and hints', () => {
    const labels = DEFAULT_ROWS.map((r) => r.label);
    const level = labels.indexOf('Running header level');
    expect(level).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_ROWS.slice(level + 1, level + 4)).toEqual([
      {
        label: 'Page numbers in links',
        path: ['linkPageNumbers'],
        kind: 'toggle',
      },
      {
        label: 'Link page level',
        path: ['linkPageLevel'],
        kind: 'number',
        hint: '1 to 6',
      },
      {
        label: 'Link page word',
        path: ['linkPageWord'],
        kind: 'text',
        hint: 'p.',
      },
    ]);
  });

  it('US-018 AC-8: refused values are refused with the AC-1 messages (no line: the Defaults)', () => {
    expect(validateFields({linkPageLevel: 7})).toEqual({
      ok: false,
      error: {
        message: 'linkPageLevel must be a whole number from 1 to 6',
        line: null,
      },
    });
    expect(validateFields({linkPageWord: ''})).toEqual({
      ok: false,
      error: {message: 'linkPageWord must be text', line: null},
    });
  });

  it('US-018 AC-8: the reset question names the word typed after the row was drawn (draw, change, use)', async () => {
    const holder = {value: 'p.'};
    const confirm = vi.fn(async () => true);
    const save = vi.fn(async () => true);
    // drawn with "p."; the user types "S." and leaves the field; then the icon:
    holder.value = 'S.';
    await resetDefaultField(
      {confirm, save},
      {label: 'Link page word', value: () => holder.value},
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          'The value "S." is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
      }),
    );
    expect(save).toHaveBeenCalledWith(undefined);
  });
});

const FOLDER = 'Obsidian2Typst/presets';
const PRESET = `${FOLDER}/Book.md`;
const NOTE = 'Sample/Rules.md';
const SOURCE =
  '# Rules\n\nSee [Tessera](#tessera) and [Moss](#moss).\n\n## Tessera\n\nText.\n\n### Moss\n\nMore.\n';

const preset = (level: number): string =>
  ['---', 'schemaVersion: 1', `linkPageLevel: ${level}`, '---', ''].join('\n');

async function rig() {
  const vault = new FakeVault({[PRESET]: preset(2)}, [FOLDER]);
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

describe('US-018 AC-8 the preview shows the numbers as the export', () => {
  it('US-018 AC-8: the preview source holds the helper and the call for a ## target at the preset level 2', async () => {
    const {deps} = await rig();
    const prepared = await preparePreview(deps, NOTE, none);
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.request.source).toContain('#let page-ref(target)');
    expect(prepared.request.source).toContain('#page-ref(<h-tessera>)');
    expect(prepared.request.source).not.toContain('#page-ref(<h-moss>)');
  });

  it('US-018 AC-8: an edit of linkPageLevel reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await rig();
    const before = await preparePreview(deps, NOTE, none);
    vault.edit(PRESET, preset(3));
    await presets.load();
    const after = await preparePreview(deps, NOTE, none);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).not.toContain('#page-ref(<h-moss>)');
    expect(after.request.source).toContain('#page-ref(<h-moss>)');
  });
});
