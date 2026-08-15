import { supabaseAuth } from "../../../config/supabase.js";

import type { VerifiedSupabaseIdentity } from "../auth.types.js";

export async function verifyAccessToken(
  accessToken: string,
): Promise<VerifiedSupabaseIdentity | null> {
  const { data, error } =
    await supabaseAuth.auth.getUser(accessToken);

  const user = data.user;
  const email = user?.email?.trim().toLowerCase();

  if (error || !user || !email) {
    return null;
  }

  return {
    authUserId: user.id,
    email,
  };
}
