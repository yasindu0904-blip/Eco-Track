import { registerRootComponent } from "expo";

import App from "./App";
import { MapPreviewApp } from "./src/features/map/MapPreviewApp";

const RootComponent =
  process.env.EXPO_PUBLIC_MAP_PREVIEW === "true" ? MapPreviewApp : App;

registerRootComponent(RootComponent);
