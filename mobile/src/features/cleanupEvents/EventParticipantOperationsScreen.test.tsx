import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventParticipantOperationsScreen } from "./EventParticipantOperationsScreen";
import { allocateEventParticipant, listEventParticipants } from "./cleanupEvent.api";

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
  StyleSheet: { create: <T,>(styles: T) => styles },
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
  allocateEventParticipant: vi.fn(),
  listEventParticipants: vi.fn(),
  markEventAttendance: vi.fn(),
  reallocateEventParticipant: vi.fn(),
  removeEventAllocation: vi.fn(),
  removeEventParticipant: vi.fn(),
}));

const futureSession = {
  id: "session-future",
  sessionDate: "2099-09-01",
  startTime: "09:00:00",
  endTime: "11:00:00",
  status: "SCHEDULED" as const,
  capacity: 5,
  allocatedCount: 0,
};

describe("EventParticipantOperationsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not offer attendance before a future session starts", async () => {
    vi.mocked(listEventParticipants).mockResolvedValue({
      event: { id: "event-1", title: "Canal cleanup", lifecycleStatus: "PUBLISHED" },
      sessions: [futureSession],
      participants: [{
        id: "participant-1",
        status: "JOINED",
        joinedAt: "2026-08-21T08:00:00.000Z",
        removedAt: null,
        volunteer: { id: "user-1", fullName: "Volunteer One", phoneNumber: "+94770000001" },
        availableSessionIds: [futureSession.id],
        allocations: [{ id: "allocation-1", participantId: "participant-1", sessionId: futureSession.id, status: "PLANNED", allocatedAt: "2026-08-21T09:00:00.000Z", attendanceMarkedAt: null, notes: null }],
      }],
      nextCursor: null,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<EventParticipantOperationsScreen accessToken="token" organizationId="organization-1" eventId="event-1" />);
    });

    expect(renderer!.root.findAllByType("Button" as never).some((node) => node.props.label === "Mark attended")).toBe(false);
    expect(renderer!.root.findAllByType("Notice" as never).some((node) => node.props.message === "Attendance opens when this session starts.")).toBe(true);
  });

  test("allocates through the event allocation endpoint", async () => {
    vi.mocked(listEventParticipants).mockResolvedValue({
      event: { id: "event-1", title: "Canal cleanup", lifecycleStatus: "PUBLISHED" },
      sessions: [futureSession],
      participants: [{
        id: "participant-1",
        status: "JOINED",
        joinedAt: "2026-08-21T08:00:00.000Z",
        removedAt: null,
        volunteer: { id: "user-1", fullName: "Volunteer One", phoneNumber: "+94770000001" },
        availableSessionIds: [futureSession.id],
        allocations: [],
      }],
      nextCursor: null,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<EventParticipantOperationsScreen accessToken="token" organizationId="organization-1" eventId="event-1" />);
    });
    const allocate = renderer!.root.findAllByType("Button" as never).find((node) => node.props.label === "Allocate 2099-09-01 09:00");
    expect(allocate).toBeTruthy();

    await act(async () => {
      allocate!.props.onPress();
    });

    expect(allocateEventParticipant).toHaveBeenCalledWith("token", "organization-1", "event-1", "participant-1", "session-future");
  });
});
