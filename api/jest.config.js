// Jest + ts-jest. Tests live in test/, helpers in test/support/.
//   *.e2e-spec.ts  HTTP tests through the real AppModule (every response is checked against openapi.yaml)
//   *.spec.ts      fast unit tests (helpers, pure domain rules)
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    // test/tsconfig.json sets isolatedModules, so ts-jest skips per-file type-checking
    // (`npm run typecheck` covers the source).
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  testEnvironment: 'node',
  // Memory guards: keep a runaway test from exhausting RAM.
  maxWorkers: 2,
  workerIdleMemoryLimit: '768MB',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/contracts/generated/**'],
  coverageDirectory: '<rootDir>/coverage',
};
