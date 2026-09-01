import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";

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

export async function findAdministrativeAreaBoundaryRecord(
  prisma: PrismaClient,
  areaId: string,
) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      officialCode: string;
      name: string;
      divisionalSecretariatName: string | null;
      districtName: string | null;
      geometry: string;
    }>
  >(Prisma.sql`
    SELECT
      area."id",
      area."official_code" AS "officialCode",
      area."name_en" AS "name",
      area."divisional_secretariat_name" AS "divisionalSecretariatName",
      area."district_name" AS "districtName",
      extensions.ST_AsGeoJSON(
        extensions.ST_SimplifyPreserveTopology(area."boundary"::extensions.geometry, 0.00002)
      ) AS "geometry"
    FROM "public"."administrative_areas" AS area
    WHERE area."id" = ${areaId}::uuid
      AND area."is_active" = true
      AND area."level" = 'GN_DIVISION'
    LIMIT 1
  `);
  return rows[0] ?? null;
}
