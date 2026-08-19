import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import {
  listMyParticipationsQuerySchema,
  participationAvailabilitySchema,
  publicEventParametersSchema,
} from "../cleanupEvent.validation.js";
import {
  getMyParticipation,
  listMyParticipations,
} from "./participation.service.js";
import { joinEvent } from "./use-cases/joinCleanupEvent.useCase.js";
import { updateAvailability } from "./use-cases/updateAvailability.useCase.js";
import { withdrawFromEvent } from "./use-cases/withdrawFromCleanupEvent.useCase.js";

function invalid(validation: { error: { issues: Array<{ path: PropertyKey[]; message: string }> } }): ApplicationError {
  const issue = validation.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(400, "EVENT_PARTICIPATION_REQUEST_INVALID", issue ? `${field ? `${field}: ` : ""}${issue.message}` : "The participation request is invalid.");
}

export function joinEventController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = publicEventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      const body = participationAvailabilitySchema.safeParse(request.body);
      if (!body.success) throw invalid(body);
      const result = await joinEvent(dependencies, parameters.data.eventId, request.authentication!.profile.id, body.data.sessionIds);
      response.status(result.created || result.rejoined ? 201 : 200).json({ data: result });
    } catch (error) { next(error); }
  };
}

export function getMyParticipationController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = publicEventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      response.status(200).json({ data: await getMyParticipation(dependencies, parameters.data.eventId, request.authentication!.profile.id) });
    } catch (error) { next(error); }
  };
}

export function updateAvailabilityController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = publicEventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      const body = participationAvailabilitySchema.safeParse(request.body);
      if (!body.success) throw invalid(body);
      response.status(200).json({ data: await updateAvailability(dependencies, parameters.data.eventId, request.authentication!.profile.id, body.data.sessionIds) });
    } catch (error) { next(error); }
  };
}

export function withdrawFromEventController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const parameters = publicEventParametersSchema.safeParse(request.params);
      if (!parameters.success) throw invalid(parameters);
      response.status(200).json({ data: await withdrawFromEvent(dependencies, parameters.data.eventId, request.authentication!.profile.id) });
    } catch (error) { next(error); }
  };
}

export function listMyParticipationsController(dependencies: CleanupEventDependencies) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listMyParticipationsQuerySchema.safeParse(request.query);
      if (!query.success) throw invalid(query);
      response.status(200).json({ data: await listMyParticipations(dependencies, request.authentication!.profile.id, query.data) });
    } catch (error) { next(error); }
  };
}
