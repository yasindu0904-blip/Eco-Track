import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NotificationButton, NotificationInboxScreen } from "./NotificationInboxScreen";
import { markAllNotificationsRead, markNotificationRead } from "./notification.api";
import { publishNotificationCount } from "./notificationUpdates";
import type { NotificationItem } from "./notification.types";

const mocks = vi.hoisted(() => ({ request: vi.fn(), foreground: undefined as ((state: string) => void) | undefined }));
vi.mock("../../api/apiClient", () => ({ apiRequest: mocks.request, ApiRequestError: class extends Error {} }));
vi.mock("react-native", () => ({
  AppState: { addEventListener: (_event: string, callback: (state: string) => void) => {
    mocks.foreground = callback;
    return { remove: vi.fn() };
  } },
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles }, Text: "Text", View: "View",
}));
vi.mock("../../components/NavigationIcon", () => ({ NavigationIcon: () => null }));
vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Screen: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("Screen", props, children),
    PageHeader: ({ action }: { action: React.ReactNode }) => React.createElement("View", null, action),
    Button: ({ label, ...props }: { label: string }) => React.createElement("Button", { ...props, accessibilityLabel: label }),
    Notice: ({ message }: { message: string }) => React.createElement("Text", null, message),
    sharedStyles: { card: {}, sectionTitle: {}, spacedRow: {} },
  };
});

let tree: ReactTestRenderer | undefined;
let unread: number;
let countReplies: (number | Promise<number>)[];
let items: NotificationItem[];
beforeEach(() => {
  vi.clearAllMocks();
  unread = 2;
  countReplies = [];
  items = [1, 2].map(id => ({ id: String(id), title: `Update ${id}`, message: "Cleanup update",
    type: "GENERAL", data: null, organizationId: null, readAt: null, createdAt: "2026-10-02T10:00:00Z" }));
  mocks.request.mockImplementation(async (path: string) => {
    if (path === "/notifications/unread-count") return { data: { unreadCount: await (countReplies.shift() ?? unread) } };
    if (path.startsWith("/notifications?")) return { data: { items: [...items], nextCursor: null } };
    if (path === "/notifications/read-all") {
      const markedReadCount = unread;
      unread = 0;
      return { data: { markedReadCount, readAt: "2026-10-02T10:01:00Z" } };
    }
    const id = path.match(/^\/notifications\/(\d+)\/read$/)?.[1];
    if (id) { unread -= 1; return { data: { ...items.find(item => item.id === id), readAt: "2026-10-02T10:01:00Z" } }; }
    throw new Error(`Unexpected test request: ${path}`);
  });
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });

async function render(inbox = true, accessToken = "session-a") {
  await act(async () => {
    tree = create(<>
      <NotificationButton compact accessToken={accessToken} onOpen={vi.fn()} />
      {inbox && <NotificationInboxScreen accessToken={accessToken} onBack={vi.fn()} />}
    </>);
  });
}
function bellLabel() {
  return tree!.root.findAllByType("Pressable" as never).find(node =>
    node.props.accessibilityLabel?.startsWith("Notifications"))!.props.accessibilityLabel;
}

test("mark all removes the persistent header badge without restarting the app", async () => {
  await render();
  expect(bellLabel()).toBe("Notifications, 2 unread");
  await act(async () => tree!.root.findByProps({ accessibilityLabel: "Mark all as read" }).props.onPress());
  expect(bellLabel()).toBe("Notifications");
  expect(mocks.request).toHaveBeenCalledWith("/notifications/read-all", { method: "PATCH", accessToken: "session-a" });
});

test("marking one notification read refreshes the count for the header", async () => {
  await render(false);
  await act(async () => { await markNotificationRead("session-a", "1"); });
  expect(bellLabel()).toBe("Notifications, 1 unread");
});

test("a count request started before mark-all cannot restore the old badge", async () => {
  await render(false);
  let finish!: (count: number) => void;
  countReplies.push(new Promise(resolve => { finish = resolve; }));
  await act(async () => mocks.foreground!("active"));
  await act(async () => { await markAllNotificationsRead("session-a"); });
  expect(bellLabel()).toBe("Notifications");
  await act(async () => finish(2));
  expect(bellLabel()).toBe("Notifications");
});

test("refreshing the inbox synchronizes the bell, including changes on another device", async () => {
  await render();
  unread = 0;
  await act(async () => { await tree!.root.findByType("Screen" as never).props.onRefresh(); });
  expect(bellLabel()).toBe("Notifications");
});

test("an incoming push refreshes the badge and another session cannot change it", async () => {
  await render(false);
  await act(async () => publishNotificationCount("session-b", 0));
  expect(bellLabel()).toBe("Notifications, 2 unread");
  unread = 3;
  await act(async () => publishNotificationCount("session-a"));
  expect(bellLabel()).toBe("Notifications, 3 unread");
});

test("a failed mark-all request keeps the unread badge", async () => {
  await render();
  mocks.request.mockRejectedValueOnce(new Error("network unavailable"));
  await act(async () => tree!.root.findByProps({ accessibilityLabel: "Mark all as read" }).props.onPress());
  expect(bellLabel()).toBe("Notifications, 2 unread");
});

test("an older inbox refresh cannot resurrect unread counts after mark-all", async () => {
  await render();
  let finish!: (count: number) => void;
  countReplies.push(new Promise(resolve => { finish = resolve; }));
  let refresh!: Promise<void>;
  await act(async () => { refresh = tree!.root.findByType("Screen" as never).props.onRefresh(); });
  await act(async () => tree!.root.findByProps({ accessibilityLabel: "Mark all as read" }).props.onPress());
  await act(async () => { finish(2); await refresh; });
  expect(bellLabel()).toBe("Notifications");
});
