// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryPanel } from "./SummaryPanel";
afterEach(cleanup);

describe("SummaryPanel", () => {
  it("shows loaded data and supports refresh", async () => {
    const load = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    render(<SummaryPanel<number> label="Citizen summary" load={load}>{value => <span>{value} reports</span>}</SummaryPanel>);
    expect(await screen.findByText("2 reports")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("3 reports")).toBeTruthy();
  });

  it("preserves partial data while reporting a refresh error", async () => {
    const load = vi.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error("offline"));
    render(<SummaryPanel<number> label="Citizen summary" load={load}>{value => <span>{value} reports</span>}</SummaryPanel>);
    await screen.findByText("2 reports"); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("offline"));
    expect(screen.getByText("2 reports")).toBeTruthy();
  });
});
