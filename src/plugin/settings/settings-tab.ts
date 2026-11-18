// US-008 AC-1, AC-4, AC-5, AC-13: the settings tab. The tab holds layout only:
// values are checked by `core/presets`, notes are written by the preset store,
// data.json by the settings store. Preset fields are edited in the preset note;
// the tab edits the Defaults only (decided by the user on 2026-10-17).
// US-029 AC-1, AC-7: the tab draws `TAB_LAYOUT` as collapsible sections of
// feature rows and plain rows; which sections are open is kept for the life
// of the tab (a session).
import {PluginSettingTab, Setting, type App, type Plugin} from 'obsidian';
import {formatPresetError, getField, groupPresets} from '../../core/presets';
import type {FontSet} from '../fonts';
import type {PresetStore} from '../presets/store';
import {onActivePresetChange, type SettingsStore} from './data';
import {commitOnChange} from './commit';
import {TAB_LAYOUT, type LayoutItem} from './layout';
import {NameModal} from './name-modal';
import {
  addLayoutSections,
  createTrimState,
  noOwner,
  type RowsEnv,
} from './rows';
import {captureScroll, type ScrollNode} from './scroll';
import {createSectionState} from './sections';
import {STRINGS} from '../strings';
import {ConfirmModal} from './rows';
import {
  RESETTABLE_SECTIONS,
  resetSection,
  type ResettableSection,
} from './section-reset';

export interface SettingsTabDeps {
  settings: SettingsStore;
  presets: PresetStore;
  /** US-010 AC-6: the fonts for the family dropdowns. */
  fonts: FontSet;
  /** US-020 AC-1: the action behind the `Use` button. */
  usePreset(name: string): Promise<void>;
  /** US-021 AC-8: opens the details pop-up of a preset. */
  openDetails(name: string): void;
  /** US-042 AC-12: gathers and copies the debug info. */
  copyDebugInfo(): Promise<void>;
}

export class Obsidian2TypstSettingTab extends PluginSettingTab {
  private stopListening: (() => void) | null = null;
  /** US-020 AC-4: stops following a preset chosen outside the tab. */
  private stopActive: (() => void) | null = null;
  /** US-008 AC-19: puts the scroll position of the last draw back. */
  private restoreScroll: () => void = () => undefined;
  /** US-009 AC-12: what the trim size rows keep between two draws. */
  private readonly trim = createTrimState();
  /** US-029 AC-7 (decision 2): Presets open at first, kept for the session. */
  private readonly sections = createSectionState([STRINGS.sections.presets]);

  constructor(
    app: App,
    private readonly plugin: Plugin,
    private readonly deps: SettingsTabDeps,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.stopListening?.();
    this.stopListening = this.deps.presets.onChange(() => this.display());
    // US-020 AC-4: a preset chosen in the ribbon menu or the panel shows here.
    this.stopActive?.();
    this.stopActive = onActivePresetChange(this.deps.settings, () =>
      this.display(),
    );
    const {containerEl} = this;
    // US-008 AC-19: a redraw must not throw the user back to the top.
    this.restoreScroll = captureScroll(containerEl as unknown as ScrollNode);
    containerEl.empty();
    // US-042 AC-12: the version and Copy debug info in the first line.
    const header = containerEl.createDiv({cls: 'o2t-tab-header'});
    new Setting(header)
      .setDesc(STRINGS.tab.version(this.plugin.manifest.version))
      .addExtraButton((b) =>
        b
          .setIcon('bug')
          .setTooltip(STRINGS.tab.copyDebugInfo)
          .onClick(() => void this.deps.copyDebugInfo()),
      );
    addLayoutSections(containerEl, this.rowsEnv(), TAB_LAYOUT, this.sections, {
      presets: (body) => this.showPresets(body),
      other: (body, item) => this.showGlobal(body, item),
      sectionEnd: (body, name) => this.addSectionReset(body, name),
    });
    this.restoreScroll();
    requestAnimationFrame(() => this.restoreScroll());
  }

  override hide(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.stopActive?.();
    this.stopActive = null;
  }

  /**
   * US-042 | AC-13 (P3): The reset row at the end of Page, Text and Book; the
   * other sections get none. The question is the shared `ConfirmModal`
   * (Cancel first, #174); the tab redraws after a reset (SCAR-016).
   */
  private addSectionReset(body: HTMLElement, name: string): void {
    if (!(RESETTABLE_SECTIONS as readonly string[]).includes(name)) return;
    new Setting(body).addButton((b) =>
      b.setButtonText(STRINGS.tab.resetSection).onClick(async () => {
        const reset = await resetSection(
          {
            settings: this.deps.settings,
            confirm: (question) =>
              new Promise<boolean>((resolve) =>
                new ConfirmModal(this.app, question, resolve).open(),
              ),
          },
          name as ResettableSection,
        );
        if (reset) this.display();
      }),
    );
  }

  private showPresets(root: HTMLElement): void {
    const {presets, settings} = this.deps;
    root.createEl('p', {
      cls: 'setting-item-description',
      text: STRINGS.tab.presetsIntro,
    });
    const active = settings.data.activePreset;
    for (const group of groupPresets(presets.entries())) {
      // US-021 AC-4: a heading row per group while presets are grouped.
      if (group.heading !== null) {
        new Setting(root).setName(group.heading).setHeading();
      }
      for (const entry of group.entries) {
        const row = new Setting(root).setName(entry.name);
        const isActive = entry.name === active;
        if (entry.valid) {
          row.setDesc(isActive ? STRINGS.tab.active : STRINGS.empty);
        } else {
          row.setDesc(
            STRINGS.tab.invalidPreset(
              formatPresetError(
                entry.error ?? {message: STRINGS.tab.unknownError, line: null},
              ),
            ),
          );
          row.descEl.addClass('mod-warning');
        }
        row.addButton((b) =>
          b
            .setButtonText(
              isActive ? STRINGS.details.inUse : STRINGS.details.use,
            )
            .setDisabled(!entry.valid || isActive)
            .onClick(async () => {
              await this.deps.usePreset(entry.name);
              this.display();
            }),
        );
        // US-029 AC-6: the gear opens the preset screen of this row's preset
        // (US-021's details with Duplicate, Rename and Delete).
        row.addExtraButton((b) =>
          b
            .setIcon('settings')
            .setTooltip(STRINGS.tab.presetTooltip(entry.name))
            .onClick(() => this.deps.openDetails(entry.name)),
        );
      }
    }
    new Setting(root).addButton((b) =>
      b
        .setButtonText(STRINGS.tab.newPreset)
        .setCta()
        .onClick(() =>
          new NameModal(this.app, STRINGS.tab.newPreset, '', async (name) => {
            const result = await presets.create(name);
            return result.ok ? null : result.error;
          }).open(),
        ),
    );
  }

  /** US-012 AC-15: the rows are the ones of the style panel; no preset owns a row here. */
  private rowsEnv(): RowsEnv {
    const {settings, presets, fonts} = this.deps;
    return {
      app: this.app,
      settings,
      presets,
      fonts,
      redraw: () => this.display(),
      ownerNote: noOwner,
      shown: (path) => getField(settings.data.defaults, path),
      trim: this.trim,
    };
  }

  /**
   * US-008 AC-1 | US-029 AC-1, AC-2: the rows of the Export section that are
   * plugin data, not Defaults: Strict mode (a feature row: a toggle, no reset
   * icon, no gear) and the two folder rows.
   */
  private showGlobal(root: HTMLElement, item: LayoutItem): void {
    const {settings} = this.deps;
    if (item.kind === 'feature' && item.toggle === 'strictMode') {
      new Setting(root)
        .setName(item.name)
        .setDesc(item.desc)
        .setClass('o2t-no-gear')
        .addToggle((t) =>
          t
            .setValue(settings.data.strictMode)
            .onChange((on) => void settings.update({strictMode: on})),
        );
      return;
    }
    if (item.kind !== 'plain') return;
    if (item.label === STRINGS.tab.presetsFolder) this.showPresetsFolder(root);
    if (item.label === STRINGS.tab.warningsFolder)
      this.showWarningsFolder(root);
  }

  /** US-008 AC-4: the vault folder of the preset notes. */
  private showPresetsFolder(root: HTMLElement): void {
    const {settings, presets} = this.deps;
    new Setting(root)
      .setName(STRINGS.tab.presetsFolder)
      .setDesc(STRINGS.tab.presetsFolderDesc)
      .addText((t) => {
        t.setValue(settings.data.presetsFolder);
        commitOnChange(
          t.inputEl,
          () => t.getValue(),
          async (text) => {
            const folder = text.trim().replace(/\/+$/, '');
            if (folder === '') return;
            await settings.update({presetsFolder: folder});
            await presets.load();
          },
        );
      });
  }

  /** US-006: the vault folder of the warnings note. */
  private showWarningsFolder(root: HTMLElement): void {
    const {settings} = this.deps;
    new Setting(root)
      .setName(STRINGS.tab.warningsFolder)
      .setDesc(STRINGS.tab.warningsFolderDesc)
      .addText((t) => {
        t.setValue(settings.data.warningsNoteFolder);
        commitOnChange(
          t.inputEl,
          () => t.getValue(),
          (text) =>
            settings.update({
              warningsNoteFolder: text.trim().replace(/\/+$/, ''),
            }),
        );
      });
  }
}
