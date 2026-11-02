"use client";

import { useState } from "react";

export default function AdminCreateUserForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [pending, setPending] = useState(false);
  return <form action={action} className="dashboard-form" onSubmit={(event) => {
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    if (!window.confirm(`Create a passenger account for ${email}?`)) {
      event.preventDefault();
      return;
    }
    setPending(true);
  }}>
    <label className="field"><span>Full name</span><input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>
    <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label className="field"><span>Mobile number <em>(optional)</em></span><input name="phone" type="tel" autoComplete="tel" placeholder="0991 234 567"/></label>
    <label className="field"><span>Initial password</span><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
    <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
  </form>;
}
