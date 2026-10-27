"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: authError } =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (authError) {
      setError(authError.message ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(next);
    router.refresh(); // so the header picks up the new session immediately
  }

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="form-card">
        <h1>{mode === "sign-up" ? "Create your account" : "Sign in"}</h1>

        <div className="form-stack">
          {error && <p className="alert alert-error">{error}</p>}

          {mode === "sign-up" && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="field-row">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "sign-up" && (
              <p className="field-hint">At least 8 characters.</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending
              ? "Please wait…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </div>
      </form>

      <p className="form-footer">
        {mode === "sign-up" ? (
          <>Already have an account? <Link href="/sign-in">Sign in</Link></>
        ) : (
          <>New to Board95? <Link href="/sign-up">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
