import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';
import { buildResetEmail } from '../auth/password/reset-email';

// Real SMTP delivery through Mailpit (docker-compose.dev.yml: SMTP :1025, API
// :8025). Skipped with a message when Mailpit is not reachable.

const MAILPIT_API = process.env.MAILPIT_API ?? 'http://localhost:8025';

let reachable = false;
try {
  reachable = (await fetch(`${MAILPIT_API}/api/v1/info`, { signal: AbortSignal.timeout(2000) })).ok;
} catch {
  reachable = false;
}
if (!reachable) console.warn('[mailer] Mailpit is not reachable — skipping the SMTP delivery test.');

describe.skipIf(!reachable)('MailerService over SMTP (Mailpit)', () => {
  it('delivers the reset email with only the link in it', async () => {
    const to = `mail-${randomUUID().slice(0, 8)}@synthetic.test`;
    const link = `http://localhost:1420/reset-password#token=${'A'.repeat(43)}`;
    const mailer = new MailerService(new ConfigService({ SMTP_HOST: 'localhost', SMTP_PORT: 1025 }));
    await mailer.send({ to, ...buildResetEmail(link, 30) });

    let found: { ID: string } | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      const res = await fetch(`${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
      found = ((await res.json()) as { messages: { ID: string }[] }).messages[0];
      if (!found) await new Promise((r) => setTimeout(r, 100));
    }
    expect(found).toBeDefined();
    const msg = (await (await fetch(`${MAILPIT_API}/api/v1/message/${found!.ID}`)).json()) as { Text: string };
    expect(msg.Text).toContain(link);

    await fetch(`${MAILPIT_API}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: [found!.ID] }),
    });
  });
});
