import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { PageHeader, Screen } from "./memberUi";

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" }, Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView",
  Text: "Text", TextInput: "TextInput", View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("../features/citizen/CitizenDrawer", () => ({ CitizenDrawer: "CitizenDrawer" }));
vi.mock("../features/notifications/NotificationInboxScreen", () => ({ NotificationButton: "NotificationButton" }));

let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe("shared mobile header", () => {
  it("keeps the green header outside scrolling content and applies each safe edge once", async () => {
    await act(async () => {
      tree = create(<AppShell title="Reports" onSignOut={vi.fn()}>
        <Screen><PageHeader title="My Reports" /><Screen><PageHeader title="Report details" /></Screen></Screen>
      </AppShell>);
    });
    const areas = tree.root.findAllByType("SafeAreaView" as never);
    expect(areas.map((area) => area.props.edges)).toEqual([
      ["top", "left", "right"], ["bottom", "left", "right"], [], [],
    ]);
    expect(areas[0]!.props.style.backgroundColor).toBe("#195F38");
    expect(areas[0]!.findAllByType("ScrollView" as never)).toHaveLength(0);
    const scroll = tree.root.findAllByType("ScrollView" as never)[0]!;
    expect(scroll.findAllByProps({ accessibilityLabel: "Open navigation menu" })).toHaveLength(0);
    expect(scroll.findAllByProps({ children: "Report details" })).toHaveLength(0);
    expect(areas[0]!.findAllByProps({ children: "Report details" })).toHaveLength(1);
  });

  it("uses the deepest screen's current back handler, restores the parent, and opens the drawer there", async () => {
    const parentBack = vi.fn();
    const firstBack = vi.fn();
    const latestBack = vi.fn();
    const render = (detail: boolean, onBack: () => void) => (
      <AppShell title="EcoTrack" onSignOut={vi.fn()}>
        <Screen>
          <PageHeader title="Workspace" onBack={parentBack} backLabel="Dashboard" />
          {detail && <Screen><PageHeader title="Event details" onBack={onBack} backLabel="Event list" /></Screen>}
        </Screen>
      </AppShell>
    );
    await act(async () => { tree = create(render(true, firstBack)); });
    await act(async () => tree.update(render(true, latestBack)));
    await act(async () => tree.root.findByProps({ accessibilityLabel: "Event list" }).props.onPress());
    expect(latestBack).toHaveBeenCalledOnce();
    expect(firstBack).not.toHaveBeenCalled();
    expect(parentBack).not.toHaveBeenCalled();
    await act(async () => tree.update(render(false, latestBack)));
    await act(async () => tree.root.findByProps({ accessibilityLabel: "Dashboard" }).props.onPress());
    expect(parentBack).toHaveBeenCalledOnce();
    await act(async () => tree.root.findByProps({ accessibilityLabel: "Open navigation menu" }).props.onPress());
    expect(tree.root.findByType("CitizenDrawer" as never).props.visible).toBe(true);
    await act(async () => tree.root.findByType("CitizenDrawer" as never).props.onClose());
    expect(tree.root.findByType("CitizenDrawer" as never).props.visible).toBe(false);
  });

  it("protects standalone sign-in screens without requiring an authenticated header", async () => {
    await act(async () => { tree = create(<Screen><PageHeader title="Sign in" /></Screen>); });
    expect(tree.root.findByType("SafeAreaView" as never).props.edges).toEqual(["top", "bottom", "left", "right"]);
    expect(tree.root.findAllByProps({ children: "Sign in" })).toHaveLength(1);
  });

  it("runs pull-to-refresh work and clears the native refresh indicator", async () => {
    let finishRefresh: (() => void) | undefined;
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => {
      finishRefresh = resolve;
    }));
    await act(async () => {
      tree = create(<Screen onRefresh={onRefresh}>Refreshable content</Screen>);
    });
    const refreshControl = () => tree.root.findByType("ScrollView" as never).props.refreshControl;
    expect(refreshControl().props.refreshing).toBe(false);
    await act(async () => {
      refreshControl().props.onRefresh();
      await Promise.resolve();
    });
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(refreshControl().props.refreshing).toBe(true);
    await act(async () => {
      finishRefresh?.();
      await Promise.resolve();
    });
    expect(refreshControl().props.refreshing).toBe(false);
  });

  it("inherits the workspace back action when a nested section only supplies a title", async () => {
    const overview = vi.fn();
    const dashboard = vi.fn();
    await act(async () => {
      tree = create(<AppShell title="EcoTrack" onBack={dashboard} onSignOut={vi.fn()}>
        <Screen><PageHeader title="Workspace" onBack={overview} backLabel="Organization overview" />
          <Screen><PageHeader title="Organization events" /></Screen>
        </Screen>
      </AppShell>);
    });
    await act(async () => tree.root.findByProps({ accessibilityLabel: "Organization overview" }).props.onPress());
    expect(overview).toHaveBeenCalledOnce();
    expect(dashboard).not.toHaveBeenCalled();
  });
});
