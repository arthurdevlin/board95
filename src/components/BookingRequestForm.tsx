"use client";
import { Check, Eye, MessageCircle, Send, Ticket, X } from "lucide-react";


import { useRef } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestSeatAction, type BookingRequestState } from "@/lib/actions";
import BookingReference from "@/components/BookingReference";
import ReferenceLoading from "@/components/ReferenceLoading";

const initialState: BookingRequestState = { status: "idle", message: "" };

export default function BookingRequestForm({
  tripId,
  tripLabel,
  pickupAvailable,
  soldOut,
}: {
  tripId: string;
  tripLabel?: string;
  pickupAvailable: boolean;
  soldOut: boolean;
}) {
  const [state, formAction, pending] = useActionState(requestSeatAction, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function closeDialog() {
    if (pending) return;
    dialogRef.current?.close();
  }

  return (
    <div className="trip-cta">
      <button
        type="button"
        className="btn btn-primary trip-book-button"
        aria-label={tripLabel ? `${state.status === "success" ? "View booking for" : soldOut ? "Fully booked:" : "Book a seat on"} ${tripLabel}` : undefined}
        disabled={soldOut}
        onClick={() => dialogRef.current?.showModal()}
      >{state.status === "success" ? <Eye size={16} aria-hidden="true"/> : <Ticket size={16} aria-hidden="true"/>}
        {soldOut ? "Fully booked" : state.status === "success" ? "View booking" : "Book seat"}
      </button>

      <dialog
        ref={dialogRef}
        className="booking-dialog"
        aria-labelledby={`booking-title-${tripId}`}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClick={(event) => {
          if (event.target === dialogRef.current && !pending) closeDialog();
        }}
      >
        <div className="booking-dialog-card">
          <div className="booking-dialog-heading">
            <div>
              <p className="dashboard-eyebrow">PASSENGER DETAILS</p>
              <h2 id={`booking-title-${tripId}`}>{state.status === "success" ? "Request received" : "Book this trip"}</h2>
              <p>Enter your contact details so the operator can confirm your seat.</p>
            </div>
            <button type="button" className="booking-dialog-close" onClick={closeDialog} aria-label="Close booking form" disabled={pending}><X size={18} aria-hidden="true"/></button>
          </div>

          {state.status === "success" ? (
            <div className="alert alert-info booking-feedback" role="status">
              <p>{state.message}</p>
              {state.reference && <BookingReference reference={state.reference}/>}
              <p className="booking-account-note">Signed-in bookings are also saved in My account.</p>
              {state.guestChatUrl && <Link className="btn btn-secondary booking-done" href={state.guestChatUrl}><MessageCircle size={16} aria-hidden="true"/>Open your booking and chat</Link>}
              {state.guestChatUrl && <p className="booking-account-note">Save this private chat link; it is your guest access to the booking.</p>}
              {state.reference && <p className="booking-account-note">Lost the link? <Link href="/bookings/lookup">Find a guest booking</Link> with your reference and mobile number.</p>}
              <button type="button" className="btn btn-secondary booking-done" onClick={closeDialog}><Check size={16} aria-hidden="true"/>Done</button>
            </div>
          ) : (
            <form action={formAction} aria-busy={pending}>
              <input type="hidden" name="tripId" value={tripId} />
              <div className="booking-fields">
                <label className="field">
                  <span>Passenger name</span>
                  <input name="guestName" autoComplete="name" required minLength={2} maxLength={100} disabled={pending} />
                </label>
                <label className="field">
                  <span>Mobile number</span>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0993 661 661 or 993661661" required maxLength={32} disabled={pending} />
                </label>
                <label className="field">
                  <span>Email <em>(optional)</em></span>
                  <input name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} />
                </label>
                {pickupAvailable && <>
                  <label className="pickup-check">
                    <input name="pickupRequested" type="checkbox" disabled={pending} />
                    <span>Request pickup</span>
                  </label>
                  <label className="field pickup-location-field">
                    <span>Pickup location <em>(if requested)</em></span>
                    <input name="pickupLocation" autoComplete="street-address" maxLength={200} placeholder="Area, landmark or address" disabled={pending} />
                  </label>
                </>}
                <button type="submit" className="btn btn-primary btn-block" disabled={pending}><Send size={16} aria-hidden="true"/>
                  {pending ? "Sending request…" : "Submit booking request"}
                </button>
              </div>
              {state.status === "unavailable" && <p className="alert alert-error booking-feedback" role="alert">{state.message}</p>}
              {state.status === "error" && <p className="alert alert-error booking-feedback" role="alert">{state.message}</p>}
            <label className="pickup-check dashboard-form-wide"><input name="whatsappUpdates" type="checkbox"/><span>I agree to WhatsApp booking updates if SMS delivery fails.</span></label></form>
          )}
        </div>
        <ReferenceLoading pending={pending}/>
      </dialog>
    </div>
  );
}
