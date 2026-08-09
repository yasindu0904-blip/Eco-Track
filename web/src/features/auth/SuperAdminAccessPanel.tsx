import { useState } from "react";

import type { PlatformRole } from "./auth.types";

interface SuperAdminAccessPanelProps {
  platformRole: PlatformRole;
  onCheckAccess: () => Promise<string>;
}

type AccessCheckState =
  | { status: "idle"; message: null }
  | { status: "checking"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function SuperAdminAccessPanel({
  platformRole,
  onCheckAccess,
}: SuperAdminAccessPanelProps) {
  const [state, setState] = useState<AccessCheckState>({
    status: "idle",
    message: null,
  });

  if (platformRole !== "SUPER_ADMIN") {
    return (
      <aside className="authorization-note">
        <span className="authorization-note-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path d="M7 10V8a5 5 0 0 1 10 0v2" />
            <path d="M5 10h14v10H5z" />
          </svg>
        </span>
        <div>
          <h3>Standard member access</h3>
          <p>
            Super Admin tools are hidden for this account. The API also
            enforces this permission on every protected request.
          </p>
        </div>
      </aside>
    );
  }

  async function handleAccessCheck(): Promise<void> {
    setState({
      status: "checking",
      message: null,
    });

    try {
      const message = await onCheckAccess();

      setState({
        status: "success",
        message,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify Super Admin access.",
      });
    }
  }

  return (
    <section className="super-admin-panel">
      <div className="super-admin-panel-heading">
        <span aria-hidden="true">★</span>
        <div>
          <p>Protected platform area</p>
          <h3>Super Admin access</h3>
        </div>
      </div>

      <p className="super-admin-panel-description">
        Verify this role against the protected EcoTrack API endpoint.
      </p>

      {state.message && (
        <p
          className={`access-result access-result-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}

      <button
        className="button button-primary"
        type="button"
        disabled={state.status === "checking"}
        onClick={() => {
          void handleAccessCheck();
        }}
      >
        {state.status === "checking" ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            Verifying access...
          </>
        ) : (
          "Verify protected access"
        )}
      </button>
    </section>
  );
}
