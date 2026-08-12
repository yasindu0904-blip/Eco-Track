import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";

import { mobileEnv } from "./env";
import { secureStorage } from "./secureStorage";

export const supabase = createClient(
  mobileEnv.supabaseUrl,
  mobileEnv.supabasePublishableKey,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
