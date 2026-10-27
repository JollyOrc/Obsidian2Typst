// US-008 AC-19: keeps the scroll position of the settings tab over a redraw.
// Pure over plain objects; the DOM elements of Obsidian fit `ScrollNode`.

export interface ScrollNode {
  parentElement: ScrollNode | null;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** The computed `overflow-y`; read from the style of a real element. */
  overflowY?: string;
}

const overflowOf = (node: ScrollNode): string | undefined =>
  typeof getComputedStyle === 'function'
    ? getComputedStyle(node as unknown as Element).overflowY
    : node.overflowY;

const scrolls = (node: ScrollNode): boolean => {
  const overflow = overflowOf(node);
  return (
    (overflow === 'auto' || overflow === 'scroll') &&
    node.scrollHeight > node.clientHeight
  );
};

/**
 * Notes the scroll position of the nearest part around `start` that scrolls
 * (`start` itself first) and returns the function that puts it back. Without a
 * scrolling part the function does nothing. The position is restored as it was
 * noted; the browser keeps it inside the new height.
 */
export function captureScroll(start: ScrollNode): () => void {
  let node: ScrollNode | null = start;
  while (node !== null && !scrolls(node)) node = node.parentElement;
  if (node === null) return () => undefined;
  const target = node;
  const top = target.scrollTop;
  return () => {
    target.scrollTop = top;
  };
}
