// Jest + ts-jest (NestJS default). Tests live in test/, helpers in test/support/.
//   *.e2e-spec.ts  HTTP tests through the real AppModule (contract + store checks)
//   *.spec.ts      fast unit tests (helpers, pure domain rules)
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$':['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
};
