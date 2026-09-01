import assert from "node:assert/strict";
import test from "node:test";
import {
  listEventParticipantsQuerySchema,
  recordAttendanceSchema,
  removeParticipantSchema,
} from "./participantOperations.validation.js";

test("participant operation validation applies bounded paging", () => {
  assert.deepEqual(listEventParticipantsQuerySchema.parse({}), {
    status: "JOINED",
    limit: 50,
  });
  assert.equal(
    listEventParticipantsQuerySchema.safeParse({ limit: 101 }).success,
    false,
  );
});

test("event attendance accepts only final event-level states", () => {
  assert.equal(
    recordAttendanceSchema.safeParse({ status: "PLANNED" }).success,
    false,
  );
  assert.equal(
    recordAttendanceSchema.safeParse({ status: "ATTENDED" }).success,
    true,
  );
  assert.equal(
    recordAttendanceSchema.safeParse({ status: "ABSENT" }).success,
    true,
  );
  assert.equal(
    recordAttendanceSchema.safeParse({
      status: "ATTENDED",
      sessionId: "obsolete",
    }).success,
    false,
  );
});

test("participant removal requires a useful reason", () => {
  assert.equal(
    removeParticipantSchema.safeParse({ reason: "short" }).success,
    false,
  );
  assert.equal(
    removeParticipantSchema.safeParse({
      reason: "The volunteer cannot safely participate.",
    }).success,
    true,
  );
});
