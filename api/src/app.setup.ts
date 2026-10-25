import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';

const DEFAULT_CORS_ORIGIN = 'http://localhost:1420';
const DEFAULT_PORT = 3000;
const BODY_LIMIT = '256kb';

/**
 * Apply the cross-cutting HTTP setup to a Nest Express application.
 *
 * The default Nest body parsers are disabled in `main.ts`
 * (`{ bodyParser: false }`), so they are re-registered here explicitly:
 *
 *  - the correlation middleware is registered first so a malformed JSON body
 *    still gets a `request_id` and the `x-request-id` response header;
 *  - helmet adds security headers;
 *  - the JSON and urlencoded parsers use an explicit 256kb size limit;
 *  - CORS allowlist and listen port come from the validated config
 *    (`CORS_ORIGIN`, `PORT`), never from `process.env`.
 */
export function configureApp(app: NestExpressApplication): { port: number } {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Behind the reverse proxy, req.ip must be the client address (login throttle).
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  const correlation = app.get(CorrelationMiddleware);
  app.use(correlation.use.bind(correlation));

  app.use(helmet());

  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: true });

  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? DEFAULT_CORS_ORIGIN;
  const origins = corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  const port = config.get<number>('PORT') ?? DEFAULT_PORT;
  return { port };
}
