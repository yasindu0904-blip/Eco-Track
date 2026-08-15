import { subject as createCaslSubject } from "@casl/ability";

import type {
  AchievementDefinition,
  CleanupEvent,
  CleanupWorkflowStatus,
  CleanupWorkflowTransition,
  ContributionEvent,
  EventCoordinator,
  EventEvidence,
  EventNote,
  EventParticipant,
  EventSession,
  Incident,
  IncidentReview,
  Notification,
  Organization,
  OrganizationMembership,
  OrganizationServiceArea,
  ParticipantSessionAvailability,
  SessionAllocation,
  UserProfile,
  UserAchievement,
} from "../generated/prisma/client.js";

import type { PrismaSubjects } from "./caslPrisma.js";

export const Subjects = {
  Platform: "Platform",
  UserProfile: "UserProfile",
  OrganizationApplication:
    "OrganizationApplication",
  Organization: "Organization",
  OrganizationServiceArea:
    "OrganizationServiceArea",
  OrganizationMembership:
    "OrganizationMembership",
  Notification: "Notification",
  Incident: "Incident",
  IncidentReview: "IncidentReview",
  CleanupWorkflow: "CleanupWorkflow",
  CleanupEvent: "CleanupEvent",
  EventSession: "EventSession",
  EventCoordinator: "EventCoordinator",
  EventParticipant: "EventParticipant",
  ParticipantAvailability:
    "ParticipantAvailability",
  SessionAllocation: "SessionAllocation",
  EventNote: "EventNote",
  EventEvidence: "EventEvidence",
  Contribution: "Contribution",
  Achievement: "Achievement",
  Dashboard: "Dashboard",
} as const;

export type SubjectName =
  (typeof Subjects)[keyof typeof Subjects];

type DatabaseSubject = PrismaSubjects<{
  UserProfile: UserProfile;
  Organization: Organization;
  OrganizationMembership: OrganizationMembership;
  OrganizationServiceArea: OrganizationServiceArea;
  Notification: Notification;
  Incident: Incident;
  IncidentReview: IncidentReview;
  CleanupWorkflow:
    | CleanupWorkflowStatus
    | CleanupWorkflowTransition;
  CleanupEvent: CleanupEvent;
  EventSession: EventSession;
  EventCoordinator: EventCoordinator;
  EventParticipant: EventParticipant;
  ParticipantAvailability: ParticipantSessionAvailability;
  SessionAllocation: SessionAllocation;
  EventNote: EventNote;
  EventEvidence: EventEvidence;
  Contribution: ContributionEvent;
  Achievement:
    | AchievementDefinition
    | UserAchievement;
}>;

export type Subject =
  | Exclude<
      SubjectName,
      | typeof Subjects.UserProfile
      | typeof Subjects.Organization
      | typeof Subjects.OrganizationMembership
      | typeof Subjects.OrganizationServiceArea
      | typeof Subjects.Notification
      | typeof Subjects.Incident
      | typeof Subjects.IncidentReview
      | typeof Subjects.CleanupWorkflow
      | typeof Subjects.CleanupEvent
      | typeof Subjects.EventSession
      | typeof Subjects.EventCoordinator
      | typeof Subjects.EventParticipant
      | typeof Subjects.ParticipantAvailability
      | typeof Subjects.SessionAllocation
      | typeof Subjects.EventNote
      | typeof Subjects.EventEvidence
      | typeof Subjects.Contribution
      | typeof Subjects.Achievement
    >
  | DatabaseSubject;

export function createAuthorizationSubject(
  subjectName: SubjectName,
  resource: Record<string, unknown>,
): Subject {
  return createCaslSubject(
    subjectName,
    resource,
  ) as unknown as Subject;
}
