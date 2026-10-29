// US-020: the entries of the ribbon menu and the note menus, as data. No
// Obsidian import: `main.ts` draws the entries with Obsidian's `Menu` in one
// function (`showEntries`), and the tests read them as they are. Every entry
// calls an action (`actions.ts`); a preset entry holds only the name, so the
// action reads the store when it is clicked (SCAR-016).
import {extensionOf, SUPPORTED_IMAGE_EXTENSIONS} from '../core/assets';
import type {LineContext} from '../core/convert';
import {headingRuleKey, headingRuleTable} from '../core/markers';
import {
  contentsAction,
  coverAction,
  groupPresets,
  headingRuleAction,
  isPresetNote,
  pickActive,
  type PresetChangePlan,
  type PresetFields,
} from '../core/presets';
import type {Actions} from './actions';

/** One line of a menu: an item, a label, or a separator. */
export interface MenuEntry {
  title?: string;
  /** A Lucide icon name, as Obsidian takes it. */
  icon?: string;
  checked?: boolean;
  disabled?: boolean;
  /** A heading line that cannot be clicked. */
  label?: boolean;
  separator?: boolean;
  /** What a click does; absent for labels, separators and disabled items. */
  run?: () => Promise<unknown>;
}

/** The presets as the ribbon menu shows them, read when the menu opens. */
export interface PresetsView {
  /** In settings order (the store's `entries()`); `group` as US-021 reads it. */
  names: readonly {name: string; valid: boolean; group?: string | null}[];
  /** The stored active preset (`activePreset` of the plugin data). */
  stored: string;
}

/**
 * US-020 | AC-3, AC-4, AC-5: The entries of the ribbon menu.
 *
 * `Export current note` and `Open style panel` (no path: the active note and
 * the panel alone), a separator, the label `Preset`, then every preset in the
 * given order: the one `pickActive` gives is checked (the stored name, or the
 * first name when it no longer exists, valid or not — the preset an export
 * would use), an invalid one is titled `<name> (invalid)` and disabled. With
 * no preset: one disabled `No preset yet`. Built anew for each click.
 * US-021 AC-5: while presets are grouped (`groupPresets`), the `Preset` label
 * gives way to a separator and a label per group, each followed by its
 * presets; without groups the entries are those of US-020.
 */
export function ribbonMenuEntries(
  actions: Actions,
  presets: PresetsView,
): MenuEntry[] {
  const entries: MenuEntry[] = [
    {
      title: 'Export current note',
      icon: 'file-output',
      run: () => actions.exportNote(),
    },
    {
      title: 'Open style panel',
      icon: 'panel-right',
      run: () => actions.previewNote(),
    },
  ];
  if (presets.names.length === 0) {
    entries.push(
      {separator: true},
      {title: 'Preset', label: true},
      {title: 'No preset yet', disabled: true},
    );
    return entries;
  }
  const active = pickActive(
    presets.names.map((entry) => entry.name),
    presets.stored,
  );
  const groups = groupPresets(
    presets.names.map((entry) => ({...entry, group: entry.group ?? null})),
  );
  for (const group of groups) {
    entries.push(
      {separator: true},
      {title: group.heading ?? 'Preset', label: true},
    );
    for (const {name, valid} of group.entries) {
      entries.push(
        valid
          ? {
              title: name,
              checked: name === active,
              run: () => actions.usePreset(name),
            }
          : {
              title: `${name} (invalid)`,
              checked: name === active,
              disabled: true,
            },
      );
    }
  }
  return entries;
}

/**
 * US-020 | AC-6, AC-7: The entries of the file explorer and editor menus for
 * `file`.
 *
 * `Export to PDF` and `Preview` for a Markdown note (extension `md` in any
 * case) outside `presetsFolder`; nothing for a folder, another file or a
 * preset note. The entries pass the clicked note's path to the actions.
 */
export function noteMenuEntries(
  actions: Actions,
  file: {path: string; folder: boolean},
  presetsFolder: string,
): MenuEntry[] {
  if (
    file.folder ||
    !/\.md$/i.test(file.path) ||
    isPresetNote(file.path, presetsFolder)
  ) {
    return [];
  }
  return [
    {
      title: 'Export to PDF',
      icon: 'file-output',
      run: () => actions.exportNote(file.path),
    },
    {
      title: 'Preview',
      icon: 'panel-right',
      run: () => actions.previewNote(file.path),
    },
  ];
}

/** US-022 AC-6: the active preset as the menus see it when they open. */
export interface ActivePresetView {
  /** `pickActive` over the store's entries; null without presets. */
  name: string | null;
  valid: boolean;
  /** The preset's own fields when it is valid, else null. */
  fields: PresetFields | null;
  /**
   * US-027 AC-7: the Defaults, for the effective contents depth (decision 3:
   * the item also sets depth 2 while the contents are off). Missing: none.
   */
  defaults?: PresetFields | null;
}

/**
 * US-022 | AC-6, AC-9: The active preset for the editor and file explorer
 * menus, read from the store's `entries` and the stored name when a menu
 * opens (the menus are built synchronously, so this is what is in memory).
 * US-027 AC-7: with the Defaults (`defaults`, in memory too).
 * The action reads it again at `Change preset` (SCAR-016).
 */
export function activePresetView(
  entries: readonly {
    name: string;
    valid: boolean;
    preset?: {fields: PresetFields};
  }[],
  stored: string,
  defaults?: PresetFields | null,
): ActivePresetView {
  // only when given: the view of a caller without Defaults is as before
  const withDefaults = defaults === undefined ? {} : {defaults};
  const name = pickActive(
    entries.map((entry) => entry.name),
    stored,
  );
  const entry = entries.find((candidate) => candidate.name === name);
  return entry === undefined
    ? {name: null, valid: false, fields: null, ...withDefaults}
    : {
        name: entry.name,
        valid: entry.valid,
        fields: entry.valid ? (entry.preset?.fields ?? null) : null,
        ...withDefaults,
      };
}

/**
 * US-022 | AC-6: one entry for `plan` with `icon`: it calls `changePreset`
 * for the active preset; without a preset or with an invalid one it is
 * disabled and its title gives the reason (`title` is then the plain
 * `Use …` title, since an invalid preset's state is unknown).
 */
function presetEntry(
  actions: Pick<Actions, 'changePreset'>,
  active: ActivePresetView,
  icon: string,
  title: string,
  plan: () => PresetChangePlan,
): MenuEntry {
  const {name} = active;
  if (name === null) {
    return {title: `${title} (no preset)`, icon, disabled: true};
  }
  if (!active.valid) {
    return {
      title: `${title} (preset "${name}" is invalid)`,
      icon,
      disabled: true,
    };
  }
  const {title: shown, change, question} = plan();
  return {
    title: shown,
    icon,
    run: () => actions.changePreset({preset: name, change, question}),
  };
}

/**
 * US-022 | AC-1, AC-3, AC-6: The entries of the editor menu for the line of
 * the cursor (`context` from `lineContext`, built when the menu opens): the
 * heading item (`headingRuleAction`, icon `list`), on a top-level H1 that is
 * no colophon or back-notes heading the two contents items (`contentsAction`,
 * icon `list-ordered`; US-027 AC-7), and one cover item per
 * image (`coverAction`, icon `image`; with several images, titled with the
 * file name), in that order. Nothing for a line without either. The caller
 * leaves preset notes out (`isPresetNote`).
 */
export function presetEditEntries(
  actions: Pick<Actions, 'changePreset'>,
  context: LineContext,
  active: ActivePresetView,
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const {heading, images} = context;
  if (heading !== null) {
    entries.push(
      presetEntry(actions, active, 'list', 'Use as glossary section', () =>
        headingRuleAction(active.fields, heading.text, active.name ?? ''),
      ),
    );
    // US-027 AC-7: on an H1 that is no colophon or back-notes heading.
    const rule = headingRuleTable(active.fields?.headingRules ?? {}).get(
      headingRuleKey(heading.text),
    );
    if (heading.level === 1 && rule !== 'colophon' && rule !== 'back-notes') {
      for (const side of ['before', 'after'] as const) {
        entries.push(
          presetEntry(
            actions,
            active,
            'list-ordered',
            `Table of contents ${side} this heading`,
            () =>
              contentsAction(
                active.fields,
                active.defaults ?? null,
                heading.text,
                side,
                active.name ?? '',
              ),
          ),
        );
      }
    }
  }
  const several = images.length > 1;
  for (const path of images) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    entries.push(
      presetEntry(
        actions,
        active,
        'image',
        several ? `Use "${name}" as cover` : 'Use as cover',
        () => coverAction(active.fields, path, active.name ?? '', several),
      ),
    );
  }
  return entries;
}

/**
 * US-022 | AC-3, AC-6: The entries of the file explorer menu for the file at
 * `path`: one cover item for an image of a supported type (by its
 * extension; its bytes are read when the item is clicked, AC-9), nothing for
 * any other file.
 */
export function imageFileEntries(
  actions: Pick<Actions, 'changePreset'>,
  path: string,
  active: ActivePresetView,
): MenuEntry[] {
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extensionOf(path))) return [];
  return [
    presetEntry(actions, active, 'image', 'Use as cover', () =>
      coverAction(active.fields, path, active.name ?? '', false),
    ),
  ];
}
