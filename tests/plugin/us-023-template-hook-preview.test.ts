// US-023 AC-1, AC-2, AC-5, AC-7, AC-9 — the template hook in the plugin: the
// export preparation and the preview read the template where the preset or
// the Defaults select it, write the hook line when it defines `template`,
// report top-level rules, and hand the same document and template copy to
// the preview (SCAR-016: the template is read when it is used).
// Source of truth: docs/user-stories/US-023-templates-that-style-the-document.md.
import {describe, expect, it} from 'vitest';
import {prepareNote, type PrepareDeps} from '../../src/plugin/prepare-note';
import {preparePreview} from '../../src/plugin/preview/request';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {standIn} from '../support/convert';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';
const PRESET = `${FOLDER}/MU.md`;
const NOTE = 'Sample/Rules.md';
const SOURCE = '# Rules\n\n## Tessera\n\nText.\n';
const OWN = 'Obsidian2Typst/templates/A5 MU Print.typ';
const DEFAULTS = 'Styles/default.typ';

const HOOK_TEMPLATE = [
  '#let mu-gold = rgb("#C9A44A")',
  '#let template(doc) = {',
  '  set page(fill: rgb("#FEFCF0"))',
  '  show heading.where(level: 2): set text(fill: mu-gold)',
  '  doc',
  '}',
  '',
].join('\n');
const PLAIN_TEMPLATE = '#let accent = rgb("#336699")\n';
const RULE_TEMPLATE = '#let accent = 1\n#set page(fill: rgb("#FEFCF0"))\n';

const HOOK = '#show: template';
const IMPORT = '#import "template.typ": *';

const presetNote = (template: string | null): string =>
  [
    '---',
    'schemaVersion: 1',
    ...(template === null ? [] : [`template: ${template}`]),
    '---',
    '',
  ].join('\n');

/** A vault with the preset `MU` active and the template texts in `texts`. */
async function rig(template: string | null, texts: Record<string, string>) {
  const vault = new FakeVault({[PRESET]: presetNote(template)}, [FOLDER]);
  const files = new Map(Object.entries(texts));
  const data: PluginData = JSON.parse(
    JSON.stringify(DEFAULT_PLUGIN_DATA),
  ) as PluginData;
  data.activePreset = 'MU';
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
      files: () => [NOTE, ...files.keys()],
      readHead: async (path, length = 16) => standIn(path).subarray(0, length),
      readBytes: async (path) => standIn(path),
      readText: async (path) => files.get(path) ?? null,
    },
    presets,
    settings: {
      get data() {
        return data;
      },
      setLastExportFolder: async () => undefined,
    },
  };
  return {data, files, deps};
}

const none = {downsample: async () => null};

async function prepared(deps: PrepareDeps) {
  const result = await prepareNote(deps, NOTE);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

describe('US-023 AC-1, AC-2, AC-9 where the template comes from (SCAR-019)', () => {
  it('US-023 AC-1, AC-9: a hook template set in the preset gives the hook line right after the import', async () => {
    const {deps} = await rig(OWN, {[OWN]: HOOK_TEMPLATE});
    const result = await prepared(deps);
    const lines = result.typ.split('\n');
    expect(lines[1]).toBe(IMPORT);
    expect(lines[2]).toBe(HOOK);
    expect(result.template).toBe(HOOK_TEMPLATE);
  });

  it('US-023 AC-9: a hook template set only in the Defaults gives the hook line too', async () => {
    const {deps, data} = await rig(null, {[DEFAULTS]: HOOK_TEMPLATE});
    data.defaults = {template: DEFAULTS};
    const lines = (await prepared(deps)).typ.split('\n');
    expect(lines[1]).toBe(IMPORT);
    expect(lines[2]).toBe(HOOK);
  });

  it('US-023 AC-2, AC-9: the preset template wins over the Defaults: a plain preset template gives no hook although the Defaults one has it', async () => {
    const {deps, data} = await rig(OWN, {
      [OWN]: PLAIN_TEMPLATE,
      [DEFAULTS]: HOOK_TEMPLATE,
    });
    data.defaults = {template: DEFAULTS};
    const result = await prepared(deps);
    expect(result.typ.split('\n')[1]).toBe(IMPORT);
    expect(result.typ).not.toContain(HOOK);
  });

  it('US-023 AC-2, AC-9: no template and a missing template give neither line', async () => {
    const unset = await prepared((await rig(null, {})).deps);
    expect(unset.typ).not.toContain(IMPORT);
    expect(unset.typ).not.toContain(HOOK);
    const missing = await prepared((await rig(OWN, {})).deps);
    expect(missing.typ).not.toContain(IMPORT);
    expect(missing.typ).not.toContain(HOOK);
    expect(missing.warnings.map((w) => w.code)).toContain('TEMPLATE_MISSING');
  });
});

describe('US-023 AC-5 the warning reaches the export', () => {
  it('US-023 AC-5: a template with a top-level rule is still imported, and the warning names the line', async () => {
    const {deps} = await rig(OWN, {[OWN]: RULE_TEMPLATE});
    const result = await prepared(deps);
    expect(result.typ.split('\n')[1]).toBe(IMPORT);
    expect(result.typ).not.toContain(HOOK);
    expect(result.warnings).toContainEqual({
      code: 'TEMPLATE_RULE_IGNORED',
      message:
        'Template rule at line 2 does not apply; put it inside template(doc)',
      line: 0,
    });
  });
});

describe('US-023 AC-7 the preview is the export', () => {
  it('US-023 AC-7: the preview compiles the same document as the export, with the same template copy', async () => {
    const {deps} = await rig(OWN, {[OWN]: HOOK_TEMPLATE});
    const exported = await prepared(deps);
    const preview = await preparePreview(deps, NOTE, none);
    if (!preview.ok) throw new Error('preview');
    expect(preview.request.source).toBe(exported.typ);
    expect(preview.request.source.split('\n')[2]).toBe(HOOK);
    expect(
      new TextDecoder().decode(preview.request.files['template.typ']),
    ).toBe(HOOK_TEMPLATE);
  });

  it('US-023 AC-7, SCAR-016: a template edited between two previews: the next one reads the new text (no hook, then the hook)', async () => {
    const {deps, files} = await rig(OWN, {[OWN]: PLAIN_TEMPLATE});
    const before = await preparePreview(deps, NOTE, none);
    if (!before.ok) throw new Error('before');
    expect(before.request.source).not.toContain(HOOK);
    files.set(OWN, HOOK_TEMPLATE);
    const after = await preparePreview(deps, NOTE, none);
    if (!after.ok) throw new Error('after');
    expect(after.request.source.split('\n')[2]).toBe(HOOK);
  });
});
