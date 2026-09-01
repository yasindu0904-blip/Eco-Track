// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EventParticipationPanel } from "./EventParticipationPanel";
import { getMyEventParticipation, joinCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail } from "./cleanupEvent.types";
vi.mock("./cleanupEvent.api", () => ({
  getMyEventParticipation: vi.fn(),
  joinCleanupEvent: vi.fn(),
  withdrawFromCleanupEvent: vi.fn(),
}));
const event: CleanupEventPublicDetail = {
  id: "event-1",
  organization: { id: "org-1", name: "Green Team" },
  incidentId: null,
  title: "Canal cleanup",
  description: "Remove litter from the canal.",
  publicInstructions: "Bring water.",
  lifecycleStatus: "PUBLISHED",
  displayStatus: "UPCOMING",
  eventLatitude: 6.9,
  eventLongitude: 79.9,
  eventAddress: null,
  meetingLatitude: null,
  meetingLongitude: null,
  meetingAddress: null,
  startsAt: "2099-08-23T09:00:00.000Z",
  capacity: 25,
  publishedAt: "2026-08-21T08:00:00.000Z",
  joinedVolunteerCount: 0,
};
afterEach(() => vi.clearAllMocks());
test("joins a cleanup with one Volunteer action", async () => {
  vi.mocked(getMyEventParticipation).mockResolvedValue(null);
  vi.mocked(joinCleanupEvent).mockResolvedValue({
    created: true,
    rejoined: false,
    participation: {
      id: "participant-1",
      status: "JOINED",
      attendanceStatus: "UNMARKED",
      attendanceMarkedAt: null,
      joinedAt: "2026-08-21T09:00:00Z",
      withdrawnAt: null,
      event,
    },
  });
  render(<EventParticipationPanel accessToken="token" event={event} />);
  fireEvent.click(await screen.findByRole("button", { name: "Volunteer" }));
  await waitFor(() =>
    expect(joinCleanupEvent).toHaveBeenCalledWith("token", "event-1"),
  );
  expect(
    await screen.findByText("You are now volunteering for this cleanup event."),
  ).toBeTruthy();
});
