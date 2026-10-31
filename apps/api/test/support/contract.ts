import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2019, { type ValidateFunction } from 'ajv/dist/2019';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

/**
 * Contract validation straight from openapi.yaml (no generated code involved).
 *
 * For a response it finds the spec operation (method + path template), checks that the
 * status is declared, that the content type matches, and validates the body with AJV.
 *
 * Strict by design: the spec's schemas allow extra properties, so on its own AJV would
 * accept fields the spec doesn't define. Here every place a schema is *used* (a property,
 * array items, a response body) is wrapped in `unevaluatedProperties: false` (JSON Schema
 * 2019-09), which sees through allOf/anyOf/$ref. So a field the spec doesn't declare fails
 * the test. `nullable` (OpenAPI 3.0) is AJV's built-in keyword.
 */

// Spec nodes are arbitrary JSON; `any` keeps the walkers readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;
export type Method = (typeof METHODS)[number];

export const SPEC_PATH = join(__dirname, '../../../../packages/shared/contracts/openapi.yaml');

export interface ResponseLike {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  text?: string;
}

export interface OperationMatch {
  operationId: string;
  pathTemplate: string;
  params: Record<string, string>;
}

const esc = (seg: string | number) => encodeURIComponent(String(seg).replace(/~/g, '~0').replace(/\//g, '~1'));
const pointer = (path: (string | number)[]) => '/' + path.map(esc).join('/');

/** Wraps a schema at a use site so properties not declared anywhere in it are rejected. */
function strictUse(schema: Json): Json {
  if (!schema || typeof schema !== 'object') return schema;
  const objectLike =
    '$ref' in schema || 'properties' in schema || 'allOf' in schema || 'anyOf' in schema || 'oneOf' in schema;
  if (!objectLike || schema.type === 'array') return walk(schema);
  return { allOf: [walk(schema)], unevaluatedProperties: false };
}

/** Recurses into a schema, making nested use sites strict. Composition branches stay as they are. */
function walk(schema: Json): Json {
  if (!schema || typeof schema !== 'object' || '$ref' in schema) return schema;
  const out: Json = { ...schema };
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, strictUse(v as Json)]));
  }
  if (schema.items) out.items = strictUse(schema.items);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    out.additionalProperties = strictUse(schema.additionalProperties);
  }
  for (const k of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (Array.isArray(schema[k])) out[k] = schema[k].map((s: Json) => walk(s));
  }
  return out;
}

function strictSpec(spec: Json): Json {
  const copy: Json = structuredClone(spec);
  for (const [name, s] of Object.entries(copy.components?.schemas ?? {})) copy.components.schemas[name] = walk(s as Json);
  const fixContent = (content: Json | undefined) => {
    for (const media of Object.values(content ?? {}) as Json[]) if (media.schema) media.schema = walk(media.schema);
  };
  for (const r of Object.values(copy.components?.responses ?? {}) as Json[]) fixContent(r.content);
  for (const item of Object.values(copy.paths ?? {}) as Json[]) {
    for (const m of METHODS) {
      const op = item[m];
      if (!op) continue;
      for (const r of Object.values(op.responses ?? {}) as Json[]) fixContent(r.content);
      if (op.requestBody) fixContent(op.requestBody.content);
    }
  }
  return copy;
}

export class Contract {
  readonly spec: Json;
  private readonly ajv: Ajv2019;
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly routes: { method: Method; template: string; regex: RegExp; names: string[]; operationId: string }[] = [];

  constructor(specPath = SPEC_PATH) {
    // Spec 2.0.0 has many YAML aliases; the default alias limit rejects it (R-001).
    this.spec = parse(readFileSync(specPath, 'utf8'), { maxAliasCount: -1 });
    this.ajv = new Ajv2019({ strict: false, allErrors: true });
    addFormats(this.ajv);
    this.ajv.addSchema(strictSpec(this.spec), 'spec');

    for (const [template, item] of Object.entries(this.spec.paths as Json)) {
      const names: string[] = [];
      const regex = new RegExp(
        '^' + template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n) => (names.push(n), '([^/]+)')) + '$',
      );
      for (const m of METHODS) if (item[m]) this.routes.push({ method: m, template, regex, names, operationId: item[m].operationId });
    }
    // Literal segments win over templates (e.g. a future /problems/search over /problems/{id}).
    this.routes.sort((a, b) => (a.template.match(/\{/g)?.length ?? 0) - (b.template.match(/\{/g)?.length ?? 0));
  }

  /** `path` is relative to the server URL (/api/v1), with or without a query string. */
  findOperation(method: string, path: string): OperationMatch | undefined {
    const m = method.toLowerCase();
    const clean = path.split('?')[0].replace(/^\/api\/v1/, '') || '/';
    for (const r of this.routes) {
      if (r.method !== m) continue;
      const hit = clean.match(r.regex);
      if (hit) {
        return {
          operationId: r.operationId,
          pathTemplate: r.template,
          params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])),
        };
      }
    }
    return undefined;
  }

  operation(operationId: string): { method: Method; path: string; op: Json } {
    for (const [path, item] of Object.entries(this.spec.paths as Json)) {
      for (const m of METHODS) if (item[m]?.operationId === operationId) return { method: m, path, op: item[m] };
    }
    throw new Error(`Unknown operationId ${operationId}`);
  }

  operationIds(): string[] {
    return this.routes.map((r) => r.operationId);
  }

  /** Returns the list of contract violations (empty = the response matches the spec). */
  check(method: string, path: string, res: ResponseLike): string[] {
    const match = this.findOperation(method, path);
    if (!match) return [`${method.toUpperCase()} ${path} is not an operation in openapi.yaml`];
    const { op, path: template, method: m } = this.operation(match.operationId);
    const label = `${match.operationId} (${m.toUpperCase()} ${template}) → ${res.status}`;

    const declared = op.responses?.[String(res.status)] ?? op.responses?.[`${String(res.status)[0]}XX`] ?? op.responses?.default;
    if (!declared) {
      return [`${label}: status ${res.status} is not declared in the spec (declared: ${Object.keys(op.responses ?? {}).join(', ')})`];
    }
    const statusKey = op.responses[String(res.status)] ? String(res.status) : op.responses[`${String(res.status)[0]}XX`] ? `${String(res.status)[0]}XX` : 'default';
    let responsePath: (string | number)[] = ['paths', template, m, 'responses', statusKey];
    let response: Json = declared;
    if (response.$ref) {
      const name = response.$ref.split('/').pop();
      response = this.spec.components.responses[name];
      responsePath = ['components', 'responses', name];
    }

    const contentType = String(res.headers['content-type'] ?? '').split(';')[0].trim();
    const hasBody = res.text !== undefined ? res.text.length > 0 : res.body !== undefined && res.body !== null && !(typeof res.body === 'object' && Object.keys(res.body as object).length === 0);
    if (!response.content) {
      return hasBody ? [`${label}: the spec declares no body, but the response has one (${contentType})`] : [];
    }
    const media = response.content[contentType];
    if (!media) {
      return [`${label}: content type "${contentType || '(none)'}" is not declared (declared: ${Object.keys(response.content).join(', ')})`];
    }
    if (!media.schema) return [];
    const validate = this.validator([...responsePath, 'content', contentType, 'schema']);
    if (validate(res.body)) return [];
    return (validate.errors ?? []).map((e) => {
      const extra = e.params && 'unevaluatedProperty' in e.params ? ` "${(e.params as Json).unevaluatedProperty}"` : '';
      const allowed = e.params && 'allowedValues' in e.params ? ` ${JSON.stringify((e.params as Json).allowedValues)}` : '';
      return `${label}: body${e.instancePath || ''} ${e.message}${extra}${allowed}`;
    });
  }

  /** Throws with a readable message when the response violates the contract. */
  assertResponse(method: string, path: string, res: ResponseLike): void {
    const errors = this.check(method, path, res);
    if (errors.length) {
      const body = JSON.stringify(res.body);
      throw new Error(
        `Contract violation (openapi.yaml):\n  - ${[...new Set(errors)].join('\n  - ')}\n  response body: ${body.length > 600 ? body.slice(0, 600) + '…' : body}`,
      );
    }
  }

  private validator(path: (string | number)[]): ValidateFunction {
    const key = pointer(path);
    let v = this.validators.get(key);
    if (!v) {
      v = this.ajv.compile({ allOf: [{ $ref: `spec#${key}` }], unevaluatedProperties: false });
      this.validators.set(key, v);
    }
    return v;
  }
}

let shared: Contract | undefined;
/** One parsed spec per test file. */
export function contract(): Contract {
  return (shared ??= new Contract());
}
