// Test support for US-037: the story's AC-1 example as bytes, written from
// the story's text (not from the code under test, SCAR-003), and a helper
// that builds a PDF in the form Typst 0.14.2 writes (objects separated by a
// blank line, `xref` entries of 20 bytes ending `\r\n`, no line end after
// `%%EOF`; taken from compiled files, SCAR-023) with offsets computed here.

/** The bytes of a latin1 string (one byte per character). */
export function bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** The latin1 text of bytes. */
export function text(data: Uint8Array): string {
  let out = '';
  for (const b of data) out += String.fromCharCode(b);
  return out;
}

/** US-037 AC-1: Typst's head, `%PDF-1.7`, `%` and four bytes 0x80. */
const HEAD = '%PDF-1.7\n%\x80\x80\x80\x80\n\n';

/** US-037 AC-1: object 1, at offset 16. */
const PAGES =
  '1 0 obj\n<<\n  /Type /Pages\n  /Count 0\n  /Kids []\n>>\nendobj\n\n';

/** US-037 AC-1: the catalog's dictionary as Typst writes it. */
export const AC1_CATALOG =
  '<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /ViewerPreferences <<\n    /Direction /L2R\n  >>\n>>';

/** US-037 AC-1: Typst's file, 324 bytes. */
export const AC1_TYPST: string =
  HEAD +
  PAGES +
  `2 0 obj\n${AC1_CATALOG}\nendobj\n\n` +
  'xref\n0 3\n0000000000 65535 f\r\n0000000016 00000 n\r\n0000000075 00000 n\r\n' +
  'trailer\n<<\n  /Size 3\n  /Root 2 0 R\n  /ID [(abc) (abc)]\n>>\nstartxref\n178\n%%EOF';

/** US-037 AC-1: the bytes the plugin appends (251 bytes; 575 in all). */
export const AC1_UPDATE: string =
  '\n\n2 0 obj\n<<\n  /PageLayout /TwoPageRight\n  /Type /Catalog\n  /Pages 1 0 R\n' +
  '  /ViewerPreferences <<\n    /Direction /L2R\n  >>\n>>\nendobj\n\n' +
  'xref\n2 1\n0000000326 00000 n\r\n' +
  'trailer\n<<\n  /Size 3\n  /Root 2 0 R\n  /ID [(abc) (abc)]\n  /Prev 178\n>>\n' +
  'startxref\n457\n%%EOF';

/**
 * A PDF in Typst's form with one Pages object and the given catalog
 * dictionary and trailer lines (each written `  <line>\n`); the xref offsets
 * and `startxref` are computed. `ending` follows `%%EOF` (Typst: none).
 */
export function typstPdf(
  catalog: string,
  trailer: readonly string[] = ['/Size 3', '/Root 2 0 R', '/ID [(abc) (abc)]'],
  ending = '',
): string {
  let out = HEAD;
  const o1 = out.length;
  out += PAGES;
  const o2 = out.length;
  out += `2 0 obj\n${catalog}\nendobj\n\n`;
  const x = out.length;
  const pad = (n: number): string => String(n).padStart(10, '0');
  out +=
    `xref\n0 3\n0000000000 65535 f\r\n${pad(o1)} 00000 n\r\n${pad(o2)} 00000 n\r\n` +
    `trailer\n<<\n${trailer.map((l) => `  ${l}\n`).join('')}>>\nstartxref\n${x}\n%%EOF${ending}`;
  return out;
}
