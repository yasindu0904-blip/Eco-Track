import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { toolkit } from './inventory.mjs';
import { Blocked, targetOrigin, requiredCommand } from './lib.mjs';

function bounded(name, fallback, min, max) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw new Blocked(`${name} must be an integer from ${min} to ${max}.`);
  return n;
}
export function csvRows(text) {
  return text.trim().split(/\r?\n/).map(line => {
    const result = []; let cell = ''; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (c === ',' && !quoted) { result.push(cell); cell = ''; } else cell += c;
    }
    result.push(cell); return result;
  });
}
export async function performanceTest(run) {
  if (process.env.SUBMISSION_ALLOW_LOAD_TEST !== 'true') throw new Blocked('Configure JMeter, a test bearer and known nearby incident/event IDs in .env.local, then set SUBMISSION_ALLOW_LOAD_TEST=true. No traffic was generated.');
  const origin = targetOrigin();
  const bin = process.env.SUBMISSION_JMETER_BIN;
  if (!bin || !existsSync(bin)) throw new Blocked('SUBMISSION_JMETER_BIN must point to the installed JMeter executable/batch file.');
  const token = process.env.SUBMISSION_ACCESS_TOKEN || '';
  const incident = process.env.SUBMISSION_EXPECTED_INCIDENT_ID || '';
  const event = process.env.SUBMISSION_EXPECTED_EVENT_ID || '';
  if (!/^[A-Za-z0-9._-]+$/.test(token) || !/^[0-9a-f-]{36}$/i.test(incident) || !/^[0-9a-f-]{36}$/i.test(event)) throw new Blocked('Supply a valid test access token and UUIDs of known published event/visible incident near the chosen coordinates.');
  const latitude = Number(process.env.SUBMISSION_LATITUDE || 6.795);
  const longitude = Number(process.env.SUBMISSION_LONGITUDE || 79.94);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Blocked('Invalid load-test coordinates.');
  const users = bounded('SUBMISSION_LOAD_USERS', 1, 1, 20);
  const durationSeconds = bounded('SUBMISSION_LOAD_DURATION_SECONDS', 60, 10, 300);
  const rampSeconds = bounded('SUBMISSION_LOAD_RAMP_SECONDS', 10, 1, durationSeconds);
  const properties = {
    apiHost: origin.hostname, apiProtocol: origin.protocol.slice(0, -1), apiPort: origin.port || (origin.protocol === 'https:' ? 443 : 80),
    accessToken: token, expectedIncidentId: incident, expectedEventId: event,
    latitude, longitude, users, durationSeconds, rampSeconds,
    'jmeter.save.saveservice.output_format': 'csv', 'jmeter.save.saveservice.print_field_names': 'true',
    'jmeter.save.saveservice.response_data': 'false', 'jmeter.save.saveservice.samplerData': 'false',
    'jmeter.save.saveservice.requestHeaders': 'false', 'jmeter.save.saveservice.responseHeaders': 'false',
  };
  const temp = mkdtempSync(resolve(tmpdir(), 'ecotrack-jmeter-'));
  const privateFile = resolve(temp, 'private.properties');
  writeFileSync(privateFile, Object.entries(properties).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  const jtl = resolve(run.directory, 'samples.jtl');
  const report = resolve(run.directory, 'html-report');
  mkdirSync(report);
  try {
    let executable = bin;
    const args = ['-n', '-t', resolve(toolkit, 'tests/performance/read-only-baseline.jmx'), '-q', privateFile, '-l', jtl, '-j', resolve(run.directory, 'jmeter.log'), '-e', '-o', report];
    if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(basename(bin))) {
      const jar = resolve(dirname(bin), 'ApacheJMeter.jar');
      if (!existsSync(jar)) throw new Blocked('Expected ApacheJMeter.jar beside the configured JMeter batch file.');
      executable = 'java'; args.unshift('-jar', jar);
    }
    await requiredCommand(run, 'JMeter read-only baseline (categories, nearby incidents, nearby events)', executable, args, { cwd: dirname(bin) });
    const rows = csvRows(readFileSync(jtl, 'utf8'));
    const headers = rows.shift();
    const elapsedIndex = headers.indexOf('elapsed');
    const successIndex = headers.indexOf('success');
    if (elapsedIndex < 0 || successIndex < 0 || rows.length === 0) throw new Error('JMeter did not produce valid sample results.');
    const times = rows.map(r => Number(r[elapsedIndex])).sort((a, b) => a - b);
    const failures = rows.filter(r => r[successIndex] !== 'true').length;
    const p95Ms = times[Math.ceil(times.length * 0.95) - 1];
    const result = { users, rampSeconds, durationSeconds, samples: rows.length, failures, errorPercent: failures / rows.length * 100, p95Ms, acceptance: { zeroFailedSamples: failures === 0, p95Below2000Ms: p95Ms < 2000 }, scope: 'Bounded read baseline only; no writes, scalability claims or Grafana/k6 usage implied.' };
    writeFileSync(resolve(run.directory, 'performance-summary.json'), JSON.stringify(result, null, 2) + '\n');
    const pass = Object.values(result.acceptance).every(Boolean);
    run.summary.steps.push({ label: `${rows.length} requests: zero failures and p95 < 2000 ms`, status: pass ? 'PASS' : 'FAIL' });
    run.log(`Samples: ${rows.length}; failed samples: ${failures}; p95: ${p95Ms} ms\n`);
  } finally { unlinkSync(privateFile); rmdirSync(temp); }
}
