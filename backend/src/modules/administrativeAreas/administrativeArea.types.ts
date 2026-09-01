export type AdministrativeAreaDto = {
  id: string;
  officialCode: string;
  name: string;
  gnNumber: string | null;
  divisionalSecretariatName: string | null;
  districtName: string | null;
  provinceName: string | null;
};

export type ListAdministrativeAreasQuery = {
  search?: string;
  limit: number;
};

export type AdministrativeAreaBoundaryDto = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] };
    properties: {
      id: string;
      officialCode: string;
      name: string;
      divisionalSecretariatName: string | null;
      districtName: string | null;
    };
  }>;
};
