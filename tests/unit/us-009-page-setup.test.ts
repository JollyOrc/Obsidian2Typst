// US-009 — page setup (unit, pure core). Source of truth:
// docs/user-stories/US-009-page-setup.md. Written BEFORE the implementation
// (SCAR-003); it fails until TICKET-002 is done. Expected strings are compared
// exactly (docs/technical/tests.md).
//
// API this test fixes (module `src/core/layout/page-setup.ts`, no I/O):
//   NAMED_SIZES                      name -> { width, height } in mm
//   BUILTIN_PAGE_PRESETS             'A5 print' | 'A4 digital' -> PageSettingsInput
//   formatMm(n)                      number -> 'NNmm' text, at most 2 decimals
//   resolvePageSetup(input)          -> { ok: true, value: PageGeometry }
//                                     | { ok: false, errors: { field, message }[] }
//   emitPageSetup(geometry)          -> one `#set page(...)` line
// All lengths are millimetres. Omitted gutter, bleed, and slug count as 0.
import {describe, expect, it} from 'vitest';
import {
  BUILTIN_PAGE_PRESETS,
  NAMED_SIZES,
  emitPageSetup,
  formatMm,
  resolvePageSetup,
  type PageSettingsInput,
} from '../../src/core/layout/page-setup';

const A5_PRINT: PageSettingsInput = {
  trimSize: 'A5',
  margins: {top: 18, bottom: 22, inside: 15, outside: 15},
  gutter: 5,
  bleed: 3,
  facingPages: true,
};

const A4_DIGITAL: PageSettingsInput = {
  trimSize: 'A4',
  margins: {top: 20, bottom: 20, inside: 20, outside: 20},
  gutter: 0,
  bleed: 0,
  facingPages: false,
};

function emit(input: PageSettingsInput): string {
  const r = resolvePageSetup(input);
  if (!r.ok)
    throw new Error(`expected valid input: ${JSON.stringify(r.errors)}`);
  return emitPageSetup(r.value);
}

describe('US-009 page setup', () => {
  it('US-009 AC-1: resolves the named sizes A4 210x297, A5 148x210, A6 105x148, US Letter 215.9x279.4', () => {
    expect(NAMED_SIZES).toEqual({
      A4: {width: 210, height: 297},
      A5: {width: 148, height: 210},
      A6: {width: 105, height: 148},
      'US Letter': {width: 215.9, height: 279.4},
    });
  });

  it('US-009 AC-1: lets trimWidth/trimHeight win over trimSize', () => {
    const r = resolvePageSetup({
      ...A4_DIGITAL,
      trimSize: 'A4',
      trimWidth: 152.4,
      trimHeight: 228.6,
    });
    expect(r.ok && emitPageSetup(r.value)).toBe(
      '#set page(width: 152.4mm, height: 228.6mm, margin: (top: 20mm, bottom: 20mm, left: 20mm, right: 20mm))',
    );
  });

  it('US-009 AC-2: rejects numbers below 0 and trim below 50 mm', () => {
    const negative = resolvePageSetup({
      ...A5_PRINT,
      margins: {...A5_PRINT.margins, top: -1},
    });
    expect(negative).toEqual({
      ok: false,
      errors: [
        {
          field: 'margins.top',
          message: 'margins.top must be a number of at least 0',
        },
      ],
    });

    const narrow = resolvePageSetup({
      trimWidth: 49,
      trimHeight: 210,
      margins: {top: 5, bottom: 5, inside: 5, outside: 5},
      facingPages: false,
    });
    expect(narrow).toEqual({
      ok: false,
      errors: [
        {field: 'trimWidth', message: 'trimWidth must be at least 50 mm'},
      ],
    });
  });

  it("US-009 AC-2: rejects A5 with inside 60 and outside 60: 'Text block would be only 23 mm wide (minimum 30 mm)'", () => {
    const r = resolvePageSetup({
      ...A5_PRINT,
      margins: {top: 18, bottom: 22, inside: 60, outside: 60},
    });
    expect(r).toEqual({
      ok: false,
      errors: [
        {
          field: 'margins',
          message: 'Text block would be only 23 mm wide (minimum 30 mm)',
        },
      ],
    });
  });

  it('US-009 AC-2: rejects a text block under 30 mm high', () => {
    // 210 - 95 - 90 = 25 mm
    const r = resolvePageSetup({
      ...A5_PRINT,
      margins: {top: 95, bottom: 90, inside: 15, outside: 15},
    });
    expect(r).toEqual({
      ok: false,
      errors: [
        {
          field: 'margins',
          message: 'Text block would be only 25 mm high (minimum 30 mm)',
        },
      ],
    });
  });

  it('US-009 AC-2: computes text width without the gutter for single pages and with it for facing pages', () => {
    // 148 - 50 - 50 - 20 = 28 mm (facing pages, too narrow) but 148 - 50 - 50 = 48 mm (single pages, fine).
    const margins = {top: 18, bottom: 22, inside: 50, outside: 50};
    const facing = resolvePageSetup({
      ...A5_PRINT,
      margins,
      gutter: 20,
      facingPages: true,
    });
    const single = resolvePageSetup({
      ...A5_PRINT,
      margins,
      gutter: 20,
      facingPages: false,
    });
    expect(facing).toEqual({
      ok: false,
      errors: [
        {
          field: 'margins',
          message: 'Text block would be only 28 mm wide (minimum 30 mm)',
        },
      ],
    });
    expect(single.ok).toBe(true);
  });

  it('US-009 AC-3: emits #set page(width: 154mm, height: 216mm, margin: (top: 21mm, bottom: 25mm, inside: 23mm, outside: 18mm)) for the A5 example', () => {
    expect(emit(A5_PRINT)).toBe(
      '#set page(width: 154mm, height: 216mm, margin: (top: 21mm, bottom: 25mm, inside: 23mm, outside: 18mm))',
    );
  });

  it('US-009 AC-4: emits width 210mm, height 297mm, margin (top 20, bottom 20, left 20, right 20) for facingPages false, bleed 0', () => {
    expect(emit(A4_DIGITAL)).toBe(
      '#set page(width: 210mm, height: 297mm, margin: (top: 20mm, bottom: 20mm, left: 20mm, right: 20mm))',
    );
  });

  it('US-009 AC-4: ignores the gutter and adds bleed to all four margins when facingPages is false', () => {
    // inside 20 -> left, outside 20 -> right; gutter 5 ignored; bleed 3 added to all four; size 210+6 x 297+6.
    expect(emit({...A4_DIGITAL, gutter: 5, bleed: 3})).toBe(
      '#set page(width: 216mm, height: 303mm, margin: (top: 23mm, bottom: 23mm, left: 23mm, right: 23mm))',
    );
  });

  it('US-009 AC-6: defines A5 print and A4 digital with the documented values and facingPages true / false', () => {
    expect(BUILTIN_PAGE_PRESETS['A5 print']).toEqual({...A5_PRINT, slug: 0});
    expect(BUILTIN_PAGE_PRESETS['A4 digital']).toEqual({
      ...A4_DIGITAL,
      slug: 0,
    });
  });

  it('US-009 AC-7: prints at most 2 decimals with trailing zeros removed: 18.5mm, 18mm, 215.9mm', () => {
    expect(formatMm(18.5)).toBe('18.5mm');
    expect(formatMm(18)).toBe('18mm');
    expect(formatMm(215.9)).toBe('215.9mm');
    expect(formatMm(18.0)).toBe('18mm');
  });

  it('US-009 AC-7: rounds half up to 2 places: 18.456 becomes 18.46mm', () => {
    expect(formatMm(18.456)).toBe('18.46mm');
    expect(formatMm(0.125)).toBe('0.13mm');
  });

  it('US-009 AC-8: gives a bleed-only preset on A5 the page size 158mm x 220mm', () => {
    const r = resolvePageSetup({...A5_PRINT, bleed: 5});
    expect(r.ok && emitPageSetup(r.value)).toMatch(
      /^#set page\(width: 158mm, height: 220mm, /,
    );
  });

  it.todo(
    'US-009 AC-8: uses the full page size including bleed and no margins for the cover page (needs the cover emitter, US-011)',
  );

  it('US-009 AC-9: gives the A5 print values with slug 5 the page 164mm x 226mm and margins 26/30/28/23mm', () => {
    expect(emit({...A5_PRINT, slug: 5})).toBe(
      '#set page(width: 164mm, height: 226mm, margin: (top: 26mm, bottom: 30mm, inside: 28mm, outside: 23mm))',
    );
  });

  it('US-009 AC-9: leaves every earlier result unchanged when slug is 0', () => {
    expect(emit({...A5_PRINT, slug: 0})).toBe(emit(A5_PRINT));
    expect(emit({...A4_DIGITAL, slug: 0})).toBe(emit(A4_DIGITAL));
  });

  it('US-009 AC-9: rejects a negative slug', () => {
    expect(resolvePageSetup({...A5_PRINT, slug: -1})).toEqual({
      ok: false,
      errors: [{field: 'slug', message: 'slug must be a number of at least 0'}],
    });
  });

  it('US-009 AC-10: rejects an unknown trimSize such as A55 or a5', () => {
    const msg = (name: string) => ({
      ok: false,
      errors: [
        {
          field: 'trimSize',
          message: `Unknown trim size "${name}" (use A4, A5, A6, US Letter, or trimWidth and trimHeight)`,
        },
      ],
    });
    expect(resolvePageSetup({...A5_PRINT, trimSize: 'A55'})).toEqual(
      msg('A55'),
    );
    expect(resolvePageSetup({...A5_PRINT, trimSize: 'a5'})).toEqual(msg('a5'));
  });

  it('US-009 AC-10: rejects a missing trim size and a lone trimWidth or trimHeight', () => {
    const missing = {
      ok: false,
      errors: [
        {
          field: 'trimSize',
          message:
            'Trim size missing (set trimSize, or both trimWidth and trimHeight)',
        },
      ],
    };
    expect(resolvePageSetup({...A5_PRINT, trimSize: undefined})).toEqual(
      missing,
    );
    expect(resolvePageSetup({...A5_PRINT, trimWidth: 160})).toEqual(missing);
    expect(
      resolvePageSetup({...A5_PRINT, trimSize: undefined, trimHeight: 230}),
    ).toEqual(missing);
  });

  it('US-009 AC-10: ignores an unknown trimSize when trimWidth and trimHeight are both given', () => {
    const r = resolvePageSetup({
      ...A5_PRINT,
      trimSize: 'A55',
      trimWidth: 148,
      trimHeight: 210,
    });
    expect(r.ok && emitPageSetup(r.value)).toBe(emit(A5_PRINT));
  });
});
