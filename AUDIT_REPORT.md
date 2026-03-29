# TCG Booking — Audit Report

**Date**: 2026-03-28
**Scope**: Auth flow, Supabase calls, mobile/desktop UX, code quality, security posture
**Codebase**: Next.js 14.2.35 / TypeScript (strict) / Supabase v2 / Tailwind + shadcn/ui

---

## Critical (fix immediately)

### [Auth] Open redirect in auth callback
**File**: `src/app/auth/callback/route.ts:8`
The `next` query parameter is used in a redirect without validation:
```ts
const next = searchParams.get("next") ?? "/book";
return NextResponse.redirect(`${origin}${next}`);
```
An attacker can craft `?next=https://evil.com` and redirect users post-login.
**Fix**: Validate that `next` starts with `/` and doesn't contain `//` or protocol schemes. Use an allowlist of internal paths.

### [Supabase] `listUsers({ perPage: 1000 })` fetches entire user table
**Files**:
- `src/app/api/admin/clients/route.ts:141`
- `src/app/api/admin/waitlist/route.ts:46`
- `src/app/api/cron/reminders/route.ts:98`

All three call `auth.admin.listUsers({ perPage: 1000 })` which downloads **every user** in the system to find emails for a handful of IDs. This is an O(N) memory/network cost that will degrade as users grow, and exposes all user emails to the server process unnecessarily.
**Fix**: Use Supabase's `auth.admin.getUserById()` in a batched `Promise.all()` for only the needed IDs, or create a Postgres function that joins `auth.users` to avoid pulling full user objects.

---

## High (fix before launch)

### [Auth] Sign-out supports GET method — CSRF vulnerability
**File**: `src/app/api/signout/route.ts`
Both GET and POST are exported. GET-based sign-out is vulnerable to CSRF via image tags or link prefetching — a malicious page could log users out with `<img src="/api/signout">`.
**Fix**: Remove the GET handler; only allow POST for sign-out. One-line deletion.

### [Auth] No rate limiting on login/signup forms (client-side)
**Files**: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
The server-side rate limiter (`src/lib/ratelimit.ts`) protects API routes, but the auth pages call `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()` directly from the client — these bypass the server rate limiter entirely.
**Fix**: Route auth calls through API routes that apply Upstash rate limiting, or add Supabase's built-in rate limiting configuration.

### [Auth] Middleware fetches profile role on every request
**File**: `src/middleware.ts:88-92`
Every authenticated request triggers a Supabase query to `profiles` to check the user's role. This adds latency to every page load and API call.
**Fix**: Store role in Supabase JWT custom claims via a database trigger, or cache the role in a cookie after first fetch with a short TTL.

### [Security] No Content-Security-Policy header
**File**: `next.config.mjs`
Security headers include HSTS, X-Frame-Options, X-Content-Type-Options, and XSS-Protection, but **no CSP** is configured. CSP is the primary defense against XSS — the other headers are supplementary.
**Fix**: Add a `Content-Security-Policy` header. Start with a report-only policy to avoid breaking anything: `Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co`. Tighten iteratively.

### [Security] No environment variable validation at build/startup
**Files**: 7 files use `process.env.VARIABLE!` non-null assertions — `client.ts`, `server.ts`, `service.ts`, `middleware.ts`, `callback/route.ts`, `delete/route.ts`, `reminders/route.ts`
If any env var is missing, the app crashes at runtime with an unhelpful error instead of failing fast at build time.
**Fix**: Add a `src/lib/env.ts` that validates all required env vars at import time using Zod or `@t3-oss/env-nextjs`. Fail at build if any are missing.

### [Mobile] Auth form inputs missing `fontSize: 16px` — causes iOS zoom
**Files**: `src/app/(auth)/login/page.tsx:60-82`, `src/app/(auth)/signup/page.tsx:85-117`, `src/app/(auth)/reset-password/page.tsx`, `src/app/(auth)/update-password/page.tsx`
Admin forms consistently apply `style={{ fontSize: 16 }}` to prevent iOS auto-zoom on focus, but all auth forms are missing this.
**Fix**: Add `style={{ fontSize: 16 }}` to all `<input>` elements in auth pages, or set a global base input font-size of 16px in the UI component.

### [Mobile] Zero `autocomplete` attributes on any form input
**Files**: All form pages (auth, admin, booking)
No `autocomplete` attribute found anywhere in the codebase. Password managers can't fill login forms, mobile keyboards don't suggest emails/phones.
**Fix**: Add `autocomplete="email"` on email inputs, `autocomplete="current-password"` / `autocomplete="new-password"` on password fields, `autocomplete="name"` on name fields, `autocomplete="tel"` on phone fields.

### [Supabase] Admin clients endpoint loads all appointments into memory
**File**: `src/app/api/admin/clients/route.ts:18-22`
Fetches ALL appointments for a stylist without limit, then aggregates in JavaScript. Will degrade as appointment count grows.
**Fix**: Move aggregation to a Postgres function or view (`GROUP BY client_id` with `COUNT`, `MAX`, `MIN`) and paginate at the DB level.

---

## Medium (fix soon)

### [Code Quality] Near-zero test coverage on critical paths
**Status**: vitest.config.ts exists and `src/lib/__tests__/availability.test.ts` exists, but no other tests.
The booking flow and auth redirect validation are the two paths where a regression costs the most.
**Fix**: Prioritize tests for: (1) auth callback redirect validation (once the open redirect fix lands), (2) booking flow / `book_appointment` RPC, (3) Zod validation schemas, (4) availability calculation (already started).

### [Mobile] Button `sm` size variant is 36px — below 44px touch target
**File**: `src/components/ui/button.tsx:23`
The `sm` variant sets `min-h-[36px]` which is below the recommended 44px minimum for touch targets.
**Fix**: Increase `sm` variant to `min-h-[44px]`, or only use it in desktop-specific contexts with a responsive override.

### [Desktop] Admin content area has no max-width constraint
**File**: `src/app/(admin)/layout.tsx:233`
The sidebar is fixed at `w-64`, but the main content area stretches unbounded. On ultrawide monitors (2560px+), content lines become very long.
**Fix**: Add `max-w-5xl` or `max-w-6xl` to the main content wrapper.

### [Supabase] Silent error swallowing in account page
**File**: `src/app/(client)/account/page.tsx:20-34`
Profile fetch uses `.then()` without `.catch()`. If the query fails, the user sees a blank/broken page with no feedback.
**Fix**: Add error state handling and display a user-friendly error message.

### [Mobile] Waitlist sheet `max-h-[85vh]` may clip on short displays
**File**: `src/app/(admin)/admin/waitlist/page.tsx:348`
On phones with small screens (especially with keyboard open), 85vh may still be too tall.
**Fix**: Use `max-h-[calc(100dvh-2rem)]` with `dvh` (dynamic viewport height). Note: `dvh` support is strong in modern browsers but test on target Android WebViews if older devices are in scope.

### [Code Quality] Console-only logging in production
**Files**: 10+ API routes use `console.error` with tags like `[api/admin/appointments POST]`
**Fix**: Consider a structured logging library (e.g., pino) for production, or at minimum ensure Vercel's log drain captures these.

---

## Low / Nice to Have

### [Security] No CORS configuration
No explicit CORS headers or middleware found. Currently not an issue since all API routes are same-origin, but if the API is ever consumed by a different frontend or mobile app, this will need to be addressed.
**Fix**: Document the same-origin assumption. If cross-origin access is needed later, add CORS middleware.

### [Security] Cookie flags managed by Supabase SSR — verify in production
**File**: `src/lib/supabase/server.ts`
Supabase SSR (`@supabase/ssr`) handles cookie configuration internally. No explicit `HttpOnly`, `SameSite`, or `Secure` flags are set in application code, which is correct — the library handles this. However, verify in production that cookies are actually set with `HttpOnly; SameSite=Lax; Secure`.
**Fix**: Inspect cookies in production devtools to confirm flags are present.

### [Mobile] PendingBanner doesn't account for safe-area-inset-top
**File**: `src/components/PendingBanner.tsx:52`
Uses `top-[53px] lg:top-0` which may overlap the notch/dynamic island on modern iPhones.
**Fix**: Use `top-[calc(53px+env(safe-area-inset-top))]` or position below the nav.

### [Accessibility] Form labels use `<label>` elements but lack `htmlFor` / `id` pairing
**Files**: Auth forms and admin forms use `<label>` adjacent to `<input>` but don't explicitly link them with `htmlFor`/`id`.
**Fix**: Add matching `id` on inputs and `htmlFor` on labels for screen reader association.

### [Code Quality] Minor `as string` casts on Supabase data
**Files**: `src/app/api/admin/clients/route.ts:37,47`
**Fix**: Type the Supabase query response generics properly to avoid casts.

### [Desktop] Sidebar fixed at `w-64` on all screen sizes above `lg`
**File**: `src/app/(admin)/layout.tsx:233`
On very large screens, the sidebar could be wider for better readability. Minor aesthetic issue.
**Fix**: Consider `lg:w-64 xl:w-72` for larger screens.

### [Dependencies] Next.js 14.2 is one major behind latest
**File**: `package.json`
Next.js 16 is the current major version. Not urgent since 14.2.35 is stable, but worth planning the upgrade path.
**Fix**: Plan migration when ready — will need async request APIs (`await cookies()`, `await headers()`), `proxy.ts` rename, etc.

---

## What's Working Well

- **RLS on all 14 tables**: profiles, stylists, services, operational_hours, blocked_times, appointments, operational_hours_overrides, rebooking_reminders, stylist_client_notes, walk_in_clients, client_service_log, appointment_services, waitlist_entries — all have RLS enabled with appropriate ownership policies.
- **Service role key isolation**: `SUPABASE_SERVICE_ROLE_KEY` is only used in `src/lib/supabase/service.ts` — never in client code.
- **Atomic booking**: Uses Postgres RPC function (`book_appointment`) to prevent double-booking with proper conflict detection.
- **Strict TypeScript**: `strict: true` in tsconfig, no `any` types, Zod validation on all API inputs with UUID regex, datetime validation, and string length limits.
- **Security headers**: HSTS (63M seconds with preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, XSS-Protection, Referrer-Policy — all configured in next.config.mjs.
- **Rate limiting**: Upstash Redis-based rate limiting on booking (20/hr) and API (60/min) with graceful degradation if Redis is unavailable.
- **Touch targets**: Systematic use of `min-h-[44px]` and `min-h-[48px]` across nav, buttons, and interactive elements — well above industry average for an app at this stage.
- **iOS zoom prevention**: Admin forms consistently apply `fontSize: 16` inline style (auth forms need the same treatment).
- **Mobile navigation**: Bottom nav with `env(safe-area-inset-bottom)` handling, proper responsive breakpoints, drag-handle bottom sheets.
- **Loading states**: Skeleton screens (`ServiceSkeleton`, `SlotSkeleton`, `PageSkeleton`) and button spinners throughout.
- **Error boundary**: Proper class-based ErrorBoundary with dev-mode error details and recovery UI.
- **Realtime cleanup**: Both auth state (`onAuthStateChange`) and Postgres change subscriptions properly unsubscribe on component unmount.
- **Code organization**: Clean separation — API routes, components, lib utilities, config — all well-structured with consistent patterns.

---

## Follow-up Audit Recommendations

Areas not fully covered in this pass that warrant a follow-up:
1. **CSP policy tuning** — after adding the initial CSP header, iterate with report-only mode to tighten directives
2. **Cookie flag verification** — inspect Supabase SSR cookie behavior in production
3. **CORS policy** — document same-origin assumption or add explicit CORS if cross-origin consumers are planned
4. **Dependency security audit** — run `npm audit` / `pnpm audit` for known CVEs
5. **Lighthouse accessibility scan** — automated WCAG 2.1 AA audit for color contrast and keyboard navigation
6. **Load testing** — validate the `listUsers` and clients endpoint fixes under realistic user counts
