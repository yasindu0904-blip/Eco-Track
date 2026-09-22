import type { OrganizationApplicationDependencies } from "../../organizations/application/application.dependencies.js";
import { listActiveGnDivisionRecords } from "../repositories/administrativeArea.repository.js";
import { readCached } from "../../../config/redisRuntime.js";
import type {
  AdministrativeAreaDto,
  ListAdministrativeAreasQuery,
} from "../administrativeArea.types.js";

export function listAdministrativeAreas(
  dependencies: OrganizationApplicationDependencies,
  query: ListAdministrativeAreasQuery,
): Promise<AdministrativeAreaDto[]> {
  return readCached(dependencies.cache, "reference:gn-divisions", [query.search?.trim().toLowerCase(), query.limit], 600,
    () => listActiveGnDivisionRecords(dependencies.prisma, query));
}
