"use client";
import { Search } from "lucide-react";


import { useActionState } from "react";
import { lookupGuestBookingAction, type GuestLookupState } from "@/lib/actions";
import Link from "next/link";

const initialState: GuestLookupState = { error: null };

export default function GuestBookingLookupForm() {
  const [state, action, pending] = useActionState(lookupGuestBookingAction, initialState);
  return <form action={action} className="dashboard-form guest-lookup-form" aria-busy={pending}>
    <label className="field"><span>Booking reference</span><input name="reference" required minLength={8} maxLength={32} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABC12345" disabled={pending}/></label>
    <label className="field"><span>Booking mobile number</span><input name="phone" type="tel" inputMode="tel" required maxLength={32} autoComplete="tel" placeholder="0993 661 661" disabled={pending}/></label>
    {state.error && <p className="alert alert-error dashboard-form-wide" role="alert">{state.error}</p>}
    <button className="btn btn-primary" type="submit" disabled={pending}><Search size={16} aria-hidden="true"/>{pending ? "Checking…" : "Find my booking"}</button>
    <p className="dashboard-help dashboard-form-wide">Booked while signed in? <Link href="/sign-in?next=%2Faccount%23my-bookings">Open My bookings</Link>.</p>
  </form>;
}
