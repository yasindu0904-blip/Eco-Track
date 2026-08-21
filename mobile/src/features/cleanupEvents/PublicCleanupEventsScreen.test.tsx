import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PublicCleanupEventsScreen } from "./PublicCleanupEventsScreen";
import { getPublicCleanupEvent } from "./cleanupEvent.api";
import type { EventParticipation } from "./cleanupEvent.types";

vi.mock("../../config/env", () => ({
  mobileEnv: {
    apiBaseUrl: "http://localhost:5000/api/v1",
    eventEvidenceBucket: "event-evidence",
    supabasePublishableKey: "test-key",
    supabaseUrl: "https://example.supabase.co",
  },
}));

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("../../components/ui", () => ({
  Button: "Button",
  Notice: "Notice",
  PageHeader: "PageHeader",
  Screen: "Screen",
  sharedStyles: { card: {}, sectionTitle: {} },
}));

vi.mock("./cleanupEvent.api", () => ({
  getPublicCleanupEvent: vi.fn(),
  listPublicCleanupEvents: vi.fn(),
}));

vi.mock("./EventParticipationPanel", () => ({
  EventParticipationPanel: "EventParticipationPanel",
}));

vi.mock("./ParticipantEventUpdatesPanel", () => ({
  ParticipantEventUpdatesPanel: "ParticipantEventUpdatesPanel",
}));

const event = {
  id: "event-1",
  organization: { id: "organization-1", name: "Green Neighbours" },
  incidentId: null,
  title: "Canal cleanup",
  description: "Remove litter beside the canal.",
  publicInstructions: "Bring drinking water.",
  lifecycleStatus: "PUBLISHED" as const,
  eventLatitude: 6.9271,
  eventLongitude: 79.8612,
  eventAddress: "Canal road",
  meetingLatitude: 6.9271,
  meetingLongitude: 79.8612,
  meetingAddress: "Community hall",
  publishedAt: "2026-08-21T08:00:00.000Z",
  firstSessionAt: "2026-08-23T08:00:00.000Z",
  sessions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPublicCleanupEvent).mockResolvedValue(event);
});

describe("PublicCleanupEventsScreen participant updates", () => {
  test("loads private participant updates only after the user is confirmed as joined", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <PublicCleanupEventsScreen
          accessToken="token"
          initialEventId="event-1"
          onBack={vi.fn()}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer!.root.findAllByType("ParticipantEventUpdatesPanel" as never)).toHaveLength(0);
    const participationPanel = renderer!.root.findByType("EventParticipationPanel" as never);

    await act(async () => {
      participationPanel.props.onChanged({ status: "JOINED" } as EventParticipation);
    });

    expect(renderer!.root.findAllByType("ParticipantEventUpdatesPanel" as never)).toHaveLength(1);
  });
});
