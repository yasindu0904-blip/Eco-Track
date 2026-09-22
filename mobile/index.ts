import { registerRootComponent } from "expo";

import App from "./App";
import { MapPreviewApp } from "./src/features/map/MapPreviewApp";
import { configureNotificationPresentation } from "./src/features/notifications/pushNotification.service";

configureNotificationPresentation();

const RootComponent =
  process.env.EXPO_PUBLIC_MAP_PREVIEW === "true" ? MapPreviewApp : App;

registerRootComponent(RootComponent);
