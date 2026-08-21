import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CleanupEventDraftScreen } from "./CleanupEventDraftScreen";
import { createDraft, getDraft, listDrafts, saveSession } from "./cleanupEvent.api";
import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import { getOrganizationIncidentDetail } from "../organizations/organizationIncidentDiscovery.api";

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
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("../../components/ui", () => ({
  Button: "Button",
  Field: "Field",
  Notice: "Notice",
  PageHeader: "PageHeader",
  sharedStyles: {
    card: {},
    divider: {},
    sectionTitle: {},
    sectionSubtitle: {},
  },
}));

vi.mock("../map", () => ({
  COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
  LocationPicker: "LocationPicker",
}));

vi.mock("./CleanupEventPublishPanel", () => ({
  CleanupEventPublishPanel: "CleanupEventPublishPanel",
}));

vi.mock("./cleanupEvent.api", () => ({
  assignCoordinator: vi.fn(),
  createDraft: vi.fn(),
  discardDraft: vi.fn(),
  getDraft: vi.fn(),
  listDrafts: vi.fn(),
  removeCoordinator: vi.fn(),
  removeSession: vi.fn(),
  saveSession: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock("../memberships/administration/membershipAdministration.api", () => ({
  listOrganizationMembers: vi.fn(),
}));

vi.mock("../organizations/organizationIncidentDiscovery.api", () => ({
  getOrganizationIncidentDetail: vi.fn(),
}));

const incident = {
  id: "incident-1",
  title: "Blocked canal",
  category: { id: "category-1", name: "Water pollution", description: null },
  severity: "HIGH" as const,
  status: "ACTIVE" as const,
  latitude: 6.92,
  longitude: 79.86,
  addressText: "Canal Road",
  reportedAt: "2026-08-20T10:00:00.000Z",
  falseReviewCount: 0,
  currentReviewStatus: "VALID" as const,
  description: "Waste is blocking the canal.",
  highlightUntil: "2026-09-20T10:00:00.000Z",
  archiveAfter: "2027-08-20T10:00:00.000Z",
  resolvedAt: null,
  archivedAt: null,
  thumbnailUrl: null,
  photos: [],
  statusHistory: [],
  accessSource: "CURRENT_SERVICE_AREA" as const,
  currentReview: null,
};

const createdDirectDraft = {
  id: "draft-1",
  organizationId: "organization-1",
  incidentId: null,
  title: "Direct cleanup",
  description: "A directly planned cleanup event.",
  publicInstructions: null,
  eventLatitude: 6.81,
  eventLongitude: 79.92,
  eventAddress: null,
  meetingLatitude: null,
  meetingLongitude: null,
  meetingAddress: null,
  lifecycleStatus: "DRAFT" as const,
  workflowStatusId: "workflow-1",
  createdAt: "2026-08-21T10:00:00.000Z",
  updatedAt: "2026-08-21T10:00:00.000Z",
  sessions: [],
  coordinators: [],
  publishReadiness: { ready: false, checks: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listDrafts).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(listOrganizationMembers).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(getOrganizationIncidentDetail).mockResolvedValue(incident);
  vi.mocked(createDraft).mockResolvedValue(createdDirectDraft);
});

describe("CleanupEventDraftScreen linked incident flow", () => {
  test("loads incident context and does not leak it into a new direct draft", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CleanupEventDraftScreen
          accessToken="token"
          organizationId="organization-1"
          incidentId="incident-1"
          onBack={vi.fn()}
        />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    let picker = renderer!.root.findByType("LocationPicker" as never);
    expect(picker.props.referenceMarker.properties.id).toBe("incident-1");
    expect(picker.props.value).toEqual({ latitude: 6.92, longitude: 79.86 });

    await act(async () => {
      renderer!.root.findByType("PageHeader" as never).props.onBack();
    });
    await act(async () => {
      renderer!.root.findByProps({ label: "New direct draft" }).props.onPress();
    });

    picker = renderer!.root.findByType("LocationPicker" as never);
    expect(picker.props.referenceMarker).toBeUndefined();

    await act(async () => {
      renderer!.root.findByProps({ label: "Title" }).props.onChangeText("Direct cleanup");
      renderer!.root.findByProps({ label: "Description" }).props.onChangeText(
        "A directly planned cleanup event.",
      );
      picker.props.onChange({ latitude: 6.81, longitude: 79.92 });
      picker.props.onConfirm({ latitude: 6.81, longitude: 79.92 });
    });
    await act(async () => {
      renderer!.root.findByProps({ label: "Save private draft" }).props.onPress();
      await Promise.resolve();
    });

    expect(createDraft).toHaveBeenCalledOnce();
    expect(vi.mocked(createDraft).mock.calls[0]?.[2]).toMatchObject({
      incidentId: null,
      eventLatitude: 6.81,
      eventLongitude: 79.92,
    });
  });

  test("prepares a new time after adding a session at the event location", async () => {
    const savedSession = {
      id: "session-1",
      sessionDate: "2026-08-22",
      startTime: "09:00:00",
      endTime: "11:00:00",
      capacity: 25,
      locationLatitude: 6.81,
      locationLongitude: 79.92,
      locationAddress: null,
      notes: null,
    };
    vi.mocked(getDraft)
      .mockResolvedValueOnce(createdDirectDraft)
      .mockResolvedValueOnce({ ...createdDirectDraft, sessions: [savedSession] });
    vi.mocked(saveSession).mockResolvedValue(savedSession);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CleanupEventDraftScreen
          accessToken="token"
          organizationId="organization-1"
          initialDraftId="draft-1"
          onBack={vi.fn()}
        />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      renderer!.root.findByProps({ label: "Add session" }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveSession).toHaveBeenCalledOnce();
    expect(vi.mocked(saveSession).mock.calls[0]?.[3]).toMatchObject({
      startTime: "09:00:00",
      endTime: "11:00:00",
      locationLatitude: 6.81,
      locationLongitude: 79.92,
      locationAddress: null,
    });
    expect(renderer!.root.findByProps({ placeholder: "09:00" }).props.value).toBe("11:00");
    expect(renderer!.root.findByProps({ placeholder: "11:00" }).props.value).toBe("13:00");
    expect(renderer!.root.findAllByProps({ placeholder: "Session address" })).toHaveLength(0);
  });
});
