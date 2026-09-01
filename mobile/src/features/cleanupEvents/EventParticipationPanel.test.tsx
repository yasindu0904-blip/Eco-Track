import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventParticipationPanel } from "./EventParticipationPanel";
import { getMyEventParticipation, joinCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail } from "./cleanupEvent.types";

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
  StyleSheet: { create: <T,>(value: T) => value },
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
  withdrawFromCleanupEvent: vi.fn(),
}));

const event: CleanupEventPublicDetail = {
  id: "event-1",
  organization: { id: "organization-1", name: "Green Neighbours" },
  incidentId: null,
  title: "Canal cleanup",
  description: "Remove litter beside the canal.",
  publicInstructions: "Bring water.",
  lifecycleStatus: "PUBLISHED",
  displayStatus: "UPCOMING",
  eventLatitude: 6.92,
  eventLongitude: 79.86,
  eventAddress: "Canal Road",
  meetingLatitude: null,
  meetingLongitude: null,
  meetingAddress: null,
  startsAt: "2099-09-01T03:30:00.000Z",
  capacity: 25,
  publishedAt: "2026-08-21T08:00:00.000Z",
  joinedVolunteerCount: 0,
};

describe("EventParticipationPanel simplified volunteering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyEventParticipation).mockResolvedValue(null);
  });

  test("joins with one Volunteer action and no session selection", async () => {
    vi.mocked(joinCleanupEvent).mockResolvedValue({
      created: true,
      rejoined: false,
      participation: {
        id: "participant-1",
        status: "JOINED",
        attendanceStatus: "UNMARKED",
        attendanceMarkedAt: null,
        joinedAt: "2026-08-21T09:00:00.000Z",
        withdrawnAt: null,
        event,
      },
    });
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <EventParticipationPanel accessToken="token" event={event} />,
      );
    });
    const volunteer = renderer!.root
      .findAllByType("Button" as never)
      .find((node) => node.props.label === "Volunteer");
    expect(volunteer).toBeTruthy();
    await act(async () => {
      await volunteer!.props.onPress();
    });
    expect(joinCleanupEvent).toHaveBeenCalledWith("token", "event-1");
  });
});
