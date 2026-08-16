import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { MembershipSelfServiceDependencies } from "./membershipSelfService.dependencies.js";
import {
  createMembershipRequestSchema,
  listMembershipRequestsQuerySchema,
  membershipRequestIdSchema,
  searchOrganizationsQuerySchema,
} from "./membershipSelfService.validation.js";
import { createMembershipRequest } from "./services/createMembershipRequest.service.js";
import { getMyMembershipRequest } from "./services/getMyMembershipRequest.service.js";
import { listMyMembershipRequests } from "./services/listMyMembershipRequests.service.js";
import { searchActiveOrganizations } from "./services/searchActiveOrganizations.service.js";
import { withdrawMembershipRequest } from "./services/withdrawMembershipRequest.service.js";

function invalidInput(code: string, message: string): ApplicationError {
  return new ApplicationError(400, code, message);
}

function parseRequestId(request: Request): string {
  const parsed = membershipRequestIdSchema.safeParse(
    request.params.requestId,
  );

  if (!parsed.success) {
    throw invalidInput(
      "MEMBERSHIP_REQUEST_ID_INVALID",
      "The membership request ID is invalid.",
    );
  }

  return parsed.data;
}

export function searchActiveOrganizationsController(
  dependencies: MembershipSelfServiceDependencies,
) {
  return async function handleSearchActiveOrganizations(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = searchOrganizationsQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        throw invalidInput(
          "ORGANIZATION_SEARCH_INVALID",
          parsed.error.issues[0]?.message ?? "The organization search is invalid.",
        );
      }

      response.status(200).json({
        data: await searchActiveOrganizations(dependencies, parsed.data),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createMembershipRequestController(
  dependencies: MembershipSelfServiceDependencies,
) {
  return async function handleCreateMembershipRequest(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = createMembershipRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        throw invalidInput(
          "MEMBERSHIP_REQUEST_INPUT_INVALID",
          parsed.error.issues[0]?.message ?? "The membership request is invalid.",
        );
      }

      response.status(201).json({
        data: await createMembershipRequest(dependencies, {
          requesterUserId: request.authentication.profile.id,
          ...parsed.data,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function listMyMembershipRequestsController(
  dependencies: MembershipSelfServiceDependencies,
) {
  return async function handleListMyMembershipRequests(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const parsed = listMembershipRequestsQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        throw invalidInput(
          "MEMBERSHIP_REQUEST_LIST_INVALID",
          parsed.error.issues[0]?.message ?? "The membership request list is invalid.",
        );
      }

      response.status(200).json({
        data: await listMyMembershipRequests(dependencies, {
          requesterUserId: request.authentication.profile.id,
          ...parsed.data,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function getMyMembershipRequestController(
  dependencies: MembershipSelfServiceDependencies,
) {
  return async function handleGetMyMembershipRequest(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data: await getMyMembershipRequest(
          dependencies,
          request.authentication.profile.id,
          parseRequestId(request),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function withdrawMembershipRequestController(
  dependencies: MembershipSelfServiceDependencies,
) {
  return async function handleWithdrawMembershipRequest(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data: await withdrawMembershipRequest(
          dependencies,
          request.authentication.profile.id,
          parseRequestId(request),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}
