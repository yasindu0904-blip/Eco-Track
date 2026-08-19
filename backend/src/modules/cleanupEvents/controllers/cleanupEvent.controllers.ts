import type { NextFunction, Request, Response } from "express";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  createDraftSchema,
  draftIdParametersSchema,
  updateDraftSchema,
  createSessionSchema,
  eventSessionParametersSchema,
  assignCoordinatorSchema,
} from "../cleanupEvent.validation.js";
import {
  createDraft,
  updateDraft,
  listMyDrafts,
  getMyDraft,
  createSession,
  removeSession,
  updateSession,
  assignCoordinator,
  removeCoordinator,
} from "../services/cleanupEvent.service.js";
import { ApplicationError } from "../../../errors/applicationError.js";

function validationError(validation: { error: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const issue = validation.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(
    400,
    "CLEANUP_EVENT_REQUEST_INVALID",
    issue ? `${field ? `${field}: ` : ""}${issue.message}` : "The cleanup event request is invalid.",
  );
}

export function createDraftController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = createDraftSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation);
      const tenant = request.tenant!;
      const result = await createDraft(deps, tenant.organization.id, tenant.membership.id, validation.data);
      response.status(201).json({ data: result });
    } catch (error) { next(error); }
  };
}

export function updateDraftController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const idValidation = draftIdParametersSchema.safeParse(request.params);
      if (!idValidation.success) throw validationError(idValidation as any);
      const validation = updateDraftSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation as any);
      const tenant = request.tenant!;
      const result = await updateDraft(deps, tenant.organization.id, tenant.membership.id, idValidation.data.id, validation.data);
      response.status(200).json({ data: result });
    } catch (error) { next(error); }
  };
}

export function listMyDraftsController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const tenant = request.tenant!;
      response.status(200).json({ data: await listMyDrafts(deps, tenant.organization.id, tenant.membership.id) });
    } catch (error) { next(error); }
  };
}

export function getMyDraftController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const idValidation = draftIdParametersSchema.safeParse(request.params);
      if (!idValidation.success) throw validationError(idValidation as any);
      const tenant = request.tenant!;
      response.status(200).json({ data: await getMyDraft(deps, tenant.organization.id, tenant.membership.id, idValidation.data.id) });
    } catch (error) { next(error); }
  };
}

export function createSessionController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = createSessionSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation as any);
      const tenant = request.tenant!;
      const cleanupEventId = String(request.params.eventId);
      const result = await createSession(deps, tenant.organization.id, cleanupEventId, validation.data);
      response.status(201).json({ data: result });
    } catch (error) { next(error); }
  };
}

export function removeSessionController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const idValidation = eventSessionParametersSchema.safeParse(request.params);
      if (!idValidation.success) throw validationError(idValidation as any);
      const tenant = request.tenant!;
      await removeSession(deps, tenant.organization.id, idValidation.data.eventId, idValidation.data.sessionId);
      response.status(204).send();
    } catch (error) { next(error); }
  };
}

export function updateSessionController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = eventSessionParametersSchema.safeParse(request.params);
      if (!parameters.success) throw validationError(parameters as any);
      const validation = createSessionSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation as any);
      response.status(200).json({ data: await updateSession(deps, request.tenant!.organization.id, parameters.data.eventId, parameters.data.sessionId, validation.data) });
    } catch (error) { next(error); }
  };
}

export function assignCoordinatorController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = assignCoordinatorSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation as any);
      const tenant = request.tenant!;
      const cleanupEventId = String(request.params.eventId);
      const result = await assignCoordinator(deps, tenant.organization.id, cleanupEventId, validation.data.membershipId, tenant.membership.id);
      response.status(201).json({ data: result });
    } catch (error) { next(error); }
  };
}

export function removeCoordinatorController(deps: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = assignCoordinatorSchema.safeParse(request.body);
      if (!validation.success) throw validationError(validation as any);
      const tenant = request.tenant!;
      const cleanupEventId = String(request.params.eventId);
      await removeCoordinator(deps, tenant.organization.id, cleanupEventId, validation.data.membershipId);
      response.status(204).send();
    } catch (error) { next(error); }
  };
}
