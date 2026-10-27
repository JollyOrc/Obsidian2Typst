// US-023 AC-1, AC-2, AC-5, AC-6, AC-10 — the template hook in the core: which
// template defines `template`, the line the pipeline writes for it, the
// warning for top-level rules, and the name. The PDF facts are in
// tests/integration/us-023-template-hook-pdf.test.ts, the export and the
// preview in tests/plugin/us-023-template-hook-preview.test.ts.
// Source of truth: docs/user-stories/US-023-templates-that-style-the-document.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {ConvertSettings} from '../../src/core/convert';
import type {Warning} from '../../src/core/emit';
import * as template from '../../src/core/template';
import {COMPOSED_NOTE, SETTINGS, run} from '../support/convert';

/** US-023: shapes of code that does not exist yet (red until the code). */
type DefinesHook = (text: string) => boolean;
const definesTemplateHook = (text: string): boolean => {
  const fn = (template as unknown as Record<string, DefinesHook>)[
    'definesTemplateHook'
  ];
  expect(typeof fn, 'definesTemplateHook').toBe('function');
  return (fn as DefinesHook)(text);
};
/** The settings with the template present and, when `hook`, the hook. */
const withTemplate = (hook: boolean): ConvertSettings =>
  ({...SETTINGS, template: true, templateHook: hook}) as ConvertSettings;

const HOOK = '#show: template';
const IMPORT = '#import "template.typ": *';

describe('US-023 AC-1 which template defines the hook', () => {
  it('US-023 AC-1: a top-level `#let template` defines it, in every form the definition scan finds', () => {
    for (const text of [
      '#let template(doc) = {\n  set page(fill: rgb("#FEFCF0"))\n  doc\n}\n',
      '#let mu-gold = rgb("#C9A44A")\n#let template(doc) = doc\n',
      '#let template = (doc) => doc\n',
      '﻿#let template(doc) = doc',
      '#let accent = 1\r\n#let template(doc) = doc\r\n',
      '#let\ttemplate(doc) = doc',
    ]) {
      expect(definesTemplateHook(text), JSON.stringify(text)).toBe(true);
    }
  });

  it('US-023 AC-2: other names, indented or commented definitions and an empty template do not', () => {
    for (const text of [
      '#let accent = rgb("#336699")\n',
      '#let templates(doc) = doc\n',
      '#let template-mu(doc) = doc\n',
      '  #let template(doc) = doc\n',
      '// #let template(doc) = doc\n',
      '#letemplate(doc) = doc\n',
      '',
    ]) {
      expect(definesTemplateHook(text), JSON.stringify(text)).toBe(false);
    }
  });
});

describe('US-023 AC-1, AC-2 the line the pipeline writes', () => {
  it('US-023 AC-1: with the hook, `#show: template` is the line right after the import, once', async () => {
    const result = await run('# Rules\n\nText.', {
      settings: withTemplate(true),
    });
    const lines = result.typ.split('\n');
    expect(lines[1]).toBe(IMPORT);
    expect(lines[2]).toBe(HOOK);
    expect(lines[3]).toMatch(/^#set page\(width: /);
    expect(lines.filter((line) => line === HOOK)).toHaveLength(1);
  });

  it('US-023 AC-1, AC-3: the hook comes before every rule the plugin generates (the composed note)', async () => {
    const result = await run(COMPOSED_NOTE, {settings: withTemplate(true)});
    const lines = result.typ.split('\n');
    const hook = lines.indexOf(HOOK);
    expect(hook).toBe(2);
    const firstRule = lines.findIndex((line) => /^#(set|show|let) /.test(line));
    expect(firstRule).toBeGreaterThan(hook);
  });

  it('US-023 AC-2: a template without the hook is imported as before, with no hook line', async () => {
    const result = await run('# Rules\n\nText.', {
      settings: withTemplate(false),
    });
    const lines = result.typ.split('\n');
    expect(lines[1]).toBe(IMPORT);
    expect(lines[2]).toMatch(/^#set page\(width: /);
    expect(result.typ).not.toContain(HOOK);
  });

  it('US-023 AC-2, AC-9: no template (missing or unset) writes neither line, also with the hook flag set', async () => {
    for (const settings of [
      SETTINGS,
      {...SETTINGS, templateHook: true} as ConvertSettings,
      {...SETTINGS, template: false, templateHook: true} as ConvertSettings,
    ]) {
      const result = await run('# Rules\n\nText.', {settings});
      expect(result.typ).not.toContain(IMPORT);
      expect(result.typ).not.toContain(HOOK);
    }
  });
});

describe('US-023 AC-5 top-level rules get a warning', () => {
  const ignored = (line: number): Warning => ({
    code: 'TEMPLATE_RULE_IGNORED',
    message: `Template rule at line ${line} does not apply; put it inside template(doc)`,
    line: 0,
  });

  it('US-023 AC-5: `#set` and `#show` at line start, with the template line in the message', () => {
    const text = [
      '#let mu-ink = rgb("#1A1A1A")', // 1
      '#set page(fill: rgb("#FEFCF0"))', // 2
      '#show heading: set text(fill: red)', // 3
      '#show: x => x', // 4
      '#set text(fill: mu-ink)', // 5
    ].join('\n');
    expect(template.templateWarnings(text)).toEqual([
      ignored(2),
      ignored(3),
      ignored(4),
      ignored(5),
    ]);
  });

  it('US-023 AC-5: the story example: a rule at line 12', () => {
    const lines = Array.from({length: 11}, (_, i) => `#let v${i} = ${i}`);
    lines.push('#set page(fill: rgb("#FEFCF0"))');
    expect(template.templateWarnings(lines.join('\n'))).toEqual([ignored(12)]);
  });

  it('US-023 AC-5: no warning for indented rules inside the hook, other names, comments or a template without rules', () => {
    for (const text of [
      '#let template(doc) = {\n  set page(fill: rgb("#FEFCF0"))\n  show heading: set text(fill: red)\n  doc\n}\n',
      '#showcase()\n#settings\n#set-up\n',
      '#let template(doc) = [\n  #set text(fill: red)\n  #doc\n]\n',
      '// #set page(fill: red)\n',
      '#let accent = 1\n',
      '',
    ]) {
      expect(template.templateWarnings(text), JSON.stringify(text)).toEqual([]);
    }
  });

  it('US-023 AC-5: a rule on the first line after a byte-order mark, and a rule before a definition, keep their line and their order', () => {
    expect(template.templateWarnings('\uFEFF#set text(size: 11pt)\n')).toEqual([
      ignored(1),
    ]);
    expect(
      template
        .templateWarnings('#set text(size: 11pt)\n#let quote(b) = b\n')
        .map((w) => w.code),
    ).toEqual(['TEMPLATE_RULE_IGNORED', 'TEMPLATE_SHADOWS_BUILTIN']);
  });

  it('US-023 AC-5 (decision 1): a rule at line start inside a content-block template is warned about too', () => {
    const text = '#let template(doc) = [\n#set text(fill: red)\n#doc\n]\n';
    expect(template.templateWarnings(text)).toEqual([ignored(2)]);
  });

  it('US-023 AC-5: with and without the hook; a byte-order mark and `\\r\\n` keep the line numbers; in line order with the other template warnings', () => {
    const text =
      '﻿#let quote(b) = b\r\n#set text(size: 11pt)\r\n#let template(doc) = doc\r\n#show: template\r\n';
    expect(
      template.templateWarnings(text).map((w) => [w.code, w.message]),
    ).toEqual([
      [
        'TEMPLATE_SHADOWS_BUILTIN',
        'Template line 1 defines "quote", which shadows a Typst built-in',
      ],
      [
        'TEMPLATE_RULE_IGNORED',
        'Template rule at line 2 does not apply; put it inside template(doc)',
      ],
      [
        'TEMPLATE_RULE_IGNORED',
        'Template rule at line 4 does not apply; put it inside template(doc)',
      ],
    ]);
  });

  it('US-023 AC-5 (decision 1): the code is listed as active for US-023 in docs/technical/warning-codes.md, with the content-block case', () => {
    const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
    const row = text
      .split('\n')
      .find((line) => line.startsWith('| `TEMPLATE_RULE_IGNORED` |'));
    expect(row).toBeDefined();
    expect(row).toContain('US-023 AC-5');
    expect(row).toContain('active');
    expect(row).toContain('content block');
  });
});

describe('US-023 AC-6, AC-10 the name and the corrected story', () => {
  it('US-023 AC-6: `template` is neither a Typst standard-library name nor a name the plugin defines', () => {
    expect(template.STD_NAMES).not.toContain('template');
    expect(template.PLUGIN_NAMES).not.toContain('template');
    expect(template.templateWarnings('#let template(doc) = doc\n')).toEqual([]);
  });

  it('US-023 AC-6: the generated document never defines `template` (the composed note, every rule on)', async () => {
    const result = await run(COMPOSED_NOTE, {settings: withTemplate(true)});
    expect(result.typ).not.toMatch(/^#let template\b/m);
  });

  it('US-023 AC-10: US-008 AC-9 says the definitions are available and the rules apply through template(doc)', () => {
    const story = readFileSync(
      'docs/user-stories/US-008-presets-and-settings.md',
      'utf8',
    ).replace(/\s+/g, ' ');
    expect(story).not.toContain(
      "the template's functions and rules are available",
    );
    expect(story).toContain(
      "the template's definitions are available; its rules apply through `template(doc)` (US-023)",
    );
  });
});
