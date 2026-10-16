# SERVIO — Operational Roadmap & Task Checklist

> **Status:** Active Roadmap · **Updated:** 2026-10-16
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

**Implementation plan — Demo milestone (in required order)**
- [x] A1: Demo flags and database-generated booking codes (`0002_demo_and_pros`); migrated dev/test and schema assertions pass.
- [x] A3: Booking creation, mock escrow hold, idempotency (including concurrent retries and rollback tests).
- [x] A4: Authorized status machine, participant reads/pagination, compensating cancellation fees/refunds, Pro strikes and server no-show deadlines.
- [x] A5: Assigned-Pro catalog add-on quotes, one pending quote, customer approval holds, decline and concurrency/rollback checks.
- [x] A6: Owned upload metadata, R2 signed PUT/GET, local Wrangler demo adapter, participant access and add-on evidence ownership checks.
- [x] A7: Customer-only HMAC PIN, committed five-attempt lockout, atomic completion/release and replay/concurrency guards.
- [ ] A8: Wallet and cashout.
- [ ] A9: Tips, reviews, bulletin, chat, directory.
- [ ] C1: App API client.
- [ ] C2: Email code auth screens.
- [ ] C3: Customer API flows.
- [ ] C4: Pro API flows.
- [ ] D1: Guarded demo seed.
- [ ] D2: Demo sign-in.
- [ ] D3: Reset and backup.
- [ ] B2: OrderRoom live sockets.
- [ ] B3: Real GPS and simulator fallback.
- [ ] F1 (demo-required): Android packaging, permissions, icons/splash and dev/demo LAN access; iPhone Personal Team install instructions.
- [ ] D4: Demo checklist for Monday, October 19, 2026 (iPhone customer + Android Pro).

**Demo data (`servio-api/scripts/seed-demo.ts`, `npm run db:seed-demo`)**
- [ ] Demo accounts with fixed sign-in codes that work only outside production: customer **Sophia M.**, Pro **Daniel K.**, plus Chris L., Ava L., Kevin T., Sophia (tutor role), and an admin.
- [ ] Pro profiles: KYC approved, online, locations around Bel-Air / Poblacion, Makati; SKUs each Pro offers; ratings and jobs done matching the app.
- [ ] Active order **#SRV-8821** (Split AC Water Leak Repair, ₱1,100 + ₱50 fee) in `EN_ROUTE` with escrow `HOLD_AUTHORIZED`, its event timeline and the seeded chat thread.
- [ ] Order history: #SRV-8807, #SRV-8790, #SRV-8772 (completed, with reviews and released escrow).
- [ ] Bulletin feed: the 6 sample requests (Open / Urgent / Accepted / Completed).
- [ ] Daniel's wallet ledger: ₱8,640.75 available, ₱1,870.00 in escrow, today's net ₱3,316.25, and the sample credits, cashout and in-escrow rows.
- [ ] Demo photos uploaded to the dev R2 bucket (sample drain-hose evidence, avatars).
- [ ] Every demo row marked as demo data (`is_demo` flag or a fixed demo id range) so cleanup can never touch real data.

**Reset and backup**
- [ ] `npm run db:demo-reset`: deletes only demo rows (respecting the append-only ledger, using a guarded cleanup path), then re-runs the catalog seed and the demo seed, leaving a clean known state in one command.
- [ ] Hard guard: reset and demo seed refuse to run when `ENVIRONMENT=production` or against the production database.
- [ ] Backup before the demo: `pg_dump` snapshot script (`npm run db:backup` → `backups/servio-<date>.sql`, git-ignored) plus a restore script; on Neon, also create a branch snapshot (`demo-baseline`) to restore from instantly.
- [ ] App "Reset demo order" button (Tracking tab) calls the API reset endpoint (dev/demo only) instead of only clearing local storage.
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
- [ ] App: switch login screen from phone to email code; `AuthService` calls the API and stores the session token.

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
- [ ] Deploy `servio-api` to Workers (production env, Hyperdrive id, secrets).
- [ ] Neon production database + migrations; R2 production bucket.
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
