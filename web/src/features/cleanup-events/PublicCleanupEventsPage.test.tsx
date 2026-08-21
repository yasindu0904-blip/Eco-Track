// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { getPublicCleanupEvent, listPublicCleanupEvents } from "./cleanupEvent.api";
import type { EventParticipation } from "./cleanupEvent.types";
import { PublicCleanupEventsPage } from "./PublicCleanupEventsPage";

vi.mock("./cleanupEvent.api", () => ({
  getPublicCleanupEvent: vi.fn(),
  listPublicCleanupEvents: vi.fn(),
}));

vi.mock("./EventParticipationPanel", () => ({
  EventParticipationPanel: ({ onChanged }: { onChanged?: (value: EventParticipation | null) => void }) => <div>
    <span>Participation options</span>
    <button type="button" onClick={() => onChanged?.({ status: "JOINED" } as EventParticipation)}>Mock joined</button>
  </div>,
}));

vi.mock("./ParticipantEventUpdates", () => ({
  ParticipantEventUpdates: () => <div>Participant updates</div>,
}));

afterEach(() => {
  vi.clearAllMocks();
});

test("a map-selected event opens in a focused detail view and returns through its caller", async () => {
  vi.mocked(getPublicCleanupEvent).mockResolvedValue({
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
    firstSessionAt: "2026-08-23T08:00:00.000Z",
    sessions: [],
  });
  const onBack = vi.fn();

  render(
    <PublicCleanupEventsPage
      accessToken="token"
      initialEventId="event-1"
      onBack={onBack}
    />,
  );

  await waitFor(() => expect(getPublicCleanupEvent).toHaveBeenCalledWith("token", "event-1"));
  expect((await screen.findAllByText("Canal cleanup")).length).toBeGreaterThan(0);
  expect(screen.queryByText("Upcoming and active events")).toBeNull();
  expect(screen.queryByText("No published events yet")).toBeNull();
  expect(listPublicCleanupEvents).not.toHaveBeenCalled();
  expect(screen.queryByText("Participant updates")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Mock joined" }));
  expect(await screen.findByText("Participant updates")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
