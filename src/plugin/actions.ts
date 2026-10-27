// US-020: the three actions of the plugin. Every entry point — the palette
// commands, the settings tab's `Use` button, the style panel's preset
// dropdown, the ribbon menu and the note menus — calls these and nothing else
// (SCAR-017; text checks in the US-020 tests). Everything the actions need
// from Obsidian is injected, so they run without Obsidian.
import {extensionOf, sniffImage} from '../core/assets';
import {editPresetField, pickActive, type PresetChange} from '../core/presets';
import {exportNoteAt, type ExportCommandDeps} from './export-command';
import type {VaultPort} from './presets/store';
import {openStylePanel, type PanelWorkspace} from './preview/open';
import type {DeleteConfirmation} from './settings/dialog';

/** What the actions need: the export command's deps plus the two UI steps. */
export interface ActionDeps extends ExportCommandDeps {
  /** Makes the note at `path` the active note (opens it or activates its pane). */
  showNote(path: string): Promise<void>;
  /** Shows the style panel; false when there is no room for it. */
  openPanel(): Promise<boolean>;
  settings: ExportCommandDeps['settings'] & {
    update(patch: {activePreset: string}): Promise<void>;
  };
  /** US-022 AC-7: the atomic write of a preset note (the vault port). */
  presetNotes: Pick<VaultPort, 'process'>;
  /** US-022 AC-5: asks the question; true for `Change preset` only. */
  confirm(question: DeleteConfirmation): Promise<boolean>;
}

/** US-022 AC-5: one change of a preset, as a menu item asks for it. */
export interface PresetChangeRequest {
  /** The preset the item was built for (the active one when the menu opened). */
  preset: string;
  change: PresetChange;
  /** The question's line (`headingRuleAction`, `coverAction`). */
  question: string;
}

/** US-020 AC-1: the actions every entry point calls. */
export interface Actions {
  /** Exports the note at `path`; without a path, the active note. */
  exportNote(path?: string): Promise<unknown>;
  /** Shows the note at `path` (it becomes active), then the panel. */
  previewNote(path?: string): Promise<void>;
  /** Makes `name` the active preset, read from the store at the call. */
  usePreset(name: string): Promise<void>;
  /** US-022: asks, then changes one key of the active preset's note. */
  changePreset(request: PresetChangeRequest): Promise<void>;
}

/** US-022 AC-7: thrown inside `process` so that a refused edit writes nothing. */
class RefusedEdit extends Error {}

/**
 * US-022 | AC-9: The refusal for the image of a `Use as cover` request, read
 * when the item is clicked (the menu was built without reading files): null
 * when the image exists and its first bytes fit its type (`sniffImage` over
 * the 16 bytes the export reads for the same check), else the notice. A file
 * whose read fails (the vault reader throws for a path it does not have) no
 * longer exists.
 */
async function imageRefusal(
  deps: ActionDeps,
  path: string,
  preset: string,
): Promise<string | null> {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const unchanged = `preset "${preset}" was not changed`;
  let head: Uint8Array;
  try {
    head = await deps.vault.readHead(path);
  } catch {
    return `"${name}" no longer exists; ${unchanged}`;
  }
  const extension = extensionOf(path);
  return sniffImage(extension, head)
    ? null
    : `"${name}" is not a valid .${extension} image; ${unchanged}`;
}

/**
 * US-020 | AC-1, AC-8: The `openPanel` step over Obsidian's workspace: today's
 * `openStylePanel` (US-012 AC-1). The one caller of `openStylePanel`.
 */
export function panelOpener(workspace: PanelWorkspace): () => Promise<boolean> {
  return () => openStylePanel(workspace);
}

/**
 * US-020 | AC-1, AC-2, AC-4, AC-5, AC-8: Builds the actions over `deps`.
 *
 * `exportNote` hands the path (or the active note's) to `exportNoteAt`, with
 * its checks and messages; an error becomes the notice `Export failed: …`.
 * `previewNote` shows the note first, so the panel, which follows the active
 * note (US-012 AC-4), shows it; without room for the panel it gives today's
 * notice. `usePreset` asks the preset store when it is
 * called, not when a control was drawn (SCAR-016): a missing or invalid preset
 * gives the store's message and changes nothing; the active preset again saves
 * nothing.
 *
 * US-022 AC-5, AC-7 to AC-9: `changePreset` reads at the moment of each step
 * (SCAR-016): for `Use as cover`, the image at the click, before the question
 * (a refusal asks nothing, SCAR-014); the active preset after `Change preset`
 * (changed or invalid: nothing written); the note at the write, in one atomic
 * `process` with `editPresetField` (a refused edit throws inside, so nothing
 * is written, and its message is the notice). The one writer of a preset
 * note's fields (SCAR-017). The store re-reads the note from the vault event.
 */
export function createActions(deps: ActionDeps): Actions {
  return {
    async exportNote(path) {
      try {
        return await exportNoteAt(deps, path ?? deps.notes.activePath());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deps.notice(`Export failed: ${message}`);
        return undefined;
      }
    },
    async previewNote(path) {
      if (path !== undefined) await deps.showNote(path);
      if (!(await deps.openPanel())) {
        deps.notice('There is no room for the panel in the right sidebar');
      }
    },
    async usePreset(name) {
      const used = deps.presets.use(name);
      if (!used.ok) {
        deps.notice(used.error);
        return;
      }
      if (deps.settings.data.activePreset === name) return;
      await deps.settings.update({activePreset: name});
    },
    async changePreset({preset, change, question}) {
      if (change.kind === 'cover' && change.file !== null) {
        const refused = await imageRefusal(deps, change.file, preset);
        if (refused !== null) {
          deps.notice(refused);
          return;
        }
      }
      const confirmed = await deps.confirm({
        title: `Change preset "${preset}"`,
        lines: [question],
        confirmLabel: 'Change preset',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
      const entries = deps.presets.entries();
      const active = pickActive(
        entries.map((entry) => entry.name),
        deps.settings.data.activePreset,
      );
      const entry = deps.presets.get(preset);
      if (active !== preset || entry === undefined || !entry.valid) {
        deps.notice('The active preset changed; nothing was written');
        return;
      }
      try {
        await deps.presetNotes.process(entry.path, (text) => {
          const edited = editPresetField(text, change);
          if (!edited.ok) throw new RefusedEdit(edited.error);
          return edited.text;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deps.notice(
          error instanceof RefusedEdit
            ? message
            : `Preset "${preset}" was not changed: ${message}`,
        );
        return;
      }
      deps.notice(`Preset "${preset}" changed`);
    },
  };
}
