import { resolve } from 'node:path';
import { repository } from './inventory.mjs';
import { loadSettings, integrationEnvironment, dependency, Blocked } from './lib.mjs';
import { spawn } from 'node:child_process';

loadSettings();
try {
  const env = integrationEnvironment('interactive');
  env.SUPABASE_URL = process.env.SUBMISSION_SUPABASE_URL || env.SUPABASE_URL;
  env.SUPABASE_PUBLISHABLE_KEY = process.env.SUBMISSION_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUBMISSION_SUPABASE_SERVICE_ROLE_KEY || '';
  env.WEB_ORIGIN = process.env.SUBMISSION_WEB_ORIGIN || env.WEB_ORIGIN;
  console.log('Starting test API on port 5025 with dedicated submission database and Redis. Ctrl+C stops it.');
  const child = spawn(process.execPath, [dependency('backend', 'tsx/dist/cli.mjs'), 'src/server.ts'], { cwd: resolve(repository, 'backend'), env, stdio: 'inherit' });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  child.once('error', () => { console.error('Could not start backend. Run setup and db:prepare first.'); process.exitCode = 2; });
  child.once('exit', code => { process.exitCode = code || 0; });
} catch (error) { console.error(error.message); process.exitCode = error instanceof Blocked ? 2 : 1; }
