# Connected frontend

The customer and staff screens now use NestJS `/api/v1` with PostgreSQL as the source of truth. The original reference demo remains available explicitly through `NEXT_PUBLIC_DATA_MODE=demo`. Live mode is the default and does not fall back to synthetic data when a request fails.

## Contracts and sessions

`apps/web/src/lib/api-client.ts` contains the typed API contracts and handles the Nest response envelope, validation failures, authentication errors and request IDs. Public salon metadata resolves real tenant/branch IDs; the frontend uses the branch currency, timezone, services, capabilities, staff and contact details.

`apps/web/src/app/api/v1/[...path]/route.ts` is a same-origin server proxy to the fixed `API_UPSTREAM_URL`. Staff JWTs and private customer receipts are stored in HttpOnly, SameSite=Strict cookies. Production cookies require HTTPS. JWTs and receipt credentials are removed from browser JSON responses. State-changing requests require a matching Origin; set `WEB_ORIGIN` behind a production reverse proxy. Backend JWT, role, tenant, branch and feature guards remain authoritative. Access checks do not rely on hidden frontend controls.

Public booking/queue creation supplies an expiring, signed receipt scoped to the tenant, resource ID and purpose. The proxy stores it in a cookie and the browser retains only resource IDs for its own receipts. This enables same-browser booking detail, reschedule, cancellation, queue tracking and leaving without pretending to have verified an OTP. Receipts last seven days. After expiry or cookie deletion, contact the salon for assistance. Cross-device customer recovery needs real OTP delivery and a customer account UI.

## Connected behavior

- Booking: multiple services, compatible staff/Any Available, branch-local dates, shifts, breaks, buffers, current reservations, conflict errors, confirmation, private receipts, reschedule and cancellation policy.
- Queue: immutable private visit IDs rather than guessable display tokens; live status, guests ahead, recalculated workload estimate and leave action. Customer status responses exclude customer names, phone numbers and notes.
- Reception: staff login/logout, walk-ins, new booking dialog, customer lookup, quick check-in, compatible assignment/start, calling, completion, cancellation and audited reasoned reordering. Linked appointments move with their operational queue entries.
- Insights: real KPI, service demand, utilization and date/branch data from `/analytics/dashboard`. Unsupported historical demand/peak-hour trends and payment revenue are explicitly identified instead of populated with synthetic figures.
- Query caching is invalidated after successful mutations. Open customer/desk tabs poll every three seconds, salon metadata every fifteen seconds, and insights every ten seconds. No browser bearer-token socket connection is needed. Existing anonymous socket room subscriptions were restricted.

## Integration repairs in NestJS

Added scoped customer receipt authorization; required tenant context on public tenant-specific routes; enforced receptionist branch context and identifier-only resource checks; restricted anonymous socket subscriptions; validated complete service lists, compatible professionals and queue transitions; consolidated desk service actions into the transactional queue operation; made booking creation and reschedule conflict checks transactional; converted branch wall times to UTC instants; corrected break-day filtering, missing schedules, past-slot rejection and closed-day handling; recalculated customer/reception ETAs from current workload; avoided double-counting checked-in appointments in service demand/utilization; removed fabricated analytics fallback values.

OTP generation and notification records currently have no delivery adapter. They now report delivery as unconfigured/PENDING, not successful SENT. This integration does not add SMS, WhatsApp, email or payment provider delivery, and does not certify the entire backend as production-ready.

## Repeatable real end-to-end tests

With local PostgreSQL/Redis and a seeded active plan:

```sh
pnpm --filter @velora/web exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` builds the API, creates the dedicated `velora-integration-test` synthetic tenant, starts API port 4101 and web port 3011, runs real Playwright flows with no API mocks, stops its servers and removes its own tenant. Existing salon records are untouched. `INTEGRATION_API_PORT` and `INTEGRATION_WEB_PORT` can change occupied ports. `PLAYWRIGHT_CHROMIUM_PATH` supports a separately installed Chromium executable. The fixture requires an existing active plan and feature catalogue.

The suite covers public routes at 390/768/1448px, real booking persistence/reload/reschedule/cancel, timezones, combined durations, breaks, incompatible staff, conflicts, private queue authorization, cross-tab calling/service completion, leaving, reception walk-in/reordering/lookup/check-in, staff cookies, logout, CSRF, role/branch enforcement and date-filtered analytics. Additional API tests cover receipt tampering, expiry, purpose/tenant scope and timezone boundaries.

If an interrupted test leaves its dedicated fixture behind, remove only that fixture before rerunning:

```sh
node --env-file=apps/api/.env apps/api/scripts/integration-fixture.cjs --cleanup
```

Do not run the fixture helper or end-to-end suite against a production database. The original synthetic frontend engine tests and reference UI are retained as separate demo regression fixtures.

## Verified on 3 October 2026

- `pnpm typecheck`: passed for web and API.
- `pnpm lint`: passed (the workspace currently defines frontend lint).
- `pnpm test`: 23 tests passed — 11 retained frontend engine tests and 12 backend security/receipt/timezone/scheduling tests.
- `pnpm test:e2e`: all 12 real browser integration scenarios passed. The runner stopped its test servers and deleted its dedicated synthetic tenant afterward.
- `pnpm build`: API and optimized Next.js production builds passed.
- `git diff --check`: passed.

The local production preview runs at `http://localhost:3000` against the updated API on port 4000. OTP delivery and messaging/payment provider configuration remain outside this integration. This is functional integration verification, not a comprehensive penetration test or production-security certification.

Production smoke verification also passed for Home, Booking, Queue, Reception and Insights at 390px, 768px and 1448px, with no horizontal overflow or browser runtime errors. Staff login/logout was verified with Secure/HttpOnly cookies in the production build. Captures are saved under `docs/screenshots/integration/`. The public/staff responsive browser cases were rerun after final visual repairs and passed.

## Customer login and sequential booking update

The public `/book` route now begins with a clearly labelled dummy customer login/sign-up. Use `+91 90000 00000` and code `123456`; no SMS is sent. The wizard collects services, compatible stylist, date/time, contact details, address/preferences and a final review with booking-policy consent. Reception's staff booking dialog remains available without this demo gate.

See [customer booking research and field mapping](CUSTOMER_BOOKING_RESEARCH.md) for primary sources and the address-to-appointment-notes mapping. This browser demo gate does not create real customer accounts or replace backend authorization.

Validation: the 12 existing live integration scenarios passed with the new wizard, including persisted address/preferences, followed by the focused customer login/sign-up regression. All 23 unit/API tests, frontend TypeScript/lint and the optimized frontend production build passed. Production browser captures for login and services at 390/768/1448px are in `docs/screenshots/customer-booking/`; no horizontal overflow or browser runtime errors were observed.

## Appointment convenience update

Added catalogue filters for category/per-service budget/duration, a live seven-day earliest-slot finder with time-of-day preferences, optional stylist visit requests persisted in notes, and confirmed-appointment Google Calendar/ICS export. Calendar export uses the appointment branch and actual timestamps and excludes customer contact details.

Validation: 17 frontend unit tests passed (including six discovery/date/calendar cases); the 13 existing browser scenarios passed, and the new discovery/earliest-slot/request-persistence scenario passed in a focused run. Calendar download was verified against actual persisted booking times. Frontend TypeScript, lint, production build and diff checks passed. Screenshots for discovery and earliest search at 390/768/1448px are in `docs/screenshots/customer-booking/`.

## Surprise discovery, repeat booking and queue planner

Surprise Me suggests a compatible, filtered service that the customer explicitly adds. Book This Again reads the old appointment through its private receipt, selects currently available services/compatible stylist at the original branch, and requires a fresh time and full confirmation. The own-queue travel planner combines the live wait estimate with manually entered travel and buffer time; it is an estimate rather than traffic tracking or a reserved return time.

Verified: all 15 browser integration scenarios passed, including queue planner validation, recommendation selection and unauthorized repeat-booking access. All 19 frontend unit tests passed; TypeScript, lint and production build passed. Production Surprise Me captures at 390/768/1448px are under `docs/screenshots/customer-booking/`.
