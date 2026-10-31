// Preload shim for smoke-testing dist/main without editing src (node -r ./scripts/smoke/yaml-alias-shim.cjs).
// Spec 2.0.0 contains many generated YAML anchors (&id001…); main.ts parses it with yaml's default
// maxAliasCount (100) and crashes on startup (finding R-001). This lifts the limit at runtime only.
const yaml = require(require.resolve('yaml', { paths: [require('node:path').join(__dirname, '../../apps/api')] }));
const original = yaml.parse;
yaml.parse = (src, reviver, options) =>
  typeof reviver === 'function'
    ? original(src, reviver, { maxAliasCount: -1, ...options })
    : original(src, { maxAliasCount: -1, ...reviver });
