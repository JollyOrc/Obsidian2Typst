// US-008 AC-1, AC-4, AC-5, AC-13: the settings tab. The tab holds layout only:
// values are checked by `core/presets`, notes are written by the preset store,
// data.json by the settings store. Preset fields are edited in the preset note;
// the tab edits the Defaults only (decided by the user on 2026-10-17).
import {
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  type App,
  type Plugin,
} from 'obsidian';
import {formatPresetError, getField, groupPresets} from '../../core/presets';
import type {FontSet} from '../fonts';
import type {PresetStore} from '../presets/store';
import {deletePreset, isConfirmKey} from './dialog';
import {onActivePresetChange, type SettingsStore} from './data';
import {commitOnChange} from './commit';
import {
  ConfirmModal,
  addDefaultRows,
  addFontRows,
  createTrimState,
  noOwner,
  type RowsEnv,
} from './rows';
import {captureScroll, type ScrollNode} from './scroll';

export interface SettingsTabDeps {
  settings: SettingsStore;
  presets: PresetStore;
  /** US-010 AC-6: the fonts for the family dropdowns. */
  fonts: FontSet;
  /** US-020 AC-1: the action behind the `Use` button. */
  usePreset(name: string): Promise<void>;
  /** US-021 AC-8: opens the details pop-up of a preset. */
  openDetails(name: string): void;
}

/** A small dialog that asks for a preset name and shows why one is refused. */
class NameModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly initial: string,
    private readonly submit: (name: string) => Promise<string | null>,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(this.title);
    let name = this.initial;
    const message = this.contentEl.createEl('p', {cls: 'mod-warning'});
    /** The effect of `OK`, also of Enter in the field (SCAR-013). */
    const confirm = async (): Promise<void> => {
      const error = await this.submit(name);
      if (error === null) this.close();
      else message.setText(error);
    };
    new Setting(this.contentEl)
      .setName('Name')
      .addText((text) => {
        text.setValue(name).onChange((value) => (name = value));
        text.inputEl.addEventListener('keydown', (event) => {
          if (!isConfirmKey(event)) return;
          event.preventDefault();
          void confirm();
        });
        text.inputEl.focus();
      })
      .addButton((button) =>
        button
          .setButtonText('OK')
          .setCta()
          .onClick(() => void confirm()),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

export class Obsidian2TypstSettingTab extends PluginSettingTab {
  private stopListening: (() => void) | null = null;
  /** US-020 AC-4: stops following a preset chosen outside the tab. */
  private stopActive: (() => void) | null = null;
  /** US-008 AC-19: puts the scroll position of the last draw back. */
  private restoreScroll: () => void = () => undefined;
  /** US-009 AC-12: what the trim size rows keep between two draws. */
  private readonly trim = createTrimState();

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
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: `Obsidian2Typst ${this.plugin.manifest.version}`,
    });
    this.showPresets(containerEl);
    this.showDefaults(containerEl);
    this.showFonts(containerEl);
    this.showGlobals(containerEl);
    this.restoreScroll();
    requestAnimationFrame(() => this.restoreScroll());
  }

  override hide(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.stopActive?.();
    this.stopActive = null;
  }

  private showPresets(root: HTMLElement): void {
    const {presets, settings} = this.deps;
    new Setting(root).setName('Presets').setHeading();
    root.createEl('p', {
      cls: 'setting-item-description',
      text: 'A preset is a note in the presets folder. Edit its values in the note itself; they apply to the next export.',
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
          row.setDesc(isActive ? 'Active' : '');
        } else {
          row.setDesc(
            `invalid: ${formatPresetError(entry.error ?? {message: 'unknown error', line: null})}`,
          );
          row.descEl.addClass('mod-warning');
        }
        row.addButton((b) =>
          b
            .setButtonText(isActive ? 'In use' : 'Use')
            .setDisabled(!entry.valid || isActive)
            .onClick(async () => {
              await this.deps.usePreset(entry.name);
              this.display();
            }),
        );
        // US-021 AC-4, AC-8: the details pop-up of this row's preset.
        row.addButton((b) =>
          b
            .setButtonText('Details')
            .onClick(() => this.deps.openDetails(entry.name)),
        );
        row.addButton((b) =>
          b.setButtonText('Duplicate').onClick(async () => {
            const result = await presets.duplicate(entry.name);
            if (!result.ok) new Notice(result.error);
          }),
        );
        row.addButton((b) =>
          b.setButtonText('Rename').onClick(() =>
            new NameModal(
              this.app,
              'Rename preset',
              entry.name,
              async (name) => {
                const result = await presets.rename(entry.name, name);
                if (!result.ok) return result.error;
                if (isActive)
                  await settings.update({activePreset: result.name});
                this.display();
                return null;
              },
            ).open(),
          ),
        );
        row.addButton((b) =>
          b
            .setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              await deletePreset(
                {
                  store: presets,
                  confirm: (text) =>
                    new Promise<boolean>((resolve) =>
                      new ConfirmModal(this.app, text, resolve).open(),
                    ),
                  setActive: async (name) => {
                    await settings.update({activePreset: name});
                    this.display();
                  },
                  notify: (text) => void new Notice(text),
                },
                entry.name,
                active,
              );
            }),
        );
      }
    }
    new Setting(root).addButton((b) =>
      b
        .setButtonText('New preset')
        .setCta()
        .onClick(() =>
          new NameModal(this.app, 'New preset', '', async (name) => {
            const result = await presets.create(name);
            return result.ok ? null : result.error;
          }).open(),
        ),
    );
  }

  private showDefaults(root: HTMLElement): void {
    new Setting(root).setName('Defaults').setHeading();
    root.createEl('p', {
      cls: 'setting-item-description',
      text: 'Values that a preset uses when its note does not set them. Leave a field empty to use the built-in value.',
    });
    addDefaultRows(root, this.rowsEnv());
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

  /** US-010 AC-6: the Fonts section of the Defaults. */
  private showFonts(root: HTMLElement): void {
    new Setting(root).setName('Fonts').setHeading();
    root.createEl('p', {
      cls: 'setting-item-description',
      text: 'Fonts that a preset uses when its note does not set them. The font folder is read from the vault; a family that is not found is replaced by the default font.',
    });
    const holder = root.createDiv();
    void addFontRows(holder, this.rowsEnv()).finally(() =>
      this.restoreScroll(),
    );
  }

  private showGlobals(root: HTMLElement): void {
    const {settings, presets} = this.deps;
    new Setting(root).setName('Folders and warnings').setHeading();
    new Setting(root)
      .setName('Presets folder')
      .setDesc(
        'Vault folder of the preset notes. Created with two presets when it does not exist.',
      )
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
    new Setting(root)
      .setName('Strict mode')
      .setDesc('Any warning aborts the export.')
      .addToggle((t) =>
        t
          .setValue(settings.data.strictMode)
          .onChange((on) => void settings.update({strictMode: on})),
      );
    new Setting(root)
      .setName('Warnings note folder')
      .setDesc('Vault folder of the warnings note; empty is the vault root.')
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
