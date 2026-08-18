export const MAP_LIMITS = {
  defaultPageSize: 50,
  maxPageSize: 100,
  minZoom: 5,
  maxZoom: 20,
  maxRadiusMeters: 50_000,
  maxLatitudeSpanDegrees: 1.5,
  maxLongitudeSpanDegrees: 1.5,
} as const;

export const ORGANIZATION_BOUNDARY_DISPLAY_LIMITS = {
  defaultFeatureLimit: 100,
  maxFeatureLimit: 100,
} as const;

export const SRI_LANKA_MAP_DEFAULTS = {
  latitude: 7.8731,
  longitude: 80.7718,
  zoom: 7,
} as const;

/**
 * A deliberately buffered rectangle for fast request validation. It is not
 * Sri Lanka's exact coastline and must not replace PostGIS polygon checks.
 */
export const SRI_LANKA_APPROXIMATE_BOUNDS = {
  south: 5.8,
  north: 10,
  west: 79.4,
  east: 82.1,
} as const;
