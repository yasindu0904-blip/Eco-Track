import type { OrganizationApplicationDependencies } from "../../organizations/application/application.dependencies.js";
import { listActiveGnDivisionRecords } from "../repositories/administrativeArea.repository.js";
import type {
  AdministrativeAreaDto,
  ListAdministrativeAreasQuery,
} from "../administrativeArea.types.js";

export function listAdministrativeAreas(
  dependencies: OrganizationApplicationDependencies,
  query: ListAdministrativeAreasQuery,
): Promise<AdministrativeAreaDto[]> {
  return listActiveGnDivisionRecords(dependencies.prisma, query);
}
