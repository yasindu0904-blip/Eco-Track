# MAP-01 mobile handoff

The native map foundation uses `@maplibre/maplibre-react-native` with an
OpenStreetMap raster style and `expo-location` for one-shot foreground GPS.
Import public contracts from `src/features/map`.

## Development preview

The map picker can be opened without changing the normal authentication flow:

```powershell
cd mobile
npm run start:map
```

Open the EcoTrack development build and select the development server. On the
Android emulator, the server is also reachable through `http://10.0.2.2:8081`.
The normal `npm start` command continues to load the regular EcoTrack app.

## Components

- `EcoMap` renders the shared GeoJSON incident/event marker contract, native
  marker clustering, bounded/debounced viewport events, a current-location
  action, and an accessible horizontal list fallback.
- `LocationPicker` keeps a black pin fixed at the map center. Moving the map
  updates the selected coordinates beneath the pin. It also supports one-shot
  GPS, manual coordinates, permission-denied fallback, and explicit confirm.
  When it is placed inside a `ScrollView`, connect `onMapInteractionChange` to
  the parent's `scrollEnabled` state so vertical map gestures are not captured
  by the page.

Location is requested only when the user presses **My location**. The feature
does not call a location watcher and does not request background permission.

## Native setup

MapLibre contains native Android/iOS code and cannot run in Expo Go. After
merging the dependency and `app.json` plugin changes, regenerate/rebuild the
development client:

```powershell
cd mobile
npx expo prebuild --clean
npx expo run:android --device
```

After that initial rebuild, TypeScript-only changes can normally use:

```powershell
npx expo start --dev-client
```

On Windows, build from a short path such as `C:\e\mobile` when the repository
is stored under a long OneDrive path. React Native's generated MapLibre C++
target names can otherwise exceed the path length supported by the Ninja
version bundled with Android CMake.

Production should use a reviewed tile provider or EcoTrack-hosted tiles rather
than relying on the public OpenStreetMap tile endpoint at scale.

## Coordinate and viewport contracts

The mobile types intentionally match the backend and web MAP-01 contracts.
GeoJSON uses `[longitude, latitude]`; API forms use
`{ latitude, longitude }`. `onViewportChange(viewport, context)` is debounced
by 400 ms, aborts stale callbacks, and is suppressed for bounds over 1.5°.
