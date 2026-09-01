import { ApplicationError } from "../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../organizations/application/application.dependencies.js";
import { findAdministrativeAreaBoundaryRecord } from "../repositories/administrativeArea.repository.js";
import type { AdministrativeAreaBoundaryDto } from "../administrativeArea.types.js";

export async function getAdministrativeAreaBoundary(
  dependencies: OrganizationApplicationDependencies,
  areaId: string,
): Promise<AdministrativeAreaBoundaryDto> {
  const area = await findAdministrativeAreaBoundaryRecord(dependencies.prisma, areaId);
  if (!area) {
    throw new ApplicationError(404, "ADMINISTRATIVE_AREA_NOT_FOUND", "The active GN Division was not found.");
  }

  const geometry = JSON.parse(area.geometry) as AdministrativeAreaBoundaryDto["features"][number]["geometry"];
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    throw new ApplicationError(500, "ADMINISTRATIVE_AREA_BOUNDARY_INVALID", "The GN Division boundary is invalid.");
  }

  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry,
      properties: {
        id: area.id,
        officialCode: area.officialCode,
        name: area.name,
        divisionalSecretariatName: area.divisionalSecretariatName,
        districtName: area.districtName,
      },
    }],
  };
}
