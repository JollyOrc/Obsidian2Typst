// US-041 AC-7 (amended 2026-11-18, #182): the helper that sets the clock's
// fields of a PDF aside checks itself (SCAR-023, SCAR-028): it blanks those
// fields only, and refuses a PDF in which one is missing.
import {describe, expect, it} from 'vitest';
import {withoutClock} from '../support/pdf-clock';

/** The tail of a Typst PDF as measured (`spikes/det/`), with its clock fields. */
const pdf = (
  time: string,
  id: string,
  body = 'BT (Fen Hare) Tj ET',
): Uint8Array =>
  Buffer.from(
    [
      `stream ${body} endstream`,
      `<xmp:ModifyDate>2026-11-18T11:36:${time}+00:00</xmp:ModifyDate><xmp:CreateDate>2026-11-18T11:36:${time}+00:00</xmp:CreateDate>`,
      `<xmpMM:InstanceID>${id}</xmpMM:InstanceID><xmpMM:DocumentID>${id}</xmpMM:DocumentID>`,
      `  /ModDate (D:202611181136${time}Z)`,
      `  /CreationDate (D:202611181136${time}Z)`,
      `  /ID [(${id}) (${id})]`,
    ].join('\n'),
    'latin1',
  );

describe('US-041 AC-7: withoutClock', () => {
  it('two PDFs that differ only in the clock and the ID are equal through it', () => {
    expect(withoutClock(pdf('06', '3QZDO+CY2=='))).toBe(
      withoutClock(pdf('07', 'l9c/a2Nr==')),
    );
  });

  it('a difference in the content stays', () => {
    expect(withoutClock(pdf('06', 'A==', 'BT (Fen Hare) Tj ET'))).not.toBe(
      withoutClock(pdf('06', 'A==', 'BT (Old Marsh Dragon) Tj ET')),
    );
  });

  it('a PDF without one of the fields is refused', () => {
    const text = Buffer.from(pdf('06', 'A==')).toString('latin1');
    const without = text.replace(/ {2}\/ModDate \([^)]*\)\n/, '');
    expect(() => withoutClock(Buffer.from(without, 'latin1'))).toThrow(
      '/ModDate found 0 times',
    );
  });
});
