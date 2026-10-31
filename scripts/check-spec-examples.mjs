#!/usr/bin/env node
// Validates every `example` / `examples` value in openapi.yaml against its schema (AJV, OpenAPI 3.0 mode).
//
// OpenAPI 3.0 mode means: `nullable: true` is honoured (AJV's built-in OpenAPI keyword), `example`
// and other OpenAPI-only keywords are ignored, formats (date-time…) are checked with ajv-formats.
// The whole spec is registered as one AJV document, so every `$ref: '#/components/…'` resolves
// without a separate dereferencing step, and each example is checked against `spec#<pointer>`.
//
// Checked locations:
//   - schema-level `example` anywhere under components.schemas (and inline schemas)
//   - parameter `example` / `examples.*.value` / parameter `schema.example`
//   - request and response media types: `example` and `examples.*.value`
//
// Usage: pnpm spec:examples [path/to/openapi.yaml] [--json]
// Exit code 1 if any example is invalid.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const specPath = resolve(args.find((a) => !a.startsWith('--')) ?? join('packages/shared/contracts/openapi.yaml'));
const asJson = args.includes('--json');

function join(p) {
  return resolve(root, p);
}

// Spec 2.0.0 uses many YAML aliases; lift the alias limit (see R-001).
const spec = parse(readFileSync(specPath, 'utf8'), { maxAliasCount: -1 });

const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema(spec, 'spec');

const esc = (seg) => encodeURIComponent(String(seg).replace(/~/g, '~0').replace(/\//g, '~1'));
const pointer = (path) => '/' + path.map(esc).join('/');
const human = (path) => path.join(' › ');

const validators = new Map();
function validatorFor(schemaPath) {
  const key = pointer(schemaPath);
  if (!validators.has(key)) validators.set(key, ajv.compile({ $ref: `spec#${key}` }));
  return validators.get(key);
}

const results = [];
function check(where, schemaPath, value) {
  let validate;
  try {
    validate = validatorFor(schemaPath);
  } catch (e) {
    results.push({ where, schema: human(schemaPath), ok: false, errors: [`schema did not compile: ${e.message}`] });
    return;
  }
  const ok = validate(value);
  results.push({
    where,
    schema: human(schemaPath),
    ok,
    errors: ok ? [] : validate.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}${e.params?.allowedValues ? ' ' + JSON.stringify(e.params.allowedValues) : ''}`),
  });
}

// Walk a schema (not following $ref: referenced schemas are walked where they are defined).
const SUBSCHEMA_LISTS = ['allOf', 'anyOf', 'oneOf'];
function walkSchema(schema, path) {
  if (!schema || typeof schema !== 'object' || '$ref' in schema) return;
  if ('example' in schema) check(human([...path, 'example']), path, schema.example);
  for (const [name, sub] of Object.entries(schema.properties ?? {})) walkSchema(sub, [...path, 'properties', name]);
  if (schema.items) walkSchema(schema.items, [...path, 'items']);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    walkSchema(schema.additionalProperties, [...path, 'additionalProperties']);
  }
  if (schema.not) walkSchema(schema.not, [...path, 'not']);
  for (const k of SUBSCHEMA_LISTS) (schema[k] ?? []).forEach((s, i) => walkSchema(s, [...path, k, i]));
}

function walkMediaTypes(content, path) {
  for (const [mt, media] of Object.entries(content ?? {})) {
    const mPath = [...path, 'content', mt];
    if (!media.schema) continue;
    const schemaPath = [...mPath, 'schema'];
    if ('example' in media) check(human([...mPath, 'example']), schemaPath, media.example);
    for (const [name, ex] of Object.entries(media.examples ?? {})) {
      if (ex && 'value' in ex) check(human([...mPath, 'examples', name]), schemaPath, ex.value);
    }
    walkSchema(media.schema, schemaPath);
  }
}

function walkParameter(param, path) {
  if (!param || '$ref' in param) return;
  if (param.schema) {
    const schemaPath = [...path, 'schema'];
    if ('example' in param) check(human([...path, 'example']), schemaPath, param.example);
    for (const [name, ex] of Object.entries(param.examples ?? {})) {
      if (ex && 'value' in ex) check(human([...path, 'examples', name]), schemaPath, ex.value);
    }
    walkSchema(param.schema, schemaPath);
  }
  if (param.content) walkMediaTypes(param.content, path);
}

function walkResponse(resp, path) {
  if (!resp || '$ref' in resp) return;
  walkMediaTypes(resp.content, path);
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) walkSchema(schema, ['components', 'schemas', name]);
for (const [name, p] of Object.entries(spec.components?.parameters ?? {})) walkParameter(p, ['components', 'parameters', name]);
for (const [name, r] of Object.entries(spec.components?.responses ?? {})) walkResponse(r, ['components', 'responses', name]);
for (const [name, rb] of Object.entries(spec.components?.requestBodies ?? {})) walkMediaTypes(rb.content, ['components', 'requestBodies', name]);
for (const [route, item] of Object.entries(spec.paths ?? {})) {
  (item.parameters ?? []).forEach((p, i) => walkParameter(p, ['paths', route, 'parameters', i]));
  for (const method of METHODS) {
    const op = item[method];
    if (!op) continue;
    const base = ['paths', route, method];
    (op.parameters ?? []).forEach((p, i) => walkParameter(p, [...base, 'parameters', i]));
    if (op.requestBody && !('$ref' in op.requestBody)) walkMediaTypes(op.requestBody.content, [...base, 'requestBody']);
    for (const [status, resp] of Object.entries(op.responses ?? {})) walkResponse(resp, [...base, 'responses', status]);
  }
}

const failed = results.filter((r) => !r.ok);
if (asJson) {
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.where}`);
    for (const e of r.errors) console.log(`       ${e}`);
  }
  console.log(`\n${results.length} examples checked, ${results.length - failed.length} valid, ${failed.length} invalid`);
}
process.exit(failed.length ? 1 : 0);
