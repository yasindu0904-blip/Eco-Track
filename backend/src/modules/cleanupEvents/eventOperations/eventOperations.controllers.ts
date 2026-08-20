import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  createEventEvidenceUploadIntents,
  getEventCompletionReadiness,
  getEventOperations,
  getParticipantEventUpdates,
} from "./eventOperations.service.js";
import {
  addEventNoteSchema,
  cancelEventSchema,
  completeEventSchema,
  eventEvidenceUploadIntentSchema,
  eventOperationParametersSchema,
  eventSessionOperationParametersSchema,
  participantUpdateParametersSchema,
  registerEventEvidenceSchema,
  transitionEventSchema,
  transitionSessionSchema,
} from "./eventOperations.validation.js";
import { addEventNote } from "./use-cases/addEventNote.useCase.js";
import { cancelCleanupEvent } from "./use-cases/cancelCleanupEvent.useCase.js";
import { completeCleanupEvent } from "./use-cases/completeCleanupEvent.useCase.js";
import { registerEventEvidence } from "./use-cases/registerEventEvidence.useCase.js";
import { transitionEvent } from "./use-cases/transitionEvent.useCase.js";
import { transitionSession } from "./use-cases/transitionSession.useCase.js";

function invalid(result: { error: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const issue = result.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(400, "EVENT_OPERATION_REQUEST_INVALID", issue ? `${field ? `${field}: ` : ""}${issue.message}` : "The event operation request is invalid.");
}

const actor = (request: Request) => ({
  actorMembershipId: request.tenant!.membership.id,
  actorUserId: request.authentication!.profile.id,
});

export function getEventOperationsController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      response.status(200).json({ data: await getEventOperations(dependencies, parameters.data.organizationId, parameters.data.eventId) });
    } catch (error) { next(error); }
  };
}

export function getParticipantEventUpdatesController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = participantUpdateParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      response.status(200).json({ data: await getParticipantEventUpdates(dependencies, parameters.data.eventId, request.authentication!.profile.id) });
    } catch (error) { next(error); }
  };
}

export function addEventNoteController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = addEventNoteSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(201).json({ data: await addEventNote(dependencies, { ...parameters.data, ...body.data, ...actor(request) }) });
    } catch (error) { next(error); }
  };
}

export function createEventEvidenceUploadIntentsController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = eventEvidenceUploadIntentSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(201).json({ data: await createEventEvidenceUploadIntents(dependencies, { ...parameters.data, ...body.data, actorUserId: request.authentication!.profile.id }) });
    } catch (error) { next(error); }
  };
}

export function registerEventEvidenceController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = registerEventEvidenceSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(201).json({ data: await registerEventEvidence(dependencies, { ...parameters.data, ...body.data, actorUserId: request.authentication!.profile.id }) });
    } catch (error) { next(error); }
  };
}

export function transitionEventController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = transitionEventSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(200).json({ data: await transitionEvent(dependencies, { ...parameters.data, ...body.data, ...actor(request) }) });
    } catch (error) { next(error); }
  };
}

export function transitionSessionController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventSessionOperationParametersSchema.safeParse(request.params);
      const body = transitionSessionSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(200).json({ data: await transitionSession(dependencies, { ...parameters.data, ...body.data, actorUserId: request.authentication!.profile.id }) });
    } catch (error) { next(error); }
  };
}

export function getCompletionReadinessController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      response.status(200).json({ data: await getEventCompletionReadiness(dependencies, parameters.data.organizationId, parameters.data.eventId) });
    } catch (error) { next(error); }
  };
}

export function cancelEventController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = cancelEventSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(200).json({ data: await cancelCleanupEvent(dependencies, { ...parameters.data, ...body.data, ...actor(request) }) });
    } catch (error) { next(error); }
  };
}

export function completeEventController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = eventOperationParametersSchema.safeParse(request.params);
      const body = completeEventSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response.status(200).json({ data: await completeCleanupEvent(dependencies, { ...parameters.data, ...body.data, ...actor(request) }) });
    } catch (error) { next(error); }
  };
}
