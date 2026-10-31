import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import { parse, stringify } from 'yaml';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Documentation straight from the contract: /openapi.yaml and the reference page at /docs.
  // maxAliasCount -1: the 2.0.0 spec file has YAML anchors (R-001, Q-003); the default limit of 100 crashes startup.
  const spec = parse(readFileSync(require.resolve('@matematika/contracts/openapi.yaml'), 'utf8'), { maxAliasCount: -1 });
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
