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

The homepage departure preview uses a public cache with a 15-second revalidation interval and 30-second expiry. Trip, inventory, and operator changes invalidate it immediately through server actions. Transport search and booking validation still query current database state. Session reuse is limited to one React server render.
