// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import { getOrganizationIncidentDetail } from "../organizations/workspace/organizationIncidentDiscovery.api";
import { CleanupEventDraftEditor } from "./CleanupEventDraftEditor";
import { createDraft, discardDraft, listDrafts } from "./cleanupEvent.api";

vi.mock("../maps", () => ({
  COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
  AdministrativeAreaMapSearch: () => null,
  LocationPicker: ({
    referenceMarker,
  }: {
    referenceMarker?: { properties: { id: string } };
  }) => (
    <output data-testid="incident-marker">
      {referenceMarker?.properties.id ?? "none"}
    </output>
  ),
}));

vi.mock("./CleanupEventPublishPanel", () => ({
  CleanupEventPublishPanel: () => null,
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
vi.mock("../organizations/workspace/organizationIncidentDiscovery.api", () => ({
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

beforeEach(() => {
  vi.mocked(listDrafts).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(listOrganizationMembers).mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  vi.mocked(getOrganizationIncidentDetail).mockResolvedValue(incident);
  vi.mocked(createDraft).mockResolvedValue(savedDraft);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("CleanupEventDraftEditor simplified linked-event flow", () => {
  test("locks the incident marker and submits one event time without client coordinates", async () => {
    render(
      <CleanupEventDraftEditor
        accessToken="token"
        organizationId="organization-1"
        incidentId="incident-1"
      />,
    );

    expect(await screen.findByText(/Location locked to:/)).toBeTruthy();
    expect(screen.getByTestId("incident-marker").textContent).toBe(
      "incident-1",
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Canal cleanup" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Remove litter beside the canal." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(createDraft).toHaveBeenCalledOnce());
    const input = vi.mocked(createDraft).mock.calls[0]![2];
    expect(input.incidentId).toBe("incident-1");
    expect(input.startsAt).toBeTruthy();
    expect("eventLatitude" in input).toBe(false);
    expect("eventLongitude" in input).toBe(false);
  });
});


test("draft list deletion supports cancellation, failure, and retry", async () => {
  vi.mocked(listDrafts).mockResolvedValue({ items: [savedDraft], nextCursor: null });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.mocked(discardDraft).mockRejectedValueOnce(new Error("Deletion failed")).mockResolvedValue(undefined);
  render(<CleanupEventDraftEditor accessToken="token" organizationId="organization-1" />);
  const remove = await screen.findByRole("button", { name: "Delete draft: Canal cleanup" });
  fireEvent.click(remove);
  expect(discardDraft).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(remove);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Canal cleanup")).toBeTruthy();
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByText("Canal cleanup")).toBeNull());
  expect(discardDraft).toHaveBeenLastCalledWith("token", "organization-1", "draft-1");
});

test("editor corner cross deletes the selected draft and returns to the list", async () => {
  vi.mocked(listDrafts).mockResolvedValue({ items: [savedDraft], nextCursor: null });
  vi.mocked(discardDraft).mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<CleanupEventDraftEditor accessToken="token" organizationId="organization-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete draft: Canal cleanup" }));
  expect(await screen.findByText("No private drafts")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
