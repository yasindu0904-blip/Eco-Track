import type { CleanupLifecycleStatus } from "../../generated/prisma/enums.js";

export type CleanupWorkflowStatusDto = {
  id: string;
  code: string;
  label: string;
  mappedLifecycleStatus: CleanupLifecycleStatus;
  position: number;
  isInitial: boolean;
  isFinal: boolean;
  isActive: boolean;
};

export type CleanupWorkflowTransitionDto = {
  id: string;
  fromStatusId: string;
  toStatusId: string;
};

export type CleanupWorkflowDto = {
  organizationId: string;
  statuses: CleanupWorkflowStatusDto[];
  transitions: CleanupWorkflowTransitionDto[];
};

