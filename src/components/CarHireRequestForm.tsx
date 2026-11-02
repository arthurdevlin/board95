"use client";

import { useActionState, useState } from "react";
import { requestCarHireAction, type CarHireRequestState } from "@/lib/actions";
import { formatMWK } from "@/lib/format";

const initialState: CarHireRequestState = { status: "idle", message: "" };

export default function CarHireRequestForm({ listingId, dailyRateMWK }: { listingId: string; dailyRateMWK: number }) {
  const [state, action, pending] = useActionState(requestCarHireAction, initialState);
  const [requestAnother, setRequestAnother] = useState(false);
  if (state.status === "success" && !requestAnother) return <div className="alert alert-info" role="status"><strong>Request sent</strong><p>{state.message}</p><p>Estimate: {formatMWK(state.totalMWK ?? 0)} · Reference: {state.reference}</p><p>The owner will confirm the dates and final arrangements.</p><button className="btn btn-secondary" type="button" onClick={() => setRequestAnother(true)}>Request another period</button></div>;
  return <div className="car-hire-request-panel">
    <h2>Request this vehicle</h2><p className="dashboard-help">Estimated daily rate: {formatMWK(dailyRateMWK)}. Payment is arranged directly with the owner after confirmation.</p>
    <form action={action} className="dashboard-form" aria-busy={pending}><input type="hidden" name="listingId" value={listingId}/>{requestAnother && state.status === "success" && <p className="alert alert-info dashboard-form-wide" role="status">{state.message} Reference: {state.reference}. You can request a different period below.</p>}
      <label className="field"><span>Your name</span><input name="guestName" required minLength={2} maxLength={100} autoComplete="name"/></label>
      <label className="field"><span>Malawi mobile</span><input name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="0991 234 567" pattern="(?:[+]265[ ]?9[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}|09[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3})"/></label>
      <label className="field"><span>Email <em>(optional)</em></span><input name="email" type="email" maxLength={254} autoComplete="email"/></label>
      <label className="field"><span>Pickup date</span><input name="startDate" type="date" required/></label>
      <label className="field"><span>Return date</span><input name="endDate" type="date" required/></label>
      {state.status === "error" && <p className="alert alert-error dashboard-form-wide" role="alert">{state.message}</p>}
      <button className="btn btn-primary dashboard-form-wide" type="submit" disabled={pending}>{pending ? "Sending request…" : "Send hire request"}</button>
    </form>
  </div>;
}
