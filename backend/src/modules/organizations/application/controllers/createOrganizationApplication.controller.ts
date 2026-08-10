import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../../../../errors/applicationError.js";

import type { OrganizationApplicationDependencies } from "../application.dependencies.js";
import { createOrganizationApplication } from "../services/createOrganizationApplication.service.js";
import { createOrganizationApplicationSchema } from "../application.validation.js";

function formatValidationMessage(
  path: PropertyKey[],
  message: string,
): string {
  const field = path.map(String).join(".");

  return field ? `${field}: ${message}` : message;
}

export function createOrganizationApplicationController(
  dependencies: OrganizationApplicationDependencies,
) {
  return async function handleCreateOrganizationApplication(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validation = createOrganizationApplicationSchema.safeParse(
        request.body,
      );

      if (!validation.success) {
        const firstIssue = validation.error.issues[0];

        throw new ApplicationError(
          400,
          "INVALID_ORGANIZATION_APPLICATION",
          firstIssue
            ? formatValidationMessage(firstIssue.path, firstIssue.message)
            : "The organization application is invalid.",
        );
      }

      const application = await createOrganizationApplication(
        dependencies,
        {
          requesterUserId: request.authentication.profile.id,
          application: validation.data,
        },
      );

      response.status(201).json({
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };
}
