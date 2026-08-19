import { AbilityBuilder } from "@casl/ability";

import type { AuthenticatedUserProfile } from "../modules/auth/auth.types.js";

import { Actions } from "./actions.js";
import type { AppAbility } from "./ability.types.js";
import type {
  ActiveTenantContext,
  EventAuthorizationContext,
} from "./authorization.types.js";
import { createPrismaAbility } from "./caslPrisma.js";
import { Subjects } from "./subjects.js";

type BuildAbilityContext = {
  profile: AuthenticatedUserProfile;
  tenant?: ActiveTenantContext;
  eventAuthorization?: EventAuthorizationContext;
};

function hasCompletedProfile(
  profile: AuthenticatedUserProfile,
): boolean {
  return Boolean(
    profile.profileCompletedAt &&
      profile.fullName?.trim() &&
      profile.phoneNumber?.trim(),
  );
}

export function buildAbilityForRequest(
  context: BuildAbilityContext,
): AppAbility {
  const { can, build } =
    new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );

  const {
    profile,
    tenant,
    eventAuthorization,
  } = context;

  if (profile.accountStatus !== "ACTIVE") {
    return build();
  }

  can(
    [Actions.ReadOwn, Actions.Update],
    Subjects.UserProfile,
    {
      id: profile.id,
    },
  );

  if (!hasCompletedProfile(profile)) {
    return build();
  }

  can(
    [Actions.ReadOwn, Actions.MarkRead],
    Subjects.Notification,
    {
      userId: profile.id,
    },
  );

  if (profile.platformRole === "SUPER_ADMIN") {
    can(Actions.Read, Subjects.Platform);
    can(Actions.Read, Subjects.Dashboard);
    can(
      [
        Actions.Read,
        Actions.Review,
        Actions.Approve,
        Actions.Decline,
      ],
      Subjects.OrganizationApplication,
    );
    can(Actions.Read, Subjects.Organization);
    can(
      Actions.Read,
      Subjects.OrganizationServiceArea,
    );
    can(Actions.Read, Subjects.Incident);
    can(Actions.Read, Subjects.CleanupEvent);

    return build();
  }

  can(Actions.Create, Subjects.OrganizationApplication);
  can(
    Actions.ReadOwn,
    Subjects.OrganizationApplication,
  );
  can(Actions.Read, Subjects.Organization);
  can(
    [Actions.Create, Actions.ReadOwn, Actions.Withdraw],
    Subjects.OrganizationMembership,
  );
  can(Actions.Create, Subjects.Incident);
  can(Actions.Read, Subjects.Incident);
  can(Actions.ReadOwn, Subjects.Incident, {
    reporterUserId: profile.id,
  });
  can(Actions.Read, Subjects.CleanupEvent);
  can(Actions.Read, Subjects.EventSession);
  can(Actions.Join, Subjects.CleanupEvent);
  can(Actions.ReadOwn, Subjects.EventParticipant, {
    userId: profile.id,
  });
  can(Actions.Withdraw, Subjects.EventParticipant, {
    userId: profile.id,
  });
  can(
    Actions.ManageAvailability,
    Subjects.ParticipantAvailability,
    {
      participant: {
        is: {
          userId: profile.id,
        },
      },
    },
  );
  can(Actions.ReadOwn, Subjects.Contribution, {
    userId: profile.id,
  });
  can(Actions.ReadOwn, Subjects.Achievement, {
    userId: profile.id,
  });
  can(Actions.ReadOwn, Subjects.Dashboard);

  if (
    !tenant ||
    tenant.organization.status !== "ACTIVE" ||
    tenant.membership.status !== "ACTIVE"
  ) {
    return build();
  }

  const organizationId = tenant.organization.id;

  can(Actions.Read, Subjects.Organization, {
    id: organizationId,
  });
  can(
    Actions.Read,
    Subjects.OrganizationServiceArea,
    {
      organizationId,
    },
  );
  can(Actions.Read, Subjects.Dashboard);

  if (tenant.membership.role === "ORG_ADMIN") {
    can(Actions.Update, Subjects.Organization, {
      id: organizationId,
    });
    can(
      [Actions.Read, Actions.ManageMembership],
      Subjects.OrganizationMembership,
      {
        organizationId,
      },
    );
    can(
      [Actions.Read, Actions.ManageWorkflow],
      Subjects.CleanupWorkflow,
      {
        organizationId,
      },
    );
    can(
      [Actions.Read, Actions.Review],
      Subjects.IncidentReview,
      {
        organizationId,
      },
    );
    can(
      [
        Actions.Create,
        Actions.Read,
        Actions.Update,
        Actions.Publish,
        Actions.Transition,
        Actions.Cancel,
        Actions.Complete,
      ],
      Subjects.CleanupEvent,
      {
        organizationId,
      },
    );
    can(
      [Actions.Create, Actions.Read, Actions.Update],
      Subjects.EventSession,
      {
        cleanupEvent: {
          is: {
            organizationId,
          },
        },
      },
    );
    can(
      [Actions.Read, Actions.AssignCoordinator],
      Subjects.EventCoordinator,
      {
        cleanupEvent: {
          is: {
            organizationId,
          },
        },
      },
    );
    can(Actions.Read, Subjects.EventParticipant, {
      cleanupEvent: {
        is: {
          organizationId,
        },
      },
    });
    can(
      Actions.Read,
      Subjects.ParticipantAvailability,
      {
        participant: {
          is: {
            cleanupEvent: {
              is: {
                organizationId,
              },
            },
          },
        },
      },
    );
    can(
      Actions.RemoveParticipant,
      Subjects.EventParticipant,
      {
        cleanupEvent: {
          is: {
            organizationId,
          },
        },
      },
    );
    can(
      [
        Actions.Read,
        Actions.Allocate,
        Actions.RecordAttendance,
      ],
      Subjects.SessionAllocation,
      {
        participant: {
          is: {
            cleanupEvent: {
              is: {
                organizationId,
              },
            },
          },
        },
      },
    );
    can(
      [Actions.Read, Actions.AddNote],
      Subjects.EventNote,
      {
        cleanupEvent: {
          is: {
            organizationId,
          },
        },
      },
    );
    can(
      [Actions.Read, Actions.UploadEvidence],
      Subjects.EventEvidence,
      {
        cleanupEvent: {
          is: {
            organizationId,
          },
        },
      },
    );

    return build();
  }

  if (
    !eventAuthorization?.isCoordinator ||
    eventAuthorization.cleanupEvent.organizationId !==
      organizationId
  ) {
    return build();
  }

  const cleanupEventId =
    eventAuthorization.cleanupEvent.id;

  can(
    [
      Actions.Read,
      Actions.Update,
      Actions.Transition,
      Actions.Complete,
    ],
    Subjects.CleanupEvent,
    {
      id: cleanupEventId,
      organizationId,
    },
  );
  can(
    [Actions.Read, Actions.Update, Actions.Transition],
    Subjects.EventSession,
    {
      cleanupEventId,
    },
  );
  can(Actions.Read, Subjects.EventCoordinator, {
    cleanupEventId,
  });
  can(
    [Actions.Read, Actions.RemoveParticipant],
    Subjects.EventParticipant,
    {
      cleanupEventId,
    },
  );
  can(
    Actions.Read,
    Subjects.ParticipantAvailability,
    {
      participant: {
        is: {
          cleanupEventId,
        },
      },
    },
  );
  can(
    [
      Actions.Read,
      Actions.Allocate,
      Actions.RecordAttendance,
    ],
    Subjects.SessionAllocation,
    {
      participant: {
        is: {
          cleanupEventId,
        },
      },
    },
  );
  can(
    [Actions.Read, Actions.AddNote],
    Subjects.EventNote,
    {
      cleanupEventId,
    },
  );
  can(
    [Actions.Read, Actions.UploadEvidence],
    Subjects.EventEvidence,
    {
      cleanupEventId,
    },
  );

  return build();
}
