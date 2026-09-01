export const Actions = {
  Create: "create",
  Read: "read",
  ReadOwn: "readOwn",
  Update: "update",
  Review: "review",
  Approve: "approve",
  Decline: "decline",
  ManageMembership: "manageMembership",
  ManageWorkflow: "manageWorkflow",
  Publish: "publish",
  Join: "join",
  Withdraw: "withdraw",
  AssignCoordinator: "assignCoordinator",
  RemoveParticipant: "removeParticipant",
  RecordAttendance: "recordAttendance",
  AddNote: "addNote",
  UploadEvidence: "uploadEvidence",
  Cancel: "cancel",
  Complete: "complete",
  MarkRead: "markRead",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];
