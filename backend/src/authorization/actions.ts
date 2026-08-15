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
  ManageAvailability: "manageAvailability",
  AssignCoordinator: "assignCoordinator",
  Allocate: "allocate",
  RemoveParticipant: "removeParticipant",
  RecordAttendance: "recordAttendance",
  AddNote: "addNote",
  UploadEvidence: "uploadEvidence",
  Transition: "transition",
  Cancel: "cancel",
  Complete: "complete",
  MarkRead: "markRead",
} as const;

export type Action =
  (typeof Actions)[keyof typeof Actions];
