import type {
  Organization,
  OrganizationMembership,
  OrganizationServiceArea,
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
} as const;

export type SubjectName =
  (typeof Subjects)[keyof typeof Subjects];

type DatabaseSubject = PrismaSubjects<{
  Organization: Organization;
  OrganizationMembership: OrganizationMembership;
  OrganizationServiceArea: OrganizationServiceArea;
}>;

export type Subject =
  | Exclude<
      SubjectName,
      | typeof Subjects.Organization
      | typeof Subjects.OrganizationMembership
      | typeof Subjects.OrganizationServiceArea
    >
  | DatabaseSubject;
