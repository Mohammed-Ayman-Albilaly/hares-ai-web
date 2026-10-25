import { describe, expect, it } from 'vitest';
import i18n, { applyDocumentLang, dirOf, initialLang, setLang } from './index';
import { ar } from './ar';
import { en } from './en';

const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('translations', () => {
  it('Arabic and English have exactly the same keys (content parity, WEB-NFR-012)', () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });

  it('no value is empty', () => {
    for (const dict of [ar, en]) for (const k of keys(dict)) expect(k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict)).not.toBe('');
  });

  it('every data category and enum used by the API has a label in both languages', () => {
    for (const dict of [ar, en]) {
      expect(Object.keys(dict.category)).toHaveLength(24);
      expect(Object.keys(dict.risk)).toEqual(['HIGH', 'MEDIUM', 'LOW', 'NONE']);
      expect(Object.keys(dict.action)).toEqual(['BLOCKED', 'WARNED', 'ALLOWED']);
    }
  });
});

describe('language and direction', () => {
  it('Arabic is rtl, English is ltr, and the default is Arabic', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    localStorage.clear();
    expect(initialLang()).toBe('ar');
  });

  it('switching sets <html lang dir> and remembers the choice', async () => {
    setLang('en');
    await new Promise((r) => setTimeout(r));
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('hares.lang')).toBe('en');
    expect(initialLang()).toBe('en');
    setLang('ar');
    await new Promise((r) => setTimeout(r));
    expect(document.documentElement.dir).toBe('rtl');
    applyDocumentLang(i18n.language as 'ar');
  });
});
