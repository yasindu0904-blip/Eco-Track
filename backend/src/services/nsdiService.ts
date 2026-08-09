import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

const NSDI_DS_LAYER = "https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Survey_10k/MapServer/3";

export type NsdiDsDivisionLookupResult = {
  dsDivisionName: string;
  districtName: string;
  provinceName: string;
  geojson: FeatureCollection<Geometry, GeoJsonProperties>;
};

export async function lookupDsDivisionByCoordinate(
  lat: number,
  lon: number,
): Promise<NsdiDsDivisionLookupResult | null> {
  const queryParams = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "ds_division_name,district_name,province_name",
    returnGeometry: "true",
  });

  const response = await fetch(`${NSDI_DS_LAYER}/query?${queryParams.toString()}`);

  if (!response.ok) {
    throw new Error(`NSDI service error: ${response.status} ${response.statusText}`);
  }

  const geojson = (await response.json()) as FeatureCollection<Geometry, GeoJsonProperties>;

  if (!geojson.features || geojson.features.length === 0) {
    return null;
  }

  const feature = geojson.features[0];
  const properties = feature.properties ?? {};

  return {
    dsDivisionName:
      String(properties.ds_division_name ?? properties.DS_DIVISION_NAME ?? "").trim(),
    districtName: String(properties.district_name ?? properties.DISTRICT_NAME ?? "").trim(),
    provinceName: String(properties.province_name ?? properties.PROVINCE_NAME ?? "").trim(),
    geojson: {
      type: "FeatureCollection",
      features: [feature],
    },
  };
}
