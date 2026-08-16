import type { MapBounds, MapLocation } from "./map.types";

export const SRI_LANKA_MAP_CENTER: MapLocation = {
  latitude: 7.8731,
  longitude: 80.7718,
};

export const COLOMBO_MAP_CENTER: MapLocation = {
  latitude: 6.9271,
  longitude: 79.8612,
};

export const SRI_LANKA_MAP_BOUNDS: MapBounds = {
  west: 79.4,
  south: 5.8,
  east: 82.1,
  north: 10,
};

export const MAP_REQUEST_LIMITS = {
  debounceMilliseconds: 400,
  maxLatitudeSpanDegrees: 1.5,
  maxLongitudeSpanDegrees: 1.5,
} as const;

export function isWithinSriLankaBounds(location: MapLocation): boolean {
  return (
    location.latitude >= SRI_LANKA_MAP_BOUNDS.south &&
    location.latitude <= SRI_LANKA_MAP_BOUNDS.north &&
    location.longitude >= SRI_LANKA_MAP_BOUNDS.west &&
    location.longitude <= SRI_LANKA_MAP_BOUNDS.east
  );
}

