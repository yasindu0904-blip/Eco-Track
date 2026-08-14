import { useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";

import { ApiRequestError } from "../api/apiClient";
import { supabase } from "../config/supabase";
import { fetchCurrentUser } from "./auth.api";
import { handleAuthenticationCallback } from "./auth.service";
import type { AuthenticatedUserProfile } from "./auth.types";

type AuthenticationStatus = "loading" | "signedOut" | "signedIn" | "error";

type AuthenticationState = {
  status: AuthenticationStatus;
  profile: AuthenticatedUserProfile | null;
  accessToken: string | null;
  errorMessage: string | null;
};

const initialState: AuthenticationState = {
  status: "loading",
  profile: null,
  accessToken: null,
  errorMessage: null,
};

function authenticationErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.statusCode === 401) {
    return "Your access token is invalid or expired. Please request a new magic link.";
  }

  return error instanceof Error
    ? error.message
    : "EcoTrack could not complete authentication.";
}

export function useAuthentication() {
  const [state, setState] = useState<AuthenticationState>(initialState);
  const latestResolution = useRef(0);

  const resolveSession = useCallback(async (session: Session | null) => {
    const resolutionId = latestResolution.current + 1;
    latestResolution.current = resolutionId;

    if (!session) {
      setState({
        status: "signedOut",
        profile: null,
        accessToken: null,
        errorMessage: null,
      });
      return;
    }

    setState((current) => ({ ...current, status: "loading", errorMessage: null }));

    try {
      const profile = await fetchCurrentUser(session.access_token);

      if (latestResolution.current !== resolutionId) {
        return;
      }

      setState({
        status: "signedIn",
        profile,
        accessToken: session.access_token,
        errorMessage: null,
      });
    } catch (error) {
      if (latestResolution.current !== resolutionId) {
        return;
      }

      setState({
        status: "error",
        profile: null,
        accessToken: session.access_token,
        errorMessage: authenticationErrorMessage(error),
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const processUrl = async (url: string | null) => {
      if (!url || !url.includes("auth/callback")) {
        return;
      }

      setState((current) => ({ ...current, status: "loading", errorMessage: null }));

      try {
        await handleAuthenticationCallback(url);
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            profile: null,
            accessToken: null,
            errorMessage: authenticationErrorMessage(error),
          });
        }
      }
    };

    const initialize = async () => {
      const initialUrl = await Linking.getInitialURL();
      await processUrl(initialUrl);

      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        setState({
          status: "error",
          profile: null,
          accessToken: null,
          errorMessage: error.message,
        });
        return;
      }

      await resolveSession(data.session);
    };

    void initialize();

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void processUrl(url);
    });
    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          void resolveSession(session);
        }
      },
    );

    return () => {
      active = false;
      linkingSubscription.remove();
      authSubscription.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const retry = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", errorMessage: null }));
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setState({
        status: "error",
        profile: null,
        accessToken: null,
        errorMessage: error.message,
      });
      return;
    }

    await resolveSession(data.session);
  }, [resolveSession]);

  const signOut = useCallback(async () => {
    latestResolution.current += 1;
    setState({
      status: "signedOut",
      profile: null,
      accessToken: null,
      errorMessage: null,
    });
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const replaceProfile = useCallback((profile: AuthenticatedUserProfile) => {
    setState((current) => ({ ...current, profile }));
  }, []);

  return { ...state, retry, signOut, replaceProfile };
}
