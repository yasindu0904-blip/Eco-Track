# EcoTrack

EcoTrack is a multi-tenant platform for community-driven environmental incident reporting and cleanup coordination.

## Applications

```text
Eco-Track/
|-- backend/   Express, TypeScript, Prisma and PostgreSQL/PostGIS API
|-- web/       React, TypeScript and Vite web application
|-- mobile/    React Native, Expo and TypeScript Android application
|-- docs/      Project documentation
`-- docker/    Local container infrastructure
```

The Android/Expo development workflow runs directly on the host computer because it needs Metro, the Android SDK, Gradle and ADB. Docker runs the backend, web application and, when requested, a separate local PostGIS database.

## Docker: backend and web with Supabase

Create the local Docker environment file:

```powershell
Copy-Item .env.docker.example .env.docker
```

Replace the placeholders in `.env.docker` with the same Supabase values used by the existing applications. Then build and start the API and web containers:

```powershell
docker compose --env-file .env.docker up --build
```

If ports `5000` or `8080` are already in use, change `BACKEND_PORT`, `WEB_PORT`, `WEB_ORIGIN`, and `VITE_API_BASE_URL` together in `.env.docker`.

Open:

- Web application: http://localhost:8080
- Backend health endpoint: http://localhost:5000/health

This mode uses the hosted Supabase database in `DATABASE_URL`. It does not apply migrations automatically. Database migrations to Supabase remain an explicit deployment step.

## Docker: isolated local PostGIS database

To run the same backend and web containers with a separate local PostgreSQL/PostGIS database:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local-db.yaml up --build
```

This mode:

- starts PostgreSQL/PostGIS on host port `5433`;
- prepares the Supabase-compatible `extensions` schema and database roles;
- applies every committed Prisma migration before starting the backend;
- stores local database data in the `ecotrack-postgres-data` Docker volume;
- does not modify the hosted Supabase database.

The local database starts without the full GN Division reference dataset. Import it separately when that data is required.

Stop the containers while preserving the local database:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local-db.yaml down
```

To deliberately remove the isolated local database as well, add `--volumes` to that command. This permanently deletes the local Docker database data.
