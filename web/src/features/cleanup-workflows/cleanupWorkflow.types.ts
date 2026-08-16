export type CleanupWorkflowStatus = {
  id: string;
  code: string;
  label: string;
  mappedLifecycleStatus: string;
  position: number;
  isInitial: boolean;
  isFinal: boolean;
  isActive: boolean;
};

export type CleanupWorkflow = {
  organizationId: string;
  statuses: CleanupWorkflowStatus[];
  transitions: Array<{ id: string; fromStatusId: string; toStatusId: string }>;
};

