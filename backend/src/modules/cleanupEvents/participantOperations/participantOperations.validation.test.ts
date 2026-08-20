import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import {
  allocateParticipantSchema,
  listEventParticipantsQuerySchema,
  recordAttendanceSchema,
  removeParticipantSchema,
} from "./participantOperations.validation.js";

test("participant operation validation applies bounded paging", () => {
  assert.deepEqual(listEventParticipantsQuerySchema.parse({}), {
    status: "JOINED",
    limit: 50,
  });
  assert.equal(listEventParticipantsQuerySchema.safeParse({ limit: 101 }).success, false);
});

test("allocation and attendance validation reject unsafe fields", () => {
  const allocation = allocateParticipantSchema.safeParse({
    participantId: randomUUID(),
    sessionId: randomUUID(),
    allocatedByMembershipId: randomUUID(),
  });
  assert.equal(allocation.success, false);
  assert.equal(recordAttendanceSchema.safeParse({ status: "PLANNED" }).success, false);
});

test("participant removal requires a useful reason", () => {
  assert.equal(removeParticipantSchema.safeParse({ reason: "short" }).success, false);
  assert.equal(removeParticipantSchema.safeParse({ reason: "The volunteer cannot safely participate." }).success, true);
});

