import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * API entry point.
 *
 * The default Nest body parsers are disabled so the correlation middleware can
 * be registered before body parsing (see `configureApp`). That way a malformed
 * JSON body still produces a `request_id` and the `x-request-id` response
 * header.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const { port } = configureApp(app);
  // Run shutdown hooks on SIGTERM/SIGINT (e.g. finish in-flight reset emails).
  app.enableShutdownHooks();

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`hares-api listening on http://localhost:${port}/api`);
}

void bootstrap();
