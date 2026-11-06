# Board95 milestone review — 6 November 2026

This is a source review and local verification snapshot. Implemented does not mean deployed or externally verified.

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| Accounts and access | Implemented | Better Auth, role permissions, company memberships, administrator controls, password-recovery screens. Email verification is currently disabled. |
| Transport marketplace | Implemented | Bus/taxi search, guest requests, booking recovery, passenger/operator chat, status changes and seat accounting. Bookings are requests, not paid tickets. |
| Bus operations | Implemented | Fleet management, recurring schedules, dated departures, bus reassignment, capacity safeguards and day-specific overrides. |
| Car hire | Implemented | Listings, owner dashboard, rental requests, guest recovery, private rental chat and completion after the return date. |
| Reviews and sharing | Implemented in this update | Completed-service reviews, ratings by operator/vehicle/provider, shared trip pages, copy-link/WhatsApp/device sharing. |
| Listing lifecycle | Implemented; deployment setup required | Expiry, renewal, atomic archival, preserved bookings/messages and CSV history. Configure database cron or the hosting scheduler. |
| Transactional email | Integration implemented; activation pending | Resend sender, persistent delivery queue, administrator retry, notifications and password reset. Local Resend key, sender and admin recipient are unset. Production settings were not inspected. |
| SMS/WhatsApp | Integration implemented; activation pending | Twilio outbox, delivery polling, opt-in WhatsApp fallback and reminders. Credentials, approved senders/templates and scheduler still need configuration and live testing. |
| Payments and ticketing | Planned | No mobile-money checkout, paid ticket issuance, seat selection, counter sales or boarding validation. See bus-ticketing-roadmap.md. |

## Recommended implementation order

1. Activate and test email using email-setup.md. Test password reset and booking notifications with controlled accounts before retrying older queued messages.
2. Prepare staging: apply committed Prisma migrations, configure persistent photo storage, configure listing cleanup, and verify guest/signed-in flows in a browser. The build does not apply migrations or install schedulers.
3. Harden email delivery: include action URLs in plain-text messages; distinguish provider acceptance from actual delivery; record provider IDs and handle delivered/bounced/complained events; add retry backoff, expiry and concurrency control. Old password-reset messages should expire rather than be retried indefinitely. Resend deduplicates idempotency keys for only 24 hours.
4. Activate SMS/WhatsApp only after approved Malawi-capable senders and consented-recipient tests. Add rental pickup times: current rental reminders are based on midnight Malawi time. Add operational visibility for unknown/stuck mobile deliveries.
5. Implement a shared ticket-order and inventory model for online and counter sales, expiring seat holds and race-condition tests. Then integrate verified mobile-money callbacks, issue tickets, and add manifests/boarding. Follow bus-ticketing-roadmap.md.

## Verification

- ESLint: passed.
- Automated tests: 109 passed, zero failures; includes isolated PostgreSQL migration/inventory/archive tests and mocked mobile-delivery tests.
- TypeScript and production build: passed after clearing stale generated development route/validator files.
- No live email/SMS, production deployment, payment integration or full browser acceptance test was performed in this review.

An existing ignored Next.js development route-type file contained a duplicated trailing fragment, causing TypeScript and production build checks to fail. The normal type-generation command did not replace that development file. Removing the corrupted generated route file and its dependent generated validator restored passing checks; no application source changes were needed. The authorized Next.js feedback-instructions command completed successfully without instructions/output.
