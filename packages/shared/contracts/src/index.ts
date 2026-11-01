// Public entry of @matematika/contracts.
// Types (e.g. ProblemDetail) and Zod schemas (e.g. zProblemCreate) are generated
// from openapi.yaml into ./generated. Edit the spec, then run `pnpm generate`.
export * from './generated/types.gen';
export * from './generated/zod.gen';
export * from './error-codes';
