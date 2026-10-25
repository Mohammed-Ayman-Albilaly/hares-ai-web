import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends transactional email over SMTP: a real provider in production, Mailpit
 * (docker-compose.dev.yml, SMTP on localhost:1025, UI on :8025) in development.
 *
 * The only email the system sends is the password-reset link. Callers must
 * never put prompt text, passwords, tokens other than the link, or any
 * placeholder values in a message. Recipients and bodies are never logged.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const secure = config.get<boolean>('SMTP_SECURE') ?? false;
    const production = config.get<string>('NODE_ENV') === 'production';
    this.transport = createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: config.get<number>('SMTP_PORT') ?? 1025,
      secure,
      // In production a plain connection must upgrade with STARTTLS, so the
      // SMTP password is never sent in clear text.
      requireTLS: production && !secure,
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    this.from = config.get<string>('MAIL_FROM') ?? 'Hares AI <no-reply@hares.local>';
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (e) {
      // Only a code: SMTP error messages often contain the recipient address.
      const err = e as { code?: unknown; responseCode?: unknown };
      this.logger.error(`mail delivery failed (${String(err.code ?? err.responseCode ?? 'unknown')})`);
      throw e;
    }
  }
}
