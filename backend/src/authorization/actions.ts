export const Actions = {
  Create: "create",
  Read: "read",
  ReadOwn: "readOwn",
  Update: "update",
  Review: "review",
  Approve: "approve",
  Decline: "decline",
  ManageMembership: "manageMembership",
} as const;

export type Action =
  (typeof Actions)[keyof typeof Actions];