import { Contract } from './contract';

// Unit tests for the contract helper itself: it must reject what the spec doesn't allow.
describe('Contract helper', () => {
  const c = new Contract();
  const json = { 'content-type': 'application/json; charset=utf-8' };
  const problemJson = { 'content-type': 'application/problem+json; charset=utf-8' };
  const tag = { id: 'UkLWZ', name: 'x', scope: 'global' };

  it('finds operations by method and path template', () => {
    expect(c.findOperation('get', '/problems?scope=mine')?.operationId).toBe('listProblems');
    expect(c.findOperation('GET', '/api/v1/problems/abcde')?.operationId).toBe('getProblem');
    expect(c.findOperation('post', '/problems/abcde/copy')?.operationId).toBe('copyProblem');
    expect(c.findOperation('delete', '/problems/abcde/children/fghij')).toMatchObject({
      operationId: 'removeSetChild',
      params: { id: 'abcde', childId: 'fghij' },
    });
    expect(c.findOperation('put', '/problems/abcde')).toBeUndefined();
  });

  it('knows all 16 operations', () => {
    expect(new Set(c.operationIds()).size).toBe(16);
  });

  it('accepts a valid body', () => {
    expect(c.check('get', '/tags', { status: 200, headers: json, body: { items: [tag], meta: { page: 1, limit: 20, total: 1 } } })).toEqual([]);
  });

  it('rejects an undeclared status', () => {
    expect(c.check('get', '/tags', { status: 418, headers: json, body: {} })[0]).toMatch(/status 418 is not declared/);
  });

  it('rejects a missing required field and a wrong enum value', () => {
    const errors = c.check('get', '/tags', { status: 200, headers: json, body: { items: [{ ...tag, scope: 'nope' }] } });
    expect(errors.join('\n')).toMatch(/must have required property 'meta'/);
    expect(errors.join('\n')).toMatch(/allowed values/);
  });

  it('rejects properties the spec does not declare, also nested and through allOf', () => {
    const top = c.check('get', '/tags', { status: 200, headers: json, body: { items: [], meta: { page: 1, limit: 20, total: 0 }, extra: 1 } });
    expect(top.join()).toMatch(/unevaluated properties "extra"/);
    const nested = c.check('get', '/tags', { status: 200, headers: json, body: { items: [{ ...tag, colour: 'red' }], meta: { page: 1, limit: 20, total: 1 } } });
    expect(nested.join()).toMatch(/\/items\/0 must NOT have unevaluated properties "colour"/);
    const chapters = c.check('get', '/chapters', { status: 200, headers: json, body: { items: [{ ...tag, parentId: null, depth: 1 }] } });
    expect(chapters.join()).toMatch(/"depth"/);
  });

  it('accepts null where the spec says nullable, and rejects null elsewhere', () => {
    const ok = c.check('get', '/chapters', { status: 200, headers: json, body: { items: [{ ...tag, parentId: null }] } });
    expect(ok).toEqual([]);
    const bad = c.check('get', '/chapters', { status: 200, headers: json, body: { items: [{ ...tag, name: null, parentId: null }] } });
    expect(bad.join()).toMatch(/name must be string/);
  });

  it('checks error bodies and their content type', () => {
    const err = { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', requestId: 'x' };
    expect(c.check('get', '/problems/abcde', { status: 404, headers: problemJson, body: err })).toEqual([]);
    expect(c.check('get', '/problems/abcde', { status: 404, headers: json, body: err })[0]).toMatch(/content type "application\/json" is not declared/);
  });

  it('requires an empty body where the spec declares none (204)', () => {
    expect(c.check('delete', '/problems/abcde', { status: 204, headers: {}, body: {}, text: '' })).toEqual([]);
    expect(c.check('delete', '/problems/abcde', { status: 204, headers: json, body: { a: 1 }, text: '{"a":1}' })[0]).toMatch(/declares no body/);
  });

  it('reports a request that is not in the spec', () => {
    expect(c.check('get', '/nope', { status: 404, headers: json, body: {} })[0]).toMatch(/not an operation/);
  });
});
