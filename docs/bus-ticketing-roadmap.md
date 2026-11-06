# Bus fleet, schedules and future ticketing

## Current workflow

- Company administrators register buses in Fleet management. A bus stores its model, unique registration plate, seat capacity and service status.
- Schedule creation selects an existing company bus and fills its capacity. Schedule submission never creates or changes a fleet record.
- Administrators can reassign a schedule to another active bus in their company. Booked departures and day-specific changes retain their existing details; the recurring change applies to other unbooked future departures.
- Manage bus edits vehicle details or removes/restores it from service. Removing a bus pauses its schedules, retains history and requires upcoming pending/accepted bookings to be reassigned or cancelled first.
- Manage this day changes a dated departure, including its assigned bus, without changing the recurring schedule. Capacity changes preserve already reserved seats.

## Future counter and online ticketing

This is a design plan, not an implemented payment or ticketing integration. Current bookings are requests; accepted bookings consume seats. A pending request is not a paid ticket or a guaranteed reservation.

Use the dated Trip as the single inventory source. Never maintain separate physical and online seat quotas, and never reserve against a recurring BusSchedule or Vehicle.

1. Add ticket orders with sales channel (counter/online), passenger, departure, quantity, price snapshot, seller where applicable, and auditable status transitions. Counter sales must be recorded before issuing a printed ticket.
2. Add seat assignments scoped to the dated departure, with a unique constraint on departure and seat number. Define a seat layout before offering seat selection. Changing buses must preserve or explicitly remap occupied seats and must reject insufficient capacity.
3. Both sales channels must use the same transaction to claim seats and reduce availability conditionally. Existing accepted bookings must be accounted for during migration so tickets cannot sell their seats again. Cancelling or expiring a reservation releases inventory exactly once.
4. Online checkout creates a temporary seat hold with an expiry. Payment attempts and ticket orders have separate statuses. An expiry worker releases unpaid holds safely even if a payment callback races with expiry.
5. Integrate TNM Mpamba and Airtel Money through provider adapters after confirming their merchant APIs and credentials. Verify callbacks, amount, currency, merchant and order reference server-side. Use unique provider transaction references and idempotency keys so retries cannot issue extra tickets or consume seats twice. A browser success redirect is not payment confirmation.
6. After confirmed payment or recorded counter payment, issue a unique ticket reference and printable/QR ticket backed by the same order. Record cash versus mobile money separately. Scanning validates the ticket and prevents repeat boarding.
7. Provide a departure manifest showing capacity, holds, confirmed counter sales, confirmed online sales, remaining seats and boarding status. Reconcile recorded payments and ticket totals, including voids/refunds, with an audit trail.

Before release, test simultaneous counter/online purchases for the final seat, repeated callbacks, payment failure, expired holds, late successful payments, refunds, departure cancellations and bus changes. A late payment after a released hold needs a defined reallocation or refund policy; it must never silently oversell.
