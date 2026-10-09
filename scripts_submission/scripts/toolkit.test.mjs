import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { categoryFor, inventory } from './inventory.mjs';
import { Blocked, guardDatabase, defaultDatabase, defaultRedis, testEnvironment, targetOrigin, redact } from './lib.mjs';
import { csvRows } from './performance.mjs';
import { smoke } from './smoke.mjs';

test('integration guard accepts only dedicated local DB/Redis', () => {
  assert.doesNotThrow(() => guardDatabase(defaultDatabase, defaultRedis));
  for (const db of [defaultDatabase.replace('127.0.0.1', 'example.com'), defaultDatabase.replace('ecotrack_submission_test', 'postgres'), defaultDatabase.replace('55439', '5432')]) assert.throws(() => guardDatabase(db, defaultRedis), Blocked);
  assert.throws(() => guardDatabase(defaultDatabase, 'redis://production.example.com:6379'), Blocked);
  assert.throws(() => guardDatabase(defaultDatabase + '&host=production.example.com', defaultRedis), Blocked);
  assert.throws(() => guardDatabase(defaultDatabase + '&options=-c%20search_path=other', defaultRedis), Blocked);
  assert.throws(() => guardDatabase(defaultDatabase, defaultRedis + '?host=production.example.com'), Blocked);
});
test('test child environment overwrites live settings and removes service credentials', () => {
  const old = process.env.DATABASE_URL, oldToken = process.env.NORTHFLANK_API_TOKEN;
  process.env.DATABASE_URL = 'postgresql://live:secret@production.example.com:5432/postgres';
  process.env.NORTHFLANK_API_TOKEN = 'private-test-token';
  try {
    const env = testEnvironment('check');
    assert.equal(env.DATABASE_URL, defaultDatabase);
    assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, '');
    assert.equal(env.NORTHFLANK_API_TOKEN, undefined);
    assert.equal(env.TEST_REDIS_URL, undefined);
  } finally {
    if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
    if (oldToken === undefined) delete process.env.NORTHFLANK_API_TOKEN; else process.env.NORTHFLANK_API_TOKEN = oldToken;
  }
});
test('source inventory groups every test once and excludes old mockup', () => {
  const files = inventory();
  assert.ok(files.length > 60);
  assert.equal(new Set(files.map(f => f.file)).size, files.length);
  assert.ok(files.every(f => ['unit', 'integration', 'ui'].includes(f.category)));
  assert.equal(categoryFor('backend', 'backend/src/config/redisRuntime.test.ts'), 'integration');
  assert.equal(categoryFor('web', 'web/src/Feature.scenarios.test.tsx'), 'ui');
  assert.ok(files.every(f => !f.file.includes('mockup')));
});
test('redaction hides URLs and bearer values', () => {
  const safe = redact('postgresql://user:secret@example.com/db rediss://user:secret@example.com:6379 Bearer sensitive-token');
  assert.ok(!safe.includes('secret')); assert.ok(!safe.includes('sensitive-token'));
});
test('CSV parser handles JMeter quoted commas and doubled quotes', () => {
  assert.deepEqual(csvRows('elapsed,success,message\n12,false,"error, expected ""value"""'), [['elapsed', 'success', 'message'], ['12', 'false', 'error, expected "value"']]);
});
test('remote target guard rejects remote without opt-in and URLs with credentials', () => {
  const origin = process.env.SUBMISSION_API_ORIGIN, allow = process.env.SUBMISSION_ALLOW_REMOTE;
  try {
    process.env.SUBMISSION_ALLOW_REMOTE = 'false';
    process.env.SUBMISSION_API_ORIGIN = 'https://example.com'; assert.throws(targetOrigin, Blocked);
    process.env.SUBMISSION_ALLOW_REMOTE = 'true'; assert.equal(targetOrigin().origin, 'https://example.com');
    process.env.SUBMISSION_API_ORIGIN = 'https://user:password@example.com'; assert.throws(targetOrigin, Blocked);
  } finally {
    if (origin === undefined) delete process.env.SUBMISSION_API_ORIGIN; else process.env.SUBMISSION_API_ORIGIN = origin;
    if (allow === undefined) delete process.env.SUBMISSION_ALLOW_REMOTE; else process.env.SUBMISSION_ALLOW_REMOTE = allow;
  }
});
test('smoke assertions pass correct contracts and reject incorrect contracts', async () => {
  let broken = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/health') { res.statusCode = 200; res.end(JSON.stringify({ status: broken ? 'broken' : 'ok', service: 'ecotrack-backend' })); }
    else if (req.url === '/api/v1/auth/me') { res.statusCode = 401; res.end(JSON.stringify({ error: { code: 'AUTH_TOKEN_MISSING' } })); }
    else { res.statusCode = 404; res.end(JSON.stringify({ error: { code: 'ROUTE_NOT_FOUND' } })); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const previous = process.env.SUBMISSION_API_ORIGIN;
  const directory = mkdtempSync(resolve(tmpdir(), 'ecotrack-smoke-test-'));
  process.env.SUBMISSION_API_ORIGIN = `http://127.0.0.1:${server.address().port}`;
  try {
    const run = { directory, summary: { steps: [] }, log() {} };
    await smoke(run);
    assert.ok(run.summary.steps.every(s => s.status === 'PASS'));
    broken = true;
    run.summary.steps = []; await smoke(run);
    assert.equal(run.summary.steps[0].status, 'FAIL');
    assert.equal(JSON.parse(readFileSync(resolve(directory, 'check-1.json'), 'utf8')).assertions.contract, false);
  } finally {
    await new Promise(r => server.close(r));
    if (previous === undefined) delete process.env.SUBMISSION_API_ORIGIN; else process.env.SUBMISSION_API_ORIGIN = previous;
    assert.ok(directory.startsWith(resolve(tmpdir(), 'ecotrack-smoke-test-')));
    rmSync(directory, { recursive: true });
  }
});
