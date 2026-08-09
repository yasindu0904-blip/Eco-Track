import { createClient } from "@supabase/supabase-js";

import { webEnv } from "./env";

export const supabase = createClient(
  webEnv.supabaseUrl,
  webEnv.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);