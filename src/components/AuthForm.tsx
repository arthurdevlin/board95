"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

function getSafeRedirectPath(path: string) {
  try {
    const destination = new URL(path, window.location.origin);
    return destination.origin === window.location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/account";
  } catch {
    return "/account";
  }
}

// One form, two modes. This is a Client Component — it's the one place
// in the app that needs to call the browser-side authClient and track
// "is this submitting right now" as React state.
export default function AuthForm({
  mode,
  next = "/account",
}: {
  mode: Mode;
  next?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";

    try {
      const { error: authError } =
        mode === "sign-up"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });

      if (authError) {
        setError(authError.message ?? "Something went wrong. Please try again.");
        return;
      }

      form.reset();
      router.push(getSafeRedirectPath(next));
      router.refresh();
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-heading">
        <p className="auth-eyebrow">BOARD95 ACCOUNT</p>
        <h1>
          {mode === "sign-up" ? "Create your account" : "Welcome back"}
        </h1>
        <p>
          {mode === "sign-up"
            ? "A few details to get started."
            : "Sign in to continue to Board95."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="form-card"
        aria-busy={pending}
      >
        <div className="form-stack">
          {error && (
            <p className="alert alert-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          {mode === "sign-up" && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                disabled={pending}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={pending}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-row">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                required
                minLength={8}
                disabled={pending}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={pending}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "sign-up" && (
              <p className="field-hint">At least 8 characters.</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={pending}
          >
            {pending
              ? mode === "sign-up"
                ? "Creating account…"
                : "Signing in…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </div>
      </form>

      <p className="form-footer">
        {mode === "sign-up" ? (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            New to Board95? <Link href="/sign-up">Create an account</Link>
          </>
        )}
      </p>
    </div>
  );
}
