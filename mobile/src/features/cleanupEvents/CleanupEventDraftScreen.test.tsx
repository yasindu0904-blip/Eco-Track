import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CleanupEventDraftScreen } from "./CleanupEventDraftScreen";
import { Alert } from "react-native";
import { createDraft, discardDraft, listDrafts } from "./cleanupEvent.api";
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
  StyleSheet: { create: <T,>(value: T) => value },
  Text: "Text",
  View: "View",
}));
vi.mock("../../components/ui", () => ({
  Button: "Button",
  Field: "Field",
  Notice: "Notice",
  PageHeader: "PageHeader",
  sharedStyles: { card: {}, sectionTitle: {}, sectionSubtitle: {} },
}));
vi.mock("../map", () => ({
  COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
  AdministrativeAreaMapSearch: "AdministrativeAreaMapSearch",
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
  description: "Waste is blocking the canal.",
  category: { id: "category-1", name: "Water pollution", description: null },
  severity: "HIGH" as const,
  status: "ACTIVE" as const,
  latitude: 6.92,
  longitude: 79.86,
  addressText: "Canal Road",
  reportedAt: "2026-08-20T10:00:00.000Z",
  falseReviewCount: 0,
  currentReviewStatus: "VALID" as const,
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
const savedDraft = {
  id: "draft-1",
  organizationId: "organization-1",
  incidentId: "incident-1",
  title: "Canal cleanup",
  description: "Remove litter beside the canal.",
  publicInstructions: null,
  eventLatitude: 6.92,
  eventLongitude: 79.86,
  eventAddress: null,
  meetingLatitude: 6.92,
  meetingLongitude: 79.86,
  meetingAddress: null,
  startsAt: "2099-09-01T03:30:00.000Z",
  capacity: null,
  locationLockedToIncident: true,
  lifecycleStatus: "DRAFT" as const,
  displayStatus: "DRAFT" as const,
  createdAt: "2026-08-21T10:00:00.000Z",
  updatedAt: "2026-08-21T10:00:00.000Z",
  coordinators: [],
};

describe("CleanupEventDraftScreen simplified linked-event flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDrafts).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(listOrganizationMembers).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    vi.mocked(getOrganizationIncidentDetail).mockResolvedValue(incident);
    vi.mocked(createDraft).mockResolvedValue(savedDraft);
  });

  test("uses the incident point and submits one date/time without editable coordinates", async () => {
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
    const picker = renderer!.root.findByType("LocationPicker" as never);
    expect(picker.props.disabled).toBe(true);
    expect(picker.props.referenceMarker.properties.id).toBe("incident-1");
    await act(async () => {
      renderer!.root
        .findByProps({ label: "Title" })
        .props.onChangeText("Canal cleanup");
      renderer!.root
        .findByProps({ label: "Description" })
        .props.onChangeText("Remove litter beside the canal.");
    });
    await act(async () => {
      await renderer!.root
        .findByProps({ label: "Create draft" })
        .props.onPress();
    });
    const input = vi.mocked(createDraft).mock.calls[0]![2];
    expect(input.incidentId).toBe("incident-1");
    expect(input.startsAt).toBeTruthy();
    expect("eventLatitude" in input).toBe(false);
  });
});


test("draft cross confirms deletion and removes the draft only on success", async () => {
  vi.mocked(listDrafts).mockResolvedValue({ items: [savedDraft], nextCursor: null });
  vi.mocked(discardDraft).mockResolvedValue(undefined);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<CleanupEventDraftScreen accessToken="token" organizationId="organization-1" onBack={vi.fn()} />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: "Delete draft: Canal cleanup" }).props.onPress(); });
  expect(discardDraft).not.toHaveBeenCalled();
  const actions = vi.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => { await actions.find(action => action.text === "Delete")!.onPress!(); });
  expect(discardDraft).toHaveBeenCalledWith("token", "organization-1", "draft-1");
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Delete draft: Canal cleanup" })).toHaveLength(0);
  await act(async () => renderer.unmount());
});
