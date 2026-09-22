import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type {
  NotificationItem,
  NotificationType,
} from "./notification.types";
import {
  deactivatePushDevice,
  registerPushDevice,
} from "./pushNotification.api";

const notificationTypes = new Set<NotificationType>([
  "INCIDENT_STATUS_CHANGED",
  "NEW_INCIDENT_IN_AREA",
  "EVENT_PUBLISHED",
  "EVENT_JOINED",
  "SESSION_ALLOCATED",
  "EVENT_UPDATED",
  "EVENT_CANCELLED",
  "EVENT_COMPLETED",
  "EVENT_REMINDER",
  "MEMBERSHIP_UPDATED",
  "ORGANIZATION_REVIEW_UPDATED",
  "ACHIEVEMENT_AWARDED",
  "GENERAL",
]);

function installationKey(userId: string): string {
  return `ecotrack.push.installation.${userId}`;
}

async function getOrCreateInstallationId(userId: string): Promise<string> {
  const key = installationKey(userId);
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;

  const installationId = Crypto.randomUUID();
  await SecureStore.setItemAsync(key, installationId);
  return installationId;
}

function projectId(): string {
  const value = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;

  if (typeof value !== "string" || value.length === 0) {
    throw new Error("The Expo EAS project ID is missing from the app configuration.");
  }

  return value;
}

export async function registerCurrentInstallationForPush(
  accessToken: string,
  userId: string,
  devicePushToken?: Notifications.DevicePushToken,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted || !Device.isDevice || (Platform.OS !== "android" && Platform.OS !== "ios")) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("ecotrack-updates-v2", {
      name: "EcoTrack updates",
      description: "Updates about reports, memberships, and cleanup events.",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const installationId = await getOrCreateInstallationId(userId);
  if (signal?.aborted) return;
  let permission = await Notifications.getPermissionsAsync();
  if (signal?.aborted) return;
  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (signal?.aborted) return;

  if (permission.status !== "granted") {
    await deactivatePushDevice(accessToken, installationId).catch(() => undefined);
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
    ...(devicePushToken ? { devicePushToken } : {}),
  });
  if (signal?.aborted) return;

  await registerPushDevice(accessToken, {
    installationId,
    expoPushToken: token.data,
    platform: Platform.OS === "android" ? "ANDROID" : "IOS",
    deviceName: Device.deviceName ?? undefined,
    appVersion: Constants.expoConfig?.version,
  }, signal);
}

export async function deactivateCurrentInstallationPush(
  accessToken: string,
  userId: string,
): Promise<void> {
  const installationId = await SecureStore.getItemAsync(installationKey(userId));
  const results = await Promise.allSettled([
    Notifications.unregisterForNotificationsAsync(),
    installationId ? deactivatePushDevice(accessToken, installationId) : Promise.resolve(),
  ]);
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("Could not disable push notifications on this phone or server. Check your connection and try again.");
  }
  if (results[1]?.status === "rejected") {
    console.warn("Push device could not be deactivated on the server.", results[1].reason);
  }
}

export function notificationItemFromResponse(
  response: Notifications.NotificationResponse,
): NotificationItem | null {
  const content = response.notification.request.content;
  const source = content.data ?? {};
  const id = source.notificationId;
  const type = source.type;

  if (
    typeof id !== "string"
    || typeof type !== "string"
    || !notificationTypes.has(type as NotificationType)
  ) {
    return null;
  }

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && key !== "notificationId" && key !== "type") {
      data[key] = value;
    }
  }

  return {
    id,
    organizationId: typeof source.organizationId === "string"
      ? source.organizationId
      : null,
    type: type as NotificationType,
    title: content.title ?? "EcoTrack update",
    message: content.body ?? "Open EcoTrack to view this update.",
    data: Object.keys(data).length > 0 ? data : null,
    readAt: null,
    createdAt: new Date(response.notification.date).toISOString(),
  };
}

export function configureNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
