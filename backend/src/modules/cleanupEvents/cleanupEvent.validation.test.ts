import assert from "node:assert/strict";
import test from "node:test";
import {
  createDraftSchema,
  createSessionSchema,
  listDraftQuerySchema,
  updateDraftSchema,
} from "./cleanupEvent.validation.js";

test("draft validation accepts direct and incident-linked drafts", () => {
  const base = { title: "Beach cleanup", description: "Remove plastic from the beach", eventLatitude: 6.927079, eventLongitude: 79.861244 };
  assert.equal(createDraftSchema.safeParse(base).success, true);
  assert.equal(createDraftSchema.safeParse({ ...base, incidentId: "07e253e8-e6f8-4f67-b82a-831a32dc0462" }).success, true);
});

test("draft validation rejects invalid coordinates and incomplete meeting coordinates", () => {
  const base = { title: "Beach cleanup", description: "Remove plastic from the beach", eventLatitude: 91, eventLongitude: 79.861244 };
  assert.equal(createDraftSchema.safeParse(base).success, false);
  assert.equal(createDraftSchema.safeParse({ ...base, eventLatitude: 6.9, meetingLatitude: 6.8 }).success, false);
  assert.equal(createDraftSchema.safeParse({ ...base, eventLatitude: 8, eventLongitude: 50 }).success, false);
  assert.equal(updateDraftSchema.safeParse({ eventLatitude: 6.9 }).success, false);
  assert.equal(updateDraftSchema.safeParse({ meetingLatitude: null }).success, false);
});

test("session validation rejects invalid capacity and malformed times", () => {
  assert.equal(createSessionSchema.safeParse({ sessionDate: "2026-09-01", startTime: "09:00:00", endTime: "11:00:00", capacity: 10 }).success, true);
  assert.equal(createSessionSchema.safeParse({ sessionDate: "2026-09-01", startTime: "09:00:00", endTime: "11:00:00", capacity: 0 }).success, false);
  assert.equal(createSessionSchema.safeParse({ sessionDate: "2026-09-01", startTime: "25:00:00", endTime: "11:00:00", capacity: 1 }).success, false);
  assert.equal(createSessionSchema.safeParse({ sessionDate: "2026-02-31", startTime: "09:00:00", endTime: "11:00:00", capacity: 1 }).success, false);
  assert.equal(createSessionSchema.safeParse({ sessionDate: "2026-09-01", startTime: "11:00:00", endTime: "09:00:00", capacity: 1 }).success, false);
});

test("draft listing validation coerces query strings and applies safe limits", () => {
  const parsed = listDraftQuerySchema.safeParse({ limit: "20" });
  assert.equal(parsed.success, true);
  assert.equal(listDraftQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.equal(listDraftQuerySchema.safeParse({ limit: "20", unexpected: "field" }).success, false);
});
