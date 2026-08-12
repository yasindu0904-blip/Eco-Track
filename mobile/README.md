# EcoTrack Mobile

React Native + Expo + TypeScript client for EcoTrack.

## Implemented flows

- Supabase passwordless magic-link authentication
- `ecotrack://auth/callback` deep-link session callback
- Encrypted persisted Supabase sessions through Expo SecureStore
- Backend profile loading through `GET /api/v1/auth/me`
- Citizen/volunteer dashboard
- Official GN Division search and selection
- Organization onboarding submission and personal application-status history
- Super Admin protected-access check
- Pending organization queue, details, approval, and decline

All EcoTrack application data is read and written through the Express API. The mobile app never connects directly to Prisma/PostgreSQL and never trusts a locally supplied role.

## Local environment

Copy `.env.example` to `.env.local` and provide:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (never the service-role key)
- `EXPO_PUBLIC_API_BASE_URL`

For a physical Android phone, `EXPO_PUBLIC_API_BASE_URL` must use the development computer's LAN IPv4 address, for example:

```text
http://192.168.1.100:5000/api/v1
```

The phone and computer must be on the same network, and Windows Firewall must allow the backend port.

Add this redirect URL to the Supabase project's allowed authentication redirect URLs:

```text
ecotrack://auth/callback
```

## Commands

```powershell
npm run typecheck
npm run doctor
npm run security:check
npm run android
```

`npm run android` creates/opens a development build on a USB-connected Android phone. Enable Developer options and USB debugging first.

## Build-tool security note

Expo SDK 57 currently brings `image-size` through Metro. The latest published
`image-size` release has unresolved denial-of-service advisories in its ICNS,
JXL, and HEIF parsers. EcoTrack does not use those formats, so
`metro.config.js` disables all three before Metro processes assets.

`npm run security:check` verifies the mitigation with crafted inputs. npm's
version-based audit will continue to list the advisory through several Expo and
React Native dependency paths until `image-size` publishes a patched version
and Expo/Metro adopts it. Do not use `npm audit fix --force`; it proposes
incompatible Expo and React Native downgrades.
