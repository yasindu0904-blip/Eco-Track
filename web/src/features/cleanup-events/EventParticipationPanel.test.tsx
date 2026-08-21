// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { EventParticipationPanel } from "./EventParticipationPanel";
import { getMyEventParticipation } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, EventParticipation } from "./cleanupEvent.types";

vi.mock("./cleanupEvent.api", () => ({
  getMyEventParticipation: vi.fn(),
  joinCleanupEvent: vi.fn(),
  updateEventAvailability: vi.fn(),
  withdrawFromCleanupEvent: vi.fn(),
}));

const event: CleanupEventPublicDetail = {
  id: "event-1",
  organization: { id: "organization-1", name: "Green Neighbours" },
  incidentId: null,
  title: "Canal cleanup",
  description: "Remove litter beside the canal.",
  publicInstructions: "Bring drinking water.",
  lifecycleStatus: "PUBLISHED",
  eventLatitude: 6.9271,
  eventLongitude: 79.8612,
  eventAddress: "Canal road",
  meetingLatitude: 6.9271,
  meetingLongitude: 79.8612,
  meetingAddress: "Community hall",
  publishedAt: "2026-08-21T08:00:00.000Z",
  firstSessionAt: "2026-08-23T09:00:00.000Z",
  sessions: [{
    id: "session-1",
    sessionDate: "2026-08-23",
    startTime: "09:00:00",
    endTime: "11:00:00",
    capacity: 5,
    locationLatitude: 6.9271,
    locationLongitude: 79.8612,
    locationAddress: null,
  }],
};

const participation: EventParticipation = {
  id: "participant-1",
  status: "JOINED",
  joinedAt: "2026-08-21T09:00:00.000Z",
  withdrawnAt: null,
  availableSessionIds: ["session-1"],
  allocations: [{
    id: "allocation-1",
    sessionId: "session-1",
    status: "PLANNED",
    allocatedAt: "2026-08-21T10:00:00.000Z",
    attendanceMarkedAt: null,
  }],
  event,
};

describe("EventParticipationPanel assignments", () => {
  beforeEach(() => {
    vi.mocked(getMyEventParticipation).mockResolvedValue(participation);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("shows the volunteer's server-side assignment and can refresh it", async () => {
    const onChanged = vi.fn();
    render(<EventParticipationPanel accessToken="token" event={event} onChanged={onChanged} />);

    expect(await screen.findByRole("heading", { name: "Your assigned sessions" })).toBeTruthy();
    expect(screen.getByText("ASSIGNED")).toBeTruthy();
    expect(screen.getAllByText("2026-08-23 · 09:00–11:00")).toHaveLength(2);
    expect(onChanged).toHaveBeenCalledWith(participation);

    fireEvent.click(screen.getByRole("button", { name: "Refresh assignment" }));
    await waitFor(() => expect(getMyEventParticipation).toHaveBeenCalledTimes(2));
  });
});
