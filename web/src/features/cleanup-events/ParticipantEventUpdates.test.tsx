// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { getParticipantEventUpdates } from "./cleanupEvent.api";
import { ParticipantEventUpdates } from "./ParticipantEventUpdates";

vi.mock("./cleanupEvent.api", () => ({ getParticipantEventUpdates: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("shows participant-visible updates and cancellation details", async () => {
  vi.mocked(getParticipantEventUpdates).mockResolvedValue({
    event: {
      id: "event-a",
      title: "Canal cleanup",
      lifecycleStatus: "CANCELLED",
      completedAt: null,
      cancelledAt: "2026-08-20T10:00:00.000Z",
      cancellationReason: "Unsafe weather conditions",
    },
    notes: [{
      id: "note-a",
      visibility: "PARTICIPANTS",
      noteText: "Bring reusable gloves.",
      author: { id: "user-a", fullName: "Coordinator One" },
      createdAt: "2026-08-20T09:00:00.000Z",
    }],
  });

  render(<ParticipantEventUpdates accessToken="token" eventId="event-a" />);

  await waitFor(() => expect(screen.getByText("Bring reusable gloves.")).toBeTruthy());
  expect(screen.getByText("Cancelled: Unsafe weather conditions")).toBeTruthy();
  expect(getParticipantEventUpdates).toHaveBeenCalledWith("token", "event-a");
});
