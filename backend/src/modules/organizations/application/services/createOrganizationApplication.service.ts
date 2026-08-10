import { randomUUID } from "node:crypto";

import { ApplicationError } from "../../../../errors/applicationError.js";
import {
  AccountStatus,
  PlatformRole,
} from "../../../../generated/prisma/enums.js";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import type {
  CreateOrganizationApplicationCommand,
  OrganizationApplicationDto,
} from "../application.types.js";
import {
  createOrganizationApplicationRecord,
  organizationSlugExists,
  validateServiceAreaBoundary,
} from "../repositories/organizationApplication.repository.js";

function createSlugBase(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || "organization";
}

async function createAvailableSlug(
  dependencies: OrganizationApplicationDependencies,
  organizationName: string,
): Promise<string> {
  const base = createSlugBase(organizationName);

  if (!(await organizationSlugExists(dependencies.prisma, base))) {
    return base;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const candidate = `${base.slice(0, 71)}-${suffix}`;

    if (!(await organizationSlugExists(dependencies.prisma, candidate))) {
      return candidate;
    }
  }

  throw new ApplicationError(
    409,
    "ORGANIZATION_SLUG_UNAVAILABLE",
    "A unique organization identifier could not be generated.",
  );
}

export async function createOrganizationApplication(
  dependencies: OrganizationApplicationDependencies,
  command: CreateOrganizationApplicationCommand,
): Promise<OrganizationApplicationDto> {
  const requester = await dependencies.prisma.userProfile.findUnique({
    where: { id: command.requesterUserId },
    select: {
      platformRole: true,
      accountStatus: true,
    },
  });

  if (!requester) {
    throw new ApplicationError(
      401,
      "AUTHENTICATED_PROFILE_NOT_FOUND",
      "The authenticated user profile could not be found.",
    );
  }

  if (
    requester.accountStatus !== AccountStatus.ACTIVE ||
    requester.platformRole !== PlatformRole.USER
  ) {
    throw new ApplicationError(
      403,
      "ORGANIZATION_APPLICATION_NOT_ALLOWED",
      "Only active citizen accounts may submit organization applications.",
    );
  }

  for (let index = 0; index < command.application.serviceAreas.length; index += 1) {
    const serviceArea = command.application.serviceAreas[index];

    if (!serviceArea) {
      continue;
    }

    const validation = await validateServiceAreaBoundary(
      dependencies.prisma,
      serviceArea.boundary,
    );

    if (
      validation.isEmpty ||
      !validation.isValid ||
      validation.geometryType !== "MULTIPOLYGON"
    ) {
      throw new ApplicationError(
        422,
        "INVALID_SERVICE_AREA_BOUNDARY",
        `Service area ${index + 1} has an invalid MultiPolygon boundary: ${validation.validityReason}`,
      );
    }
  }

  const slug = await createAvailableSlug(
    dependencies,
    command.application.name,
  );

  return createOrganizationApplicationRecord(dependencies.prisma, {
    ...command,
    slug,
  });
}
