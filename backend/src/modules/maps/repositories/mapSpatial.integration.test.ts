import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";

import { prisma } from "../../../database/prisma.js";
import {
  OrganizationStatus,
  ServiceAreaStatus,
} from "../../../generated/prisma/enums.js";
import {
  isLocationCoveredByActiveOrganizationServiceArea,
  listOrganizationServiceAreaBoundaryFeatures,
} from "./mapSpatial.repository.js";

const profileId = randomUUID();
const organizationId = randomUUID();
const administrativeAreaId = randomUUID();
const serviceAreaId = randomUUID();

before(async () => {
  await prisma.userProfile.create({
    data: {
      id: profileId,
      authUserId: randomUUID(),
      email: `map-foundation-${profileId}@example.com`,
      fullName: "Map Foundation Test User",
    },
  });

  await prisma.organization.create({
    data: {
      id: organizationId,
      requestedByUserId: profileId,
      name: "Map Foundation Test Organization",
      slug: `map-foundation-${organizationId}`,
      officialEmail: `map-foundation-${organizationId}@example.com`,
      officialPhone: "+94 70 000 0010",
      officialAddress: "Map foundation test address",
      status: OrganizationStatus.ACTIVE,
      activatedAt: new Date(),
    },
  });

  await prisma.$executeRaw`
    INSERT INTO "administrative_areas" (
      "id",
      "level",
      "official_code",
      "name_en",
      "boundary",
      "source_name",
      "source_version",
      "updated_at"
    ) VALUES (
      ${administrativeAreaId}::uuid,
      'GN_DIVISION'::"AdministrativeAreaLevel",
      ${`MAP-${administrativeAreaId}`},
      'Map Foundation Test GN Division',
      extensions.ST_GeogFromText(
        'SRID=4326;MULTIPOLYGON(((79.85 6.92,79.87 6.92,79.87 6.94,79.85 6.94,79.85 6.92)))'
      ),
      'EcoTrack map foundation integration test',
      'test-v1',
      CURRENT_TIMESTAMP
    )
  `;

  await prisma.organizationServiceArea.create({
    data: {
      id: serviceAreaId,
      organizationId,
      administrativeAreaId,
      status: ServiceAreaStatus.ACTIVE,
    },
  });
});

after(async () => {
  await prisma.organizationServiceArea.deleteMany({
    where: { id: serviceAreaId },
  });
  await prisma.organization.deleteMany({
    where: { id: organizationId },
  });
  await prisma.administrativeArea.deleteMany({
    where: { id: administrativeAreaId },
  });
  await prisma.userProfile.deleteMany({
    where: { id: profileId },
  });
});

test("includes interior and boundary points but excludes outside points", async () => {
  assert.equal(
    await isLocationCoveredByActiveOrganizationServiceArea(
      prisma,
      organizationId,
      { latitude: 6.93, longitude: 79.86 },
    ),
    true,
  );

  assert.equal(
    await isLocationCoveredByActiveOrganizationServiceArea(
      prisma,
      organizationId,
      { latitude: 6.92, longitude: 79.85 },
    ),
    true,
  );

  assert.equal(
    await isLocationCoveredByActiveOrganizationServiceArea(
      prisma,
      organizationId,
      { latitude: 7.1, longitude: 80.1 },
    ),
    false,
  );
});

test("inactive service areas do not authorize location coverage", async () => {
  await prisma.organizationServiceArea.update({
    where: { id: serviceAreaId },
    data: { status: ServiceAreaStatus.INACTIVE },
  });

  try {
    assert.equal(
      await isLocationCoveredByActiveOrganizationServiceArea(
        prisma,
        organizationId,
        { latitude: 6.93, longitude: 79.86 },
      ),
      false,
    );
  } finally {
    await prisma.organizationServiceArea.update({
      where: { id: serviceAreaId },
      data: { status: ServiceAreaStatus.ACTIVE },
    });
  }
});

test("returns an organization-scoped GeoJSON service-area overlay", async () => {
  const collection =
    await listOrganizationServiceAreaBoundaryFeatures(
      prisma,
      organizationId,
    );

  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 1);
  assert.equal(
    collection.features[0]?.geometry.type,
    "MultiPolygon",
  );
  assert.equal(
    collection.features[0]?.properties.officialCode,
    `MAP-${administrativeAreaId}`,
  );
});
