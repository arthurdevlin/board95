# Mobile status delivery

Delivery is disabled until Twilio credentials and sender settings are configured. Status events still enter `MobileNotification`; no Twilio request is made without configuration.

Set these deployment environment variables (never commit real values):

- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
- `TWILIO_SMS_FROM`: an approved SMS sender capable of delivery to Malawi.
- `TWILIO_WHATSAPP_FROM`: approved sender in `whatsapp:+...` format.
- `TWILIO_WHATSAPP_CONTENT_SID`: approved WhatsApp utility template. Template variable `1` receives the status message. Confirm approval for the intended messages before enabling.
- `CRON_SECRET`: the existing scheduler bearer secret.

Schedule a POST to `/api/cron/mobile-notifications` every minute with `Authorization: Bearer <CRON_SECRET>`. Configure this in the hosting scheduler; adding the route does not schedule it automatically. Do not expose the bearer secret in a public URL. The endpoint returns 503 while sending is unconfigured.

The worker queues accepted trip reminders for the hour before departure and accepted rental reminders for the hour before the stored rental start (currently midnight Malawi time, because rentals collect dates rather than pickup times). It processes 10 deliveries per invocation; scale invocation frequency/concurrency to match traffic. Reminder discovery is bounded to 500 trips and 500 rentals per invocation.

SMS is submitted first. Subsequent runs poll Twilio's message status. Confirmed failed/undelivered SMS can fall back to WhatsApp only when the passenger explicitly opted in. WhatsApp uses the approved template, not unsolicited free-form messages. No webhook is needed for this polling integration.

`DELIVERED` means Twilio reported delivery/read. `FAILED` is a terminal provider rejection without a further eligible channel. `UNKNOWN` and stale `SENDING` require checking Twilio's logs before any manual retry: a timeout may have occurred after Twilio accepted a paid message. Automatic resending could duplicate it. Pending statuses are polled again on the next run. Unsent events expire (normally after 24 hours; reminders at departure/start time).

Inspect the private outbox in the database for failed or unknown deliveries. Never publish phone numbers, credentials, message bodies, or guest access links in logs. Test credentials/sandbox senders first, then test an opted-in Malawi recipient with approved production senders. The automated tests mock Twilio and do not send paid messages.

Guest rental recovery is available at `/bookings/lookup`. Recovery rotates a hashed, expiring access token. Rental messaging is limited to the passenger/token holder, owner, and administrator. Old rental requests can be recovered without needing an original token.

Rental owners mark accepted rentals completed after the return date, using the rental detail page. Trip reviews require the existing completed-booking status and a past departure. Reviews are unique per booking/request, use a 1–5 score and up to 300 characters, and remain associated with stable vehicle/operator IDs when listings are archived.

Twilio references: [Messages API](https://www.twilio.com/docs/messaging/api/message-resource), [WhatsApp platform](https://www.twilio.com/docs/whatsapp/api).
