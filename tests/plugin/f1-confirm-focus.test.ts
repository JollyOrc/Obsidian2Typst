// #174 (F1; US-008 AC-17, AC-18 amended; SCAR-014, SCAR-028): the confirmation of the
// settings tab, drawn through `onOpen`, then treated as Obsidian 1.15.0 treats a modal
// (measured: `Modal.open()` focuses the first focusable element after `onOpen`; Enter on
// a focused button clicks it). The fake `Modal` never drew the question, which is why no
// test saw it. Red on 0.15.2 first.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ConfirmModal} from '../../src/plugin/settings/rows';
import {FakeEl, resetFake} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const QUESTIONS = [
  [
    'delete',
    {
      title: 'Delete preset "Probe"?',
      lines: ['x'],
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    },
  ],
  [
    'reset',
    {
      title: 'Reset "Bleed (mm)"?',
      lines: ['x'],
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    },
  ],
] as const;

const buttonsOf = (el: FakeEl): FakeEl[] =>
  el.children.flatMap((c) => (c.tag === 'button' ? [c] : buttonsOf(c)));

function open(text: (typeof QUESTIONS)[number][1]) {
  const answers: boolean[] = [];
  const modal = new ConfirmModal(
    {} as never,
    {...text, lines: [...text.lines]},
    (a) => answers.push(a),
  );
  modal.onOpen();
  return {
    modal,
    answers,
    buttons: buttonsOf(modal.contentEl as unknown as FakeEl),
  };
}

describe('#174 F1: the safe button is the first one Obsidian focuses', () => {
  beforeEach(() => resetFake());
  it.each(QUESTIONS)(
    '%s: the buttons read Cancel, then the action',
    (_n, text) => {
      expect(open(text).buttons.map((b) => b.text)).toEqual([
        'Cancel',
        text.confirmLabel,
      ]);
    },
  );
  it.each(QUESTIONS)(
    "%s: Enter on the first button (Obsidian's focus) answers false",
    (_n, text) => {
      const {buttons, answers} = open(text);
      buttons[0]!.click();
      expect(answers).toEqual([false]);
    },
  );
  it.each(QUESTIONS)('%s: the action button answers true', (_n, text) => {
    const {buttons, answers} = open(text);
    buttons.find((b) => b.text === text.confirmLabel)!.click();
    expect(answers).toEqual([true]);
  });
});
