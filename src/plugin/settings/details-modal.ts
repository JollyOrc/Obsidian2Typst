// US-021 AC-6 to AC-9: the details pop-up of a preset, drawn from
// `detailsView` (details.ts). It redraws while it is open, whenever a preset
// note or the plugin settings change (decision 1; SCAR-016), and stops
// listening when it closes. Escape closes it (Obsidian's `Modal`); the focus
// is on `Close` (SCAR-013, SCAR-014: the safe button).
import {Modal, Setting, type App} from 'obsidian';
import type {PresetStore} from '../presets/store';
import type {SettingsStore} from './data';
import {detailsView, type DetailsView} from './details';

/** What the pop-up reads and calls. */
export interface DetailsModalDeps {
  presets: PresetStore;
  settings: SettingsStore;
  usePreset(name: string): Promise<void>;
  openNote(path: string): Promise<void>;
}

/** US-021 | AC-6 to AC-9: the pop-up of the preset `name`. */
export class PresetDetailsModal extends Modal {
  private stops: (() => void)[] = [];

  constructor(
    app: App,
    private readonly deps: DetailsModalDeps,
    private readonly name: string,
  ) {
    super(app);
  }

  /**
   * US-021 | AC-7, AC-9: draws the pop-up and redraws it on every change of a
   * preset note or the settings while it is open.
   */
  override onOpen(): void {
    this.draw();
    this.stops.push(
      this.deps.presets.onChange(() => this.draw()),
      this.deps.settings.onChange(() => this.draw()),
    );
  }

  /** US-021 | AC-9: stops listening; nothing is kept. */
  override onClose(): void {
    for (const stop of this.stops.splice(0)) stop();
    this.contentEl.empty();
  }

  /** Draws the view of this moment: the title, the table or the error, the buttons. */
  private draw(): void {
    const view: DetailsView = detailsView(
      {...this.deps, close: () => this.close()},
      this.name,
    );
    this.titleEl.setText(view.title);
    const {contentEl} = this;
    contentEl.empty();
    if (view.error !== undefined) {
      contentEl.createEl('p', {cls: 'mod-warning', text: view.error});
    }
    if (view.rows !== undefined) {
      const table = contentEl.createEl('table', {cls: 'o2t-preset-details'});
      const head = table.createEl('tr');
      for (const title of ['Setting', 'In this preset', 'Used']) {
        head.createEl('th', {text: title});
      }
      for (const row of view.rows) {
        const line = table.createEl('tr');
        line.createEl('td', {text: row.label});
        line.createEl('td', {text: row.own});
        line.createEl('td', {
          text: row.source === null ? row.used : `${row.used} (${row.source})`,
        });
      }
    }
    const buttons = new Setting(contentEl);
    let focus: HTMLElement | null = null;
    for (const button of view.buttons) {
      buttons.addButton((b) => {
        b.setButtonText(button.text).setDisabled(button.disabled);
        const run = button.run;
        if (run !== undefined) b.onClick(() => void run());
        if (button.text === view.focus) focus = b.buttonEl;
      });
    }
    (focus as HTMLElement | null)?.focus();
  }
}
