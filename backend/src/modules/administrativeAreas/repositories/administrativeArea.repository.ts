import type { PrismaClient } from "../../../generated/prisma/client.js";

import type {
  AdministrativeAreaDto,
  ListAdministrativeAreasQuery,
} from "../administrativeArea.types.js";

export async function listActiveGnDivisionRecords(
  prisma: PrismaClient,
  query: ListAdministrativeAreasQuery,
): Promise<AdministrativeAreaDto[]> {
  const search = query.search?.trim();

  const areas = await prisma.administrativeArea.findMany({
    where: {
      isActive: true,
      level: "GN_DIVISION",
      ...(search
        ? {
            OR: [
              { nameEn: { contains: search, mode: "insensitive" } },
              { officialCode: { contains: search, mode: "insensitive" } },
              {
                divisionalSecretariatName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              { districtName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ districtName: "asc" }, { nameEn: "asc" }],
    take: query.limit,
    select: {
      id: true,
      officialCode: true,
      nameEn: true,
      gnNumber: true,
      divisionalSecretariatName: true,
      districtName: true,
      provinceName: true,
    },
  });

  return areas.map((area) => ({
    id: area.id,
    officialCode: area.officialCode,
    name: area.nameEn,
    gnNumber: area.gnNumber,
    divisionalSecretariatName: area.divisionalSecretariatName,
    districtName: area.districtName,
    provinceName: area.provinceName,
  }));
}
