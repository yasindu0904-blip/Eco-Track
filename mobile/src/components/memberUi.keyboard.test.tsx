import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Field, Screen } from "./memberUi";

const mocks = vi.hoisted(() => ({
  scrollTo: vi.fn(), remove: vi.fn(),
  keyboardCallbacks: new Map<string, (event: { endCoordinates: { screenY: number } }) => void>(),
}));
vi.mock("react-native", () => ({
  Keyboard: { addListener: (event: string, callback: (event: { endCoordinates: { screenY: number } }) => void) => {
    mocks.keyboardCallbacks.set(event, callback);
    return { remove: mocks.remove };
  } },
  ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" }, Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView",
  Text: "Text", TextInput: "TextInput", View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));

let tree: ReactTestRenderer | undefined;
let inputY: number;
beforeEach(() => { vi.clearAllMocks(); mocks.keyboardCallbacks.clear(); inputY = 600; });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
async function render() {
  await act(async () => {
    tree = create(<Screen keyboardAware>
      <Field label="Search official areas" value="Kesbewa" onChangeText={vi.fn()} />
    </Screen>, { createNodeMock: element => {
      if (element.type === "ScrollView") return { scrollTo: mocks.scrollTo };
      if (element.type === "TextInput") return {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, inputY, 300, 50),
      };
      return null;
    } });
  });
}

test("scrolls the focused search input above the keyboard using its measured position", async () => {
  await render();
  await act(async () => {
    tree!.root.findByType("ScrollView" as never).props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
    tree!.root.findByType("TextInput" as never).props.onFocus();
  });
  expect(mocks.scrollTo).not.toHaveBeenCalled();
  await act(async () => mocks.keyboardCallbacks.get("keyboardDidShow")!({ endCoordinates: { screenY: 500 } }));
  expect(mocks.scrollTo).toHaveBeenCalledWith({ y: 266, animated: true });
});

test("also reveals a field focused while the keyboard is already open", async () => {
  await render();
  await act(async () => mocks.keyboardCallbacks.get("keyboardDidShow")!({ endCoordinates: { screenY: 500 } }));
  expect(mocks.scrollTo).not.toHaveBeenCalled();
  await act(async () => tree!.root.findByType("TextInput" as never).props.onFocus());
  expect(mocks.scrollTo).toHaveBeenCalledWith({ y: 166, animated: true });
  mocks.scrollTo.mockClear();
  await act(async () => mocks.keyboardCallbacks.get("keyboardDidHide")!({ endCoordinates: { screenY: 800 } }));
  await act(async () => tree!.root.findByType("TextInput" as never).props.onFocus());
  expect(mocks.scrollTo).not.toHaveBeenCalled();
});

test("keeps an already visible field in place and removes keyboard listeners on exit", async () => {
  inputY = 250;
  await render();
  await act(async () => {
    tree!.root.findByType("TextInput" as never).props.onFocus();
    mocks.keyboardCallbacks.get("keyboardDidShow")!({ endCoordinates: { screenY: 500 } });
  });
  expect(mocks.scrollTo).not.toHaveBeenCalled();
  await act(async () => tree!.unmount());
  expect(mocks.remove).toHaveBeenCalledTimes(2);
  tree = undefined;
});
