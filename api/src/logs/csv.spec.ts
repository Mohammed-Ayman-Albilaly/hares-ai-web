import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from './csv';

describe('CSV encoding', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1', "'+1"],
    ['-2', "'-2"],
    ['@cmd', "'@cmd"],
    ['\tx', "'\tx"],
    ['\rx', '"\'\rx"'],
  ])('prefixes the formula cell %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('leaves normal cells alone and quotes commas, quotes and line breaks', () => {
    expect(csvCell('Ali')).toBe('Ali');
    expect(csvCell('محمد')).toBe('محمد');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(7)).toBe('7');
  });

  it('a prefixed cell that also needs quotes is both prefixed and quoted', () => {
    expect(csvCell('=A1,B1')).toBe('"\'=A1,B1"');
  });

  it('ends each row with CRLF', () => {
    expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
  });
});
