import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { targetOrigin, redact } from './lib.mjs';

export async function smoke(run) {
  const origin = targetOrigin().origin;
  const cases = [
    { name: 'Health responds with service identity', path: '/health', status: 200, fields: { status: 'ok', service: 'ecotrack-backend' } },
    { name: 'Protected endpoint rejects missing token', path: '/api/v1/auth/me', status: 401, code: 'AUTH_TOKEN_MISSING' },
    { name: 'Protected endpoint rejects malformed authorization', path: '/api/v1/auth/me', status: 401, code: 'AUTH_TOKEN_MISSING', headers: { Authorization: 'Basic deliberately-invalid' } },
    { name: 'Unknown route returns expected error', path: '/api/v1/submission-route-does-not-exist', status: 404, code: 'ROUTE_NOT_FOUND' },
  ];
  for (const [i, check] of cases.entries()) {
    const started = performance.now();
    let record;
    try {
      const response = await fetch(origin + check.path, { headers: check.headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = null; }
      const assertions = {
        expectedStatus: response.status === check.status,
        json: response.headers.get('content-type')?.includes('application/json') === true && body !== null,
        contract: check.code ? body?.error?.code === check.code : Object.entries(check.fields).every(([k, v]) => body?.[k] === v),
        noInternalErrorLeak: !/(PrismaClient|"stack"\s*:|SELECT\s+.+FROM)/i.test(text),
      };
      record = { name: check.name, path: check.path, httpStatus: response.status, assertions, status: Object.values(assertions).every(Boolean) ? 'PASS' : 'FAIL' };
    } catch {
      record = { name: check.name, path: check.path, status: 'FAIL', error: 'Request failed or timed out; check API availability.' };
    }
    Object.assign(record, { durationMs: Math.round(performance.now() - started), timestamp: new Date().toISOString() });
    writeFileSync(resolve(run.directory, `check-${i + 1}.json`), redact(JSON.stringify(record, null, 2)) + '\n');
    run.summary.steps.push({ label: record.name, status: record.status });
    run.log(`${record.name}: ${record.status}\n`);
  }
  run.summary.scope = 'Four unauthenticated HTTP checks only. Does not verify DB writes, Redis, login, notifications or full workflows.';
}
