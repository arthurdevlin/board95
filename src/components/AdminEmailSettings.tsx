"use client";

import { useActionState } from "react";
import { saveAdminEmailSettings } from "@/lib/admin-email-actions";

export default function AdminEmailSettings({ primaryEmail, secondaryEmail }: { primaryEmail: string; secondaryEmail: string }) {
  const [state, action, pending] = useActionState(saveAdminEmailSettings, {});
  return <form action={action} className="dashboard-form">
    <h3>Board95 notification inboxes</h3>
    <p className="dashboard-help">Both inboxes receive administrator notifications and booking notifications when no operator email is available. These settings do not change account sign-in or password recovery.</p>
    <label className="field"><span>Primary email</span><input name="primaryEmail" type="email" required maxLength={254} defaultValue={primaryEmail}/></label>
    <label className="field"><span>Second email (optional)</span><input name="secondaryEmail" type="email" maxLength={254} defaultValue={secondaryEmail}/><small>Leave blank and save to remove the second inbox.</small></label>
    <p className="field-hint">While using the Resend testing sender, delivery is limited to your Resend account email.</p>
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    {state.saved && <p className="alert" role="status">Notification inboxes saved.</p>}
    <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save notification inboxes"}</button>
  </form>;
}
