// US-019 AC-2, AC-10 — the three new Defaults rows (settings tab and the Page
// group of the style panel, which draws the same rows) and the preview: the
// rows have the kinds and places of the story, a refused level keeps the saved
// value with its message, the reset question reads the value at the click
// (SCAR-016: draw, change, use), and a preset edit reaches the next preview
// request. Source of truth:
// docs/user-stories/US-019-folios-and-running-headers.md.
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

describe('US-019 AC-2 the Defaults rows', () => {
  it('US-019 AC-2: Page numbers, Running header and Running header level follow Gutter (mm), with their kinds', () => {
    const labels = DEFAULT_ROWS.map((r) => r.label);
    const gutter = labels.indexOf('Gutter (mm)');
    expect(DEFAULT_ROWS.slice(gutter + 1, gutter + 4)).toEqual([
      {label: 'Page numbers', path: ['page', 'folios'], kind: 'toggle'},
      {
        label: 'Running header',
        path: ['page', 'runningHeader'],
        kind: 'toggle',
      },
      {
        label: 'Running header level',
        path: ['page', 'runningHeaderLevel'],
        kind: 'number',
        hint: '1 to 6',
      },
    ]);
  });

  it('US-019 AC-2: a refused level is refused with the AC-1 message (no line: the Defaults)', () => {
    const result = validateFields({page: {runningHeaderLevel: 7}});
    expect(result).toEqual({
      ok: false,
      error: {
        message: 'page.runningHeaderLevel must be a whole number from 1 to 6',
        line: null,
      },
    });
  });

  it('US-019 AC-2: the reset question names the value typed after the row was drawn (draw, change, use)', async () => {
    const holder = {value: 2 as number};
    const confirm = vi.fn(async () => true);
    const save = vi.fn(async () => true);
    // drawn with 2; the user types 3 and leaves the field; then the icon:
    holder.value = 3;
    await resetDefaultField(
      {confirm, save},
      {label: 'Running header level', value: () => holder.value},
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          'The value "3" is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
      }),
    );
    expect(save).toHaveBeenCalledWith(undefined);
  });
});

const FOLDER = 'Obsidian2Typst/presets';
const PRESET = `${FOLDER}/Book.md`;
const NOTE = 'Sample/Rules.md';
const SOURCE = '# Rules\n\n## Tessera\n\nText.\n';

const preset = (level: number): string =>
  [
    '---',
    'schemaVersion: 1',
    'page:',
    `  runningHeaderLevel: ${level}`,
    '---',
    '',
  ].join('\n');

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

describe('US-019 AC-10 the preview shows folios and headers as the export', () => {
  it('US-019 AC-10: the preview source holds the furniture rule with the preset level', async () => {
    const {deps} = await rig();
    const prepared = await preparePreview(deps, NOTE, none);
    if (!prepared.ok) throw new Error('prepared');
    expect(prepared.request.source).toContain('#let running-title(level)');
    expect(prepared.request.source).toContain('running-title(2)');
    expect(prepared.request.source).toContain('numbering: "1"');
  });

  it('US-019 AC-10: an edit of page.runningHeaderLevel reaches the next preview request (draw, change, use)', async () => {
    const {vault, presets, deps} = await rig();
    const before = await preparePreview(deps, NOTE, none);
    vault.edit(PRESET, preset(3));
    await presets.load();
    const after = await preparePreview(deps, NOTE, none);
    if (!before.ok || !after.ok) throw new Error('prepared');
    expect(before.request.source).toContain('running-title(2)');
    expect(after.request.source).toContain('running-title(3)');
    expect(after.request.source).not.toContain('running-title(2)');
  });
});
