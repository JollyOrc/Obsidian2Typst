// US-010 AC-2, US-016 AC-11: the one way a number of points is written into
// Typst. Pure: no Obsidian, Node, or I/O imports.

/**
 * US-010 | AC-2; US-016 | AC-11: A number of pt as a Typst length without
 * trailing zeros (`10` → `10pt`, `10.50` → `10.5pt`, `0.75` → `0.75pt`).
 *
 * Assumes a finite number (the preset parser checks the ranges). The only
 * transform is JavaScript's shortest number text; no rounding.
 */
export function ptLength(points: number): string {
  return `${Number(points)}pt`;
}
