"use client";
import { KeyRound, Send } from "lucide-react";


import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function RequestPasswordResetForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setError(result.error.message ?? "Could not request a reset link.");
      } else {
        // Keep the response generic so it does not disclose whether an account exists.
        setMessage("If an account exists for that email, a password reset link has been sent.");
      }
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="dashboard-form" onSubmit={submit} aria-busy={pending}>
      <label className="field">
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" required disabled={pending} />
      </label>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {message && <p className="alert" role="status">{message}</p>}
      <button className="btn btn-primary" disabled={pending}><Send size={16} aria-hidden="true"/>
        {pending ? "Sending…" : "Email reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      setPending(false);
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(result.error.message ?? "This reset link is invalid or expired.");
      } else {
        setMessage("Your password has been reset. You can now sign in.");
      }
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="dashboard-form" onSubmit={submit} aria-busy={pending}>
      <label className="field">
        <span>New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={pending} />
      </label>
      <label className="field">
        <span>Re-enter new password</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={pending} />
      </label>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {message && <p className="alert" role="status">{message} <Link href="/sign-in">Sign in</Link></p>}
      <button className="btn btn-primary" disabled={pending}><KeyRound size={16} aria-hidden="true"/>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
