"use client";

import { useActionState } from "react";
import { lookupGuestBookingAction, type GuestLookupState } from "@/lib/actions";

const initialState: GuestLookupState = { error: null };

export default function GuestBookingLookupForm() {
  const [state, action, pending] = useActionState(lookupGuestBookingAction, initialState);
  return <form action={action} className="dashboard-form guest-lookup-form" aria-busy={pending}>
    <label className="field"><span>Booking reference</span><input name="reference" required minLength={8} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="ABC12345" disabled={pending}/></label>
    <label className="field"><span>Booking mobile number</span><input name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="0991 234 567" pattern="(?:[+]265[ ]?(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|0(?:8|9|2)[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})" disabled={pending}/></label>
    {state.error && <p className="alert alert-error dashboard-form-wide" role="alert">{state.error}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Find my booking"}</button>
  </form>;
}
