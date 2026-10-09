import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inventory, toolkit, repository } from './inventory.mjs';
import { Blocked, loadSettings, makeRun, testEnvironment, integrationEnvironment, dependency, npmCli, command, requiredCommand } from './lib.mjs';
import { smoke } from './smoke.mjs';
import { performanceTest } from './performance.mjs';
import { createConnection } from 'node:net';

loadSettings();
const action = process.argv[2];
const valid = ['setup', 'toolkit', 'unit', 'integration', 'ui', 'all', 'smoke', 'e2e', 'performance', 'build-backend', 'build-web', 'build-android', 'db-up', 'db-prepare', 'db-down'];
if (!valid.includes(action)) { console.error('Unknown command. Use the scripts in submission/package.json.'); process.exit(2); }

async function listening(port) {
  await new Promise((yes, no) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(3000);
    socket.once('connect', () => { socket.destroy(); yes(); });
    socket.once('error', () => { socket.destroy(); no(new Blocked('Test infrastructure is unavailable. Start Docker Desktop, then run npm run db:up and npm run db:prepare.')); });
    socket.once('timeout', () => { socket.destroy(); no(new Blocked('Test infrastructure connection timed out.')); });
  });
}
const composeArgs = ['compose', '-p', 'ecotrack-submission', '-f', resolve(toolkit, 'config/tests/compose.test.yaml')];

async function runCategory(category) {
  const run = makeRun(category);
  try {
    if (['unit', 'integration', 'ui'].includes(category)) {
      const selected = inventory().filter(t => t.category === category);
      run.summary.fileCount = selected.length;
      writeFileSync(resolve(run.directory, 'selected-tests.json'), JSON.stringify(selected, null, 2) + '\n');
      if (!selected.length) throw new Blocked('No test files exist for this category.');
      const env = category === 'integration' ? integrationEnvironment(run.runId) : testEnvironment(run.runId);
      for (const project of new Set(selected.map(t => t.project))) dependency(project, project === 'backend' ? 'tsx/dist/cli.mjs' : 'vitest/vitest.mjs');
      if (category === 'integration') {
        dependency('backend', 'tsx/dist/cli.mjs');
        await listening(55439);
        await listening(56389);
      }
      let failed = false;
      for (const project of ['backend', 'web', 'mobile']) {
        const files = selected.filter(t => t.project === project).map(t => t.file.slice(project.length + 1));
        if (!files.length) continue;
        const runner = dependency(project, project === 'backend' ? 'tsx/dist/cli.mjs' : 'vitest/vitest.mjs');
        const args = project === 'backend'
          ? [runner, '--test', '--test-reporter=tap', '--test-concurrency=1', ...files]
          : [runner, 'run', '--reporter=default', '--reporter=json', `--outputFile=${resolve(run.directory, `${project}-results.json`)}`, ...files];
        const code = await command(run, `${project} ${category}: ${files.length} files`, process.execPath, args, { cwd: resolve(repository, project), env });
        if (code !== 0) failed = true;
        if (project !== 'backend') {
          const p = resolve(run.directory, `${project}-results.json`);
          if (existsSync(p)) {
            const r = JSON.parse((await import('node:fs')).readFileSync(p, 'utf8'));
            run.summary.steps.at(-1).counts = { tests: r.numTotalTests, pass: r.numPassedTests, fail: r.numFailedTests, skipped: r.numPendingTests, todo: r.numTodoTests };
          }
        }
      }
      run.finish(failed ? 'FAIL' : 'PASS', 'All discovered files in this category were selected. Review per-step counts for skips; mocked UI tests do not verify live services.');
      return { category, status: run.summary.status, directory: run.directory, code: failed ? 1 : 0 };
    }
    if (category === 'e2e') throw new Blocked('No automated live-browser E2E suite exists for the production app. See tests/MANUAL-AND-E2E.md. The old mockup screenshot.spec.ts is excluded.');
    if (category === 'toolkit') await requiredCommand(run, 'Toolkit runner checks', process.execPath, ['--test', '--test-reporter=tap', resolve(toolkit, 'scripts/toolkit.test.mjs')]);
    else if (category === 'smoke') await smoke(run);
    else if (category === 'performance') await performanceTest(run);
    else if (category.startsWith('db-')) {
      const env = integrationEnvironment(run.runId);
      if (category === 'db-up') await requiredCommand(run, 'Start dedicated PostGIS and Redis', 'docker', [...composeArgs, 'up', '-d', '--wait'], { env });
      if (category === 'db-down') await requiredCommand(run, 'Stop only submission containers (temporary data is discarded)', 'docker', [...composeArgs, 'down'], { env });
      if (category === 'db-prepare') {
        await listening(55439);
        await requiredCommand(run, 'Apply migrations to submission test database', process.execPath, [dependency('backend', 'prisma/build/index.js'), 'migrate', 'deploy'], { cwd: resolve(repository, 'backend'), env });
        await requiredCommand(run, 'Generate Prisma client', process.execPath, [dependency('backend', 'prisma/build/index.js'), 'generate'], { cwd: resolve(repository, 'backend'), env });
      }
    } else if (category === 'setup') {
      for (const project of ['backend', 'web', 'mobile']) await requiredCommand(run, `Install ${project} locked dependencies`, process.execPath, [npmCli(), 'ci'], { cwd: resolve(repository, project) });
      await requiredCommand(run, 'Generate Prisma client (no database connection)', process.execPath, [dependency('backend', 'prisma/build/index.js'), 'generate'], { cwd: resolve(repository, 'backend') });
    } else if (category === 'build-backend') {
      await requiredCommand(run, 'Generate Prisma client', process.execPath, [dependency('backend', 'prisma/build/index.js'), 'generate'], { cwd: resolve(repository, 'backend') });
      await requiredCommand(run, 'Compile backend', process.execPath, [npmCli(), 'run', 'build'], { cwd: resolve(repository, 'backend') });
      run.summary.artifact = 'backend/dist/';
    } else if (category === 'build-web') {
      const env = testEnvironment(run.runId);
      Object.assign(env, {
        NODE_ENV: 'production',
        VITE_SUPABASE_URL: process.env.SUBMISSION_SUPABASE_URL || env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: process.env.SUBMISSION_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
        VITE_API_BASE_URL: process.env.SUBMISSION_WEB_API_BASE_URL || env.VITE_API_BASE_URL,
      });
      run.summary.publicConfigurationIsPlaceholder = env.VITE_SUPABASE_URL.includes('placeholder') || env.VITE_SUPABASE_URL.includes('YOUR_');
      await requiredCommand(run, 'Compile web application', process.execPath, [npmCli(), 'run', 'build'], { cwd: resolve(repository, 'web'), env });
      run.summary.artifact = 'web/dist/';
    } else if (category === 'build-android') {
      // Uses the real mobile/eas.json, not the archived placeholder snapshot.
      // EAS submission is explicit through this command; never part of test:all.
      const env = { ...process.env };
      for (const name of Object.keys(env)) if (/^(SUBMISSION_|DATABASE_|REDIS_|SUPABASE_SERVICE_ROLE|NF_|NORTHFLANK_)/.test(name)) delete env[name];
      await requiredCommand(run, 'Submit standalone preview APK build to EAS', process.execPath, [npmCli(), 'exec', '--yes', '--package=eas-cli', '--', 'eas', 'build', '--platform', 'android', '--profile', 'preview'], { cwd: resolve(repository, 'mobile'), env });
      run.summary.artifact = 'EAS build URL/APK link in console.txt; cloud build uses existing preview profile.';
    }
    const failed = run.summary.steps.some(s => s.status === 'FAIL');
    run.finish(failed ? 'FAIL' : 'PASS');
    return { category, status: run.summary.status, directory: run.directory, code: failed ? 1 : 0 };
  } catch (error) {
    const blocked = error instanceof Blocked && !run.summary.steps.some(s => s.status === 'FAIL');
    run.finish(blocked ? 'BLOCKED' : 'FAIL', error.message);
    return { category, status: run.summary.status, directory: run.directory, code: blocked ? 2 : 1 };
  }
}
if (action === 'all') {
  const run = makeRun('all');
  const results = [];
  for (const category of ['unit', 'integration', 'ui']) results.push(await runCategory(category));
  run.summary.categories = results;
  const code = results.some(r => r.code === 1) ? 1 : results.some(r => r.code === 2) ? 2 : 0;
  run.finish(code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'BLOCKED', 'Scope: unit, integration and UI. Smoke requires a running API; performance requires fixture IDs and opt-in; E2E is currently manual. These are excluded, not reported as passed.');
  process.exitCode = code;
} else process.exitCode = (await runCategory(action)).code;
