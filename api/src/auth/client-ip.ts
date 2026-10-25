import { isIPv6 } from 'node:net';
import type { Request } from 'express';

/**
 * Client address used as a throttle key (honours TRUST_PROXY via `req.ip`).
 *
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) becomes plain IPv4, and a real IPv6
 * address is reduced to its /64 prefix: one subscriber usually owns a whole
 * /64, so keying by the full address would let a client rotate addresses to
 * escape per-source limits.
 */
export function clientIp(req: Request): string {
  return normalizeIp(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

export function normalizeIp(raw: string): string {
  const ip = raw.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!isIPv6(ip)) return ip;
  return `${expandIPv6(ip).slice(0, 4).join(':')}::/64`;
}

/** Expand an IPv6 address to its 8 hextets (no embedded IPv4 support needed here). */
function expandIPv6(ip: string): string[] {
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - h.length - t.length;
  return [...h, ...Array(missing).fill('0'), ...t].map((x) => (x || '0').toLowerCase().replace(/^0+(?=.)/, ''));
}
