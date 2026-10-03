# Velora

Responsive salon booking, customer queue, reception desk and owner insights demo, recreated from the supplied Velora PNG references.

Figma: https://www.figma.com/design/Gkg2DNv0MUBVqDLgoRER6s

## Run

Requires Node.js 22+ and pnpm 10.28.2.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Reception: `/desk`; insights: `/dashboard`. All ten requested routes are implemented. Use **Demo Settings** in the dashboard sidebar to reset the synthetic state.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @velora/web exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm --filter @velora/web start
```

If Chromium is already installed in a different location, set `PLAYWRIGHT_CHROMIUM_PATH` to its executable when running `pnpm test:e2e`. The production build uses Webpack. Turbopack requires worker permissions unavailable in some restricted environments.

## Workspace

- `apps/web`: Next.js 16.3.8, React 19.3.0, TypeScript, Tailwind 4, TanStack Query, React Hook Form, Recharts and Zod.
- `packages/ui`: shared shadcn-style Radix Dialog and CVA button primitives.
- `packages/types`: tenant/branch-aware domain and demo-service interfaces.
- `packages/validation`: shared customer form schema.
- `apps/web/src/lib/engine.ts`: scheduling, booking conflicts, queue estimates, transitions, check-in and reasoned reordering.
- `apps/web/src/lib/demo-service.ts`: replaceable synchronous demo-service boundary.
- `apps/web/src/lib/data.ts`: locale, SGD currency, Singapore timezone, branch contacts, staff capabilities, shifts, breaks, prices and reference fixture.

Dependencies are pinned in the package manifests and `pnpm-lock.yaml`.

## Demo behavior

Booking supports multiple services, compatible professionals or Any Available, buffers, shifts, breaks and reservation conflicts. Confirmation reads the latest saved state and rechecks availability. Customer forms validate before saving. Booking records persist, can be rescheduled and can be cancelled within the configured policy. Check-in moves a reservation into the operational queue. Reception supports walk-ins, lookup, check-in, assignment, calling, starting, completion, cancellation, skipping/no-show and reordering with a reason. Service completion updates the other tab’s queue estimates and local notices.

The public queue view renders the selected guest’s token, service and progress without other guests’ names or phone numbers. Newly joined guests receive sequential tokens. Demo state is saved in localStorage and synchronized with the browser storage event. Keep only synthetic data in this demo. Storage is not secure authorization or a transactional database; simultaneous writes from independent tabs can race.

The operational clock is fixed at **16 April 2025, 09:00 Singapore time** for repeatable comparisons. Analytics use a separate synthetic July 2024 historical fixture. Date, branch, chart granularity, demand ordering and utilization filters work; figures are illustrative, not financial records. The screenshot wording “Real data” is retained as brand copy. No real payment, OTP, email, SMS or push delivery is performed.

## Branding and comparison

Outlined transparent wordmark, light wordmark, V symbol and app icon are in `apps/web/public/brand`. All lettering in the logo is vector paths, including the tagline. Fonts are bundled locally. The gold uses the PRD palette with a tonal gradient matching the reference.

The supplied PNGs are the source of the photographs and logo trace. See `docs/ASSET_PROVENANCE.md` for crop limitations and `docs/VALIDATION.md` for checks. Recreating vector artwork from raster references does not restore the original master curves. Some text metrics, image cropping and demo counts differ from the static reference. The desktop target viewport is 1448 × 1086; captures retain full content height until the final Figma cleanup. Mobile and tablet designs retain scrollable content.

`/design` is a development capture helper that lays out editable mobile/tablet DOM content for Figma. `NEXT_PUBLIC_FIGMA_CAPTURE=1` enables Figma’s official capture script. Ordinary development/production runs leave the script disabled. This helper is not customer navigation.

## Production boundary

This delivery is a frontend demo. Desk/owner access and settings are presentation controls. Before production, implement server-side authentication, authorization, tenant/branch isolation, entitlement enforcement, private customer tokens, transactional scheduling, audit attribution and retention, protected `/api/v1` endpoints, secure transport, validation, rate limiting and the supplied security requirements. NestJS/database, live sockets, payment providers, messaging, onboarding/settings backend and deployment remain outside this phase.
