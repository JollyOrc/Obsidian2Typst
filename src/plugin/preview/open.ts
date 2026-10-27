// US-012 AC-1, AC-3: opening the single style panel and the choices of its preset
// selector, as plain functions over small interfaces so that tests run them
// without Obsidian.
import {groupPresets} from '../../core/presets';
import {statusLine, type StatusState} from '../../core/preview/status';

/** The view type of the style panel. */
export const VIEW_TYPE_STYLE_PANEL = 'obsidian2typst-style-panel';

/** The part of a workspace leaf that opening uses. */
export interface PanelLeaf {
  setViewState(state: {type: string; active?: boolean}): Promise<void>;
}

/** The part of the workspace that opening uses. */
export interface PanelWorkspace {
  getLeavesOfType(type: string): PanelLeaf[];
  /** A new leaf in the right sidebar, or null when there is none. */
  getRightLeaf(): PanelLeaf | null;
  revealLeaf(leaf: PanelLeaf): Promise<void>;
}

/**
 * US-012 AC-1: shows the style panel; an open panel is shown again, never a
 * second one is made. Returns false when there is no leaf in the right sidebar.
 */
export async function openStylePanel(
  workspace: PanelWorkspace,
): Promise<boolean> {
  let leaf: PanelLeaf | undefined = workspace.getLeavesOfType(
    VIEW_TYPE_STYLE_PANEL,
  )[0];
  if (leaf === undefined) {
    const made = workspace.getRightLeaf();
    if (made === null) return false;
    await made.setViewState({type: VIEW_TYPE_STYLE_PANEL, active: true});
    leaf = made;
  }
  await workspace.revealLeaf(leaf);
  return true;
}

/** One entry of the preset selector. */
export interface PresetChoice {
  name: string;
  /** False for an invalid preset: listed greyed out, cannot be chosen. */
  selectable: boolean;
  active: boolean;
  /** The error of an invalid preset, shown as tooltip. */
  tooltip: string | null;
}

/**
 * US-012 AC-3: the selector entries for the presets of the store (in the order
 * given). An invalid preset is not selectable and carries its error text.
 */
export function presetChoices(
  entries: readonly {name: string; valid: boolean; error?: string}[],
  active: string,
): PresetChoice[] {
  return entries.map((entry) => ({
    name: entry.name,
    selectable: entry.valid,
    active: entry.name === active,
    tooltip: entry.valid ? null : (entry.error ?? 'invalid'),
  }));
}

/** US-021 AC-3: one labelled group of the preset dropdown (label null: none). */
export interface PresetChoiceGroup {
  label: string | null;
  choices: PresetChoice[];
}

/**
 * US-021 | AC-3: The dropdown's choices in the groups of `groupPresets`
 * (AC-2): one group with the label null while no preset has a group, which
 * the dropdown draws as today. The choices are those of `presetChoices`.
 */
export function presetDropdownGroups(
  entries: readonly {
    name: string;
    valid: boolean;
    group: string | null;
    error?: string;
  }[],
  active: string,
): PresetChoiceGroup[] {
  return groupPresets(entries).map((group) => ({
    label: group.heading,
    choices: presetChoices(group.entries, active),
  }));
}

/** US-012 AC-11: the status line of a preview state (core text). */
export const previewStatus = (state: StatusState): string => statusLine(state);
