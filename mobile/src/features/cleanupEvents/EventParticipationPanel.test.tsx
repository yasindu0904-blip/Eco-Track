import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventParticipationPanel } from "./EventParticipationPanel";
import { getMyEventParticipation } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, EventParticipation } from "./cleanupEvent.types";

vi.mock("../../config/env", () => ({
  mobileEnv: {
    apiBaseUrl: "http://localhost:5000/api/v1",
    eventEvidenceBucket: "event-evidence",
    supabasePublishableKey: "test-key",
    supabaseUrl: "https://example.supabase.co",
  },
}));

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("../../components/ui", () => ({
  Button: "Button",
  Notice: "Notice",
  sharedStyles: { card: {}, sectionTitle: {}, sectionSubtitle: {} },
}));

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
  sessions: [{ id: "session-1", sessionDate: "2026-08-23", startTime: "09:00:00", endTime: "11:00:00", capacity: 5, locationLatitude: 6.9271, locationLongitude: 79.8612, locationAddress: null }],
};

const participation: EventParticipation = {
  id: "participant-1",
  status: "JOINED",
  joinedAt: "2026-08-21T09:00:00.000Z",
  withdrawnAt: null,
  availableSessionIds: ["session-1"],
  allocations: [{ id: "allocation-1", sessionId: "session-1", status: "PLANNED", allocatedAt: "2026-08-21T10:00:00.000Z", attendanceMarkedAt: null }],
  event,
};

describe("EventParticipationPanel assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyEventParticipation).mockResolvedValue(participation);
  });

  test("shows the volunteer's assignment and refreshes from the API", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<EventParticipationPanel accessToken="token" event={event} />);
    });

    const text = renderer!.root.findAllByType("Text" as never).flatMap((node) => node.props.children).join(" ");
    expect(text).toContain("Your assigned sessions");
    expect(text).toContain("ASSIGNED");
    expect(text).toContain("2026-08-23 · 09:00–11:00");

    const refresh = renderer!.root.findAllByType("Button" as never).find((node) => node.props.label === "Refresh assignment");
    expect(refresh).toBeTruthy();
    await act(async () => {
      refresh!.props.onPress();
    });
    expect(getMyEventParticipation).toHaveBeenCalledTimes(2);
  });
});
