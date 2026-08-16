export type CleanupWorkflowStatus = { id: string; label: string; mappedLifecycleStatus: string; position: number; isInitial: boolean; isFinal: boolean; isActive: boolean };
export type CleanupWorkflow = { organizationId: string; statuses: CleanupWorkflowStatus[]; transitions: Array<{ id: string; fromStatusId: string; toStatusId: string }> };

export function cleanupLifecycleLabel(value: string): string {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

