// US-028 AC-5: the label of the image fit decisions, in a module of its own
// so that the compiler worker can read it without the image emitter. Pure: no
// Obsidian, Node, or I/O imports.

/** US-028 AC-5: the label of the decisions the plugin reads back. */
export const FIT_DECISION_LABEL = 'o2t-fit-decision';
