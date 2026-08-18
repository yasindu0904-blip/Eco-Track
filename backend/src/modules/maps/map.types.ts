export type MapLocation = {
  latitude: number;
  longitude: number;
};

export type MapBoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapViewportQuery = MapBoundingBox & {
  zoom: number;
  limit: number;
  cursor?: string;
};

export type MapRadiusQuery = MapLocation & {
  radiusMeters: number;
  limit: number;
  cursor?: string;
};

export const MapMarkerKinds = {
  Incident: "INCIDENT",
  CleanupEvent: "CLEANUP_EVENT",
} as const;

export type MapMarkerKind =
  (typeof MapMarkerKinds)[keyof typeof MapMarkerKinds];

export type GeoJsonPoint = {
  type: "Point";
  /** GeoJSON always uses [longitude, latitude]. */
  coordinates: [longitude: number, latitude: number];
};

export type GeoJsonBoundary = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown[];
};

export type MapMarkerProperties = {
  id: string;
  kind: MapMarkerKind;
  title: string;
  status: string;
  category?: string;
  occurredAt?: string;
};

export type MapMarkerFeature = {
  type: "Feature";
  geometry: GeoJsonPoint;
  properties: MapMarkerProperties;
};

export type MapMarkerFeatureCollection = {
  type: "FeatureCollection";
  features: MapMarkerFeature[];
};

export type OrganizationServiceAreaBoundaryProperties = {
  id: string;
  name: string;
  officialCode: string | null;
  status: string;
};

export type OrganizationServiceAreaBoundaryFeature = {
  type: "Feature";
  geometry: GeoJsonBoundary;
  properties: OrganizationServiceAreaBoundaryProperties;
};

export type OrganizationServiceAreaBoundaryCollection = {
  type: "FeatureCollection";
  features: OrganizationServiceAreaBoundaryFeature[];
  truncated: boolean;
};

export function toGeoJsonPoint(
  location: MapLocation,
): GeoJsonPoint {
  return {
    type: "Point",
    coordinates: [
      location.longitude,
      location.latitude,
    ],
  };
}
