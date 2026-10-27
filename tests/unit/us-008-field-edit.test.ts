// US-008 AC-1 — reading and replacing one field of the Defaults by path (unit,
// pure core), as the settings tab does. Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it} from 'vitest';
import {getField, withField, type PresetFields} from '../../src/core/presets';

const FULL: PresetFields = {
  highlightColor: '#a5d6a7',
  page: {trimSize: 'A4', bleed: 2, margins: {top: 25, bottom: 30}},
};

describe('US-008 AC-1 editing one field of the Defaults', () => {
  it('US-008 AC-1: reads a field at any depth, and undefined where the path ends', () => {
    expect(getField(FULL, ['highlightColor'])).toBe('#a5d6a7');
    expect(getField(FULL, ['page', 'bleed'])).toBe(2);
    expect(getField(FULL, ['page', 'margins', 'top'])).toBe(25);
    expect(getField(FULL, ['page', 'margins', 'inside'])).toBeUndefined();
    expect(getField(FULL, ['template'])).toBeUndefined();
    expect(getField({}, ['page', 'margins', 'top'])).toBeUndefined();
    expect(getField(FULL, ['highlightColor', 'x'])).toBeUndefined();
    expect(getField(FULL, ['toString'])).toBeUndefined();
  });

  it('US-008 AC-1: replaces one field and keeps the others, without changing the original', () => {
    const before = JSON.stringify(FULL);
    const next = withField(FULL, ['page', 'margins', 'top'], 30);
    expect(next).toEqual({
      highlightColor: '#a5d6a7',
      page: {trimSize: 'A4', bleed: 2, margins: {top: 30, bottom: 30}},
    });
    expect(JSON.stringify(FULL)).toBe(before);
    expect(withField({}, ['headingNumbering'], 'a.1')).toEqual({
      headingNumbering: 'a.1',
    });
  });

  it('US-008 AC-1: creates the groups that are missing on the way to a field', () => {
    expect(withField({}, ['page', 'margins', 'inside'], 20)).toEqual({
      page: {margins: {inside: 20}},
    });
  });

  it('US-008 AC-1: undefined removes the field, and a group that becomes empty goes with it', () => {
    expect(withField(FULL, ['highlightColor'], undefined)).toEqual({
      page: FULL.page,
    });
    expect(
      withField(
        {page: {margins: {top: 25}}},
        ['page', 'margins', 'top'],
        undefined,
      ),
    ).toEqual({});
    expect(withField(FULL, ['page', 'margins', 'top'], undefined)).toEqual({
      highlightColor: '#a5d6a7',
      page: {trimSize: 'A4', bleed: 2, margins: {bottom: 30}},
    });
    expect(withField({}, ['page', 'margins', 'top'], undefined)).toEqual({});
  });

  it('US-008 AC-1: hands a value that is not valid on, so the store can refuse it', () => {
    expect(withField(FULL, ['page', 'bleed'], 'abc')).toEqual({
      highlightColor: '#a5d6a7',
      page: {trimSize: 'A4', bleed: 'abc', margins: {top: 25, bottom: 30}},
    });
  });
});
