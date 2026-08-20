import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { Metric, SummaryCards } from "./SummaryCards";

vi.mock("react-native", () => ({ StyleSheet: { create: <T,>(styles: T) => styles }, Text: "Text", View: "View" }));
vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Button: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => React.createElement("Button", { label, onPress, disabled }, label),
    Notice: ({ message }: { message: string }) => React.createElement("Text", null, message),
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
});
