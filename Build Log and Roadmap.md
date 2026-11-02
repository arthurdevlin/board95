# Board95 — Build Log & Roadmap

*A transport and car-hire platform for Blantyre, Lilongwe and Mzuzu, Malawi.* Last updated: 29 October 2026

This document records every step taken so far, in enough detail to reproduce them from scratch, and lays out everything still ahead through to shipping. It is a living document — update it as each milestone lands.

## 1. Project overview

**What Board95 does:** riders search and book bus and shared-taxi seats between Blantyre, Lilongwe and Mzuzu; taxi and bus operators manage their own vehicles, routes and bookings; car owners list vehicles for self-drive hire; admins oversee companies, approvals and verification.

**Roles:** Customer, Taxi/Bus Operator, Car-hire owner, Admin. Applications are reviewed by admins; roles and operator permissions are enforced on the server.

**Tech stack and why:**

- **Next.js 16, App Router, TypeScript, and Turbopack** — Next.js 16 uses Turbopack by default for `npm run dev` and `npm run build`, restoring the faster development compile flow. The project can still switch to Webpack with `--webpack` if a Turbopack-only issue returns.
- **Tailwind CSS + a custom design system (`globals.css`)** — Tailwind v4 runs through `@tailwindcss/postcss`; named component classes (`.hero`, `.trip-card`, `.btn`, etc.) hold the brand's own look.
- **PostgreSQL + Prisma ORM** — a relational database suits bookings, where two people can race for the same seat; Prisma gives typed queries and a migration history.
- **Better Auth** — email/password sign-in with sessions stored in Postgres. Chosen over NextAuth.js, which is now in maintenance mode and whose own docs point newcomers to Better Auth.
- **Supabase (hosted Postgres)** for development; see §9 for the production decision.

## 2. Milestone 1 — Foundation (done)

Scaffolded with `create-next-app` (TypeScript, Tailwind, App Router, `src/` layout). Built: root layout with header/footer, the brand's CSS variables (`--primary`, `--secondary`, `--accent`, `--danger`, `--muted`), a home page, a `/transport` listings page, and a `/car-hire` placeholder — all reading from an in-memory sample-data file shaped like the future database tables, so later milestones could swap the data source without redesigning the pages.

## 3. Milestone 2 — Search and filters (done)

Added a GET-method search form (`origin`, `destination`, `date`, `type` as URL query parameters, so every search is a shareable, bookmarkable link) and server-side filtering with input validation (`parseFilters` rejects anything that isn't a known city, a real transport type, or a valid date — URL parameters are user input and are never trusted directly). Richer trip cards: operator name, a verified badge, fare, vehicle, seats/spaces left with a coloured availability badge, and the departure point. "Matola" was renamed to "Taxi" throughout. Fixed along the way: an inconsistent availability-colour bug, a stale-search-form bug after "Clear filters", and a `new Date()` timing error that Next.js's stricter prerendering rules flagged (fixed with `await connection()`, which tells Next.js to wait for a real request before reading the current time).

## 4. Milestone 3A — Database and Prisma (done)

**Schema (`prisma/schema.prisma`):** `User`, `Operator`, `Vehicle`, `DeparturePoint`, `Trip`, `Booking`, plus (added in 3B) `Session`, `Account`, `Verification` for Better Auth. `Operator` holds bus-company stations and taxi-stage names per city; `Trip` links to `Operator`, `Vehicle` and `DeparturePoint` and stores `seatsAvailable` as a counter (this will matter in 3B phase 2 — see §6). Indexes on `origin`, `destination` and `departureAt` back the search.

**Setup performed:**

1. `npm install @prisma/client @prisma/adapter-pg pg dotenv` and `npm install -D prisma @types/pg tsx`.
2. `prisma.config.ts` created, pointing at `prisma/schema.prisma` and wiring `tsx prisma/seed.ts` as the seed command.
3. `npx prisma migrate dev --name init` — creates the tables and generates the typed client into `src/generated/prisma` (gitignored; it's rebuilt from the schema, never hand-edited).
4. `npx prisma db seed` — loads 10 sample trips across 5 operators.
5. `src/lib/prisma.ts` — a single shared `PrismaClient`, cached on `globalThis` in development so hot-reloads don't exhaust the connection pool.

**Database decision:** PostgreSQL throughout, from local development to production — never a lighter database like SQLite, because bookings need transactional seat-locking that SQLite handles poorly under concurrent writers. Supabase's free tier for development only (it pauses after a week idle and has no automatic backups); a paid managed Postgres plan before any real launch.

**Supabase connection notes (hard-won):** the *direct* connection (`db.<ref>.supabase.co:5432`) often only resolves over IPv6, which many home networks lack. The fix that worked here was the **session pooler** connection string instead: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres` — note the username becomes `postgres.<project-ref>`, not plain `postgres`, and the port stays 5432 (session mode), not 6543 (transaction mode, which `migrate dev` cannot use).

## 5. Milestone 3B — Accounts and bookings (in progress)

**Phase 1, sign-in (done):** [Better Auth](https://better-auth.com) with email and password. `Session`/`Account`/`Verification` tables added via migration; `User` extended with `emailVerified`, `image`, `updatedAt`. Key files: `src/lib/auth.ts` (server config), `src/lib/auth-client.ts` (browser client), `src/app/api/auth/[...all]/route.ts` (the catch-all route Better Auth needs), `src/components/AuthForm.tsx` (sign-up/sign-in), `src/app/account/page.tsx` (protected page), `src/proxy.ts` (route protection).

**Known pitfall, fixed:** in a `src/`-layout project, Next.js 16's `proxy.ts` (the renamed `middleware.ts`) must live at `src/proxy.ts`, not the project root — at the root it is silently never loaded, with no error, and route protection just doesn't happen. Always confirm it's working, not just present: visit a protected page signed out and check for a real redirect.

**Phase 2, booking requests and account history (implementation complete; guest booking simulation pending):** Guests and signed-in customers can request seats with a required Malawi mobile number, optional email and optional pickup location. The booking stores passenger contact details and is visible to the assigned operator; signed-in bookings also appear on `/account`. Seat decrement remains atomic and booking status can be accepted or declined by the assigned operator. Demo account setup is available through `npm run seed:demo` after the migrations and base seed have run.

**Phase 3, role dashboards and demo accounts (initial simulator pass):** `/admin` lists users, operators, applications and pending bookings; admins can approve/decline applications, approve or block operators, block user accounts, and review booking requests. `/operator` lets approved taxi and bus operators review booking contacts, accept/decline requests, add vehicles and publish departures. Taxi vehicles are limited to one departure per Malawi calendar day by both a server check and a database index. `/car-hire/dashboard` lets approved car-hire owners publish and unlist vehicles; `/car-hire` shows active vehicles publicly. The demo script creates the three requested sample accounts and representative listings.

**Phase 4, booking lifecycle and rental requests (implemented locally):** passengers and operators can resolve booking lifecycle states with seat inventory restored on cancellation/decline. Guests can recover a booking with reference plus mobile number and use a time-limited private chat link. Car-hire requests now support date ranges, owner/admin decisions, and passenger cancellation/history.

## 6. UI redesign (done, ongoing)

The product owner redesigned `globals.css` and `TripCard.tsx` directly (navy/white theme, pill badges, a polished hero). Claude's role has been to keep the redesign from quietly breaking functionality: rewriting fragile position-based CSS selectors (e.g. `body > main > section:has(> form[...])`) onto stable named classes (`.hero`, `.trip-card`, `.search-form`, `.btn`, `.status-badge`, etc.) so future markup changes can't silently break the look; verifying every interactive control meets a roughly 44px touch target (fixed: the header's "Sign in" chip, the date quick-pick chips, and the "Sign out" link were a few pixels short, bumped to `min-height: 2.75rem`); and never touching the actual data-fetching code (`await connection()`, `<Suspense>` boundaries, `searchTrips`) while restyling.

**Working agreement going forward:** when requested, make and verify changes in the local VS Code workspace first. Do not push to GitHub unless specifically asked.

## 7. Milestone 3C — Applications, passenger history and notifications (implementation complete; provider setup pending)

- Passengers can create regular accounts; Google sign-in appears after OAuth credentials are configured. Taxi operators use email/password signup plus a required Malawi mobile and admin-reviewed application.
- Car-hire, taxi and bus applicants can open their dashboard while pending; publishing tools unlock only after admin approval. Admin can review applications, manage operators/users, and view bookings.
- Signed-in passengers can see booking status/history, archive completed records from their own account, and chat with the assigned provider. Operators can manage profiles, vehicles and future unbooked schedules; booking history locks a trip schedule to protect passenger records.
- Booking requests, status changes, application decisions, and booking chat send email when Resend is configured. New applications alert the configured admin mailbox. SMS remains a later integration.
- Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `BOARD95_ADMIN_EMAIL` to local environment settings to enable email. Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, plus the callback URI `http://localhost:3000/api/auth/callback/google`. See `README.md`. Never put credentials in this log or Git.
- Guest bookings work without sign-in. Guests can open a private chat from the confirmation screen or recover access using the booking reference and mobile number; guest access tokens are hashed in the database and expire after 30 days.
- Signed-in taxi, bus and car-hire operators see Home and their dashboard in the header, while passenger transport and car-hire discovery links are hidden. Admins and passengers retain access to the service links.
- Car-hire owners attach one JPEG, PNG or WebP photo (up to 750 KB) per listing. Local development stores photos under `public/uploads/car-hire`; production needs Supabase Storage configured with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_CAR_PHOTO_BUCKET`.
- Email notifications are stored in an outbox. When Resend settings are missing or delivery fails, an admin can retry pending/failed notices from `/admin`. SMS remains a later integration.
- `/admin` now also manages car-hire listings and pending rental requests. Passengers can see and cancel their signed-in rental requests from `/account`; car-hire owners can edit listings and review incoming requests from their dashboard.

## 8. Issues found and fixed (reference log)

| Date | Issue | Root cause | Fix |
| --- | --- | --- | --- |
| 2026-10-26 | `new Date()` error during build | Next.js's strict prerendering flags reading the current time outside a request | `await connection()` before any code that reads "now" |
| 2026-10-26 | Inconsistent availability colours | Cards with ≤3 seats left had no colour at all (a design gap, not a bug) | Three explicit tiers: green / amber / red via `getAvailability()` |
| 2026-10-27 | `Module not found: @/generated/prisma/client` | The generated Prisma client folder isn't committed to Git (by design) and didn't exist on a fresh clone | `npx prisma generate` |
| 2026-10-27 | `P1001` then `P1000` authentication failed | Supabase's direct connection needs IPv6, which the network didn't have; then the pooler username was wrong | Switched to the session pooler with username `postgres.<project-ref>` |
| 2026-10-27 | `P1013` invalid port number | A connection string with leftover `[ ]` placeholder brackets | Rebuilt `.env` from scratch, verified with a small masked-output Node script |
| 2026-10-27 | Sign-in redirect silently didn't work | `proxy.ts` was at the project root instead of `src/proxy.ts` | Moved the file |
| 2026-10-28 | `BetterAuthError: Prisma schema mismatch` | `.env`'s `DATABASE_URL` and the database `prisma migrate dev` had actually been run against were out of sync, plus a stale Next.js dev server left running on port 3000 from an earlier session | `taskkill` the orphaned process, re-run `prisma db seed`, restart clean |
| 2026-10-28 | Three auth/date-chip buttons below the \~44px touch-target guideline | Design oversight in the redesign pass | `min-height: 2.75rem` on `.chip`, `.link-button`, `.field-toggle` |
| 2026-10-28 | Default Turbopack build failed while processing CSS | Turbopack's worker exited before the parent process connected | Temporarily switched to Webpack; Tailwind remained on PostCSS. Re-enabled default Turbopack on 2026-10-29; a full production build then passed. |
| 2026-10-29 | Cache Components rejected the public car-hire database query during prerendering | Runtime database access was outside a Suspense boundary | Wrapped the listing query in Suspense so the static page shell streams while results load. |
| 2026-10-29 | Demo-account seed hit a Supabase pooler timeout with parallel queries | The script opened simultaneous database work through more than one Prisma client | Reused the application's shared Prisma client and created the three accounts sequentially; the seed then completed. |

**Two recurring lessons worth keeping in mind:** (1) a Windows terminal window closing doesn't always stop the Node process behind it — press Ctrl+C before closing, and if a port conflict ever appears again, kill the named PID before starting a new server; (2) after any change to `prisma/schema.prisma`, both `npx prisma generate` *and* a full restart of `npm run dev` are required — a hot reload alone won't pick up a new generated client.

## 9. Roadmap to shipping

&#91;embedded content: roadmap · 5 milestones to shipping\]

Each milestone below gets the same build-then-test cycle already used so far: implement, verify with real requests (not just a passing build), fix, then move on.

## 10. Setting up the project from scratch (reproducible steps)

1. `npx create-next-app@latest board95` — TypeScript, Tailwind, App Router, `src/` directory, `@/*` import alias.
2. `npm install @prisma/client @prisma/adapter-pg pg dotenv better-auth` and `npm install -D prisma @types/pg tsx tailwindcss @tailwindcss/postcss`.
3. Copy in `prisma/schema.prisma`, `prisma.config.ts`, and the `src/` folder from the latest milestone handoff.
4. Create `.env` from `.env.example`: `DATABASE_URL` (a Postgres connection string — for Supabase, prefer the session pooler form, `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`), `BETTER_AUTH_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`), `BETTER_AUTH_URL`.
5. `npx prisma migrate dev --name init` — applies every migration in `prisma/migrations` in order and generates the typed client.
6. `npx prisma db seed` — loads sample operators and trips (safe only on a development database; it deletes and re-creates sample data).
7. `npx prisma migrate deploy` — applies role, guest-booking, application and car-listing schema changes.
8. `npm run seed:demo` — creates the local demo accounts and sample taxi/car-hire records. Demo password for newly created accounts: `Board95Demo!2026` (override with `BOARD95_DEMO_PASSWORD`). The accounts are `admin@board95.local`, `taxi@board95.local`, and `carhire@board95.local`. If those emails already existed, the script does not change their password.
9. `npm run dev`, then confirm: guest booking, signed-in booking history, customer account applications, admin approval/block actions, operator trip publishing and booking handling, and car-hire listing management.
10. Before any push: `npm run lint` and `npm run build` must both pass clean.

## 11. Shipping checklist (for when Milestones 4–7 are done)

- [ ] A paid managed Postgres plan, in a region near Malawi if possible — not the free Supabase tier, which pauses when idle and has no automatic backups.
- [ ] `BETTER_AUTH_SECRET` regenerated for production (never reuse a development secret) and stored only in the host's environment variables, never in Git.
- [ ] HTTPS enforced end to end; `BETTER_AUTH_URL` set to the real production domain.
- [ ] File storage decided for photos and ID documents (never stored as database blobs) — access restricted, and ID documents encrypted at rest.
- [ ] A read of Malawi's data-protection requirements for ID numbers and personal documents before the verification feature collects any.
- [ ] Airtel Money / Mpamba integration tested against their sandbox before going live; no booking ever marked paid without a verified callback from the provider.
- [ ] Role-based checks confirmed server-side (not just hidden in the UI) on every owner and admin action.
- [ ] Database backups scheduled and a restore actually tested once, not just configured.
- [ ] Error monitoring in place so a failed booking or payment surfaces immediately, not only when a user reports it.
- [ ] Load-tested the booking flow specifically for the double-booking race condition under concurrent requests.
