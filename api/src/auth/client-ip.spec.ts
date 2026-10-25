import { describe, expect, it } from 'vitest';
import { normalizeIp } from './client-ip';

describe('normalizeIp (throttle key)', () => {
  it('keeps IPv4 and unwraps IPv4-mapped IPv6', () => {
    expect(normalizeIp('10.1.2.3')).toBe('10.1.2.3');
    expect(normalizeIp('::ffff:10.1.2.3')).toBe('10.1.2.3');
  });

  it('reduces IPv6 to its /64 so address rotation inside it does not help', () => {
    const a = normalizeIp('2001:db8:abcd:12:1111:2222:3333:4444');
    const b = normalizeIp('2001:0db8:abcd:0012::9');
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
  });
});
