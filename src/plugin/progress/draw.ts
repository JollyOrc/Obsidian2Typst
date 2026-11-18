// US-042 AC-7 to AC-10: draws the progress tab's content from its state: the
// heading, the bar while running, the warnings, Cancel or Close. Redrawn whole on
// every change. No Obsidian import beyond the DOM helpers Obsidian adds.
import type {ProgressState} from '../../core/export-progress';
import {STRINGS} from '../strings';

/**
 * US-042 | AC-7 to AC-10: Draws `state` into `root`, replacing what was there.
 * The bar has no value (its length is unknown); after the end it is gone and
 * the button closes the tab. A warning without a line (0) shows no line part.
 */
export function drawProgress(
  root: HTMLElement,
  state: ProgressState,
  buttons: {cancel(): void; close(): void},
): void {
  root.empty();
  root.createEl('h4', {cls: 'o2t-progress-heading', text: state.heading});
  if (state.running) root.createEl('progress', {cls: 'o2t-progress-bar'});
  const list = root.createEl('ul', {cls: 'o2t-progress-warnings'});
  let last: HTMLElement | null = null;
  for (const warning of state.warnings) {
    const item = list.createEl('li', {cls: 'o2t-progress-warning'});
    item.createEl('strong', {text: warning.code});
    item.createEl('span', {text: warning.message});
    if (warning.line > 0) {
      item.createEl('span', {text: STRINGS.progress.line(warning.line)});
    }
    last = item;
  }
  last?.scrollIntoView?.({block: 'nearest'});
  const button = root.createEl('button', {
    text: state.running ? STRINGS.progress.cancel : STRINGS.progress.close,
  });
  button.addEventListener('click', () =>
    state.running ? buttons.cancel() : buttons.close(),
  );
}
