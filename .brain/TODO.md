# SERVIO — Operational Roadmap & Task Checklist

> **Status:** Active Roadmap · **Updated:** 2026-10-17
> **Legend:** `[ ]` Not Started | `[/]` In Progress | `[x]` Completed
> **Branches:** `main` = app (frontend). `feature/app-and-backend` = `servio-api/` work in progress.

---

## Phase 0: Knowledge Architecture & Foundations
- [x] Establish 3-layer Brain architecture (`.brain/` and `vault/`).
- [x] Document project context, strict scope boundaries, and ADRs.
- [x] Map comprehensive Obsidian Vault with linked nodes, screen inventory, and research.
- [x] Initialize repository Git structure and base Ionic-Angular project layout (`servio-app/`).
- [x] Create editable Figma customer/Pro flows, linked branding and onboarding graphics (`SERVIO.fig`).
- [ ] Validate representative Philippine catalog pricing, the ₱50 trust fee and the 85/15 payout split before launch.
- [x] Record the backend stack decision as an ADR (ADR-005/006).
- [ ] **Remaining work is specified task-by-task in `CODEX_IMPLEMENTATION_PLAN.md` (repo root).**

---

## Priority: Prototype Demo Readiness (upcoming demo)

- [x] Launch city: Tuguegarao City, Cagayan; verified OSM center/barangays, embedded 1.80 km OSRM route, location data, city ETA profile and pricing caveat.
- [x] UI & Backend Bugfix Pass (2026-10-17): tracking dock layout, order history cancellation tracking, self-booking prevention (frontend & backend), community category card layout, navigation height compaction & universal Android safe-area insets, mobile & tablet responsive layouts.

**Implementation plan — Demo milestone (in required order)**
- [x] A1: Demo flags and database-generated booking codes (`0002_demo_and_pros`); migrated dev/test and schema assertions pass.
- [x] A3: Booking creation, mock escrow hold, idempotency (including concurrent retries and rollback tests).
- [x] A4: Authorized status machine, participant reads/pagination, compensating cancellation fees/refunds, Pro strikes and server no-show deadlines.
- [x] A5: Assigned-Pro catalog add-on quotes, one pending quote, customer approval holds, decline and concurrency/rollback checks.
- [x] A6: Owned upload metadata, R2 signed PUT/GET, local Wrangler demo adapter, participant access and add-on evidence ownership checks.
- [x] A7: Customer-only HMAC PIN, committed five-attempt lockout, atomic completion/release and replay/concurrency guards.
- [x] A8: Ledger-derived Pro wallet, pending earnings, Philippine daily income, mixed ledger pagination and locked mock GCash cashouts.
- [x] A9: Completed-customer reviews and 100% tips, strict SKU bulletin, participant chat with system messages/photos, approved directory and filtered/ranked queries.
- [x] C1: Fetch HttpClient, scoped auth/request IDs/error toasts, Preferences sessions, app API/mock flags and persisted demo LAN configuration.
- [x] C2: Live email-code sign-in, profile setup, role landing, demo connection sheet and prototype legal links.
- [x] C3: Live catalog/directory/bulletin, checkout with stable retry keys, participant tracking/history/chat/photos, add-on decisions, customer PIN, cancellation and review/tip.
- [x] C4: Approved availability, foreground nearest-Pro offers/accept/decline/expiry, server job status/cancel, evidence quotes, PIN completion and ledger wallet/cashout. B2 adds socket events; B3 adds native GPS.
- [x] Demo rehearsal fixes: participant current-avatar access, strictly ordered reset timeline and persistent-directory fixture isolation.
- [x] D1: Guarded idempotent demo seed, separate accounts, Tuguegarao catalog history/feed, reconciled ledger balances and local R2 images.
- [x] D2: Guarded fixed-code sign-in for existing active demo customers/Pros; production and staff blocked.
- [x] D3: Dedicated demo DB reset/backup/restore and authenticated compensating order reset; docs/DEMO_DATA.md.
- [x] B2: Hibernatable participant OrderRoom/Pro sockets, short-lived single-use session-bound tickets, validated/throttled Pro GPS and post-commit invalidations.
- [/] B3: Native Geolocation, socket tracking/chat/dispatch, street snapping and explicit route fallback implemented; API/app checks and two-browser rehearsal pass. Native iPhone API sign-in/map loading verified; source replay regression fixed. Two-device GPS rehearsal remains with F1/D4.
- [/] F1: Android/iOS demo packaging, permissions, icons/splash, strict Release network guards and LAN setup implemented. Android APK/iOS simulator builds pass; Android emulator installer failed (package-service broken pipe). Physical installs/permissions remain for owner rehearsal.
- [/] D4: docs/DEMO_CHECKLIST.md includes reset/sign-in/full flow, LAN/API settings, native installs, branding and verification record. Full two-device rehearsal remains pending physical devices/Android installer recovery.

**Owner-added real-user readiness (payments remain mock)**
- [/] Gmail SMTP implementation, setup guide and code/concurrency tests pass; actual inbox delivery awaits owner-configured local credentials. Normal verified-email account creation stays separate from demo identities.
- [x] Editable profile name/mobile/photo, authenticated persistence, current-avatar display and owned completed-upload validation.
- [x] Owner-scoped saved addresses, explicit map pin/current-location picker and checkout using confirmed coordinates; migration 0007 and coverage checks.

**Demo data (`servio-api/scripts/seed-demo.ts`, `npm run db:seed-demo`)**
- [x] Demo customer/Pro accounts with fixed sign-in codes only outside production: Sophia M., Daniel K., Chris L., Ava L., Kevin T., Sofia R. Staff account is seeded but cannot use mobile sign-in.
- [x] Pro profiles: KYC approved, online, locations around Centro / Ugac Norte, Tuguegarao City; SKUs each Pro offers; ratings and jobs done matching the app.
- [x] Active order **#SRV-8821** (Split AC Water Leak Repair, ₱1,100 + ₱50 fee) in `EN_ROUTE` with escrow `HOLD_AUTHORIZED`, its event timeline and the seeded chat thread.
- [x] Order history: #SRV-8807, #SRV-8790, #SRV-8772 (completed, with reviews and released escrow).
- [x] Bulletin feed: the 6 sample requests (Open / Urgent / Accepted / Completed).
- [x] Daniel's wallet ledger: ₱8,640.75 available, ₱1,870.00 in escrow, today's net ₱3,316.25, and the sample credits, cashout and in-escrow rows.
- [x] Demo photos uploaded to the dev R2 bucket (sample drain-hose evidence, avatars).
- [x] Every demo row marked as demo data (`is_demo` flag or a fixed demo id range) so cleanup can never touch real data.

**Reset and backup**
- [x] `npm run db:demo-reset`: dedicated servio_demo database only, refuses non-demo rows, guarded TRUNCATE then catalog/data/image seed. Normal servio_dev/test are preserved.
- [x] Hard guard: reset and demo seed refuse to run when `ENVIRONMENT=production` or against the production database.
- [x] Local custom-format pg_dump backup and guarded restore verified in servio_demo; ignored backups/. Future owner-approved Neon demo-baseline/Reset from parent documented, not performed.
- [x] App "Reset demo order" button (Tracking tab) calls the API reset endpoint (dev/demo only) instead of only clearing local storage.
- [ ] Demo-day checklist: run reset, verify both accounts sign in, walk the full flow (book → track → add-on → PIN → wallet → review), reset again before presenting.

---

## Phase 1: MVP Core Development

### 1. Backend — `servio-api/` (Cloudflare Workers + Neon Postgres + R2)

**Step 1 — Foundation**
- [x] Scaffold Workers + Hono + Drizzle project (Node 26, `.nvmrc`), `wrangler.toml`, `.env.example`.
- [x] Drizzle schema + migrations (17 tables) with DB guards: append-only ledger/events, balanced double-entry.
- [x] Local `servio_dev` / `servio_test` databases migrated; idempotent catalog seed (`npm run db:seed`).
- [x] Shared helpers: env bindings, per-request DB client, errors, validation, crypto, money split.
- [x] Middleware: request ID, CORS (Capacitor origins), error envelope, `withDb`, `requireUser`.
- [x] Routes: `GET /health`, `GET /catalog` (categories, SKUs, add-ons).
- [x] Vitest setup (`@cloudflare/vitest-plugin`) + tests for health, catalog, money split, ledger guards.

**Step 2 — Sign-in (email codes, ADR-014 pattern from AdvanCare)**
- [x] Gmail SMTP mailer over `cloudflare:sockets` (dev: code printed to log).
- [x] `POST /auth/request-code`, `POST /auth/verify-code`, `POST /auth/sign-out`, `GET/PATCH /me` (hashed codes + sessions, rate limits, attempt lockout).
- [ ] Profile endpoints (name, phone, avatar), Pro profile + KYC submission.
- [x] App: email-code login, API session persistence and first sign-in profile setup (C2).

**Step 3 — Booking, escrow & wallet**
- [ ] Booking create (price snapshot, ₱50 fee, escrow hold ledger entries) + status transitions with event log.
- [ ] Add-on quotes: R2 presigned photo upload, create/approve/decline with ledger hold.
- [ ] Completion PIN (HMAC-derived, attempt-limited) → escrow release, 85/15 split, tips.
- [ ] Wallet balance from ledger, transaction history, cashout requests (min ₱500, ₱15 fee).
- [ ] Reviews, bulletin requests, order chat messages (REST first).
- [ ] App: replace `OrderService` / `WalletService` mocks with API calls (keep screens unchanged).

**Step 4 — Real-time & dispatch**
- [ ] Dispatch: nearest approved, online Pros within 10 km (enable PostGIS on Neon), 60-second offers, expiry.
- [ ] Durable Object per order: WebSocket for live GPS, status broadcasts and chat.
- [ ] App: Pro device streams real GPS (`@capacitor/geolocation`); `TrackingSimService` consumes the live feed instead of the simulator.
- [ ] Push notifications via FCM (dispatch alerts, add-on requests, arrival) + `@capacitor/push-notifications`.

**Step 5 — Payments & extra sign-in**
- [ ] PayMongo sandbox: GCash + card, payment intents, webhooks into the ledger; mock provider stays for tests.
- [ ] Payouts to GCash / InstaPay.
- [ ] Legal check: custodial escrow of GCash funds vs. BSP e-money rules.
- [ ] Google sign-in + Sign in with Apple (required together on iOS).
- [ ] Switch sign-in delivery to Semaphore SMS when budget allows (same flow).

### 2. Unified Mobile App (Ionic-Angular with HTML & SCSS)
- [x] Ionic-Angular + Capacitor project (`servio-app/`, Angular 22 standalone + Ionic 9 + Capacitor 8).
- [x] Design tokens, 5-tab shell, Home / Directory / Bulletin / Tracking / Profile screens.
- [x] Onboarding (Discover / Trust / Track animations), phone OTP auth (mock), reusable components.
- [x] Customer flows: helper sheet, post bulletin, escrow checkout, chat, add-on approval, completion PIN, rating & tip (mock data).
- [x] Servio Pro: dashboard, radar alert (audio/haptics), job state machine, add-on quote (camera), PIN verify, wallet & cashout (mock data).
- [x] Foodpanda-style live tracking engine (street route, interpolated GPS, heading, follow camera).
- [x] Native iOS project added and running in the Simulator (camera/photo permission strings set).
- [ ] Android project: `npx cap add android`, permissions, run on emulator.
- [ ] App icon + splash screen from `assets/logo/` (iOS + Android).
- [ ] Map tiles: add a CARTO API key (`environment.cartoApiKey`) or pick a licensed provider; OSM fallback is dev-only.
- [ ] Reconcile Figma vs implementation-brief content differences (see CHANGELOG 0.4.0).
- [ ] Pro KYC upload screen (`/pro/onboarding`) and Request Detail sheet (`/request/:id`) from the screen inventory.
- [ ] Error / offline / loading states once screens call the real API.
- [ ] Accessibility pass (VoiceOver labels, contrast, dynamic type) and a dark-mode decision.

### 3. Quality & Release
- [ ] CI (GitHub Actions): app build + tests, API typecheck + tests, migrations against a Neon branch.
- [x] Deploy `servio-api` to Workers (production env, Hyperdrive id, secrets) — https://servio-api.mcleinonza0531.workers.dev.
- [x] Neon production database + migrations; R2 production bucket (+ CORS).
- [ ] Privacy policy, Terms of Service, Escrow Protection Policy (Data Privacy Act compliance).
- [ ] TestFlight / Play internal testing builds; App Store & Play listings.

### 4. Admin Web Console
- [ ] Provider verification dashboard (KYC document inspection, approve/reject).
- [ ] Service catalog & pricing manager.
- [ ] Active bookings monitor & dispute resolution panel (manual escrow release/refund).

---

## Phase 2: Post-MVP Enhancements
- [ ] Dynamic surge pricing and peak demand algorithms.
- [ ] Automated SMS fallback for offline technicians.
- [ ] Multi-language and localization support (Filipino / English).
- [ ] Provider tier badges (Top Rated, Master Certified).
