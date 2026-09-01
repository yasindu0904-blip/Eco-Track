// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EventParticipantOperations } from "./EventParticipantOperations";
import { listEventParticipants, markEventAttendance } from "./cleanupEvent.api";
vi.mock("./cleanupEvent.api", () => ({
  listEventParticipants: vi.fn(),
  markEventAttendance: vi.fn(),
  removeEventParticipant: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
test("marks event-level attendance after the event starts", async () => {
  vi.mocked(listEventParticipants).mockResolvedValue({
    event: {
      id: "event-1",
      title: "Cleanup",
      lifecycleStatus: "PUBLISHED",
      startsAt: "2020-01-01T09:00:00Z",
      capacity: 20,
    },
    participants: [
      {
        id: "participant-1",
        status: "JOINED",
        attendanceStatus: "UNMARKED",
        attendanceMarkedAt: null,
        joinedAt: "2026-08-20T00:00:00Z",
        removedAt: null,
        volunteer: {
          id: "user-1",
          fullName: "Volunteer One",
          phoneNumber: "+94770000001",
        },
      },
    ],
    nextCursor: null,
  });
  vi.mocked(markEventAttendance).mockResolvedValue({
    id: "participant-1",
    status: "JOINED",
    attendanceStatus: "ATTENDED",
    attendanceMarkedAt: "2026-08-21T09:00:00Z",
    joinedAt: "2026-08-20T00:00:00Z",
    removedAt: null,
    volunteer: {
      id: "user-1",
      fullName: "Volunteer One",
      phoneNumber: "+94770000001",
    },
  });
  render(
    <EventParticipantOperations
      accessToken="token"
      organizationId="org-1"
      eventId="event-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mark attended" }));
  await waitFor(() =>
    expect(markEventAttendance).toHaveBeenCalledWith(
      "token",
      "org-1",
      "event-1",
      "participant-1",
      "ATTENDED",
    ),
  );
});
