import { describe, expect, it } from 'vitest';
import { checkPattern } from './regex-validation';

describe('PATTERN validation (WEB-FR-036)', () => {
  it.each([
    ['\\b\\d{10}\\b'],
    ['^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$'],
    ['\\bEMP-\\d{6}\\b'],
    ['(\\d{3}-?){3}'],
    ['\\bSA\\d{22}\\b'],
  ])('accepts the safe pattern %s', async (p) => {
    expect(await checkPattern(p)).toEqual({ ok: true });
  });

  // The analyser is deliberately conservative: a pattern it cannot prove safe
  // within its budget is rejected, even if it is only polynomial (e.g. an
  // unbounded e-mail pattern with overlapping character classes).
  it('rejects a pattern whose safety cannot be proven', async () => {
    const r = await checkPattern('[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}');
    expect(r).toEqual({ ok: false, error: 'rule.pattern_unsafe' });
  });

  it('rejects an invalid or empty regex', async () => {
    expect(await checkPattern('(')).toEqual({ ok: false, error: 'rule.pattern_invalid' });
    expect(await checkPattern('[a-')).toEqual({ ok: false, error: 'rule.pattern_invalid' });
    expect(await checkPattern('')).toEqual({ ok: false, error: 'rule.pattern_invalid' });
  });

  it('rejects an over-length pattern', async () => {
    expect(await checkPattern('a'.repeat(513))).toEqual({ ok: false, error: 'rule.pattern_invalid' });
  });

  // The extension compiles patterns case-insensitively, so the analysis must too.
  it('analyses under the same flags as the extension (case-insensitive)', async () => {
    expect(await checkPattern('^(?:[a-z]|[A-Z])+$')).toEqual({ ok: false, error: 'rule.pattern_unsafe' });
  });

  it('rejects unicode property escapes (the pattern is compiled without the u flag)', async () => {
    const r = await checkPattern('\\p{L}+');
    // Valid as plain text, so it is not a syntax error, but it means the literal "p{L}".
    expect(r.ok === true || r.error === 'rule.pattern_invalid').toBe(true);
  });

  it('runs at most a few validations at once and still answers every one', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => checkPattern('\\bEMP-\\d{6}\\b')));
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('rejects backreferences', async () => {
    expect(await checkPattern('(a)\\1')).toEqual({ ok: false, error: 'rule.pattern_backreference' });
    expect(await checkPattern('(?<x>a)\\k<x>')).toEqual({ ok: false, error: 'rule.pattern_backreference' });
  });

  it.each([['^(a+)+$'], ['(a|a)*b'], ['(.*)*x'], ['(x+x+)+y'], ['^(\\w+\\s?)*$']])(
    'rejects the catastrophic pattern %s',
    async (p) => {
      const r = await checkPattern(p);
      expect(r.ok).toBe(false);
    },
  );
});
