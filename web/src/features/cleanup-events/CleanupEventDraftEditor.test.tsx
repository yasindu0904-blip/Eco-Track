// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CleanupEventDraftEditor } from "./CleanupEventDraftEditor";
import { createDraft, listDrafts } from "./cleanupEvent.api";
import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import { getOrganizationIncidentDetail } from "../organizations/workspace/organizationIncidentDiscovery.api";

vi.mock("../maps", async () => {
  const actual = await vi.importActual<typeof import("../maps")>("../maps");
  return {
    ...actual,
    LocationPicker: (props: ComponentProps<typeof actual.LocationPicker>) => (
      <div aria-label="Mock location picker">
        <output data-testid="reference-marker">
          {props.referenceMarker?.properties.id ?? "none"}
        </output>
        <output data-testid="picker-location">
          {props.value ? `${props.value.latitude},${props.value.longitude}` : "none"}
        </output>
        <button
          type="button"
          onClick={() => props.onChange?.({ latitude: 6.81, longitude: 79.92 })}
        >
          Choose map point
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm({ latitude: 6.81, longitude: 79.92 })}
        >
          Confirm event location
        </button>
      </div>
    ),
  };
});

vi.mock("./cleanupEvent.api", () => ({
  addSession: vi.fn(),
  assignCoordinator: vi.fn(),
  createDraft: vi.fn(),
  discardDraft: vi.fn(),
  getDraft: vi.fn(),
  listDrafts: vi.fn(),
  removeCoordinator: vi.fn(),
  removeSession: vi.fn(),
  updateDraft: vi.fn(),
  updateSession: vi.fn(),
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
  publishReadiness: {
    ready: false,
    checks: [],
  },
};

beforeEach(() => {
  vi.mocked(listDrafts).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(listOrganizationMembers).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(getOrganizationIncidentDetail).mockResolvedValue(incident);
  vi.mocked(createDraft).mockResolvedValue(createdDirectDraft);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CleanupEventDraftEditor linked incident flow", () => {
  test("loads the incident map context and clears it for a new direct draft", async () => {
    render(
      <CleanupEventDraftEditor
        accessToken="token"
        organizationId="organization-1"
        incidentId="incident-1"
      />,
    );

    expect(await screen.findByText("Blocked canal")).toBeTruthy();
    expect(screen.getByTestId("reference-marker").textContent).toBe("incident-1");
    await waitFor(() => {
      expect(screen.getByTestId("picker-location").textContent).toBe("6.92,79.86");
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "New draft" }));

    expect(screen.queryByText("Blocked canal")).toBeNull();
    expect(screen.getByTestId("reference-marker").textContent).toBe("none");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Direct cleanup" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A directly planned cleanup event." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose map point" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm event location" }));
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));

    await waitFor(() => expect(createDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(createDraft).mock.calls[0][2]).toMatchObject({
      incidentId: null,
      eventLatitude: 6.81,
      eventLongitude: 79.92,
    });
  });
});
