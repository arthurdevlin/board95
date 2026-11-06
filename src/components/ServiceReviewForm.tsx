"use client";
import { useActionState } from "react";
import { Star } from "lucide-react";
import { submitServiceReview } from "@/lib/review-actions";
export default function ServiceReviewForm({ id, kind, token = "" }: { id: string; kind: "trip" | "rental"; token?: string }) {
  const [state, action, pending] = useActionState(submitServiceReview, { message: "" });
  return <section className="panel"><h2>Rate your experience</h2><p className="dashboard-help">One verified review per booking. Your score and note are public.</p><form action={action} className="dashboard-form"><input type="hidden" name="id" value={id}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="token" value={token}/><label className="field"><span>Score</span><select name="score" required defaultValue=""><option value="" disabled>Choose 1–5 stars</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label><label className="field"><span>Short note (optional)</span><textarea name="note" maxLength={300}/></label><button disabled={pending} className="btn btn-primary"><Star size={16}/>Publish review</button>{state.message && <p role="status" className="dashboard-form-wide">{state.message}</p>}</form></section>;
}
