import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { OrganizationWorkspacesScreen } from "./OrganizationWorkspacesScreen";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";

vi.mock("react-native", () => ({
  Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: <T,>(value: T) => value },
}));
vi.mock("../../components/ui", () => ({ Button: "Button", Notice: "Notice", PageHeader: "PageHeader", Screen: "Screen", sharedStyles: {} }));
vi.mock("../../components/memberUi", () => ({ memberColors: {} }));

describe("Organization workspace selection", () => {
  it("opens the selected membership rather than defaulting to the first organization", async () => {
    const select = vi.fn();
    const memberships = ["A", "B"].map((id) => ({ organization: { id, name: `Organization ${id}` } })) as ActiveOrganizationMembership[];
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OrganizationWorkspacesScreen memberships={memberships} loading={false} error={false} onRetry={vi.fn()} onBack={vi.fn()} onSelect={select} onManageMembership={vi.fn()} />);
    });
    await act(async () => tree!.root.findAllByType("Pressable" as never)[1]!.props.onPress());
    expect(select).toHaveBeenCalledWith("B");
    await act(async () => tree!.unmount());
  });

  it("offers retry for a failed load and membership access for an empty result", async () => {
    const retry = vi.fn();
    const manage = vi.fn();
    const props = { memberships: [], loading: false, onRetry: retry, onBack: vi.fn(), onSelect: vi.fn(), onManageMembership: manage };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<OrganizationWorkspacesScreen {...props} error />); });
    await act(async () => tree!.root.findByProps({ label: "Try again" }).props.onPress());
    expect(retry).toHaveBeenCalledOnce();
    await act(async () => tree!.update(<OrganizationWorkspacesScreen {...props} error={false} />));
    await act(async () => tree!.root.findByProps({ label: "Manage membership" }).props.onPress());
    expect(manage).toHaveBeenCalledOnce();
    await act(async () => tree!.unmount());
  });
});
