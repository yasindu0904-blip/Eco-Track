import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventParticipantOperationsScreen } from "./EventParticipantOperationsScreen";
import { listEventParticipants, markEventAttendance } from "./cleanupEvent.api";

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
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("../../components/ui", () => ({
  Button: "Button",
  Notice: "Notice",
  sharedStyles: { card: {}, sectionTitle: {}, sectionSubtitle: {} },
}));
vi.mock("./cleanupEvent.api", () => ({
  listEventParticipants: vi.fn(),
  markEventAttendance: vi.fn(),
  removeEventParticipant: vi.fn(),
}));

describe("EventParticipantOperationsScreen event-level attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEventParticipants).mockResolvedValue({
      event: {
        id: "event-1",
        title: "Canal cleanup",
        lifecycleStatus: "PUBLISHED",
        startsAt: "2020-01-01T00:00:00.000Z",
        capacity: 20,
      },
      participants: [
        {
          id: "participant-1",
          status: "JOINED",
          attendanceStatus: "UNMARKED",
          attendanceMarkedAt: null,
          joinedAt: "2026-08-21T08:00:00.000Z",
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
    vi.mocked(markEventAttendance).mockResolvedValue({} as never);
  });

  test("marks attendance directly on the event participant", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <EventParticipantOperationsScreen
          accessToken="token"
          organizationId="organization-1"
          eventId="event-1"
        />,
      );
    });
    const attended = renderer!.root
      .findAllByType("Button" as never)
      .find((node) => node.props.label === "Mark attended");
    expect(attended).toBeTruthy();
    await act(async () => {
      await attended!.props.onPress();
    });
    expect(markEventAttendance).toHaveBeenCalledWith(
      "token",
      "organization-1",
      "event-1",
      "participant-1",
      "ATTENDED",
    );
  });
});
