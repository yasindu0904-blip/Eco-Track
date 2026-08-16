# EVT-01 Cleanup Workflow Review Issues

## Purpose

This document explains the two issues found while reviewing and testing the EVT-01 cleanup-workflow implementation.

The issues were:

1. Existing protected workflow statuses were detected but their protected values were not checked or repaired.
2. The backend integration test deleted organizations before deleting their memberships, causing a database foreign-key failure during test cleanup.

Both issues have now been fixed and covered by verification.

## Issue 1: Existing statuses could keep incorrect protected workflow values

### File

`backend/src/modules/cleanupWorkflows/repositories/cleanupWorkflow.repository.ts`

### Background: what the workflow values mean

Every organization has cleanup-event workflow statuses such as:

- `DRAFT`
- `PUBLISHED`
- `SCHEDULED`
- `IN_PROGRESS`
- `COMPLETION_SUBMITTED`
- `COMPLETED`
- `CANCELLED`

Each status contains three important Boolean values:

- `isInitial`: identifies the status in which a new cleanup event starts.
- `isFinal`: identifies a status that ends the workflow.
- `isActive`: determines whether the status is enabled and usable.

For the protected EcoTrack lifecycle, these values must include the following behavior:

| Lifecycle status | `isInitial` | `isFinal` | `isActive` | Meaning |
| --- | ---: | ---: | ---: | --- |
| `DRAFT` | `true` | `false` | `true` | A new event begins as a draft. |
| `COMPLETED` | `false` | `true` | `true` | A completed event has reached a final state. |
| `CANCELLED` | `false` | `true` | `true` | A cancelled event has reached a final state. |
| Other required statuses | `false` | `false` | `true` | They are active intermediate workflow states. |

Organizations may use custom user-facing codes and labels. For example, an organization could display `PLANNING` / `Planning` instead of `DRAFT` / `Draft`. However, the underlying lifecycle meaning must remain protected: the status mapped to `DRAFT` must still be initial and active.

### Original behavior

The initializer loaded the organization's existing statuses into a map and then used logic equivalent to:

```ts
if (byLifecycle.has(definition.lifecycle)) {
  continue;
}
```

This answered only one question:

> Does a status mapped to this required lifecycle already exist?

If the answer was yes, the initializer skipped that status completely. It did not answer the second necessary question:

> Are the existing status's protected values correct?

### Example of the problem

Suppose an organization already had this database row:

```text
mappedLifecycleStatus = DRAFT
code                  = PLANNING
label                 = Planning
isInitial             = false
isFinal               = false
isActive              = false
```

The old initializer saw that a `DRAFT` lifecycle row existed and skipped it. The result was that:

- a new cleanup event might not have a valid initial status;
- the required draft status remained disabled;
- repeatedly running the default initializer did not repair the invalid workflow.

The same problem applied to final statuses. For example, an existing `COMPLETED` row with `isFinal = false` passed through unchanged even though `COMPLETED` must remain a final lifecycle state.

This meant the implementation did not fully satisfy the EVT-01 acceptance requirement:

> Required initial/final lifecycle behavior cannot be removed.

### Fix

The required definitions now explicitly include `isActive`, in addition to `isInitial` and `isFinal`.

When an existing required lifecycle status is found, the initializer now compares all three protected values:

```ts
const hasProtectedValues =
  existingStatus.isInitial === definition.isInitial &&
  existingStatus.isFinal === definition.isFinal &&
  existingStatus.isActive === definition.isActive;
```

If any protected value is wrong, only these protected fields are repaired:

```ts
data: {
  isInitial: definition.isInitial,
  isFinal: definition.isFinal,
  isActive: definition.isActive,
}
```

The fix intentionally does not overwrite the organization's custom `code` or `label`.

Using the earlier example, initialization now produces:

```text
mappedLifecycleStatus = DRAFT
code                  = PLANNING   # preserved
label                 = Planning   # preserved
isInitial             = true       # repaired
isFinal               = false
isActive              = true       # repaired
```

This preserves organization customization while protecting EcoTrack's lifecycle rules.

### Tests added for this behavior

The integration test now deliberately corrupts the protected values for `DRAFT`, `COMPLETED`, and `CANCELLED`, while also assigning custom codes and labels. It then runs the initializer and verifies that:

- `DRAFT` becomes initial and active again;
- `COMPLETED` becomes final and active again;
- `CANCELLED` becomes final and active again;
- custom codes and labels remain unchanged.

The transition test was also strengthened to confirm that a same-organization transition which is not configured, such as `DRAFT -> COMPLETED`, is rejected. This is additional acceptance coverage rather than a separate production issue.

## Issue 2: Integration-test cleanup used the wrong database deletion order

### File

`backend/src/modules/cleanupWorkflows/cleanupWorkflow.integration.test.ts`

### Background: organization membership relationship

The test creates:

1. user profiles;
2. organizations requested by those users;
3. organization-membership records connecting the users to the organizations as organization administrators.

An organization-membership row contains an `organizationId` foreign key that refers to its parent organization.

The database uses this foreign key to prevent an organization from being deleted while membership rows still refer to it.

### Original cleanup behavior

At the end of the test suite, cleanup attempted to delete records in this order:

```text
1. organizations
2. user profiles
```

However, the membership rows created by the test had not been deleted first.

PostgreSQL correctly rejected the organization deletion because records in `organization_memberships` still referenced those organizations. The failure was reported through the foreign-key constraint:

```text
organization_memberships_organization_id_fkey
```

### Why this caused a failed test run

The workflow assertions themselves could succeed, but the suite's `after` cleanup hook still failed. A test suite is not considered passed when its teardown hook throws an error.

This was a test-fixture cleanup problem, not a reason to weaken or remove the database foreign-key constraint. The constraint was working correctly and protecting referential integrity.

### Fix

The cleanup now deletes records from child to parent:

```text
1. organization memberships
2. organizations
3. user profiles
```

The added cleanup call is:

```ts
await prisma.organizationMembership.deleteMany({
  where: {
    organizationId: {
      in: [organizationAId, organizationBId],
    },
  },
});
```

After the child membership rows are removed, the organizations can be deleted safely. The profiles are deleted last because the organizations and memberships also refer to them.

## Verification result

After applying both fixes:

- the targeted EVT-01 backend integration suite passed;
- the complete backend suite passed with 64 of 64 tests;
- backend typecheck and build passed;
- web lint and build passed;
- mobile security check, typecheck, Expo Doctor, and Android export passed.

The EVT-01 implementation is therefore ready to commit and push, followed by merge after GitHub CI passes.
