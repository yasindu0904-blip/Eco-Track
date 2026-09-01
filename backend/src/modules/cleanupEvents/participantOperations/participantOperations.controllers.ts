import type { NextFunction, Request, Response } from "express";
import { ApplicationError } from "../../../errors/applicationError.js";
import type { CleanupEventDependencies } from "../cleanupEvent.dependencies.js";
import { listEventParticipantOperations } from "./participantOperations.service.js";
import {
  listEventParticipantsQuerySchema,
  participantOperationsParametersSchema,
  participantParametersSchema,
  recordAttendanceSchema,
  removeParticipantSchema,
} from "./participantOperations.validation.js";
import { recordAttendance } from "./use-cases/recordAttendance.useCase.js";
import { removeParticipant } from "./use-cases/removeParticipant.useCase.js";

function invalid(result: {
  error: { issues: Array<{ path: PropertyKey[]; message: string }> };
}) {
  const issue = result.error.issues[0];
  const field = issue?.path.map(String).join(".");
  return new ApplicationError(
    400,
    "PARTICIPANT_OPERATION_REQUEST_INVALID",
    issue
      ? `${field ? `${field}: ` : ""}${issue.message}`
      : "The participant operation request is invalid.",
  );
}
const actor = (request: Request) => ({
  actorMembershipId: request.tenant!.membership.id,
  actorUserId: request.authentication!.profile.id,
});

export function listEventParticipantsController(
  dependencies: CleanupEventDependencies,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = participantOperationsParametersSchema.safeParse(
        request.params,
      );
      const query = listEventParticipantsQuerySchema.safeParse(request.query);
      if (!parameters.success) throw invalid(parameters);
      if (!query.success) throw invalid(query);
      response
        .status(200)
        .json({
          data: await listEventParticipantOperations(
            dependencies,
            parameters.data.organizationId,
            parameters.data.eventId,
            query.data,
          ),
        });
    } catch (error) {
      next(error);
    }
  };
}

export function recordAttendanceController(
  dependencies: CleanupEventDependencies,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = participantParametersSchema.safeParse(request.params);
      const body = recordAttendanceSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response
        .status(200)
        .json({
          data: await recordAttendance(dependencies, {
            ...parameters.data,
            ...body.data,
            ...actor(request),
          }),
        });
    } catch (error) {
      next(error);
    }
  };
}

export function removeParticipantController(
  dependencies: CleanupEventDependencies,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parameters = participantParametersSchema.safeParse(request.params);
      const body = removeParticipantSchema.safeParse(request.body);
      if (!parameters.success) throw invalid(parameters);
      if (!body.success) throw invalid(body);
      response
        .status(200)
        .json({
          data: await removeParticipant(dependencies, {
            ...parameters.data,
            ...body.data,
            ...actor(request),
          }),
        });
    } catch (error) {
      next(error);
    }
  };
}
