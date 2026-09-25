import { getPublicIncident } from "../incidents/incident.api";
// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import {
  getPublicCleanupEvent,
  listPublicCleanupEvents,
} from "./cleanupEvent.api";
import type { EventParticipation } from "./cleanupEvent.types";
import { PublicCleanupEventsPage } from "./PublicCleanupEventsPage";

vi.mock("../incidents/incident.api", () => ({ getPublicIncident: vi.fn() }));

vi.mock("./cleanupEvent.api", () => ({
  getPublicCleanupEvent: vi.fn(),
  listPublicCleanupEvents: vi.fn(),
}));

vi.mock("./EventParticipationPanel", () => ({
  EventParticipationPanel: ({
    onChanged,
  }: {
    onChanged?: (value: EventParticipation | null) => void;
  }) => (
    <div>
      <span>Participation options</span>
      <button
        type="button"
        onClick={() => onChanged?.({ status: "JOINED" } as EventParticipation)}
      >
        Mock joined
      </button>
    </div>
  ),
}));

vi.mock("./ParticipantEventUpdates", () => ({
  ParticipantEventUpdates: () => <div>Participant updates</div>,
}));

afterEach(() => {
  vi.clearAllMocks();
});

const event = {
    id: "event-1",
    organization: { id: "organization-1", name: "Green Neighbours" },
    incidentId: null,
    title: "Canal cleanup",
    description: "Remove litter beside the canal.",
    publicInstructions: "Bring drinking water.",
    lifecycleStatus: "PUBLISHED",
    displayStatus: "UPCOMING",
    eventLatitude: 6.9271,
    eventLongitude: 79.8612,
    eventAddress: "Canal road",
    meetingLatitude: 6.9271,
    meetingLongitude: 79.8612,
    meetingAddress: "Community hall",
    publishedAt: "2026-08-21T08:00:00.000Z",
    startsAt: "2026-08-23T08:00:00.000Z",
    capacity: 25,
    joinedVolunteerCount: 0,
  } as const;

test("a map-selected event opens in a focused detail view and returns through its caller", async () => {
  vi.mocked(getPublicCleanupEvent).mockResolvedValue(event);
  const onBack = vi.fn();

  render(
    <PublicCleanupEventsPage
      accessToken="token"
      initialEventId="event-1"
      onBack={onBack}
    />,
  );

  await waitFor(() =>
    expect(getPublicCleanupEvent).toHaveBeenCalledWith("token", "event-1"),
  );
  expect((await screen.findAllByText("Canal cleanup")).length).toBeGreaterThan(
    0,
  );
  expect(screen.queryByText("Upcoming and active events")).toBeNull();
  expect(screen.queryByText("No published events yet")).toBeNull();
  expect(listPublicCleanupEvents).not.toHaveBeenCalled();
  expect(screen.queryByText("Participant updates")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Mock joined" }));
  expect(await screen.findByText("Participant updates")).toBeTruthy();

  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

const publicIncident = {
  id: "incident-evidence", title: "Plastic beside the canal", description: "Bags and bottles beside the water.",
  category: { id: "waste", name: "Waste", description: null }, severity: "MEDIUM" as const,
  status: "ACTIVE" as const, latitude: 6.9271, longitude: 79.8612, addressText: "Canal road",
  reportedAt: "2026-08-20T00:00:00.000Z", thumbnailUrl: null, falseReviewCount: 0, isOwnReport: false,
  highlightUntil: "2026-09-20T00:00:00.000Z", archiveAfter: "2026-10-20T00:00:00.000Z",
  resolvedAt: null, archivedAt: null, statusHistory: [],
  photos: [{ id: "photo-1", url: "https://example.test/evidence.jpg", caption: "Bottles by the canal", sortOrder: 0 }],
};

test("a linked event also shows its incident evidence on the join page", async () => {
  vi.mocked(getPublicCleanupEvent).mockResolvedValue({ ...event, incidentId: publicIncident.id });
  vi.mocked(getPublicIncident).mockResolvedValue(publicIncident);
  render(<PublicCleanupEventsPage accessToken="token" initialEventId="event-1" onBack={vi.fn()} />);
  expect(await screen.findByAltText("Bottles by the canal")).toHaveProperty("src", publicIncident.photos[0].url);
  expect(getPublicIncident).toHaveBeenCalledWith("token", publicIncident.id);
});
