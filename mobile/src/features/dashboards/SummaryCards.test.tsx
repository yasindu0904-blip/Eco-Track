import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { Metric, SummaryCards } from "./SummaryCards";

vi.mock("../../api/apiError", () => ({
  describeApiFailure: (reason: unknown, fallback: string) => ({
    message: reason instanceof Error ? reason.message : fallback,
  }),
}));
vi.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles }, Text: "Text", View: "View" }));
vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Button: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => React.createElement("Button", { label, onPress, disabled }, label),
    Notice: ({ message }: { message: string }) => React.createElement("Notice", { message }, message),
    sharedStyles: { card: {}, sectionTitle: {} },
  };
});
vi.mock("../../components/theme", () => ({ spacing: { sm: 8 } }));

describe("SummaryCards", () => {
  it("renders real values and refreshes", async () => {
    const load = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<SummaryCards<number> label="Organization summary" load={load}>{value => <Metric label="Incidents" value={value} />}</SummaryCards>); });
    expect(tree!.root.findAllByProps({ children: 2 }).length).toBeGreaterThan(0);
    await act(async () => { tree!.root.findByProps({ label: "Refresh" }).props.onPress(); });
    expect(tree!.root.findAllByProps({ children: 4 }).length).toBeGreaterThan(0);
  });

  it("preserves loaded values when a refresh fails", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error("offline"));
    let tree: ReturnType<typeof create>;

    await act(async () => {
      tree = create(
        <SummaryCards<number> label="Citizen summary" load={load}>
          {(value) => <Metric label="Reports" value={value} />}
        </SummaryCards>,
      );
    });
    await act(async () => {
      tree!.root.findByProps({ label: "Refresh" }).props.onPress();
    });

    expect(tree!.root.findAllByProps({ children: 2 }).length).toBeGreaterThan(0);
    expect(
      tree!.root.find(
        (node) =>
          typeof node.props.message === "string" &&
          node.props.message.includes("offline"),
      ).props.message,
    ).toContain("offline");
  });

  it("shows error and empty states when the initial request fails", async () => {
    const load = vi.fn().mockRejectedValue(new Error("network unavailable"));
    let tree: ReturnType<typeof create>;

    await act(async () => {
      tree = create(
        <SummaryCards<number> label="Platform summary" load={load}>
          {(value) => <Metric label="Users" value={value} />}
        </SummaryCards>,
      );
    });

    expect(
      tree!.root.find(
        (node) =>
          typeof node.props.message === "string" &&
          node.props.message.includes("network unavailable"),
      ).props.message,
    ).toContain("network unavailable");
    expect(
      tree!.root.findAllByProps({
        children: "No summary data is available yet.",
      }).length,
    ).toBeGreaterThan(0);
  });
});
