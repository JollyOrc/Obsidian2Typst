// US-008 AC-1, AC-17 (SCAR-013): the dialog that asks for a preset name. Moved
// out of the settings tab for US-029 AC-6: the preset screen's Rename uses it
// too. Enter in the field has the effect of OK (not while an input method is
// composing); Escape closes it without a change.
import {Modal, Setting, type App} from 'obsidian';
import {isConfirmKey} from './dialog';

/**
 * A small dialog that asks for a preset name and shows why one is refused.
 * US-029 AC-6: `closed` runs when the dialog closes, after OK or without a
 * change.
 */
export class NameModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly initial: string,
    private readonly submit: (name: string) => Promise<string | null>,
    private readonly closed: () => void = () => undefined,
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
    this.closed();
  }
}
