# Complete configuration map

The archived files under `snapshots/` mirror their original repository paths.
They contain actual settings; only the EAS public environment values have been
replaced with deployment placeholders. Do not execute archived configs in place:
relative paths to `src`, assets, migrations and package dependencies target the
original project folders.

| Files | Purpose / original location |
| --- | --- |
| `snapshots/backend/tsconfig.json`, `prisma.config.ts` | Strict NodeNext compilation; Prisma schema/migrations/seed |
| `snapshots/web/tsconfig*.json`, `vite.config.ts` | Web TypeScript and bundler |
| `snapshots/web/eslint.config.js`, `postcss.config.mjs` | Web lint and CSS |
| `snapshots/mobile/tsconfig.json`, `metro.config.js` | Expo TypeScript and Metro |
| `snapshots/mobile/app.json`, `eas.json` | App icon/package/plugins, EAS development and standalone preview profiles |
| `snapshots/backend/Dockerfile`, `snapshots/web/Dockerfile`, `snapshots/web/nginx.conf` | Container build and SPA serving |
| `snapshots/compose.yaml`, `compose.local-db.yaml`, `docker/postgres/init/20-supabase-compat.sql` | Existing deployment/local stacks and PostGIS bootstrap |
| `snapshots/.github/workflows/ci.yml` | Existing CI backend, web and mobile checks |
| `snapshots/backend/package.json`, `snapshots/web/package.json`, `snapshots/mobile/package.json` | Original test/build scripts and version declarations; original lockfiles remain in each project |
| `tests/compose.test.yaml`, `tests/bootstrap.sql` | Runnable isolated submission test infrastructure |
| `backend/.env.example`, `web/.env.example`, `mobile/.env.example` | Complete application runtime variable templates |
| `mobile/google-services.example.json` | Firebase Android client configuration shape; download the real `mobile/google-services.json` from the owner's matching Firebase Android project |
| `../.env.example` | Complete submission-runner settings |

Tests use Node's test runner/tsx (backend) and Vitest (web/mobile), currently
without standalone Jest/Playwright configuration. UI files select jsdom or
mock native dependencies themselves. The runner provides test CLI options and
file selection; it does not invent configuration for tools the app does not use.

Backend and notification worker must share `DATABASE_URL`, `REDIS_URL` and
`REDIS_KEY_PREFIX` for the same environment. Use different Redis prefixes for
production and testing. Worker command: `node dist/workers/notification.worker.js`.
For TLS-hosted Redis use its `rediss://` URL; the isolated local Redis uses `redis://`.
Backend URL/key and client public Supabase URL/key must refer to the same Auth
project. Client API base URLs include `/api/v1`; runner API origin does not.

Database URLs, service-role keys and Expo access tokens are backend-only secrets.
VITE_* and EXPO_PUBLIC_* are embedded in client builds and must contain only
public configuration. OAuth/magic-link redirect allowlists, storage buckets,
push credentials, Northflank settings and EAS account access are external service
configuration; supplying files alone does not provision or verify those services.

Firebase example values cannot produce a working push-enabled APK. Use the
downloaded real Android client configuration with package `com.ecotrack.mobile`,
and configure the FCM server credential in EAS separately. The example is not a
Firebase service-account private key.
