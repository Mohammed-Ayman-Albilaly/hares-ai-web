import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * API entry point.
 *
 * - Global route prefix `api` (so the health probe lives at `/api/health`).
 * - CORS enabled against the allowlisted dev origin; `credentials` so the
 *   HTTP-only refresh cookie is accepted on the same origin.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:1420')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`hares-api listening on http://localhost:${port}/api`);
}

void bootstrap();
