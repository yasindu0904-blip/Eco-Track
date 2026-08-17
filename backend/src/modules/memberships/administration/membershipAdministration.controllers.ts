import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../../../errors/applicationError.js";

import type { MembershipAdministrationDependencies } from "./membershipAdministration.dependencies.js";
import {
  addExistingMemberSchema,
  administrationIdSchema,
  changeMembershipRoleSchema,
  changeMembershipStatusSchema,
  declineMembershipRequestSchema,
  listActiveMembershipsQuerySchema,
  listMembersQuerySchema,
  listPendingRequestsQuerySchema,
} from "./membershipAdministration.validation.js";
import { listMyActiveMemberships } from "./services/listMyActiveMemberships.service.js";
import { listOrganizationMembers } from "./services/listOrganizationMembers.service.js";
import { listPendingMembershipRequests } from "./services/listPendingMembershipRequests.service.js";
import { addExistingMember } from "./use-cases/addExistingMember.useCase.js";
import { approveMembershipRequest } from "./use-cases/approveMembershipRequest.useCase.js";
import { changeMembershipRole } from "./use-cases/changeMembershipRole.useCase.js";
import { changeMembershipStatus } from "./use-cases/changeMembershipStatus.useCase.js";
import { declineMembershipRequest } from "./use-cases/declineMembershipRequest.useCase.js";

function invalidInput(code: string, message: string): ApplicationError {
  return new ApplicationError(400, code, message);
}

function parseId(value: unknown, code: string, message: string): string {
  const parsed = administrationIdSchema.safeParse(value);
  if (!parsed.success) throw invalidInput(code, message);
  return parsed.data;
}

function tenantContext(request: Request) {
  if (!request.tenant) throw new Error("Verified tenant context is required for membership administration.");
  return request.tenant;
}

export function listMyActiveMembershipsController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = listActiveMembershipsQuerySchema.safeParse(request.query);
      if (!parsed.success) throw invalidInput("ACTIVE_MEMBERSHIP_LIST_INVALID", parsed.error.issues[0]?.message ?? "The active-membership list query is invalid.");
      response.status(200).json({
        data: await listMyActiveMemberships(dependencies, {
          userId: request.authentication.profile.id,
          ...parsed.data,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function listPendingMembershipRequestsController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = listPendingRequestsQuerySchema.safeParse(request.query);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_REQUEST_LIST_INVALID", parsed.error.issues[0]?.message ?? "The membership-request list query is invalid.");
      response.status(200).json({
        data: await listPendingMembershipRequests(dependencies, {
          organizationId: tenantContext(request).organization.id,
          ...parsed.data,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function approveMembershipRequestController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const tenant = tenantContext(request);
      response.status(200).json({
        data: await approveMembershipRequest(dependencies, {
          organizationId: tenant.organization.id,
          requestId: parseId(request.params.requestId, "MEMBERSHIP_REQUEST_ID_INVALID", "The membership request ID is invalid."),
          reviewerMembershipId: tenant.membership.id,
          reviewerUserId: request.authentication.profile.id,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function declineMembershipRequestController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = declineMembershipRequestSchema.safeParse(request.body);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_DECLINE_REASON_INVALID", parsed.error.issues[0]?.message ?? "A useful decline reason is required.");
      const tenant = tenantContext(request);
      response.status(200).json({
        data: await declineMembershipRequest(dependencies, {
          organizationId: tenant.organization.id,
          requestId: parseId(request.params.requestId, "MEMBERSHIP_REQUEST_ID_INVALID", "The membership request ID is invalid."),
          reviewerMembershipId: tenant.membership.id,
          reviewerUserId: request.authentication.profile.id,
          reason: parsed.data.reason,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function listOrganizationMembersController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = listMembersQuerySchema.safeParse(request.query);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_LIST_INVALID", parsed.error.issues[0]?.message ?? "The member-list query is invalid.");
      response.status(200).json({
        data: await listOrganizationMembers(dependencies, {
          organizationId: tenantContext(request).organization.id,
          ...parsed.data,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function addExistingMemberController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = addExistingMemberSchema.safeParse(request.body);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_ADD_INPUT_INVALID", parsed.error.issues[0]?.message ?? "A valid EcoTrack email is required.");
      const tenant = tenantContext(request);
      response.status(201).json({
        data: await addExistingMember(dependencies, {
          organizationId: tenant.organization.id,
          email: parsed.data.email,
          actorMembershipId: tenant.membership.id,
          actorUserId: request.authentication.profile.id,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function changeMembershipRoleController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = changeMembershipRoleSchema.safeParse(request.body);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_ROLE_INPUT_INVALID", parsed.error.issues[0]?.message ?? "The membership role is invalid.");
      const tenant = tenantContext(request);
      response.status(200).json({
        data: await changeMembershipRole(dependencies, {
          organizationId: tenant.organization.id,
          membershipId: parseId(request.params.membershipId, "MEMBERSHIP_ID_INVALID", "The membership ID is invalid."),
          role: parsed.data.role,
          actorUserId: request.authentication.profile.id,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}

export function changeMembershipStatusController(dependencies: MembershipAdministrationDependencies) {
  return async function handle(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = changeMembershipStatusSchema.safeParse(request.body);
      if (!parsed.success) throw invalidInput("MEMBERSHIP_STATUS_INPUT_INVALID", parsed.error.issues[0]?.message ?? "The membership status is invalid.");
      const tenant = tenantContext(request);
      response.status(200).json({
        data: await changeMembershipStatus(dependencies, {
          organizationId: tenant.organization.id,
          membershipId: parseId(request.params.membershipId, "MEMBERSHIP_ID_INVALID", "The membership ID is invalid."),
          status: parsed.data.status,
          actorUserId: request.authentication.profile.id,
        }),
      });
    } catch (error) {
      next(error);
    }
  };
}
