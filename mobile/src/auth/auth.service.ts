import * as Linking from "expo-linking";

import { supabase } from "../config/supabase";

export const mobileAuthRedirectUrl = Linking.createURL("auth/callback");

export async function requestMagicLink(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("An email address is required.");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: mobileAuthRedirectUrl,
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw error;
  }
}

function readCallbackParameters(url: string): URLSearchParams {
  const fragmentStart = url.indexOf("#");
  const fragment = fragmentStart >= 0 ? url.slice(fragmentStart + 1) : "";
  const queryStart = url.indexOf("?");
  const queryEnd = fragmentStart >= 0 ? fragmentStart : url.length;
  const query = queryStart >= 0 ? url.slice(queryStart + 1, queryEnd) : "";
  const parameters = new URLSearchParams(query);

  new URLSearchParams(fragment).forEach((value, key) => {
    parameters.set(key, value);
  });

  return parameters;
}

export async function handleAuthenticationCallback(url: string): Promise<void> {
  const parameters = readCallbackParameters(url);
  const callbackError =
    parameters.get("error_description") ?? parameters.get("error");

  if (callbackError) {
    throw new Error(callbackError);
  }

  const code = parameters.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return;
  }

  const accessToken = parameters.get("access_token");
  const refreshToken = parameters.get("refresh_token");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }
  }
}
