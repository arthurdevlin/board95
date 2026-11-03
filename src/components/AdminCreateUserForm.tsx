"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminCreateUserForm({ action, role = "CUSTOMER" }: { action: (formData: FormData) => void | Promise<void>; role?: "CUSTOMER" | "ADMIN" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    const accountLabel = role === "ADMIN" ? "system administrator" : "passenger";
    if (!window.confirm(`Create a ${accountLabel} account for ${email}?`)) return;

    setPending(true);
    try {
      await action(formData);
      form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form className="dashboard-form" onSubmit={submit} aria-busy={pending}>
    <input type="hidden" name="role" value={role}/>
    <label className="field"><span>Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>
    <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label className="field"><span>Mobile number <em>(optional)</em></span><input name="phone" type="tel" autoComplete="tel" placeholder="0991 234 567"/></label>
    <label className="field"><span>Initial password</span><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    <label className="field"><span>Re-enter password</span><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating account…" : role === "ADMIN" ? "Create administrator" : "Create passenger account"}</button>
  </form>;
}
