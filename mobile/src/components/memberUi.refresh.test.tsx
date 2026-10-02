import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { Screen } from "./memberUi";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
    Platform: { OS: "android" }, Pressable: "Pressable", RefreshControl: "RefreshControl",
    // Mirror Android ScrollView's native hierarchy: adding/removing the refresh
    // wrapper would unmount a Map child even when its React key is unchanged.
    ScrollView: ({ refreshControl, children, ...props }: {
      refreshControl?: React.ReactElement<Record<string, unknown>>; children?: React.ReactNode;
    }) => {
      const scroll = React.createElement("NativeScrollView", props, children);
      return refreshControl ? React.cloneElement(refreshControl, {}, scroll) : scroll;
    },
    Text: "Text", TextInput: "TextInput", View: "View",
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));

test("map stays mounted when search enables refresh and gestures disable page scrolling", async () => {
  const mount = vi.fn();
  const destroy = vi.fn();
  const refresh = vi.fn();
  function NativeMap() {
    useEffect(() => { mount(); return destroy; }, []);
    return null;
  }
  const render = (scrollEnabled: boolean, hasSearch: boolean) => (
    <Screen rememberKey="nearby:map" scrollEnabled={scrollEnabled} onRefresh={hasSearch ? refresh : undefined}>
      <NativeMap />
    </Screen>
  );
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(render(true, false)); });
  expect(tree!.root.findByType("RefreshControl" as never).props.enabled).toBe(false);
  await act(async () => tree!.update(render(true, true)));
  expect(tree!.root.findByType("RefreshControl" as never).props.enabled).toBe(true);
  await act(async () => tree!.update(render(false, true)));
  const control = tree!.root.findByType("RefreshControl" as never);
  expect(control.props.enabled).toBe(false);
  await act(async () => control.props.onRefresh());
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => tree!.update(render(true, true)));
  await act(async () => tree!.root.findByType("RefreshControl" as never).props.onRefresh());
  expect(refresh).toHaveBeenCalledOnce();
  expect(mount).toHaveBeenCalledOnce();
  expect(destroy).not.toHaveBeenCalled();
  await act(async () => tree!.unmount());
  expect(destroy).toHaveBeenCalledOnce();
});
