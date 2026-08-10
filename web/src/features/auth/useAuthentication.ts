import {
  useEffect,
  useRef,
  useState,
} from "react";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "../../config/supabase";
import {
  fetchCurrentUser,
  pingSuperAdmin,
} from "./auth.api";

import type {
  AuthenticatedUserProfile,
} from "./auth.types";

type AuthenticationStatus =
  | "loading"
  | "signedOut"
  | "signedIn"
  | "error";

interface AuthenticationState {
  status: AuthenticationStatus;
  profile: AuthenticatedUserProfile | null;
  accessToken: string | null;
  errorMessage: string | null;
}

const loadingState: AuthenticationState = {
  status: "loading",
  profile: null,
  accessToken: null,
  errorMessage: null,
};

async function resolveSession(
  session: Session | null,
): Promise<AuthenticationState> {
  if (!session) {
    return {
      status: "signedOut",
      profile: null,
      accessToken: null,
      errorMessage: null,
    };
  }

  try {
    const profile = await fetchCurrentUser(
      session.access_token,
    );

    if (
      window.location.pathname ===
      "/auth/callback"
    ) {
      window.history.replaceState(
        {},
        "",
        "/",
      );
    }

    return {
      status: "signedIn",
      profile,
      accessToken: session.access_token,
      errorMessage: null,
    };
  } catch (error) {
    return {
      status: "error",
      profile: null,
      accessToken: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to load your EcoTrack profile.",
    };
  }
}

export function useAuthentication() {
  const [state, setState] =
    useState<AuthenticationState>(
      loadingState,
    );

  const authenticationOperationId =
    useRef(0);

  useEffect(() => {
    let isActive = true;

    async function synchronizeSession(
      session: Session | null,
    ): Promise<void> {
      const operationId =
        ++authenticationOperationId.current;

      const nextState =
        await resolveSession(session);

      const isLatestOperation =
        operationId ===
        authenticationOperationId.current;

      if (isActive && isLatestOperation) {
        setState(nextState);
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          if (isActive) {
            setState({
              status: "error",
              profile: null,
              accessToken: null,
              errorMessage: error.message,
            });
          }

          return;
        }

        void synchronizeSession(
          data.session,
        );
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void synchronizeSession(session);
      },
    );

    return () => {
      isActive = false;
      authenticationOperationId.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  async function retry(): Promise<void> {
    const operationId =
      ++authenticationOperationId.current;

    setState(loadingState);

    const { data, error } =
      await supabase.auth.getSession();

    if (
      operationId !==
      authenticationOperationId.current
    ) {
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

    const nextState =
      await resolveSession(data.session);

    if (
      operationId ===
      authenticationOperationId.current
    ) {
      setState(nextState);
    }
  }

  async function signOut(): Promise<void> {
    const operationId =
      ++authenticationOperationId.current;

    setState(loadingState);

    const { error } =
      await supabase.auth.signOut();

    if (
      operationId !==
      authenticationOperationId.current
    ) {
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

    setState({
      status: "signedOut",
      profile: null,
      accessToken: null,
      errorMessage: null,
    });
  }

  async function checkSuperAdminAccess(): Promise<string> {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const accessToken =
      data.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "You must be signed in to check Super Admin access.",
      );
    }

    return pingSuperAdmin(accessToken);
  }

  return {
    ...state,

    checkSuperAdminAccess,

    retry: () => {
      void retry();
    },

    signOut: () => {
      void signOut();
    },
  };
}
