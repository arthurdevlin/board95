"use client";
import { KeyRound, Save } from "lucide-react";


import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function PasswordSettings({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== String(data.get("confirmPassword") ?? "")) { setError("The passwords do not match."); return; }
    setPending(true);
    try {
      const result = await authClient.changePassword({ currentPassword: String(data.get("currentPassword")), newPassword, revokeOtherSessions: true });
      if (result.error) setError(result.error.message ?? "Could not change your password.");
      else { setMessage("Your password has been changed."); form.reset(); }
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return <div className="panel dashboard-panel"><h2>Password and security</h2><p className="dashboard-help">Change your password with your current password, or request a reset link at {email}.</p><form className="dashboard-form" onSubmit={changePassword} aria-busy={pending}><label className="field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required minLength={8} disabled={pending}/></label><label className="field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} disabled={pending}/></label><label className="field"><span>Re-enter new password</span><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} disabled={pending}/></label><button className="btn btn-primary" disabled={pending}><Save size={16} aria-hidden="true"/>{pending ? "Saving…" : "Change password"}</button><Link className="btn btn-secondary" href="/forgot-password"><KeyRound size={16} aria-hidden="true"/>Forgot password?</Link></form>{error && <p className="alert alert-error" role="alert">{error}</p>}{message && <p className="alert" role="status">{message}</p>}</div>;
}
