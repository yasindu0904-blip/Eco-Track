import {
  useState,
  type FormEvent,
} from "react";

import { sendMagicLink } from "./auth.service";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setIsSending(true);
    setErrorMessage(null);

    try {
      await sendMagicLink(email);
      setEmail(email.trim().toLowerCase());
      setIsSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the magic link.",
      );
    } finally {
      setIsSending(false);
    }
  }

  if (isSent) {
    return (
      <section className="auth-state" aria-live="polite">
        <div className="state-icon state-icon-success" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>

        <h2>Check your email</h2>
        <p>
          We sent a secure sign-in link to{" "}
          <strong>{email}</strong>.
        </p>

        <ol className="verification-steps">
          <li>
            <span>1</span>
            Check your inbox
          </li>
          <li>
            <span>2</span>
            Open the link in this browser
          </li>
          <li>
            <span>3</span>
            Return here signed in
          </li>
        </ol>

        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setIsSent(false);
            setErrorMessage(null);
          }}
        >
          Use another email
        </button>

        <p className="form-footnote">
          Didn&apos;t receive it? Check your spam folder before trying again.
        </p>
      </section>
    );
  }

  return (
    <section className="login-panel">
      <div className="section-heading">
        <span className="eyebrow">Passwordless access</span>
        <h2>Sign in</h2>
        <p>
          Enter your email to receive a magic link. No password needed.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email address</label>

          <div className="input-wrapper">
            <svg
              className="input-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 6.5h18v12H3z" />
              <path d="m4 7 8 6 8-6" />
            </svg>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSending}
              aria-describedby={
                errorMessage ? "email-error" : undefined
              }
              required
            />
          </div>

          {errorMessage && (
            <p id="email-error" className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <button
          className="button button-primary"
          type="submit"
          disabled={isSending}
        >
          {isSending ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Sending secure link...
            </>
          ) : (
            "Send magic link"
          )}
        </button>
      </form>

      <div className="security-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10V8a5 5 0 0 1 10 0v2" />
          <path d="M5 10h14v10H5z" />
        </svg>
        <p>
          Your link is single-use. EcoTrack never asks you to create a password.
        </p>
      </div>
    </section>
  );
}
