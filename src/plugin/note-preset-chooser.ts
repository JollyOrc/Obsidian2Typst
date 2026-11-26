// US-045 AC-6: the chooser of "Preset for this note…" (an Obsidian
// SuggestModal: typed filter, arrows, Enter, Escape — SCAR-013). It only
// answers; the action writes.
import {type App, SuggestModal} from 'obsidian';
import type {NotePresetChoice} from '../core/presets';
import {STRINGS} from './strings';

class NotePresetChooser extends SuggestModal<NotePresetChoice> {
  private answered = false;

  constructor(
    app: App,
    private readonly choices: NotePresetChoice[],
    private readonly answer: (choice: NotePresetChoice | null) => void,
  ) {
    super(app);
    this.setPlaceholder(STRINGS.notePreset.placeholder);
  }

  getSuggestions(query: string): NotePresetChoice[] {
    const q = query.trim().toLowerCase();
    return this.choices.filter((c) => c.label.toLowerCase().includes(q));
  }

  renderSuggestion(choice: NotePresetChoice, el: HTMLElement): void {
    el.setText(
      choice.current ? STRINGS.notePreset.current(choice.label) : choice.label,
    );
  }

  onChooseSuggestion(choice: NotePresetChoice): void {
    this.answered = true;
    this.answer(choice);
  }

  override onClose(): void {
    // Obsidian closes the modal before it reports the choice: answer "none"
    // only after that report had its turn.
    window.setTimeout(() => {
      if (!this.answered) this.answer(null);
    }, 0);
  }
}

/** US-045 | AC-6: opens the chooser; the chosen line, or null for Escape. */
export function pickNotePreset(
  app: App,
  choices: NotePresetChoice[],
): Promise<NotePresetChoice | null> {
  return new Promise((resolve) => {
    let done = false;
    new NotePresetChooser(app, choices, (choice) => {
      if (done) return;
      done = true;
      resolve(choice);
    }).open();
  });
}
