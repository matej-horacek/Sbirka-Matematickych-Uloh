// Jest + ts-jest (NestJS default). Tests live in test/, helpers in test/support/.
//   *.e2e-spec.ts  HTTP tests through the real AppModule (contract + store checks)
//   *.spec.ts      fast unit tests (helpers, pure domain rules)
// UNSKIP=1 (pnpm test:unskipped) runs it.skip tests too, see test/support/unskip-transformer.js.
const transformer = process.env.UNSKIP ? '<rootDir>/test/support/unskip-transformer.js' : 'ts-jest';

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    // test/tsconfig.json sets isolatedModules, so ts-jest skips per-file type-checking
    // (typecheck:test in verify covers it).
    '^.+\\.ts$': [transformer, { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  // The generated Prisma client imports its own files as './x.js' (they are .ts on disk).
  moduleNameMapper: { '^(\.{1,2}/.*)\.js$': '$1' },
  testEnvironment: 'node',
  // Memory guards: a runaway node process once exhausted all RAM.
  maxWorkers: 2,
  workerIdleMemoryLimit: '768MB',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
};
