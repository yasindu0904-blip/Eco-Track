import { supabase } from "../../config/supabase";

export async function sendMagicLink(
  email: string,
): Promise<void> {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "An email address is required.",
    );
  }

  const { error } =
    await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo:
          `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

  if (error) {
    throw error;
  }
}