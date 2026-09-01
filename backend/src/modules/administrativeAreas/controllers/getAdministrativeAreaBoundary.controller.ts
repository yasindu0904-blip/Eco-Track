import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { OrganizationApplicationDependencies } from "../../organizations/application/application.dependencies.js";
import { getAdministrativeAreaBoundary } from "../services/getAdministrativeAreaBoundary.service.js";

const parametersSchema = z.object({ areaId: z.string().uuid() }).strict();

export function getAdministrativeAreaBoundaryController(dependencies: OrganizationApplicationDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = parametersSchema.safeParse(request.params);
      if (!validation.success) {
        throw new ApplicationError(400, "INVALID_ADMINISTRATIVE_AREA_ID", "The GN Division ID is invalid.");
      }
      response.status(200).json({ data: await getAdministrativeAreaBoundary(dependencies, validation.data.areaId) });
    } catch (error) {
      next(error);
    }
  };
}
