// US-012 AC-15 (SCAR-017): the one set of row functions of the Defaults, used
// by the Settings tab and by the style panel. Rows keep the behavior of the tab
// (US-008, US-009, US-010): saved through `saveDefaultsField`, text fields
// through `commitOnChange`, a reset icon and a trim size change that ask first.
// A row can be owned by the active preset (US-012 AC-2): it then shows the value
// of the preset, is disabled with the text of `ownerNote` and has no reset icon.
import {Modal, Notice, Setting, type App} from 'obsidian';
import {
  BUNDLED_DEFAULT_FAMILY,
  familyOptions,
  featureGlyphNotice,
  missingFeatureGlyphs,
  type FontCatalog,
} from '../../core/fonts';
import {getField, type FieldPath} from '../../core/presets';
import type {FontSet} from '../fonts';
import type {PresetStore} from '../presets/store';
import {commitOnChange} from './commit';
import type {SettingsStore} from './data';
import {saveDefaultsField} from './save-field';
import {resetDefaultField, type DeleteConfirmation} from './dialog';
import {DEFAULT_ROWS, FONT_ROWS, type FieldRow} from './row-data';
import {
  TRIM_CHOICES,
  gutterEnabled,
  planTrimChoice,
  planTrimSizes,
  trimChoiceOf,
} from './page-fields';

/** What the rows need of their host (the tab or the panel). */
export interface RowsEnv {
  app: App;
  settings: SettingsStore;
  presets: PresetStore;
  /** US-010 AC-6: the fonts for the family dropdowns. */
  fonts: FontSet;
  /** Draws the host again (after a change that shows in other rows). */
  redraw(): void;
  /** US-012 AC-2: the text of the preset that owns the row, or null. */
  ownerNote(path: FieldPath): string | null;
  /** US-012 AC-2: the value to show: the preset's when it owns the row. */
  shown(path: FieldPath): unknown;
  /** The state of the trim size rows that lives between two draws. */
  trim: TrimState;
}

/** US-009 AC-12: what the trim size rows keep between two draws. */
export interface TrimState {
  /** The user chose Custom and no size is stored yet. */
  custom: boolean;
  /** The two size fields are saved together; their texts. */
  draft: {width: string; height: string};
  rows: Setting[];
}

export const createTrimState = (): TrimState => ({
  custom: false,
  draft: {width: '', height: ''},
  rows: [],
});

/** A host without presets that own rows (the Settings tab). */
export const noOwner = (): null => null;

// US-021 (TICKET-060): the row data lives in `row-data.ts` (no Obsidian
// import), so the details pop-up's table can read it; re-exported here.
export {DEFAULT_ROWS, FONT_ROWS, type FieldRow, type FontRow} from './row-data';

/**
 * The question before a destructive action (SCAR-014): `Cancel` has the focus,
 * so Enter alone is safe; Escape closes the dialog and counts as `Cancel`.
 */
export class ConfirmModal extends Modal {
  private answered = false;

  constructor(
    app: App,
    private readonly text: DeleteConfirmation,
    private readonly answer: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(this.text.title);
    for (const line of this.text.lines)
      this.contentEl.createEl('p', {text: line});
    const buttons = this.contentEl.createDiv({cls: 'modal-button-container'});
    const confirmButton = buttons.createEl('button', {
      text: this.text.confirmLabel,
      cls: 'mod-warning',
    });
    const cancelButton = buttons.createEl('button', {
      text: this.text.cancelLabel,
    });
    confirmButton.addEventListener('click', () => this.finish(true));
    cancelButton.addEventListener('click', () => this.finish(false));
    cancelButton.focus();
  }

  override onClose(): void {
    this.finish(false);
    this.contentEl.empty();
  }

  private finish(confirmed: boolean): void {
    if (this.answered) return;
    this.answered = true;
    this.answer(confirmed);
    this.close();
  }
}

/** Keeps the message of a row: a refused value shows its text, a saved one clears it. */
function showResult(
  setting: Setting,
  hint: string,
  result: {ok: true} | {ok: false; error: string},
): void {
  if (result.ok) {
    setting.setDesc(hint);
    setting.descEl.removeClass('mod-warning');
  } else {
    setting.setDesc(result.error);
    setting.descEl.addClass('mod-warning');
  }
}

/**
 * US-008 AC-18, US-010 AC-6 (SCAR-014): the reset icon of a Defaults row. It
 * asks before the value is removed and draws the host again after `Reset`.
 * The one place that creates this icon. A row owned by a preset has none
 * (US-012 AC-2).
 */
export function addResetButton(
  env: RowsEnv,
  setting: Setting,
  row: {label: string; path: FieldPath},
  save: (value: unknown) => Promise<boolean>,
): void {
  const owner = env.ownerNote(row.path);
  if (owner !== null) return;
  setting.addExtraButton((b) =>
    b
      .setIcon('reset')
      .setTooltip('Use the built-in value')
      .onClick(async () => {
        const done = await resetDefaultField(
          {
            confirm: (text) =>
              new Promise<boolean>((resolve) =>
                new ConfirmModal(env.app, text, resolve).open(),
              ),
            save,
          },
          {
            label: row.label,
            // Read at the click: the value typed after the row was drawn
            // counts (M2 on 0.1.0-m5.3).
            value: () => {
              const current = getField(env.settings.data.defaults, row.path);
              return typeof current === 'string' ||
                typeof current === 'number' ||
                typeof current === 'boolean'
                ? current
                : undefined;
            },
          },
        );
        if (done) env.redraw();
      }),
  );
}

/**
 * US-009 AC-12: the trim size dropdown. A choice that removes a stored custom
 * size asks first (SCAR-014); the host is drawn again after every choice.
 */
export function addTrimDropdown(
  env: RowsEnv,
  setting: Setting,
  custom: boolean,
): void {
  const {settings} = env;
  const owner = env.ownerNote(['page', 'trimSize']);
  setting.setDesc(owner ?? '');
  setting.addDropdown((d) => {
    for (const choice of TRIM_CHOICES) d.addOption(choice, choice);
    d.setValue(custom ? 'Custom' : trimChoiceOf(settings.data.defaults.page));
    if (owner !== null) d.setDisabled(true);
    d.onChange(async (choice) => {
      const plan = planTrimChoice(settings.data.defaults.page, choice);
      if (plan.confirm !== null) {
        const ok = await new Promise<boolean>((resolve) =>
          new ConfirmModal(env.app, plan.confirm!, resolve).open(),
        );
        if (!ok) {
          env.redraw();
          return;
        }
      }
      env.trim.custom = choice === 'Custom';
      const page = Object.keys(plan.page).length === 0 ? undefined : plan.page;
      const result = await saveDefaultsField(env, ['page'], page);
      if (!result.ok) {
        setting.setDesc(result.error);
        setting.descEl.addClass('mod-warning');
        return;
      }
      for (const notice of result.notices) new Notice(notice);
      env.redraw();
    });
  });
}

/**
 * US-009 AC-12: the width or the height row. Both are always there, disabled
 * unless `Custom`; the two texts are saved together, never one alone.
 */
export function addTrimSizeRow(
  env: RowsEnv,
  root: HTMLElement,
  row: FieldRow,
  isWidth: boolean,
  custom: boolean,
): void {
  const {settings} = env;
  const owner = env.ownerNote(row.path);
  const setting = new Setting(root).setName(row.label);
  env.trim.rows.push(setting);
  setting.setDesc(owner ?? (custom ? '' : 'Used only with a custom trim size'));
  const draft = env.trim.draft;
  setting.addText((t) => {
    t.setValue(isWidth ? draft.width : draft.height);
    t.setDisabled(!custom || owner !== null);
    commitOnChange(
      t.inputEl,
      () => t.getValue(),
      async (text) => {
        if (isWidth) draft.width = text;
        else draft.height = text;
        const plan = planTrimSizes(
          settings.data.defaults.page,
          draft.width,
          draft.height,
        );
        const rows = env.trim.rows;
        if (plan.page === null) {
          for (const r of rows) r.setDesc(plan.hint ?? '');
          return;
        }
        const body =
          Object.keys(plan.page).length === 0 ? undefined : plan.page;
        const result = await saveDefaultsField(env, ['page'], body);
        if (!result.ok) {
          setting.setDesc(result.error);
          setting.descEl.addClass('mod-warning');
          return;
        }
        for (const r of rows) {
          r.setDesc('');
          r.descEl.removeClass('mod-warning');
        }
        for (const notice of result.notices) new Notice(notice);
      },
    );
  });
}

/** US-008 AC-1, US-009: the rows of the Defaults (not the heading). */
export function addDefaultRows(root: HTMLElement, env: RowsEnv): void {
  const {settings} = env;
  // US-009 AC-12: `Custom` shows while a width or a height is stored, or after
  // the user chose it (nothing is stored yet then).
  const stored = trimChoiceOf(settings.data.defaults.page);
  const custom = stored === 'Custom' || env.trim.custom;
  const page = settings.data.defaults.page;
  env.trim.draft = {
    width: page?.trimWidth === undefined ? '' : String(page.trimWidth),
    height: page?.trimHeight === undefined ? '' : String(page.trimHeight),
  };
  env.trim.rows = [];
  for (const row of DEFAULT_ROWS) {
    const key = row.path.join('.');
    if (key === 'page.trimWidth' || key === 'page.trimHeight') {
      addTrimSizeRow(env, root, row, key === 'page.trimWidth', custom);
      continue;
    }
    const owner = env.ownerNote(row.path);
    const setting = new Setting(root).setName(row.label);
    const hint = owner ?? row.hint ?? '';
    setting.setDesc(hint);
    if (owner !== null) setting.descEl.addClass('o2t-owned');
    const current = env.shown(row.path);
    /** Saves a new value; a refused value shows its message, the old one stays. */
    const save = async (value: unknown): Promise<boolean> => {
      const result = await saveDefaultsField(env, row.path, value);
      showResult(setting, hint, result);
      if (!result.ok) return false;
      for (const notice of result.notices) new Notice(notice);
      return true;
    };
    if (key === 'page.trimSize') {
      addTrimDropdown(env, setting, custom);
    } else if (row.kind === 'toggle') {
      setting.addToggle((t) => {
        t.setValue(current === true);
        if (owner !== null) t.setDisabled(true);
        t.onChange(async (on) => {
          // Facing pages decides whether the gutter field is enabled
          // (US-009 AC-13): draw the host again (SCAR-016).
          if ((await save(on)) && key === 'page.facingPages') env.redraw();
        });
      });
    } else {
      setting.addText((t) => {
        t.setValue(current === undefined ? '' : String(current));
        if (owner !== null) t.setDisabled(true);
        if (key === 'page.gutter') {
          const enabled = gutterEnabled(settings.data.defaults.page);
          t.setDisabled(!enabled || owner !== null);
          if (!enabled) setting.setDesc(owner ?? 'Used only with facing pages');
        }
        commitOnChange(
          t.inputEl,
          () => t.getValue(),
          async (text) => {
            const trimmed = text.trim();
            if (trimmed === '') await save(undefined);
            else if (row.kind === 'number') {
              await save(
                Number.isNaN(Number(trimmed)) ? trimmed : Number(trimmed),
              );
            } else await save(trimmed);
          },
        );
      });
    }
    addResetButton(env, setting, row, save);
  }
}

/** US-010 AC-6: the rows of the Fonts section of the Defaults. */
export async function addFontRows(
  holder: HTMLElement,
  env: RowsEnv,
): Promise<void> {
  const {settings, presets, fonts} = env;
  const defaults = settings.data.defaults;
  const active = presets.use(settings.data.activePreset);
  const folder =
    (active.ok ? active.preset.fields.fonts?.folder : undefined) ??
    defaults.fonts?.folder ??
    null;
  let catalog: FontCatalog;
  try {
    catalog = (await fonts(folder)).catalog;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    holder.createEl('p', {
      cls: 'setting-item-description mod-warning',
      text: `The fonts cannot be listed: ${text}`,
    });
    return;
  }
  if (!holder.isConnected) return;
  const familyOf = (path: FieldPath): string | undefined => {
    const value = getField(env.settings.data.defaults, path);
    return typeof value === 'string' ? value : undefined;
  };
  for (const row of FONT_ROWS) {
    const owner = env.ownerNote(row.path);
    const setting = new Setting(holder).setName(row.label);
    const current = env.shown(row.path);
    const hint = owner ?? row.hint ?? '';
    setting.setDesc(hint);
    if (owner !== null) setting.descEl.addClass('o2t-owned');
    /** True while the last value of this row was accepted. */
    let accepted = true;
    const save = async (value: unknown): Promise<boolean> => {
      const result = await saveDefaultsField(env, row.path, value);
      accepted = result.ok;
      if (!result.ok) {
        setting.setDesc(result.error);
        setting.descEl.addClass('mod-warning');
        return false;
      }
      for (const notice of result.notices) new Notice(notice);
      return true;
    };
    if (row.kind === 'family') {
      const shown =
        typeof current === 'string' ? current : (row.builtin ?? null);
      setting.addDropdown((d) => {
        for (const option of familyOptions(catalog.families(), shown, {
          allowUnset: row.unset === true,
        })) {
          d.addOption(option.value, option.label);
        }
        d.setValue(shown ?? '');
        if (owner !== null) d.setDisabled(true);
        // A new family changes the notices of other rows: draw again.
        d.onChange(async (value) => {
          if (await save(value === '' ? undefined : value)) env.redraw();
        });
      });
      const inEffect =
        row.path[1] === 'body'
          ? (familyOf(['fonts', 'body', 'family']) ??
            familyOf(['fonts', 'default']) ??
            BUNDLED_DEFAULT_FAMILY)
          : row.path[1] === 'default'
            ? (familyOf(['fonts', 'default']) ?? BUNDLED_DEFAULT_FAMILY)
            : null;
      if (
        inEffect !== null &&
        owner === null &&
        catalog.resolve(inEffect) !== null
      ) {
        const notice = featureGlyphNotice(
          missingFeatureGlyphs(catalog, inEffect),
        );
        if (notice !== null) setting.setDesc(notice);
      }
    } else {
      setting.addText((t) => {
        t.setValue(current === undefined ? '' : String(current));
        if (owner !== null) t.setDisabled(true);
        // The folder decides the families of the dropdowns: draw again when
        // the field is left (not on every key, which would drop the cursor).
        commitOnChange(
          t.inputEl,
          () => t.getValue(),
          async (text) => {
            const trimmed = text.trim();
            if (trimmed === '') await save(undefined);
            else if (row.kind === 'size') {
              await save(
                Number.isNaN(Number(trimmed)) ? trimmed : Number(trimmed),
              );
            } else await save(trimmed);
            if (accepted) env.redraw();
          },
        );
      });
    }
    addResetButton(env, setting, row, save);
  }
}

/**
 * US-012 AC-3 | US-021 AC-3: the preset selector row. An invalid preset is
 * listed greyed out with its error as tooltip and cannot be chosen. A group
 * with a label is drawn as an `optgroup`; the group without one (no preset has
 * a group) as plain options, as before US-021.
 */
export function addPresetDropdown(
  root: HTMLElement,
  groups: readonly {
    label: string | null;
    choices: readonly {
      name: string;
      selectable: boolean;
      active: boolean;
      tooltip: string | null;
    }[];
  }[],
  choose: (name: string) => void,
): Setting {
  const setting = new Setting(root).setName('Preset');
  const choices = groups.flatMap((group) => group.choices);
  setting.addDropdown((d) => {
    for (const group of groups) {
      if (group.label === null) {
        for (const choice of group.choices)
          d.addOption(choice.name, choice.name);
        continue;
      }
      // US-021 AC-3: a labelled group is an optgroup of the select (outside
      // Obsidian's dropdown API; measured in Chromium, story G1).
      const holder = d.selectEl.createEl('optgroup', {
        attr: {label: group.label},
      });
      for (const choice of group.choices) {
        holder.createEl('option', {text: choice.name, value: choice.name});
      }
    }
    const active = choices.find((choice) => choice.active);
    if (active !== undefined) d.setValue(active.name);
    for (const option of Array.from(d.selectEl.options)) {
      const choice = choices.find((c) => c.name === option.value);
      if (choice === undefined || choice.selectable) continue;
      option.disabled = true;
      option.title = choice.tooltip ?? '';
    }
    d.onChange((name) => choose(name));
  });
  return setting;
}

/**
 * US-012 AC-6: the one-line field of the page range. The caller saves it
 * through `commitOnChange`, like every text field.
 */
export function addRangeInput(
  root: HTMLElement,
  value: string,
): {setting: Setting; input: HTMLInputElement} {
  const setting = new Setting(root)
    .setName('Pages')
    .setDesc('all, a page such as 4, or a range such as 3-5');
  let input: HTMLInputElement | null = null;
  setting.addText((t) => {
    t.setPlaceholder('all').setValue(value);
    input = t.inputEl;
  });
  if (input === null) throw new Error('The range field was not made');
  return {setting, input};
}
