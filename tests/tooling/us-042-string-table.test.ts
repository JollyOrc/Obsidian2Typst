// US-042 AC-14 — one string table: no file of `src/plugin` but `strings.ts` hands
// a string literal (quoted or a template) to a text sink: `setName`, `setDesc`,
// `setButtonText`, `setTooltip`, `setText`, `setTitle`, `setPlaceholder`,
// `new Notice`, a `notice(` call, the ribbon icon's title; or writes one into a
// shown field: `title`, `text`, `label`, `name`, `desc`, `hint`, `confirmLabel`,
// `cancelLabel`, a question's `lines`, a feature's `rows` (row labels). Widened
// at T6 on the owner's word (2026-11-18): AC-14 names every user-facing text,
// not only the first seven sinks. A text check over the sources (SCAR-017:
// every place listed by the check itself); comments are not read. A text built
// in a variable first is out of its reach and was moved by reading the files.
// Source of truth: docs/user-stories/US-042-ui-standard.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const ROOT = 'src/plugin';
const TABLE = join(ROOT, 'strings.ts');
/**
 * Not the plugin's screens: these draw the book's own content (the statblock
 * and details blocks of a note, as printed), which AC-14 does not name.
 */
const BOOK_CONTENT = [
  join(ROOT, 'entries', 'processor.ts'),
  join(ROOT, 'details', 'processor.ts'),
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** A call of a text sink whose first argument starts with a literal. */
const SINK =
  /(?:\.(?:setName|setDesc|setButtonText|setTooltip|setText|setTitle|setPlaceholder)|new Notice|\bnotice)\(\s*['"`]/g;
/** The ribbon icon's title (its second argument). */
const RIBBON = /\baddRibbonIcon\([^,()]+,\s*['"`]/g;
/**
 * A shown field written as a literal. The colon right after the name: a
 * ternary's `a ? item.desc : 'x'` has a space before it and is not one.
 */
const FIELD =
  /(?<![.\w])(?:title|text|label|name|desc|hint|confirmLabel|cancelLabel):\s*['"`]/g;
/** A question's lines and a feature's row labels as literal array items. */
const LIST = /(?<![.\w])(?:lines|rows):\s*\[\s*['"`]|\blines\.push\(\s*['"`]/g;

/** The source with its comments blanked (line breaks kept for the line numbers). */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** `file:line: the call` for each literal handed to a sink or a shown field. */
function findings(path: string, source: string): string[] {
  const text = withoutComments(source);
  const out: string[] = [];
  for (const pattern of [SINK, RIBBON, FIELD, LIST]) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      const shown = text
        .slice(match.index, (match.index ?? 0) + 60)
        .split('\n')[0];
      out.push(`${path}:${line}: ${shown}`);
    }
  }
  return out;
}

describe('US-042 AC-14: one string table', () => {
  it('the table exists', () => {
    expect(() => statSync(TABLE)).not.toThrow();
  });

  it('no literal reaches a text sink outside strings.ts', () => {
    const found = files(ROOT)
      .filter((path) => path !== TABLE && !BOOK_CONTENT.includes(path))
      .flatMap((path) => findings(path, readFileSync(path, 'utf8')));
    expect(found).toEqual([]);
  });

  // Added at T6 (SCAR-023): the move changed no wording ("no text changes
  // except those the story names"); these texts were read by no test before.
  it('the texts moved at T6 keep their wording', async () => {
    const {STRINGS} = await import('../../src/plugin/strings');
    expect([
      STRINGS.notices.compiling,
      STRINGS.tab.active,
      STRINGS.tab.invalidPreset(STRINGS.tab.unknownError),
      STRINGS.tab.presetsFolderDesc,
      STRINGS.tab.warningsFolderDesc,
      STRINGS.rows.useBuiltin,
      STRINGS.rows.pages,
      STRINGS.rows.pagesDesc,
      STRINGS.nameModal.name,
      STRINGS.nameModal.ok,
      STRINGS.panel.refresh,
    ]).toEqual([
      'Compiling…',
      'Active',
      'invalid: unknown error',
      'Vault folder of the preset notes. Created with two presets when it does not exist.',
      'Vault folder of the warnings note; empty is the vault root.',
      'Use the built-in value',
      'Pages',
      'all, a page such as 4, or a range such as 3-5',
      'Name',
      'OK',
      'Refresh',
    ]);
  });

  // Added at T6 widened (SCAR-023): every table text was changed in turn (224
  // mutants); these 35 were read by no other test, so their wording is pinned
  // here. The move itself changed no wording (compared with HEAD by script).
  it('the texts no other test reads keep their wording', async () => {
    const {STRINGS: S} = await import('../../src/plugin/strings');
    expect([
      S.dialog.folderPlaceholder,
      S.notices.debugInfoCopied,
      S.tab.presetsIntro,
      S.rows.fontsUnlisted('E'),
      S.rows.pagesPlaceholder,
      S.hints.size,
      S.hints.fontFolder,
      S.hints.highlightColour,
      S.hints.headingNumbering,
      S.hints.templateFile,
      S.hints.trimSize,
      S.hints.minimumPrintResolution,
      S.menus.coverOf('N'),
      S.details.invalid,
      ...S.details.columns,
      S.details.sources.preset,
      S.details.sources.Defaults,
      S.details.sources['built-in'],
      S.details.usedFrom('U', 'S'),
      S.presets.notChanged('P', 'M'),
      S.presets.unreadable('W'),
      S.exportDialogText.folderDialogTitle,
      S.exportDialogText.noFolderDialog,
      S.compiler.cancelled,
      S.compiler.gapScanFailed('T'),
      S.vault.noNote('/a'),
      S.vault.noFile('/b'),
      S.preview.title,
      S.preview.openNote,
      S.preview.noPages,
      S.preview.stopped(1),
      S.preview.stopped(2),
      S.preview.setByPreset('V', 'P'),
      S.preview.builtinValue('V'),
    ]).toEqual([
      '/path/to/export folder',
      'Debug info copied.',
      'A preset is a note in the presets folder. Edit its values in the note itself; they apply to the next export.',
      'The fonts cannot be listed: E',
      'all',
      'pt, greater than 0 and at most 200',
      'vault folder with .ttf and .otf files',
      '#rrggbb',
      '1.1, a.1, (1.1) or none',
      'path of a .typ file in the vault',
      'A4, A5, A6 or US Letter',
      'dpi, 0 to 2400',
      'Use "N" as cover',
      'The preset is invalid',
      'Setting',
      'In this preset',
      'Used',
      'preset',
      'Defaults',
      'built-in',
      'U (S)',
      'Preset "P" was not changed: M',
      'The preset could not be read: W',
      'Export folder',
      'The folder dialog is not available',
      'the compile was cancelled',
      'The word-gap scan could not read the PDF (T); no line was checked',
      'No such note: /a',
      'No such file: /b',
      'Style preview',
      'Open a note to preview it',
      'The document has no pages',
      'Preview stopped: 1 warning (strict mode)',
      'Preview stopped: 2 warnings (strict mode)',
      'V; set by preset "P"; change it in the preset note',
      'V; built-in value; set it in a preset note',
    ]);
  });

  // The check checks itself (SCAR-023): it finds each kind of sink, in each quote.
  it.each([
    [".setName('Export')"],
    ['.setDesc("Text")'],
    ['.setButtonText(`Reset`)'],
    [".setTooltip('Copy debug info')"],
    [".setText('Exported')"],
    ["new Notice('Debug info copied.')"],
    ['deps.notice(`❌ Export failed: ${m}`)'],
    ["host.notice(\n  'An export is already running.')"],
    // Widened at T6.
    [".setTitle('Export to PDF')"],
    [".setPlaceholder('all')"],
    ["this.addRibbonIcon('printer', 'Obsidian2Typst', (evt) => {"],
    ["{title: 'Export…', icon: 'x'}"],
    ["{text: 'Close', run: close}"],
    ["  label: 'Bleed (mm)',"],
    ["  name: 'Page setup',"],
    ["  desc: 'Trim size, margins, bleed and facing pages.',"],
    ["  hint: '1 to 6',"],
    ["  confirmLabel: 'Delete',"],
    ['  cancelLabel: `Cancel`,'],
    ["  lines: ['The note moves to the trash.'],"],
    ["  rows: ['Link page level', 'Link page word'],"],
    ['lines.push(`${next} becomes the active preset.`);'],
  ])('finds %s', (call) => {
    expect(findings('x.ts', call)).toHaveLength(1);
  });

  it.each([
    ['.setName(STRINGS.export)'],
    ['.setDesc(text.desc)'],
    ['new Notice(message)'],
    ['host.notice(failedNotice(error))'],
    ['announce(`x`)'],
    // Widened at T6: what is not a shown text.
    ['const desc = owned === null ? item.desc : `${item.desc} ${owned}`;'],
    ["  kind: 'feature',"],
    ["  toggle: 'page.folios',"],
    ["  options: ['left', 'right'],"],
    ["el.createDiv({cls: 'o2t-tab-header'});"],
    ['/** The title: `Exporting <note>`. */'],
    ["// name: 'Page'"],
    ['  name: STRINGS.layout.page,'],
    ['  rows: [STRINGS.labels.bleed],'],
    ["const url = 'https://example.org'; // text: 'x'"],
  ])('does not find %s', (call) => {
    expect(findings('x.ts', call)).toEqual([]);
  });
});

// Added at T6 (owner, 2026-11-18): a text held in a variable, a thrown error
// that reaches a notice, or a list item escapes the sink and field patterns
// above. This check reads every literal that looks like a sentence or a
// capitalised word; each one left outside the table is named here with why it
// is not a screen or notice text.
/** A literal that reads like a text: two words, or a capitalised word. */
const SENTENCE = /[A-Za-z]{2,} [A-Za-z(]|^[A-Z][a-z]/;
const LITERAL =
  /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\\n]|\\.)*)"/g;

/** `file: text`, and why it stays where it is. */
const NOT_SCREEN_TEXT: Record<string, string> = {
  'compiler/wasm-codec.ts: The embedded compiler is not valid base64':
    'a build fault, not a user situation',
  'compiler/worker-core.ts: compile before init': 'the worker protocol',
  "compiler/worker-core.ts: the compiler returned no ${vector ? 'vector document' : 'PDF'}":
    'the worker protocol',
  'compiler/worker-core.ts: font-info before init': 'the worker protocol',
  'debug-info.ts: Obsidian2Typst ${facts.pluginVersion}':
    "the debug info's own format (AC-12)",
  'debug-info.ts: Obsidian ${facts.obsidianVersion}':
    "the debug info's own format (AC-12)",
  'debug-info.ts: Enabled plugins:': "the debug info's own format (AC-12)",
  'debug-info.ts: Settings file:': "the debug info's own format (AC-12)",
  'debug-info.ts: (no settings file)': "the debug info's own format (AC-12)",
  'disk-writer.ts: Refusing to write outside the export folder: ${path}':
    'a guard against a programming fault',
  'export-dialog/rules.ts: Escape': 'a key name',
  'export-dialog/rules.ts: Enter': 'a key name',
  'settings/dialog.ts: Enter': 'a key name',
  'main.ts: = Compiler check\\n\\nHello from the embedded compiler.\\n':
    'the developer command (Typst source)',
  'main.ts: PDF ${new TextDecoder().decode(result.pdf.subarray(0, 5))}, ${result.pdf.length} bytes':
    'the developer command',
  'main.ts: ${new Date().toISOString()}: ${outcome}; ${seconds} s; longest gap ${Math.round(longestGap)} ms':
    'the developer command',
  'preview/browser-downsample.ts: image not decoded (${extension}): ${String(error)}':
    'a console diagnostic',
  'preview/canvas.ts: The preview needs a 2D canvas': 'a platform fault',
  'preview/canvas.ts: canvas ${width}×${height} px (${effective.toFixed(2)} px/pt)':
    'a console diagnostic',
  'preview/canvas.ts: scratch canvas ${width}×${height} px':
    'a console diagnostic',
  'preview/panel.ts: page ${page} not drawn: ${String(error)}':
    'a console diagnostic',
  'preview/renderer.ts: The preview document was released':
    'a programming fault',
  'preview/renderer.ts: The document has no page ${number}':
    'a programming fault',
  'settings/data.ts: Obsidian2Typst/presets':
    'a value: the default presets folder',
  'settings/details.ts: Defaults':
    'a type tag (`DetailSource`); shown through STRINGS.details.sources',
  'settings/details.ts: no row ${label}': 'a programming fault',
  'settings/rows.ts: no row ${label}': 'a programming fault',
  'settings/rows.ts: no row for ${item.toggle}': 'a programming fault',
  'settings/rows.ts: The range field was not made': 'a programming fault',
};

/** The sentence-like literals of a source, comments blanked, CSS classes skipped. */
function sentences(source: string): string[] {
  const text = withoutComments(source);
  const out: string[] = [];
  for (const match of text.matchAll(LITERAL)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    const before = text.slice(
      Math.max(0, (match.index ?? 0) - 12),
      match.index,
    );
    if (/\bcls:\s*$|Class\(\s*$|^import\b/.test(before)) continue;
    if (
      /^\s*import\b/.test(
        text.slice(text.lastIndexOf('\n', match.index) + 1, match.index),
      )
    )
      continue;
    if (SENTENCE.test(value)) out.push(value);
  }
  return out;
}

describe('US-042 AC-14: no text outside the table (T6, widened)', () => {
  const found = files(ROOT)
    .filter((path) => path !== TABLE && !BOOK_CONTENT.includes(path))
    .flatMap((path) =>
      sentences(readFileSync(path, 'utf8')).map(
        (value) => `${path.slice(ROOT.length + 1)}: ${value}`,
      ),
    );

  it('every sentence-like literal left in src/plugin is a named exemption', () => {
    expect(found.filter((entry) => !(entry in NOT_SCREEN_TEXT))).toEqual([]);
  });

  it('every exemption is still in the source (no stale entry)', () => {
    expect(
      Object.keys(NOT_SCREEN_TEXT).filter((entry) => !found.includes(entry)),
    ).toEqual([]);
  });

  // The check checks itself (SCAR-023).
  it.each([
    ["const why = 'There is no preset';"],
    ['throw new Error(`Preset "${name}" does not exist`);'],
    ["const RESET = 'Some settings were reset';"],
    ["for (const t of ['Setting', 'Used']) {}"],
  ])('reads %s', (code) => {
    expect(sentences(code).length).toBeGreaterThan(0);
  });

  it.each([
    ["el.createDiv({cls: 'setting-item-description mod-warning'});"],
    ["import {STRINGS} from '../strings';"],
    ["kind: 'feature',"],
    ['// A preset is a note.'],
    ["if (event.key === 'x') {}"],
  ])('skips %s', (code) => {
    expect(sentences(code)).toEqual([]);
  });
});

// Added at T6 (owner, 2026-11-18: "notices only, own core table"): the core's
// texts that become notices come from `src/core/strings.ts`, which the plugin's
// table carries as `STRINGS.core` (one table; the core imports nothing of the
// plugin). Preset validation messages and conversion warnings stay in the core.
const CORE_NOTICES: readonly [file: string, starts: readonly string[]][] = [
  [
    'src/core/report/index.ts',
    [
      'export function finishedNotice(',
      'export function failedNotice(',
      'export const CANCELLED_NOTICE',
      'export function strictNotice(',
      'const plural =',
    ],
  ],
  ['src/core/compile/settle.ts', ['export function compilingNotice(']],
  ['src/core/compile/index.ts', ['export function formatCompileError(']],
  ['src/core/presets/parse.ts', ['export const NUMBERING_NOTICE']],
];

/** The declaration that starts at `start` (a function or a constant). */
function declaration(source: string, start: string): string {
  const at = source.indexOf(start);
  if (at < 0) throw new Error(`not found: ${start}`);
  const rest = source.slice(at);
  // A function ends at its closing brace line, a constant at its first `;`.
  const end = (start.includes('function') ? /\n\}\n/ : /;\n/).exec(rest);
  return rest.slice(0, end === null ? undefined : end.index + 2);
}

/** The literals of a source that hold a word (two letters in a row). */
function words(source: string): string[] {
  const text = withoutComments(source);
  return [...text.matchAll(LITERAL)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    .filter((value) => /[A-Za-z]{2,}/.test(value.replace(/\$\{[^}]*\}/g, '')));
}

describe("US-042 AC-14: the core's notice texts (T6)", () => {
  it.each(
    CORE_NOTICES.flatMap(([file, starts]) => starts.map((s) => [file, s])),
  )('%s: %s has no text of its own', (file, start) => {
    // Stricter than `sentences`: a notice may start with ✅ or a value, so
    // any literal with a word in it counts here.
    expect(words(declaration(readFileSync(file, 'utf8'), start))).toEqual([]);
  });

  it('the core table imports nothing; the plugin table carries it', async () => {
    expect(readFileSync('src/core/strings.ts', 'utf8')).not.toMatch(
      /^import /m,
    );
    const {STRINGS} = await import('../../src/plugin/strings');
    const {CORE_STRINGS} = await import('../../src/core/strings');
    expect(STRINGS.core).toBe(CORE_STRINGS);
  });
});
