// US-028 AC-5: the label of the image fit decisions, in a module of its own
// so that the compiler worker can read it without the image emitter. Pure: no
// Obsidian, Node, or I/O imports.

/** US-028 AC-5: the label of the decisions the plugin reads back. */
export const FIT_DECISION_LABEL = 'o2t-fit-decision';

/**
 * US-034 AC-2: the label of the drawn-width fact of a block image
 * (`(file, widthMm)`), written by every helper that sizes an image during
 * layout (`fit-image`, `fit-flow`, the entry slots' `o2t-fitted`); the
 * worker queries it (this file keeps the worker's imports small).
 */
export const IMAGE_FACT_LABEL = 'o2t-image';
