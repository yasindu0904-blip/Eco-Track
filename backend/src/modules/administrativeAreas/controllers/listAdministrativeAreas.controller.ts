import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../organizations/application/application.dependencies.js";
import { listAdministrativeAreas } from "../services/listAdministrativeAreas.service.js";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function listAdministrativeAreasController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleListAdministrativeAreas(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = querySchema.safeParse(request.query);

      if (!validation.success) {
        throw new ApplicationError(
          400,
          "INVALID_ADMINISTRATIVE_AREA_QUERY",
          "The GN Division search query is invalid.",
        );
      }

      const areas = await listAdministrativeAreas(
        dependencies,
        validation.data,
      );

      response.status(200).json({ data: areas });
    } catch (error) {
      next(error);
    }
  };
}
