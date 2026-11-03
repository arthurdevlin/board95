# Board95 project review — 3 November 2026

**Overall assessment: 7/10 after this tuning pass.** The application has a sound foundation: server-rendered pages, database-side filtering, explicit authorization in server actions, conditional seat reservations, serializable transactions for sensitive workflows, persistent email delivery records, and a working production build. The main remaining weaknesses are database integration coverage, operational automation, large action/page modules, and database/network costs on uncached requests. This is an engineering assessment, not a penetration-test certification or a production load-test result.

| Area | Score | Assessment |
| --- | --- | --- |
| Architecture and maintainability | 7/10 | Clear framework and library boundaries, but roughly 1,040 lines of actions and dense dashboard JSX make changes harder to audit. |
| Performance and scalability | 7/10 | Bounded admin/provider tables, concurrent search reads, homepage caching, and an additive index migration. Some operator collections remain unbounded. |
| Security and data integrity | 7/10 | Strong existing ownership checks and transaction patterns; this pass closes runtime validation and rental-history deletion gaps. Authenticated integration tests remain necessary. |
| Tests and release confidence | 5/10 | Seventeen regression/helper tests, lint, types, schema validation, and production build checks; no booking concurrency or role-matrix integration suite yet. |
| Deployment and operations | 6/10 | CI and environment documentation exist. Migration rollout, background email delivery, monitoring, retention, and recovery drills need more operational proof. |

The overall rating weighs application functionality and existing design alongside these categories; it is not their arithmetic mean.

## Scope and boundaries

Reviewed the current workspace, including existing uncommitted work: 68 application source/style files, schema and migration history, package configuration and lockfile, authentication and access checks, public search, operator/admin/provider dashboards, booking and rental workflows, uploads, notification delivery, helper tests, CI, and deployment documentation. The installed Next.js 16.4.2 documentation was consulted before framework changes.

Existing user changes were preserved. No database cleanup, migration deployment, real booking submission, email send, or account deletion was performed. Authenticated browser journeys, external email/storage integrations, fresh-database migration replay, and high-concurrency booking behavior were not exercised. Runtime checks used anonymous, read-only requests.

## Changes completed

1. **Bound growing dashboard tables.** Nine admin sections now use 25-row pages, including users, operators, trips, applications, pending/recent bookings, rental requests, listings, and company staff. Previously some loaded entire tables and others stopped at a fixed cap without a way to reach older records. Provider vehicle listings are also paginated. Overview counts still represent complete collections. Company staff paging remains scoped to the selected company.
2. **Make search reads concurrent.** Counts and page reads start together, with a corrective read only when a stale URL points beyond the final page. Added stable ID tie-breakers to public and new dashboard pagination ordering.
3. **Cache the homepage departure preview.** Public trip data revalidates after 15 seconds and expires after 30 seconds on the server. Relevant trip, seat, vehicle, operator, and account changes invalidate its cache tag. Search and booking validation continue to use current database state. Next.js can retain prefetched client data for at least 30 seconds under its documented timing rules; server-action invalidation still applies immediately.
4. **Deduplicate session resolution within a React server render.** Current role and active status are read from the user row, including after administrator changes. This does not create a shared cross-user session cache.
5. **Add twelve database indexes.** The new migration covers upcoming-trip ordering, operator/vehicle/departure-point lookups, booking ordering and status/history queries, public/provider listing ordering, and expired rate-limit cleanup. These are query-driven candidates, not a measured claim about production index speed. They have not been deployed to the configured database.
6. **Fix page-zero failures.** Public car-hire and provider rental pagination normalize zero, repeated parameters, malformed values, and very large inputs. Out-of-range pages resolve to the final valid page.
7. **Harden runtime validation.** Signup applications now explicitly allow only taxi-owner or car-hire kinds on the server. TypeScript unions alone do not restrict direct server-action requests. Monetary values and calculated booking/rental totals are constrained to PostgreSQL's signed 32-bit integer range.
8. **Preserve passenger rental history.** Deleting a blocked car-hire provider now refuses to proceed when its listings have rental-request history, preventing existing cascading relations from deleting those records. The eligibility check and deletion run together in a serializable transaction.
9. **Respect blocked transport owners.** Public trip queries and seat requests exclude inactive owners while retaining ownerless bus-company support.
10. **Align phone validation.** The two booking forms now accept the same 08, 09, and 02 prefixes supported by server validation.
11. **Improve date rendering efficiency.** Reuse international date/number formatters across cards, tables, and messages. Calendar-date rendering explicitly uses Malawi time rather than the host/browser time zone.
12. **Strengthen password and link handling.** Password resets revoke sessions, the password maximum is explicit, and guest-chat/password-reset pages suppress referrers and indexing.
13. **Reduce duplicate email sends on retries.** Delivery IDs become Resend idempotency keys, and already-sent queue entries are skipped. Resend retains those keys for 24 hours; this is not a permanent exactly-once guarantee. [Provider documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)
14. **Make setup and maintenance clearer.** Production builds generate the ignored Prisma client automatically. Node requirements match the toolchain. Added an expired-rate-limit cleanup command and an explicit development-only confirmation guard on the destructive database-clean script.
15. **Expand regression coverage.** Tests cover pagination boundaries, concurrent count/read initiation, stale links, database errors, integer overflow, application kinds, leap days, time-zone boundaries, and existing phone/token behavior.

## Confirmed unused material removed

- Five unreferenced starter SVGs: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg`.
- The unused `settingsicon.png`; the interface uses the existing Lucide settings icon.
- The no-op demo-user seed script and its npm command.
- The unused server `signOutAction` and its imports; the active sign-out component remains.
- An empty local `patches` directory.

Retained uploads, the active logo, generated Prisma files on disk, migration history, project notes, diagnostics, and the pre-existing untracked patch. Generated/uploaded files already staged for removal from Git remain as they were; this pass did not erase their local contents. Dependencies were retained where application, build, or tooling usage was established.

## Verification

- `npm test`: **17 passed**, increased from five baseline tests.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed; production builds also type-check.
- `npx prisma validate`: passed.
- `npm run build`: production compilation, type checking, and generation of all 22 pages passed.
- Git whitespace check passed with Windows CRLF handling.
- Read-only production checks covered the homepage, transport search, invalid dates, car-hire page zero and excessive offsets, authentication/recovery pages, booking lookup, and anonymous dashboard/chat access. Protected server components issue streamed redirects after the shell begins, so HTTP 200 by itself is not evidence of unauthorized content.
- Final production smoke check: **16 requests passed**, including three consecutive homepage requests. Complete-HTML fetch times for those homepage requests were **6494 ms, 131 ms, 77 ms**. This small local sample demonstrates warm-cache behavior only; it is not a controlled before/after benchmark, browser metric, or load test.
- Production dependency audit: **zero known vulnerabilities reported**.
- Full dependency audit: **16 moderate findings, no high or critical findings**, all in the development lint dependency graph, stemming from the minimatch advisory. The proposed automatic fixes downgrade ESLint/Next lint tooling to incompatible historical versions, so no forced audit fix was applied. [Advisory and patched version](https://github.com/advisories/GHSA-g3hv-75wg-m249)

The initial sandbox prevented database network reads. Repeating anonymous production checks with database access resolved those environment errors. A test-runner alternative also hit a host user-info/memory error; the existing native Node runner was retained and the tests pass. Neither is attributed to a Next.js defect.

## Recommended next work, in priority order

**1. Prove booking and deletion invariants against PostgreSQL before a wider launch.** Add isolated-database tests for two operators accepting the last seat, double acceptance/cancellation, overlapping rental acceptance, taxi-per-day scheduling, administrator versus staff access, blocked accounts, and provider deletion with rental history. Add browser tests for signup, password recovery, guest lookup, and every role's dashboard. Helper tests cannot establish these guarantees.

**2. Roll out the index migration in staging and measure query plans.** Run the complete migration sequence on an empty disposable database and a staging copy. Historical auth migrations contain destructive table replacements; never replay or reset them over an existing production database. Keep deployment backups, test restoration, and verify pending migrations before release. Ordinary index creation can block writes on busy tables; plan the rollout accordingly.

**3. Measure real performance.** Collect p50/p95 response times, slow-query traces, database-pool waits, and Core Web Vitals under representative traffic. Uncached transport reads took seconds in this local-to-database setup, so investigate database region, pooling, and network latency. Local HTML fetch timings do not measure browser rendering or production capacity. Profile the rate limiter's multiple database round trips and preserve its atomicity if consolidating them.

**4. Move notification delivery into a scheduled worker.** Mutations currently wait for provider requests with a five-second timeout. Preserve the durable queue, add retry backoff, concurrency claims/leases, failure monitoring, and an automatic worker. Queue insertion and the related booking change should eventually share a transaction so a post-commit failure cannot silently omit a notification. Password-reset emails contain sensitive links; define short retention and avoid retrying expired links.

**5. Move profile images to object storage.** A 400 KB upload can become approximately 533 KB of base64 data before the data-URL prefix. That value is currently stored on the user row and passed into header navigation. Store an image URL and serve resized avatars instead. Test upload replacement and cleanup with the configured storage provider.

**6. Finish bounding operator workspaces.** Operator profiles and vehicle lists remain unbounded, and each operator loads up to 40 trips without a schedule pager. The admin company-selection dropdown also still loads all company IDs/names. Add searchable/paged selection when those collections grow. Consider separate dashboard routes or loading sections on demand so collapsed panels do not all issue queries.

**7. Split the large modules by domain.** Separate booking, rental, operator, account, and administrator actions; extract query services and table sections. Keep authorization and transaction boundaries visible. Consolidate duplicated vehicle types, phone-field patterns, and pagination conventions as each domain is refactored.

**8. Complete operational and policy decisions.** Schedule expired-rate-limit cleanup; add email/history retention, structured error monitoring, backup restoration checks, and a clear policy for stale rental requests and guest rental tracking/cancellation. Confirm that the hosting proxy overwrites client IP headers. Review email verification and blocked-user sign-in behavior against the intended account policy.

**9. Update lint dependencies when a compatible fix is available.** The advisory reports minimatch 11.0.1 as patched. Upgrade through a compatible ESLint/Next dependency path and rerun lint/build checks; avoid forcing an old dependency graph or an untested major override just to clear the audit count.

## Applying this work

Review the existing and new workspace changes together. The additive index migration is `prisma/migrations/20261103120000_query_indexes/migration.sql`. Deploy migrations through the usual staging/release process with `npx prisma migrate deploy`, then build/deploy the application. Schedule `npm run db:prune-rate-limits` separately; no scheduler or live database migration was configured by this review.

Next.js feedback reporting was considered at the end of the pass. No verified framework defect remained as a qualifying feedback candidate.
