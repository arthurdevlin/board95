"use client";
import { useActionState } from "react";
import { Send, Search } from "lucide-react";
import { lookupGuestRentalAction, sendRentalMessageAction } from "@/lib/rental-actions";

export function GuestRentalLookup() {
  const [state, action, pending] = useActionState(lookupGuestRentalAction, { error: null });
  return <form action={action} className="dashboard-form"><label className="field"><span>Rental reference</span><input name="reference" required maxLength={32} autoCapitalize="characters" /></label><label className="field"><span>Rental mobile number</span><input type="tel" name="phone" required maxLength={64} autoComplete="tel" /></label>{state.error && <p role="alert" className="alert alert-error dashboard-form-wide">{state.error}</p>}<button className="btn btn-primary" disabled={pending}><Search size={16} />{pending ? "Checking…" : "Find my rental"}</button></form>;
}
export function RentalMessageForm({ id, token }: { id: string; token: string }) {
  const [state, action, pending] = useActionState(sendRentalMessageAction, { error: null });
  return <form action={action} className="dashboard-form"><input type="hidden" name="requestId" value={id} /><input type="hidden" name="token" value={token} /><label className="field dashboard-form-wide"><span>Message</span><textarea name="body" required maxLength={2000} /></label>{state.error && <p role="alert">{state.error}</p>}<button className="btn btn-primary" disabled={pending}><Send size={16} />{pending ? "Sending…" : "Send message"}</button></form>;
}
