# Velora

Salon booking, private customer queue tracking, reception operations and owner insights, connected to the NestJS/PostgreSQL backend. The supplied Velora branding, typography, photography and original visual demo remain in the workspace.

## Run locally

Requires Node.js 22+, pnpm 10.28.2, PostgreSQL and Redis. Keep your existing `apps/api/.env` database/security settings.

```sh
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The API defaults to port 4000. Use `/desk` or `/dashboard` to sign in with an existing backend staff account. Customer routes include `/services`, `/professionals`, `/book`, `/queue/join`, `/queue`, `/customer/bookings` and `/contact`.

If initializing a new database, configure `apps/api/.env` from its example, then run `pnpm prisma:generate`, apply your migrations/schema and run `pnpm prisma:seed`. These steps are unnecessary for an already configured database.

`API_UPSTREAM_URL` is server-only; `NEXT_PUBLIC_SALON_SLUG` selects the salon. Live mode is the default. The original SGD/Singapore visual fixture is available with `NEXT_PUBLIC_DATA_MODE=demo`. The connected UI uses actual branch settings and data, including INR/India settings in the current seed. It never silently substitutes demo records for failed API requests.

## Verify

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @velora/web exec playwright install chromium
pnpm test:e2e
pnpm build
```

End-to-end tests use an isolated synthetic tenant, real API/database requests, separate server ports, and automatic cleanup. See [integration contracts, behavior, security and testing](docs/FRONTEND_INTEGRATION.md). Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is installed outside Playwright’s expected cache.

For production processes, run `pnpm --filter @velora/api start:prod` and `pnpm --filter @velora/web start` after building. Configure HTTPS, secrets, provider integrations and the exact `WEB_ORIGIN` before deploying.

## Workspace and assets

- `apps/api`: NestJS, Prisma/PostgreSQL, JWT authentication, tenant/branch/role guards, bookings, queue, reception, analytics and audit records.
- `apps/web`: Next.js 16, React, TypeScript, TanStack Query, responsive customer/staff UI and same-origin HttpOnly session proxy.
- `packages/ui`, `packages/types`, `packages/validation`: shared components, domain contracts and validation.
- `apps/web/public/brand`: outlined transparent wordmark, light variant, V symbol and app icon SVGs.
- [Asset provenance](docs/ASSET_PROVENANCE.md) and [original visual validation](docs/VALIDATION.md) describe PNG trace/crop limitations.

[Figma design](https://www.figma.com/design/Gkg2DNv0MUBVqDLgoRER6s) reflects the earlier visual reference work. `/design` is the retained development capture helper; enable Figma’s capture script only with `NEXT_PUBLIC_FIGMA_CAPTURE=1`.

Customer receipts currently support the browser in which they were created and expire after seven days. OTP/SMS/WhatsApp/email dispatch remains unconfigured, notifications are recorded as pending, and the current analytics API does not provide historical charts or payment revenue. The UI does not invent verification, delivered messages or successful payments.
