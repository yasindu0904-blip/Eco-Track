// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EventParticipantOperations } from "./EventParticipantOperations";
import { listEventParticipants } from "./cleanupEvent.api";

vi.mock("./cleanupEvent.api", () => ({
  allocateEventParticipant: vi.fn(),
  listEventParticipants: vi.fn(),
  markEventAttendance: vi.fn(),
  reallocateEventParticipant: vi.fn(),
  removeEventAllocation: vi.fn(),
  removeEventParticipant: vi.fn(),
}));

describe("EventParticipantOperations", () => {
  beforeEach(() => {
    vi.mocked(listEventParticipants).mockResolvedValue({
      event: { id: "event-a", title: "Canal cleanup", lifecycleStatus: "PUBLISHED" },
      sessions: [{ id: "session-a", sessionDate: "2099-09-01", startTime: "09:00:00", endTime: "12:00:00", status: "SCHEDULED", capacity: 10, allocatedCount: 1 }],
      participants: [{ id: "participant-a", status: "JOINED", joinedAt: "2026-08-20T00:00:00.000Z", removedAt: null, volunteer: { id: "user-a", fullName: "Volunteer One", phoneNumber: "+94770000001" }, availableSessionIds: ["session-a"], allocations: [{ id: "allocation-a", participantId: "participant-a", sessionId: "session-a", status: "PLANNED", allocatedAt: "2026-08-20T00:00:00.000Z", attendanceMarkedAt: null, notes: null }] }],
      nextCursor: null,
    });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  test("shows protected contact, availability, allocation, and attendance controls", async () => {
    render(<EventParticipantOperations accessToken="token" organizationId="organization-a" eventId="event-a" />);
    await waitFor(() => expect(screen.getByText("Volunteer One")).toBeTruthy());
    expect(screen.getByText("+94770000001")).toBeTruthy();
    expect(screen.getByText("Attended")).toBeTruthy();
    expect(screen.getByLabelText("Reallocate session")).toBeTruthy();
  });
});
