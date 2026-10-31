// Jest transformer used only by `pnpm test:unskipped` (UNSKIP=1): runs every `it.skip(...)`
// as a normal test, so you can see which skipped tests fail today (proof that a finding is real)
// and which already pass (the mock caught up: remove the `.skip`). Wraps ts-jest.
const tsJest = require('ts-jest').default;

// it.skip(…) → it(…), it.skip.each(…)(…) → it.each(…)(…).
const SKIP = /\bit\.skip(?=[.(])/g;

module.exports = {
  createTransformer(options) {
    const inner = tsJest.createTransformer(options);
    return {
      ...inner,
      process(src, path, opts) {
        return inner.process(src.replace(SKIP, 'it'), path, opts);
      },
      processAsync(src, path, opts) {
        return inner.processAsync(src.replace(SKIP, 'it'), path, opts);
      },
      getCacheKey(src, path, opts) {
        return 'unskip:' + inner.getCacheKey(src.replace(SKIP, 'it'), path, opts);
      },
    };
  },
};
