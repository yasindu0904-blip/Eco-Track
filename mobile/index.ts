import { registerRootComponent } from "expo";
import { createElement } from "react";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

import App from "./App";
import { MapPreviewApp } from "./src/features/map/MapPreviewApp";
import { configureNotificationPresentation } from "./src/features/notifications/pushNotification.service";

configureNotificationPresentation();

const RootComponent =
  process.env.EXPO_PUBLIC_MAP_PREVIEW === "true" ? MapPreviewApp : App;

function SafeRoot() {
  return createElement(SafeAreaProvider, { initialMetrics: initialWindowMetrics }, createElement(RootComponent));
}

registerRootComponent(SafeRoot);
