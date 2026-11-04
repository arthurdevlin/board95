import { renewCarHireListingAction } from "@/lib/actions";
import { listingExpiryState } from "@/lib/listing-lifecycle";
import { formatTimestamp } from "@/lib/format";

export default function CarHireRenewal({ id, expiresAt }: { id: string; expiresAt: Date }) {
  const state = listingExpiryState(expiresAt);
  return <div className="listing-renewal">
    <p className={state === "active" ? "field-hint" : "listing-expiry-warning"}>{state === "expired" ? "Expired — moving to Old listings" : state === "expiring" ? "Expires within 24 hours — renew to keep this listing" : "Listing expires"}<br/><time dateTime={expiresAt.toISOString()}>{formatTimestamp(expiresAt)}</time></p>
    {state !== "expired" && <form action={renewCarHireListingAction}><input type="hidden" name="listingId" value={id}/><button className="btn btn-secondary" type="submit">Renew for 7 days</button></form>}
  </div>;
}
