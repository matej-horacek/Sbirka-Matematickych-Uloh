import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import { parse, stringify } from 'yaml';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  // Lets the Vue dev server (another origin, e.g. http://localhost:5173) call the API from the browser.
  // CORS_ORIGIN=http://a.com,http://b.com restricts it; unset = any origin (fine for the mock, not for production).
const corsOrigins = (
  process.env.CORS_ORIGIN ?? 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.enableCors({
  origin: corsOrigins,
  credentials: true,
})
app.useGlobalFilters(new ProblemDetailsFilter());

  // Documentation straight from the contract: /openapi.yaml and the reference page at /docs.
  // maxAliasCount -1: the spec file has YAML anchors; the default limit of 100 crashes startup.
  const spec = parse(readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8'), { maxAliasCount: -1 });
  spec.servers = [{ url: '/api/v1', description: 'This server' }];
  const specText = stringify(spec);
  app.use('/openapi.yaml', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) =>
    res.type('application/yaml').send(specText),
  );
  app.use('/docs', apiReference({ url: '/openapi.yaml' }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API on http://localhost:${port}/api/v1 · docs on http://localhost:${port}/docs`);
}

void bootstrap();
