export const MAP_MARKER_KINDS = {
  incident: "INCIDENT",
  cleanupEvent: "CLEANUP_EVENT",
} as const;

export type MapMarkerKind =
  (typeof MAP_MARKER_KINDS)[keyof typeof MAP_MARKER_KINDS];

export interface MapLocation {
  latitude: number;
  longitude: number;
}
export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapViewport extends MapBounds {
  zoom: number;
}

export interface MapMarkerProperties {
  id: string;
  kind: MapMarkerKind;
  title: string;
  status: string;
  category?: string;
  occurredAt?: string;
}

export interface MapMarkerFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    /** GeoJSON coordinates are always longitude first, then latitude. */
    coordinates: [longitude: number, latitude: number];
  };
  properties: MapMarkerProperties;
}

export type MapBoundaryGeometry =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

export interface MapBoundaryFeature {
  type: "Feature";
  geometry: MapBoundaryGeometry;
  properties: {
    id: string;
    name: string;
    officialCode: string | null;
    status: string;
  };
}

export interface MapBoundaryFeatureCollection {
  type: "FeatureCollection";
  features: MapBoundaryFeature[];
  truncated: boolean;
}

export interface MapViewportRequestContext {
  signal: AbortSignal;
  requestId: number;
}

export type MapViewportChangeHandler = (
  viewport: MapViewport,
  context: MapViewportRequestContext,
) => void | Promise<void>;

export function markerLocation(marker: MapMarkerFeature): MapLocation {
  return {
    longitude: marker.geometry.coordinates[0],
    latitude: marker.geometry.coordinates[1],
  };
}
