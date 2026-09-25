import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { CitizenDrawer } from "./CitizenDrawer";

vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider" }));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));

vi.mock("react-native", () => ({
  Animated: {
    Value: class { setValue() {} },
    timing: () => ({ start() {}, stop() {} }),
    View: "AnimatedView",
  },
  Modal: "Modal", Platform: { OS: "android" }, StatusBar: { currentHeight: 24 },
  Pressable: "Pressable", SafeAreaView: "SafeAreaView", ScrollView: "ScrollView", Text: "Text", View: "View",
  StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} },
}));

describe("Citizen drawer navigation", () => {
  it("closes before opening each destination, including sign out", async () => {
    const calls: string[] = [];
    const record = (label: string) => () => calls.push(label);
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<CitizenDrawer visible onClose={record("close")}
        community={[{ label: "My Reports", onPress: record("reports") }]}
        organizations={[{ label: "Organization workspaces", onPress: record("workspaces") }]}
        onNotifications={record("notifications")} onSignOut={record("signout")} />);
    });
    for (const [label, action] of [["My Reports", "reports"], ["Organization workspaces", "workspaces"], ["Notifications", "notifications"], ["Sign out", "signout"]]) {
      calls.length = 0;
      const button = tree!.root.findAllByType("Pressable" as never).find((node) => node.findAllByProps({ children: label }).length > 0)!;
      await act(async () => button.props.onPress());
      expect(calls).toEqual(["close", action]);
    }
    await act(async () => tree!.unmount());
  });

  it("dismisses via Android back, backdrop, and the close button without navigating", async () => {
    const close = vi.fn();
    const navigate = vi.fn();
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<CitizenDrawer visible onClose={close} community={[]} organizations={[]} onNotifications={navigate} onSignOut={navigate} />);
    });
    await act(async () => tree!.root.findByType("Modal" as never).props.onRequestClose());
    await act(async () => tree!.root.findByProps({ accessibilityLabel: "Close navigation menu" }).props.onPress());
    await act(async () => tree!.root.findByProps({ accessibilityLabel: "Close menu" }).props.onPress());
    expect(close).toHaveBeenCalledTimes(3);
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => tree!.unmount());
  });
});
