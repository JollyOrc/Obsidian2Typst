// US-041 AC-7 (amended 2026-11-18, #182): Typst writes the clock into every PDF —
// `/CreationDate` and `/ModDate`, the XMP `CreateDate` and `ModifyDate`, and the
// document ID derived from them (`/ID`, XMP `InstanceID` and `DocumentID`).
// Measured (`spikes/det/`, 40 compiles of one chapter): two compiles on two sides
// of a second differ in these bytes only. A test that compares two PDFs byte by
// byte compares them through `withoutClock`.

/** One field the clock writes: its pattern, and how often a Typst PDF holds it. */
const CLOCK_FIELDS: readonly [name: string, pattern: RegExp, count: number][] =
  [
    ['/CreationDate', /\/CreationDate \(D:\d{14}Z\)/g, 1],
    ['/ModDate', /\/ModDate \(D:\d{14}Z\)/g, 1],
    ['xmp:CreateDate', /<xmp:CreateDate>[^<]*<\/xmp:CreateDate>/g, 1],
    ['xmp:ModifyDate', /<xmp:ModifyDate>[^<]*<\/xmp:ModifyDate>/g, 1],
    ['xmpMM:InstanceID', /<xmpMM:InstanceID>[^<]*<\/xmpMM:InstanceID>/g, 1],
    ['xmpMM:DocumentID', /<xmpMM:DocumentID>[^<]*<\/xmpMM:DocumentID>/g, 1],
    ['/ID', /\/ID \[\([^)]*\) \([^)]*\)\]/g, 1],
  ];

/**
 * US-041 | AC-7: The PDF's bytes with the clock's fields blanked (each replaced
 * by its name), as a latin1 string, so two compiles compare byte for byte
 * otherwise. Throws when a field is not found exactly as often as expected:
 * a changed PDF must not make the comparison pass by blanking nothing
 * (SCAR-023).
 */
export function withoutClock(pdf: Uint8Array): string {
  let text = Buffer.from(pdf).toString('latin1');
  for (const [name, pattern, count] of CLOCK_FIELDS) {
    const found = text.match(pattern)?.length ?? 0;
    if (found !== count) {
      throw new Error(
        `withoutClock: ${name} found ${found} times, not ${count}`,
      );
    }
    text = text.replace(pattern, `[${name}]`);
  }
  return text;
}
