import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { EventOperationsScreen } from "./EventOperationsScreen";
import { EventParticipantOperationsScreen } from "./EventParticipantOperationsScreen";
import { OrganizationCleanupEventListScreen } from "./OrganizationCleanupEventListScreen";
import * as api from "./cleanupEvent.api";
import type { EventOperations, EventParticipantOperationsPage } from "./cleanupEvent.types";

vi.mock("../../config/env", () => ({ mobileEnv: { apiBaseUrl: "http://localhost:5000/api/v1" } }));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() }, Image: "Image", Pressable: "Pressable", Text: "Text", View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: vi.fn(), launchImageLibraryAsync: vi.fn() }));
vi.mock("../../components/ui", () => ({ Button: "Button", Field: "Field", Notice: "Notice", sharedStyles: {} }));
vi.mock("../../components/lists/ListControls", () => ({
  ListSections: "ListSections", PageControls: "PageControls",
  ListWindow: ({ items, children }: { items: unknown[]; children: (items: unknown[]) => unknown }) => children(items),
}));
vi.mock("./cleanupEvent.api", () => ({
  getEventOperations: vi.fn(), getEventCompletionReadiness: vi.fn(), addEventNote: vi.fn(),
  uploadEventEvidence: vi.fn(), completeCleanupEvent: vi.fn(), cancelCleanupEvent: vi.fn(),
  listEventParticipants: vi.fn(), markEventAttendance: vi.fn(), removeEventParticipant: vi.fn(),
  listOwnedCleanupEvents: vi.fn(), getOwnedCleanupEvent: vi.fn(),
}));

const props = { accessToken: "token", organizationId: "org-1", eventId: "event-1" };
const operations: EventOperations = {
  event: {
    id: "event-1", organizationId: "org-1", incidentId: null, title: "Beach cleanup",
    lifecycleStatus: "PUBLISHED", startsAt: "2020-01-01T09:00:00Z", updatedAt: "2026-09-25T09:00:00Z",
    completedAt: null, cancelledAt: null, cancellationReason: null,
    currentWorkflowStatus: { id: "published", code: "PUBLISHED", label: "Published", lifecycleStatus: "PUBLISHED" },
  },
  notes: [], evidence: [], history: [],
};
const participants: EventParticipantOperationsPage = {
  event: { id: "event-1", title: "Beach cleanup", lifecycleStatus: "PUBLISHED", startsAt: "2020-01-01T09:00:00Z", capacity: null },
  participants: [{ id: "volunteer-1", status: "JOINED", attendanceStatus: "ATTENDED", attendanceMarkedAt: null,
    joinedAt: "2020-01-01T08:00:00Z", removedAt: null, volunteer: { id: "user-1", fullName: "Volunteer", phoneNumber: null } }],
  nextCursor: null,
};
let renderer: TestRenderer.ReactTestRenderer;
function control(type: string, label: string) {
  return renderer.root.findAllByType(type as never).find(node => node.props.label === label || node.props.accessibilityLabel === label)!;
}
async function mountOperations() {
  await act(async () => { renderer = TestRenderer.create(<EventOperationsScreen {...props} canCancel />); });
}
async function press(label: string, type = "Button") {
  await act(async () => { control(type, label).props.onPress(); });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getEventOperations).mockResolvedValue(operations);
  vi.mocked(api.getEventCompletionReadiness).mockResolvedValue({ eventId: "event-1", ready: false, checks: [
    { code: "evidence", ready: false, message: "After evidence is required." },
  ] });
  vi.mocked(api.listEventParticipants).mockResolvedValue(participants);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});

test("attended volunteers have no removal input or attendance actions", async () => {
  await act(async () => { renderer = TestRenderer.create(<EventParticipantOperationsScreen {...props} />); });
  expect(renderer.root.findAllByType("Field" as never)).toHaveLength(0);
  expect(control("Button", "Remove volunteer").props.disabled).toBe(true);
  expect(control("Button", "Mark attended")).toBeUndefined();
});

test("switching to Ongoing and selecting an event keeps one attendance and operations panel without duplicate keys", async () => {
  vi.mocked(api.listOwnedCleanupEvents).mockResolvedValue({ items: [{
    id: "event-1", organization: { id: "org-1", name: "Green team" }, incidentId: null,
    title: "Beach cleanup", description: "Clean the beach", lifecycleStatus: "PUBLISHED", displayStatus: "ONGOING",
    eventLatitude: 6.9, eventLongitude: 79.8, eventAddress: "Beach", startsAt: "2020-01-01T09:00:00Z",
    capacity: null, publishedAt: "2020-01-01T08:00:00Z", updatedAt: "2020-01-01T09:00:00Z",
  }], nextCursor: null });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await act(async () => { renderer = TestRenderer.create(<OrganizationCleanupEventListScreen accessToken="token" organizationId="org-1" />); });
    const selectEvent = async () => {
      await act(async () => renderer.root.findAllByType("Pressable" as never).find(node => node.props.accessibilityRole === "button")!.props.onPress());
    };
    await selectEvent();
    await act(async () => renderer.root.findByType("ListSections" as never).props.onChange("ongoing"));
    expect(api.listOwnedCleanupEvents).toHaveBeenLastCalledWith("token", "org-1", undefined, "ongoing");
    expect(renderer.root.findAllByType(EventOperationsScreen)).toHaveLength(0);
    await selectEvent();
    expect(renderer.root.findAllByType(EventParticipantOperationsScreen)).toHaveLength(1);
    expect(renderer.root.findAllByType(EventOperationsScreen)).toHaveLength(1);
    expect(errors.mock.calls.some(call => call.join(" ").includes("same key"))).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("EVENT OPERATIONS");
  } finally {
    errors.mockRestore();
  }
});

test("removal asks for a reason only after opening the action and requires confirmation", async () => {
  vi.mocked(api.listEventParticipants).mockResolvedValue({ ...participants, participants: [{ ...participants.participants[0]!, attendanceStatus: "UNMARKED" }] });
  await act(async () => { renderer = TestRenderer.create(<EventParticipantOperationsScreen {...props} />); });
  expect(renderer.root.findAllByType("Field" as never)).toHaveLength(0);
  await press("Remove volunteer");
  expect(control("Button", "Confirm removal").props.disabled).toBe(true);
  await act(async () => control("Field", "Removal reason").props.onChangeText("Requested removal by phone"));
  await press("Confirm removal");
  expect(api.removeEventParticipant).not.toHaveBeenCalled();
  const buttons = vi.mocked(Alert.alert).mock.calls[0]![2]!;
  await act(async () => buttons.find(button => button.text === "Remove")!.onPress!());
  expect(api.removeEventParticipant).toHaveBeenCalledWith("token", "org-1", "event-1", "volunteer-1", "Requested removal by phone");
  expect(renderer.root.findAllByType("Field" as never)).toHaveLength(0);
});

test("notes respect the selected audience and refresh after saving", async () => {
  await mountOperations();
  await press("Internal team only", "Pressable");
  await act(async () => control("Field", "Note").props.onChangeText("Team equipment update"));
  await press("Add note");
  expect(api.addEventNote).toHaveBeenCalledWith("token", "org-1", "event-1", "INTERNAL", "Team equipment update");
  expect(control("Field", "Note").props.value).toBe("");
  expect(api.getEventOperations).toHaveBeenCalledTimes(2);
});

test("evidence is previewed first and uploads with the selected type and caption", async () => {
  vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///after.jpg", fileName: "after.jpg", mimeType: "image/jpeg", width: 100, height: 100 }] });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  await mountOperations();
  expect(control("Button", "Upload evidence").props.disabled).toBe(true);
  await press("After", "Pressable");
  await act(async () => control("Field", "Caption").props.onChangeText("Clean beach"));
  await press("Choose photo");
  expect(api.uploadEventEvidence).not.toHaveBeenCalled();
  expect(control("Image", "Selected evidence photo").props.source.uri).toBe("file:///after.jpg");
  await press("Upload evidence");
  expect(api.uploadEventEvidence).toHaveBeenCalledWith("token", "org-1", "event-1", expect.objectContaining({ originalFileName: "after.jpg", sizeBytes: 8 }), { type: "AFTER", caption: "Clean beach" });
  expect(control("Field", "Caption").props.value).toBe("");
  expect(control("Button", "Upload evidence").props.disabled).toBe(true);
});

test("photo selection failures show an error without starting an upload", async () => {
  vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockRejectedValue(new Error("Library unavailable"));
  await mountOperations();
  await press("Choose photo");
  expect(renderer.root.findByType("Notice" as never).props.message).toBe("Library unavailable");
  expect(api.uploadEventEvidence).not.toHaveBeenCalled();
  expect(control("Button", "Choose photo").props.disabled).toBe(false);
});

test.each(["COMPLETED", "CANCELLED"] as const)("%s events show saved evidence without editable operation fields", async status => {
  vi.mocked(api.getEventOperations).mockResolvedValue({ ...operations, event: { ...operations.event, lifecycleStatus: status }, evidence: [{ id: "photo-1", type: "AFTER", caption: "Result", url: "https://example.test/photo.jpg", uploadedBy: { id: "user-1", fullName: "Coordinator" }, uploadedAt: "2026-09-25T09:00:00Z" }] });
  await mountOperations();
  expect(renderer.root.findAllByType("Field" as never)).toHaveLength(0);
  expect(control("Image", "Result").props.source.uri).toBe("https://example.test/photo.jpg");
  expect(control("Button", "Complete cleanup event")).toBeUndefined();
  expect(control("Button", "Cancel cleanup event")).toBeUndefined();
});
