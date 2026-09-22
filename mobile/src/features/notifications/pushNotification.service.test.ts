import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExpoPushTokenAsync: vi.fn(),
  unregisterForNotificationsAsync: vi.fn(),
  getItemAsync: vi.fn(),
  registerPushDevice: vi.fn(),
  deactivatePushDevice: vi.fn(),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { eas: { projectId: "test-project" } }, version: "1.0.0" } },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-installation" }));
vi.mock("expo-device", () => ({ isDevice: true, deviceName: "Test phone" }));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: () => Promise.resolve({ status: "granted" }),
  getExpoPushTokenAsync: mocks.getExpoPushTokenAsync,
  unregisterForNotificationsAsync: mocks.unregisterForNotificationsAsync,
}));
vi.mock("expo-secure-store", () => ({ getItemAsync: mocks.getItemAsync }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./pushNotification.api", () => ({
  registerPushDevice: mocks.registerPushDevice,
  deactivatePushDevice: mocks.deactivatePushDevice,
}));

import {
  deactivateCurrentInstallationPush,
  registerCurrentInstallationForPush,
} from "./pushNotification.service";

describe("push registration during sign-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getItemAsync.mockResolvedValue("test-installation");
    mocks.unregisterForNotificationsAsync.mockResolvedValue(undefined);
    mocks.deactivatePushDevice.mockResolvedValue(undefined);
  });

  it("does not reactivate a device when token retrieval finishes after sign-out", async () => {
    let finishTokenRetrieval!: (token: { data: string }) => void;
    mocks.getExpoPushTokenAsync.mockReturnValue(new Promise((resolve) => {
      finishTokenRetrieval = resolve;
    }));
    const controller = new AbortController();
    const registration = registerCurrentInstallationForPush("access-token", "user-id", undefined, controller.signal);

    await vi.waitFor(() => expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledOnce());
    controller.abort();
    await deactivateCurrentInstallationPush("access-token", "user-id");
    finishTokenRetrieval({ data: "ExponentPushToken[test]" });
    await registration;

    expect(mocks.registerPushDevice).not.toHaveBeenCalled();
    expect(mocks.unregisterForNotificationsAsync).toHaveBeenCalledOnce();
    expect(mocks.deactivatePushDevice).toHaveBeenCalledWith("access-token", "test-installation");
  });

  it("still disables the server device if native token removal fails", async () => {
    mocks.unregisterForNotificationsAsync.mockRejectedValue(new Error("native unavailable"));
    await expect(deactivateCurrentInstallationPush("access-token", "user-id")).resolves.toBeUndefined();
    expect(mocks.deactivatePushDevice).toHaveBeenCalledOnce();
  });

  it("refuses to report safe sign-out when neither cancellation succeeds", async () => {
    mocks.unregisterForNotificationsAsync.mockRejectedValue(new Error("native unavailable"));
    mocks.deactivatePushDevice.mockRejectedValue(new Error("API offline"));
    await expect(deactivateCurrentInstallationPush("access-token", "user-id"))
      .rejects.toThrow("Could not disable push notifications");
  });
});
