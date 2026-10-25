import { describe, expect, it } from 'vitest';
import { delayAfterFailures } from './throttle';

describe('progressive login throttle', () => {
  it('is free for the first 4 failures', () => {
    for (let n = 0; n <= 4; n++) expect(delayAfterFailures(n)).toBe(0);
  });

  it('doubles from the 5th failure on', () => {
    expect([5, 6, 7, 8].map((n) => delayAfterFailures(n))).toEqual([2, 4, 8, 16]);
  });

  it('is capped at 15 minutes and never becomes a lockout', () => {
    expect(delayAfterFailures(14)).toBe(900);
    expect(delayAfterFailures(1000)).toBe(900);
  });
});
