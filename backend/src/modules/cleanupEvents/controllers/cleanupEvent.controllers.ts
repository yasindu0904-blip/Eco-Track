import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  assignCoordinator,
  createDraft,
  createSession,
  discardDraft,
  getOrganizationDraft,
  listOrganizationDrafts,
  removeCoordinator,
  removeSession,
  updateDraft,
  updateSession,
} from "../services/cleanupEvent.service.js";
import {
  assignCoordinatorSchema,
  createDraftSchema,
  createSessionSchema,
  draftIdParametersSchema,
  eventParametersSchema,
  eventSessionParametersSchema,
  listDraftQuerySchema,
  updateDraftSchema,
} from "../cleanupEvent.validation.js";

type FailedValidation = {
  error: { issues: Array<{ path: PropertyKey[]; message: string }> };
};

function validationError(validation: FailedValidation): ApplicationError {
  const issue = validation.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(
    400,
    "CLEANUP_EVENT_REQUEST_INVALID",
    issue
      ? `${field ? `${field}: ` : ""}${issue.message}`
      : "The cleanup-event request is invalid.",
  );
}

export function createDraftController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = createDraftSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      response.status(201).json({
        data: await createDraft(
          dependencies,
          request.tenant!.organization.id,
          request.tenant!.membership.id,
          validation.data,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function updateDraftController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = draftIdParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      const validation = updateDraftSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      response.status(200).json({
        data: await updateDraft(
          dependencies,
          request.tenant!.organization.id,
          parameters.data.id,
          validation.data,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function listOrganizationDraftsController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = listDraftQuerySchema.safeParse(request.query);
      if (!validation.success) throw validationError(validation);
      response.status(200).json({
        data: await listOrganizationDrafts(
          dependencies,
          request.tenant!.organization.id,
          validation.data,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function getOrganizationDraftController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = draftIdParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      response.status(200).json({
        data: await getOrganizationDraft(
          dependencies,
          request.tenant!.organization.id,
          parameters.data.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function discardDraftController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = draftIdParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      await discardDraft(
        dependencies,
        request.tenant!.organization.id,
        parameters.data.id,
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

export function createSessionController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      const validation = createSessionSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      response.status(201).json({
        data: await createSession(
          dependencies,
          request.tenant!.organization.id,
          parameters.data.eventId,
          validation.data,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function updateSessionController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventSessionParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      const validation = createSessionSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      response.status(200).json({
        data: await updateSession(
          dependencies,
          request.tenant!.organization.id,
          parameters.data.eventId,
          parameters.data.sessionId,
          validation.data,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function removeSessionController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventSessionParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      await removeSession(
        dependencies,
        request.tenant!.organization.id,
        parameters.data.eventId,
        parameters.data.sessionId,
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

export function assignCoordinatorController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      const validation = assignCoordinatorSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      response.status(201).json({
        data: await assignCoordinator(
          dependencies,
          request.tenant!.organization.id,
          parameters.data.eventId,
          validation.data.membershipId,
          request.tenant!.membership.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function removeCoordinatorController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters);
      const validation = assignCoordinatorSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      await removeCoordinator(
        dependencies,
        request.tenant!.organization.id,
        parameters.data.eventId,
        validation.data.membershipId,
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
