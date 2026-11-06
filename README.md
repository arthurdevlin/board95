# Board95

Board95 is a Malawi-focused travel and car-hire platform for browsing and booking bus and taxi trips between Blantyre, Lilongwe, and Mzuzu, plus finding and requesting vehicle rentals through a car-hire marketplace. Built with Next.js, Prisma, PostgreSQL, and Better Auth, the app supports real booking flows, operator verification, and role-based access for customers, owners, hirers, and administrators. Passengers can follow booking status and contact operators. Approved operators manage trips and vehicles; car-hire providers manage listings and rental requests.

## Local setup

Use Node.js 22.12 or newer in the 22.x line, or Node.js 24+, and PostgreSQL.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `BETTER_AUTH_SECRET`.
3. Apply migrations to your development database with `npx prisma migrate deploy`.
4. The Prisma client is generated automatically during installation and before development startup. To regenerate it manually after a schema change, run `npx prisma generate`.
5. Start the app with `npm run dev` and open [http://localhost:3000](http://localhost:3000).

Do not run `prisma migrate reset` against a database with data you need. To check a fresh install, use a separate empty local database.

## Environment variables

`DATABASE_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` are needed for the app and authentication. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable email delivery. `BOARD95_ADMIN_EMAIL` receives admin notifications and booking fallback notifications. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_CAR_PHOTO_BUCKET` enable persistent car-photo storage; without them, uploads are supported only for local development.

## Checks

Administrators can configure the primary notification inbox and an optional second inbox under **Administration → Email delivery queue → Board95 notification inboxes**. Saved inboxes override `BOARD95_ADMIN_EMAIL`; without saved settings, that environment variable remains the fallback. Both inboxes receive administrator alerts and booking/message fallbacks when an operator has no email. This does not change sign-in emails or copy password resets to another inbox. Apply migrations before using this setting. The Resend testing sender can deliver only to the Resend account email; a second recipient needs a verified sending domain.

- `npm run lint` runs ESLint.
- `npm run typecheck` generates Prisma and Next.js types, then checks TypeScript types.
- `npm test` runs the helper tests with Node's built-in test runner.
- `npm run build` generates the Prisma client and creates the production build.
- `npm run db:prune-rate-limits` removes expired rate-limit buckets. Run it periodically using your deployment scheduler.

`npm run db:clean -- --confirm-delete-data` is only for disposable development databases. It deletes application data while preserving one administrator, and refuses to run when `NODE_ENV=production`.

If the app reports `Can't resolve '@/generated/prisma/client'` after switching branches or pulling changes, stop and restart it with `npm run dev`. Its `predev` hook regenerates the ignored Prisma client. If dependencies were installed with lifecycle scripts disabled, run `npm run postinstall` explicitly.

## Deployment notes

The current rate limiter uses the first address in `x-forwarded-for` (falling back to `x-real-ip`) as its client IP. This assumes the app runs behind a trusted proxy that replaces those headers, such as Vercel. If deploying behind another proxy, configure it to overwrite the forwarding headers; do not expose the app directly to clients that can choose them.

Configure the deployment with a persistent PostgreSQL database, a strong `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` set to the public HTTPS origin. Configure Resend and Supabase variables if those services are used. Uploaded profile photos are stored as data URLs in the database; car-hire photos use Supabase in production.

Apply committed migrations as a deployment step with `npx prisma migrate deploy`. The query-index migration improves public search, dashboard ordering, and relationship lookups. Test it against a staging copy first; index creation on large tables can temporarily block writes. The build generates the client but does not apply migrations.

The homepage departure preview queries current database state on each request. It shows only trips departing today in Malawi time, strictly after now and no more than eight hours ahead. The registered bus company list uses a public cache with a 15-second revalidation interval and 30-second expiry. Trip, inventory, and operator changes invalidate it immediately through server actions. Session reuse is limited to one React server render. For signed-in users, Home opens the account overview; management dashboard links open the separate role-specific workspace.

## Listing expiry and old listings

Trip listings are archived 24 hours after departure. Car-hire listings expire seven days after publication or renewal; editing and availability changes do not renew them. The car-hire dashboard and listing manager show expiry dates and renewal buttons, with reminders during the final 24 hours. Renewal starts a new seven-day period from the time the operator clicks it. Expired vehicles immediately disappear from public results and cannot receive new requests, even if cleanup is delayed.

Cleanup atomically copies listing details into separate history tables, moves booking/request links, then deletes active listings. Passenger bookings, chats, and rental requests survive. Active rental requests can still be handled after a listing expires. Stored names, rates, route details and timestamps remain in history. Photos remain referenced by URL; the archive is kept in the same PostgreSQL database, so this reduces active inventory rather than total retained storage.

Operators and bus company members can open **Old listings / Download CSV** from their dashboard. Date filters use departure dates for trips and expiry dates for car hire, with inclusive Malawi calendar dates. CSV exports include the full matching range, with timestamps explicitly labeled UTC. Access is restricted to the operator's own listings or their bus company memberships; administrators can access all history.

Apply migrations with `npx prisma migrate deploy` before running this version. Existing car-hire listings expire seven days after their original publication date; listings already older than a week will be archived on the first cleanup.

On PostgreSQL hosts with `pg_cron` support (including Supabase), run `npm run db:schedule-listing-cleanup` once after migrations. It enables `pg_cron` and installs or updates a named job that runs every five minutes, including while the application is offline. No HTTP secret is required for this database job. To inspect it, query `cron.job` for `jobname = 'board95-archive-expired-listings'`; execution results are in `cron.job_run_details`. This setup command requires database administrator privileges.

For hosts without `pg_cron`, configure a deployment scheduler to run cleanup **every five minutes**. Either run `npm run db:archive-listings` in the deployed application environment, or set a long random `CRON_SECRET` and have the scheduler make this authenticated request:

```sh
curl --fail --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_DEPLOYMENT/api/cron/archive-listings
```

The HTTP job is disabled until `CRON_SECRET` is configured. No browser session is required. Both cleanup methods process up to 1,000 trips and 1,000 car-hire listings per invocation; subsequent runs continue any backlog. Failed batches roll back and are retried on serialization conflicts. Repeat runs are safe. Physical removal happens on the next scheduled run after expiry, normally within five minutes. The scheduler must be enabled in the hosting environment; application deployment alone does not schedule it.
