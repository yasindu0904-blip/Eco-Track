# MAP-01 web handoff

The production map foundation uses `leaflet` and `react-leaflet` with
OpenStreetMap tiles. Import all public contracts from `features/maps` rather
than importing implementation files directly.

## Components

- `EcoMap` renders typed incident/event markers, clusters nearby markers,
  provides the accessible list fallback, requests location only after a user
  action, and emits bounded/debounced viewport changes.
- `LocationPicker` keeps a black pin fixed at the map center while the user
  moves the map underneath it. It also supports foreground browser location,
  manual coordinate entry, and an explicit confirmation action.
- `MapFoundationPreview` is a development-only demonstration mounted by
  `App.tsx` when the query string contains `map-preview=1`.

## Marker contract

`MapMarkerFeature` is compatible with the backend GeoJSON marker contract.
GeoJSON geometry always stores `[longitude, latitude]`; form/API location
objects use `{ latitude, longitude }`.

## Viewport requests

`onViewportChange(viewport, context)` runs after a 400 ms debounce. Pass
`context.signal` to the API client so a newer pan/zoom cancels stale work.
Callbacks are suppressed when the visible bounds exceed the backend's 1.5°
latitude/longitude limits.

```tsx
<EcoMap
  markers={features}
  onMarkerSelect={setSelectedMarker}
  onViewportChange={(viewport, { signal }) =>
    loadMapFeatures(viewport, { signal })
  }
/>
```

```tsx
<LocationPicker
  value={location}
  onChange={setLocation}
  onConfirm={saveConfirmedLocation}
/>
```
