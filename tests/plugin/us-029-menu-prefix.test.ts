// US-029 AC-10 — every item the plugin adds to the file explorer and editor
// menus is titled `O2T: ` and today's title; the ribbon menu keeps its titles
// (decision 1); labels and separators are not prefixed. One function makes
// the drawn title and `showEntries` is its only caller (SCAR-017). Source of
// truth: docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

interface MenuEntry {
  title?: string;
  icon?: string;
  label?: boolean;
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
  run?: () => unknown;
}
/** US-029: the function that does not exist yet (red until the code). */
interface MenusModule {
  /** The title drawn for `entry`; `marked`: a menu shared with others. */
  menuItemTitle(entry: MenuEntry, marked: boolean): string;
}
const load = async (): Promise<MenusModule> =>
  (await import(
    /* @vite-ignore */ '../../src/plugin/menus'
  )) as unknown as MenusModule;

const run = (): undefined => undefined;

describe('US-029 AC-10 the drawn title', () => {
  it.each([
    ['Export to PDF', {title: 'Export to PDF', icon: 'file-output', run}],
    ['Preview', {title: 'Preview', icon: 'panel-right', run}],
    ['Use as cover', {title: 'Use as cover', icon: 'image', run}],
    [
      'Use as cover (no preset)',
      {title: 'Use as cover (no preset)', icon: 'image', disabled: true},
    ],
    [
      'Stop using as glossary section',
      {title: 'Stop using as glossary section', icon: 'list', run},
    ],
    [
      'Table of contents before this heading',
      {
        title: 'Table of contents before this heading',
        icon: 'list-ordered',
        run,
      },
    ],
    [
      'Use "a.png" as cover',
      {title: 'Use "a.png" as cover', icon: 'image', run},
    ],
    [
      'Use as cover (preset "Broken" is invalid)',
      {
        title: 'Use as cover (preset "Broken" is invalid)',
        icon: 'image',
        disabled: true,
      },
    ],
  ] as const)(
    'US-029 AC-10: %s gets the O2T: prefix in a shared menu',
    async (title, entry) => {
      const {menuItemTitle} = await load();
      expect(menuItemTitle(entry, true)).toBe(`O2T: ${title}`);
    },
  );

  it('US-029 AC-10 (decision 1): the ribbon menu (not marked) keeps its titles', async () => {
    const {menuItemTitle} = await load();
    expect(
      menuItemTitle(
        {title: 'Export current note', icon: 'file-output', run},
        false,
      ),
    ).toBe('Export current note');
    expect(menuItemTitle({title: 'A5 print', checked: true, run}, false)).toBe(
      'A5 print',
    );
  });

  it('US-029 AC-10: a label is not prefixed, even in a shared menu', async () => {
    const {menuItemTitle} = await load();
    expect(menuItemTitle({title: 'Preset', label: true}, true)).toBe('Preset');
  });
});

describe('US-029 AC-10 one place adds the prefix (text checks, SCAR-017)', () => {
  const main = readFileSync('src/plugin/main.ts', 'utf8');
  const body = main.slice(main.indexOf('private showEntries('));
  const showEntries = body.slice(0, body.indexOf('\n  }\n'));

  it('US-029 AC-10: showEntries sets every title through menuItemTitle, marked when a section is given', () => {
    expect(showEntries).toContain(
      'item.setTitle(menuItemTitle(entry, section !== undefined))',
    );
    expect(main.split('.setTitle(').length - 1).toBe(1);
  });

  it('US-029 AC-10: the file and editor menus pass the section; the ribbon menu does not', () => {
    const calls = main.split('this.showEntries(').slice(1);
    const withSection = calls.filter((c) =>
      c.slice(0, c.indexOf(');')).includes("'obsidian2typst'"),
    );
    // ribbon; file menu: note items, image item; editor menu: note items,
    // line items (read 2026-10-31)
    expect(calls.length).toBe(5);
    expect(withSection.length).toBe(4);
    const ribbon = main.slice(main.indexOf('addRibbonIcon('));
    const ribbonCall = ribbon.slice(0, ribbon.indexOf('menu.showAtMouseEvent'));
    expect(ribbonCall).not.toContain("'obsidian2typst'");
  });

  it('US-029 AC-10: the prefix text O2T: stands in src/ only in menus.ts, once (no title carries it)', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (path.endsWith('.ts')) files.push(path);
      }
    };
    walk('src');
    // `O2T_BLANK_HELPER` and `O2T_PART_HELPER` (core/emit) are Typst helper
    // names, not menu text: the search is for the prefix with its colon.
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes('O2T:'));
    expect(hits).toEqual([join('src', 'plugin', 'menus.ts')]);
    const menus = readFileSync('src/plugin/menus.ts', 'utf8');
    expect(menus.split("'O2T: '").length - 1).toBe(1);
  });
});
