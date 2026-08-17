import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { IncidentDependencies } from "../incident.dependencies.js";
import {
  createEvidenceUploadIntents,
  createIncident,
  getActiveIncidentCategories,
  getMyIncident,
  getPublicSafeIncident,
  listMyIncidents,
} from "../services/incident.service.js";
import {
  createEvidenceUploadIntentsSchema,
  createIncidentSchema,
  incidentIdParametersSchema,
  incidentListQuerySchema,
} from "../incident.validation.js";

function validationError(validation: { error: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const issue = validation.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(
    400,
    "INCIDENT_REQUEST_INVALID",
    issue ? `${field ? `${field}: ` : ""}${issue.message}` : "The incident request is invalid.",
  );
}

export function listIncidentCategoriesController(dependencies: IncidentDependencies) {
  return async (_request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({ data: await getActiveIncidentCategories(dependencies) });
    } catch (error) { next(error); }
  };
}

export function createEvidenceUploadIntentsController(dependencies: IncidentDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = createEvidenceUploadIntentsSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      const intents = await createEvidenceUploadIntents(
        dependencies,
        request.authentication.profile.id,
        validation.data,
      );
      response.status(201).json({ data: intents });
    } catch (error) { next(error); }
  };
}

export function createIncidentController(dependencies: IncidentDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = createIncidentSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      const result = await createIncident(
        dependencies,
        request.authentication.profile.id,
        validation.data,
      );
      response.status(result.created ? 201 : 200).json({
        data: result.incident,
        meta: { idempotentReplay: !result.created },
      });
    } catch (error) { next(error); }
  };
}

export function listMyIncidentsController(dependencies: IncidentDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = incidentListQuerySchema.safeParse(request.query);
      if (!validation.success) throw validationError(validation);
      const page = await listMyIncidents(dependencies, {
        userId: request.authentication.profile.id,
        ...validation.data,
      });
      response.status(200).json({ data: page });
    } catch (error) { next(error); }
  };
}

function validateId(request: Request): string {
  const validation = incidentIdParametersSchema.safeParse(request.params);
  if (!validation.success) throw validationError(validation);
  return validation.data.id;
}

export function getMyIncidentController(dependencies: IncidentDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({
        data: await getMyIncident(
          dependencies,
          request.authentication.profile.id,
          validateId(request),
        ),
      });
    } catch (error) { next(error); }
  };
}

export function getPublicSafeIncidentController(dependencies: IncidentDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      response.status(200).json({
        data: await getPublicSafeIncident(dependencies, validateId(request)),
      });
    } catch (error) { next(error); }
  };
}
