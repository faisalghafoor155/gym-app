import { describe, expect, it } from 'vitest';
import { UR } from '../src/i18n/ur';
import { translate } from '../src/context/LanguageContext';

/**
 * The Roman Urdu dictionary is edited by hand across several files, and its
 * mistakes are silent: a dropped `{count}` prints a sentence with the number
 * missing, and a stray Urdu-script line shows as boxes in the Latin fonts.
 */

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('Roman Urdu dictionary', () => {
  it('keeps every placeholder of the English', () => {
    const broken = Object.entries(UR)
      .filter(([en, ur]) => placeholders(en).join() !== placeholders(ur).join())
      .map(([en]) => en);
    expect(broken).toEqual([]);
  });

  it('is Roman, with no Urdu script left in it', () => {
    const script = Object.entries(UR).filter(([, ur]) => /[؀-ۿ]/.test(ur)).map(([en]) => en);
    expect(script).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(UR).filter(([, ur]) => !ur.trim()).map(([en]) => en)).toEqual([]);
  });
});

describe('translate', () => {
  it('falls back to the English, filled in, when there is no entry', () => {
    expect(translate('ur', 'No such key {n}', { n: 3 })).toBe('No such key 3');
  });

  it('fills placeholders in English too', () => {
    expect(translate('en', '{count} members', { count: 12 })).toBe('12 members');
  });

  it('uses the Roman Urdu when Urdu is on', () => {
    expect(translate('ur', 'Attendance')).toBe('Haazri');
    expect(translate('en', 'Attendance')).toBe('Attendance');
  });
});
