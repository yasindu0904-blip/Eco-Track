// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  getMyIncident,
  listIncidentCategories,
  listMyIncidents,
} from "./incident.api";
import { IncidentPage } from "./IncidentPage";

vi.mock("../maps", () => ({
  COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
  LocationPicker: () => <div aria-label="Location picker" />,
}));

vi.mock("./CitizenIncidentDiscovery", () => ({
  CitizenIncidentDiscovery: () => <div>Citizen discovery</div>,
}));

vi.mock("./incident.api", () => ({
  createIncident: vi.fn(),
  getMyIncident: vi.fn(),
  listIncidentCategories: vi.fn(),
  listMyIncidents: vi.fn(),
  uploadIncidentEvidence: vi.fn(),
}));

const report = {
  id: "incident-workflow",
  title: "Canal cleanup report",
  category: { id: "waste", name: "Waste", description: null },
  severity: "HIGH" as const,
  status: "CLEANUP_ORGANIZED" as const,
  latitude: 6.96,
  longitude: 79.92,
  addressText: "Community canal",
  reportedAt: "2026-08-20T08:00:00.000Z",
  thumbnailUrl: null,
};

const detail = {
  ...report,
  description: "Plastic waste is blocking the community canal.",
  highlightUntil: "2026-08-22T08:00:00.000Z",
  archiveAfter: "2026-08-29T08:00:00.000Z",
  resolvedAt: null,
  archivedAt: null,
  photos: [],
  statusHistory: [
    {
      id: "history-active",
      fromStatus: null,
      toStatus: "ACTIVE" as const,
      reason: "Incident report submitted.",
      changedAt: "2026-08-20T08:00:00.000Z",
    },
    {
      id: "history-organized",
      fromStatus: "ACTIVE" as const,
      toStatus: "CLEANUP_ORGANIZED" as const,
      reason: "A cleanup event was published for this incident.",
      changedAt: "2026-08-20T10:00:00.000Z",
    },
  ],
};

const profile = {
  id: "user-1",
  email: "citizen@example.com",
  fullName: "Citizen Reporter",
  phoneNumber: "+94770000001",
  profileCompletedAt: "2026-08-01T00:00:00.000Z",
  platformRole: "USER" as const,
  accountStatus: "ACTIVE" as const,
};

beforeEach(() => {
  vi.mocked(listIncidentCategories).mockResolvedValue([]);
  vi.mocked(listMyIncidents).mockResolvedValue([report]);
  vi.mocked(getMyIncident).mockResolvedValue(detail);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("web incident workflow scenarios", () => {
  test("My Reports reloads the linked-event state and complete reporter-visible history", async () => {
    render(
      <IncidentPage
        accessToken="token"
        profile={profile}
        initialView="reports"
        onBackToDashboard={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /view report/i }));

    expect(await screen.findByText("A cleanup event was published for this incident.")).toBeTruthy();
    expect(screen.getAllByText("Cleanup Organized").length).toBeGreaterThan(0);
    expect(screen.getByText("Incident report submitted.")).toBeTruthy();
    expect(getMyIncident).toHaveBeenCalledWith("token", report.id);
    expect(document.body.textContent).not.toContain("privateNotes");
    expect(document.body.textContent).not.toContain("Organization private");
  });

  test("a recoverable report-list failure does not sign out the valid session", async () => {
    const onSignOut = vi.fn();
    vi.mocked(listMyIncidents).mockRejectedValueOnce(new Error("weak network"));

    render(
      <IncidentPage
        accessToken="token"
        profile={profile}
        initialView="reports"
        onBackToDashboard={vi.fn()}
        onSignOut={onSignOut}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain("weak network");
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
