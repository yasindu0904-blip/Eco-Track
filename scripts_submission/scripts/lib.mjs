import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { toolkit, repository } from './inventory.mjs';

export class Blocked extends Error {}
export const defaultDatabase = 'postgresql://postgres:submission_test@127.0.0.1:55439/ecotrack_submission_test?schema=public&options=-c%20search_path%3Dpublic%2Cextensions';
export const defaultRedis = 'redis://127.0.0.1:56389';
export function loadSettings() {
  const p = resolve(toolkit, '.env.local');
  if (existsSync(p)) process.loadEnvFile(p);
}
export function guardDatabase(database, redis) {
  let db, cache;
  try { db = new URL(database); cache = new URL(redis); }
  catch { throw new Blocked('Malformed submission database/Redis configuration.'); }
  const allowedOptions = '-c search_path=public,extensions';
  const queryKeys = [...db.searchParams.keys()];
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== '127.0.0.1'
      || db.port !== '55439' || db.pathname !== '/ecotrack_submission_test'
      || db.username !== 'postgres' || db.password !== 'submission_test'
      || queryKeys.some(k => !['schema', 'options'].includes(k))
      || queryKeys.length !== new Set(queryKeys).size
      || (db.searchParams.has('schema') && db.searchParams.get('schema') !== 'public')
      || (db.searchParams.has('options') && db.searchParams.get('options') !== allowedOptions)
      || cache.protocol !== 'redis:' || cache.hostname !== '127.0.0.1' || cache.port !== '56389'
      || cache.username || cache.password || cache.search || cache.hash
      || db.hash || !['', '/', '/0'].includes(cache.pathname)) {
    throw new Blocked('Integration tests are restricted to the dedicated submission database on 127.0.0.1:55439 and Redis on 127.0.0.1:56389. Hosted/original databases are refused.');
  }
}
export function testEnvironment(runId = 'unit') {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^(SUBMISSION_|DATABASE_|REDIS_|TEST_|SUPABASE_|EXPO_|VITE_|NF_|NORTHFLANK_|SUPER_ADMIN_|NOTIFICATION_)/.test(name)) delete environment[name];
  }
  return {
    ...environment, NODE_ENV: 'test', PORT: '5025', WEB_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: defaultDatabase, DATABASE_POOL_MAX: '5', REDIS_URL: defaultRedis,
    REDIS_KEY_PREFIX: `ecotrack:submission:${runId}`,
    NOTIFICATION_DISPATCH_INTERVAL_MS: '5000', NOTIFICATION_MAX_ATTEMPTS: '5', EXPO_ACCESS_TOKEN: '',
    SUPABASE_URL: 'https://submission-placeholder.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'submission-placeholder-key',
    SUPABASE_SERVICE_ROLE_KEY: '', INCIDENT_EVIDENCE_BUCKET: 'incident-evidence', EVENT_EVIDENCE_BUCKET: 'event-evidence',
    SUPER_ADMIN_AUTH_USER_ID: '', SUPER_ADMIN_EMAIL: 'superadmin@example.com', SUPER_ADMIN_FULL_NAME: 'EcoTrack Submission Admin',
    VITE_SUPABASE_URL: 'https://submission-placeholder.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'submission-placeholder-key',
    VITE_API_BASE_URL: 'http://127.0.0.1:5025/api/v1', VITE_INCIDENT_EVIDENCE_BUCKET: 'incident-evidence', VITE_EVENT_EVIDENCE_BUCKET: 'event-evidence',
    EXPO_PUBLIC_SUPABASE_URL: 'https://submission-placeholder.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'submission-placeholder-key',
    EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:5025/api/v1', EXPO_PUBLIC_INCIDENT_EVIDENCE_BUCKET: 'incident-evidence', EXPO_PUBLIC_EVENT_EVIDENCE_BUCKET: 'event-evidence',
    EXPO_PUBLIC_MAP_PREVIEW: 'false', NO_COLOR: '1', FORCE_COLOR: '0',
  };
}
export function integrationEnvironment(runId) {
  const env = testEnvironment(runId);
  env.DATABASE_URL = process.env.SUBMISSION_DATABASE_URL || defaultDatabase;
  env.REDIS_URL = process.env.SUBMISSION_REDIS_URL || defaultRedis;
  guardDatabase(env.DATABASE_URL, env.REDIS_URL);
  env.TEST_REDIS_URL = env.REDIS_URL;
  return env;
}
export function redact(text) {
  let value = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  for (const [name, secret] of Object.entries(process.env)) {
    if (/TOKEN|PASSWORD|SERVICE_ROLE|SECRET|DATABASE_URL|REDIS_URL/.test(name) && secret && secret.length > 6) value = value.replaceAll(secret, '[REDACTED]');
  }
  return value.replace(/(postgres(?:ql)?|rediss?):\/\/[^\s"'<>]+/gi, '[REDACTED_CONNECTION_URL]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]{12,}/gi, 'Bearer [REDACTED]');
}
export function makeRun(category) {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '') + '-' + process.pid;
  const directory = resolve(toolkit, 'results', category, runId);
  mkdirSync(directory, { recursive: true });
  const summary = { category, runId, startedAt: new Date().toISOString(), node: process.version, status: 'RUNNING', steps: [] };
  const log = value => {
    const safe = redact(value);
    appendFileSync(resolve(directory, 'console.txt'), safe);
    process.stdout.write(safe);
  };
  const finish = (status, message = '') => {
    Object.assign(summary, { status, message: redact(message), finishedAt: new Date().toISOString() });
    writeFileSync(resolve(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    writeFileSync(resolve(directory, 'summary.md'), `# ${category}\n\nStatus: **${status}**\n\nUTC: ${summary.startedAt} to ${summary.finishedAt}\n\n${summary.message}\n\n` + summary.steps.map(s => `- ${s.label}: ${s.status}${s.exitCode === undefined ? '' : ` (exit ${s.exitCode})`}`).join('\n') + '\n');
    log(`\n${category}: ${status}. Evidence: ${directory}\n`);
  };
  return { runId, directory, summary, log, finish };
}
export function dependency(project, path) {
  const p = resolve(repository, project, 'node_modules', path);
  if (!existsSync(p)) throw new Blocked(`Missing ${project} dependencies. Run npm run setup in submission first.`);
  return p;
}
export function npmCli() {
  const candidates = [process.env.npm_execpath, resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const p = candidates.find(p => p && existsSync(p));
  if (!p) throw new Blocked('Run this command through npm run, so the npm CLI path is available.');
  return p;
}
export async function command(run, label, executable, args, options = {}) {
  run.log(`\n--- ${label} ---\n`);
  const startedAt = new Date().toISOString();
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd || repository, env: options.env || testEnvironment(run.runId), shell: false });
    let output = '';
    const consume = chunk => { output += chunk.toString(); run.log(chunk.toString()); };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.once('error', () => reject(new Blocked(`${label} could not start. Check the executable and prerequisites.`)));
    child.once('close', (code, signal) => resolveResult({ code: code ?? 1, signal, output }));
  });
  const counts = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const match = result.output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    if (match) counts[key] = Number(match[1]);
  }
  run.summary.steps.push({ label, startedAt, finishedAt: new Date().toISOString(), status: result.code === 0 ? 'PASS' : 'FAIL', exitCode: result.code, ...(Object.keys(counts).length ? { counts } : {}) });
  return result.code;
}
export async function requiredCommand(...args) {
  const code = await command(...args);
  if (code !== 0) throw new Error(`${args[1]} failed with exit code ${code}. See console.txt.`);
}
export function targetOrigin() {
  let url;
  try { url = new URL(process.env.SUBMISSION_API_ORIGIN || 'http://127.0.0.1:5025'); }
  catch { throw new Blocked('SUBMISSION_API_ORIGIN must be an HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Blocked('Use only an HTTP(S) origin without paths, credentials or query strings.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && process.env.SUBMISSION_ALLOW_REMOTE !== 'true') throw new Blocked('Remote requests require SUBMISSION_ALLOW_REMOTE=true. Default target is the isolated local API.');
  return url;
}
export function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
