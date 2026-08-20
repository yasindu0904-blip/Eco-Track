export type CountByState = Record<string, number>;
export type CitizenSummary = { reportsByState: CountByState; joinedEvents: number; upcomingEvents: number; unreadNotifications: number; contributions: { count: number; points: number } };
export type OrganizationSummary = { organizationId: string; coveringIncidentsByState: CountByState; reviewsByState: CountByState; eventsByLifecycle: CountByState; upcomingSessions: number; joinedParticipants: number; pendingMembershipRequests: number };
export type PlatformSummary = { users: { total: number; active: number }; organizationsByState: CountByState; incidentsByState: CountByState; eventsByLifecycle: CountByState; pendingOrganizationApplications: number };
