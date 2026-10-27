// US-010 AC-7, US-012 AC-13: the font files the compiler gets.

/**
 * US-010 AC-7, US-012 AC-13: the bundled fonts first, then the fonts of the
 * vault. The export and the preview both call it, so the compiler sees the same
 * list. The arguments are not changed.
 */
export function compileFonts(
  bundled: readonly Uint8Array[],
  vault: readonly Uint8Array[],
): Uint8Array[] {
  return [...bundled, ...vault];
}
