// US-042 AC-7 to AC-10: the progress tab as an Obsidian view; it draws the state
// it is given (`drawProgress`) and closes its own tab on Close.
import {ItemView} from 'obsidian';
import type {ProgressState} from '../../core/export-progress';
import {drawProgress} from './draw';
import {STRINGS} from '../strings';

/** US-042 AC-7: the view type of the progress tab. */
export const VIEW_TYPE_EXPORT_PROGRESS = 'o2t-export-progress';

/** US-042 | AC-7 to AC-10: the progress tab. */
export class ExportProgressView extends ItemView {
  private state: ProgressState | null = null;
  private cancel: () => void = () => undefined;

  /** US-042 | AC-7: The view type Obsidian knows the tab by. */
  getViewType(): string {
    return VIEW_TYPE_EXPORT_PROGRESS;
  }

  /** US-042 | AC-7: The tab's title: `Exporting <note>`, read when shown. */
  getDisplayText(): string {
    return this.state?.title ?? STRINGS.progress.tabTitle;
  }

  /** US-042 | AC-7: The tab's icon, the export's. */
  override getIcon(): string {
    return 'file-output';
  }

  /**
   * US-042 | AC-7 to AC-10: Shows `state` (redrawn whole); `cancel` is what
   * the Cancel button calls, Close detaches the tab. A reused tab (P5) takes
   * the new note's title: `updateHeader` is Obsidian's, not in its typings
   * (reached through a structural type, a no-op where missing; checked in
   * Obsidian at T7, SCAR-024).
   */
  show(state: ProgressState, cancel: () => void): void {
    const retitled = this.state?.title !== state.title;
    this.state = state;
    this.cancel = cancel;
    drawProgress(this.contentEl, state, {
      cancel: () => this.cancel(),
      close: () => this.leaf.detach(),
    });
    if (retitled) {
      (this.leaf as unknown as {updateHeader?: () => void}).updateHeader?.();
    }
  }

  /** US-042 | AC-7: Draws a state given before the view was opened. */
  override async onOpen(): Promise<void> {
    if (this.state !== null) this.show(this.state, this.cancel);
  }
}
