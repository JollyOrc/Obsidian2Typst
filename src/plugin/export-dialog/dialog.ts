// US-042 AC-3, AC-5, AC-6: the export dialog — the preset, the destination row
// with its red and grey lines, More options — and its one answer, resolved when
// the dialog closes. The rules are `rules.ts`; this file only draws and wires.
import {Modal, Setting, type App} from 'obsidian';
import {
  checkExportFolder,
  destinationLine,
  dialogTitle,
  exportDialogKey,
  folderOf,
  presetChoices,
  type PresetEntry,
} from './rules';
import {addPresetDropdown} from '../settings/rows';
import {STRINGS} from '../strings';

/** What the dialog needs. */
export interface ExportDialogModel {
  noteName: string;
  presets: readonly PresetEntry[];
  activePreset: string;
  lastExportFolders: Readonly<Record<string, string>>;
  pathApi: {isAbsolute(p: string): boolean};
  join(folder: string, name: string): string;
  modifiedAt(path: string): Promise<Date | null>;
  chooseFolder(initial: string | null): Promise<string | null>;
  openSettings(): void;
}

/** The answer of the dialog. */
export interface ExportChoice {
  preset: string;
  folder: string;
}

/** US-042 | AC-3, AC-5, AC-6: the export dialog (a modal). */
export class ExportDialog extends Modal {
  private preset: string;
  private folderText: string;
  private answer: ExportChoice | null = null;
  private resolve: ((choice: ExportChoice | null) => void) | null = null;
  private exportButton: {setDisabled(d: boolean): unknown} | null = null;
  private folderField: {setValue(v: string): unknown} | null = null;
  private errorEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;
  private afterSettings = false;
  private refreshes = 0;

  constructor(
    app: App,
    private readonly model: ExportDialogModel,
  ) {
    super(app);
    this.preset = model.activePreset;
    this.folderText = folderOf(model.lastExportFolders, model.activePreset);
  }

  /** US-042 AC-6: opens the dialog; resolves once, when it closes. */
  choose(): Promise<ExportChoice | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  /**
   * US-042 | AC-3 to AC-6: Draws the dialog: the title, the preset as a
   * heading row (the plugin's one preset dropdown, `addPresetDropdown`, with
   * the valid presets grouped as the ribbon menu groups them), the
   * destination row, the red and grey lines, More options; Enter runs Export
   * while it is enabled (Escape, the X and a click outside are Obsidian's).
   */
  override onOpen(): void {
    const {contentEl, model} = this;
    this.titleEl.setText(dialogTitle(model.noteName));
    addPresetDropdown(
      contentEl,
      presetChoices(model.presets).map((group) => ({
        label: group.heading,
        choices: group.names.map((name) => ({
          name,
          selectable: true,
          active: name === this.preset,
          tooltip: null,
        })),
      })),
      (value) => {
        this.preset = value;
        this.folderText = folderOf(model.lastExportFolders, value);
        this.folderField?.setValue(this.folderText);
        void this.refresh();
      },
    ).setHeading();
    new Setting(contentEl)
      .addText((text) => {
        this.folderField = text;
        text.setPlaceholder(STRINGS.dialog.folderPlaceholder);
        text.setValue(this.folderText);
        text.onChange((value) => {
          this.folderText = value;
          void this.refresh();
        });
      })
      .addButton((button) =>
        button.setButtonText(STRINGS.dialog.chooseFolder).onClick(async () => {
          const checked = checkExportFolder(this.folderText, model.pathApi);
          const picked = await model.chooseFolder(
            this.folderText.trim() === ''
              ? null
              : checked.ok
                ? checked.folder
                : this.folderText,
          );
          if (picked === null) return;
          this.folderText = picked;
          this.folderField?.setValue(picked);
          await this.refresh();
        }),
      )
      .addButton((button) => {
        this.exportButton = button;
        button
          .setButtonText(STRINGS.dialog.export)
          .setCta()
          .onClick(() => this.run());
      });
    this.errorEl = contentEl.createDiv({cls: 'o2t-export-error'});
    this.infoEl = contentEl.createDiv({cls: 'o2t-export-info'});
    new Setting(contentEl)
      .setName(STRINGS.dialog.moreOptions)
      .addExtraButton((b) =>
        b.setIcon('settings').onClick(() => {
          this.afterSettings = true;
          this.close();
        }),
      );
    contentEl.addEventListener('keydown', (event: KeyboardEvent) => {
      const action = exportDialogKey(event, this.canRun());
      if (action === 'run') {
        event.preventDefault();
        this.run();
      }
    });
    void this.refresh();
  }

  /**
   * US-042 | AC-6: Resolves the one answer (the choice of Export, else null)
   * when the dialog closes, however it closes; after More options, opens the
   * plugin's settings tab.
   */
  override onClose(): void {
    this.contentEl.empty();
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(this.answer);
    if (this.afterSettings) this.model.openSettings();
  }

  /** US-042 | AC-4: Whether Export is enabled: the folder is accepted now. */
  private canRun(): boolean {
    return checkExportFolder(this.folderText, this.model.pathApi).ok;
  }

  /**
   * US-042 | AC-6: Export: keeps the preset and the checked folder as the
   * answer and closes; does nothing while the folder is refused.
   */
  private run(): void {
    const checked = checkExportFolder(this.folderText, this.model.pathApi);
    if (!checked.ok) return;
    this.answer = {preset: this.preset, folder: checked.folder};
    this.close();
  }

  /**
   * US-042 | AC-4, AC-5: The red and the grey line and the button for the
   * state of now (SCAR-016); a refresh that ends after a newer one is dropped,
   * so the grey line follows the last change.
   */
  private async refresh(): Promise<void> {
    const turn = ++this.refreshes;
    const checked = checkExportFolder(this.folderText, this.model.pathApi);
    this.exportButton?.setDisabled(!checked.ok);
    this.errorEl?.setText(checked.ok ? STRINGS.empty : checked.message);
    if (!checked.ok) {
      this.infoEl?.setText(STRINGS.empty);
      return;
    }
    const pdf = `${this.model.noteName}.pdf`;
    const modified = await this.model.modifiedAt(
      this.model.join(checked.folder, pdf),
    );
    if (turn !== this.refreshes) return;
    this.infoEl?.setText(destinationLine(pdf, modified));
  }
}
