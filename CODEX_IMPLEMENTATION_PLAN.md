# SERVIO — Codex Implementation Plan

> **Audience:** Codex (or any coding agent) finishing SERVIO from the current state.
> **Written:** 2026-10-16 by Claude Code, after backend steps 1–2.
> **Launch city:** Tuguegarao City, Cagayan (owner update 2026-10-16; ADR-008).
> **Branch to work on:** `feature/app-and-backend` (the app is also on `main`; the API is only on the feature branch until merged).
> **Work top to bottom.** Each task has acceptance criteria; a task is done only when they all pass.

---

## 0. Read this first

### What SERVIO is
"Foodpanda for services" in the Philippines: customers book **fixed-price catalog services** (AC leak repair, tutoring, errands…); a nearby verified **Pro** accepts, travels with live tracking, does the job, and is paid from **escrow** only when the customer shares a **4-digit completion PIN**. Read before coding:

- `.brain/PROJECT_CONTEXT.md`, `.brain/SCOPE.md` (in/out of scope), `.brain/DECISIONS.md` (ADR-001…004), `.brain/ARCHITECTURE.md` §4, `.brain/NOTES.md` §5, `.brain/TODO.md`.
- Product/UX depth: `vault/03_User_Experience_and_Screens/` (screen inventory, Figma handoff, pricing).
- Visual source of truth: `SERVIO.fig` (26 iPhone 14 Plus screens) and `assets/ui/`.

### Hard rules (do not break)
1. **ADR-001 — fixed SKUs only.** No bidding, offers, counter-prices or free-text prices anywhere (API, DB, UI). Add-ons come only from `addon_skus`.
2. **ADR-002 — escrow first.** A Pro is credited **only** after a matching completion PIN. Status and money change only inside API transactions; the app never sets a balance or status directly.
3. **Money is integer centavos** in the API and DB (`110000` = ₱1,100.00). Use `servio-api/src/lib/money.ts` (`splitPayout`, 85/15, remainder to platform). The app formats with its `php` pipe.
4. **Ledger is double-entry and append-only** — enforced by triggers in `servio-api/drizzle/0001_ledger_guards.sql`. Every money movement = one `txn_id` with ≥2 rows summing to 0. Never UPDATE/DELETE ledger or `booking_events` rows.
5. **Secrets never committed.** `.env` files are git-ignored; document every new secret in `servio-api/.env.example` (with "where to get it" steps, like the existing entries).
6. **Scope (SCOPE.md):** no social feed, no off-platform cash settlement, no unverified Pros on dispatch, no surge pricing.
7. **App stack is Ionic-Angular + HTML/SCSS + Capacitor** (no React/Flutter in `servio-app/`). Standalone components, signals, OnPush.
8. Keep the existing screens and visual design; swap data sources behind the services. Do not redesign.

### Decisions already made by the product owner (2026-10-16)
| Topic | Decision |
|---|---|
| Payments for the demo | **Mock escrow** — full escrow/ledger in the DB, no real money. PayMongo after the demo. |
| Sign-in | **Email 6-digit code only** (Gmail SMTP, AdvanCare ADR-014 pattern). No Google/Apple/SMS yet. |
| Live tracking | **Real GPS from the Pro phone + simulator fallback** (for indoor demos). |
| Demo delivery scope | **Android build + dev/demo LAN access required. Admin console, FCM, CI and cloud deploy deferred until after October 19 (section 3).** |
| Backend stack | Same as `../AdvanCare/backend`: Cloudflare Workers + Hono + Valibot + Drizzle (`pg`) + Neon via Hyperdrive + R2. |

### Repo map
```
SERVIO/
├─ servio-app/        Ionic 9 + Angular 22 + Capacitor 8 app (customer + Pro). iOS project in servio-app/ios.
├─ servio-api/        Cloudflare Worker API (Hono). Steps 1–2 done.
├─ .brain/            Project knowledge (update TODO/CHANGELOG/DECISIONS as you go).
├─ vault/, Servio_Vault/  Obsidian product knowledge (read-only for you unless a task says otherwise).
└─ SERVIO.fig, assets/    Design sources.
```

### Environment & commands
- **Node 26** (`servio-api/.nvmrc`). The default shell node may be 20 — run `nvm use 26` (npm 10 on node 20 crashes on install).
- Local Postgres 17 (Homebrew) on `localhost:5432`, databases `servio_dev` and `servio_test` (no PostGIS locally).
- `servio-api/.env` exists locally (git-ignored) with `DATABASE_URL`, `TEST_LOCAL_DATABASE_URL`, `PIN_SECRET`.

```bash
# API
cd servio-api
npm run dev            # wrangler dev on :8787 → http://localhost:8787/api/v1/health
npm test               # vitest in workerd; DB suites run against TEST_LOCAL_DATABASE_URL
npm run typecheck
npm run db:generate -- --name <change>   # after editing src/db/schema.ts
npm run db:migrate     # applies to DATABASE_URL_UNPOOLED || DATABASE_URL
npm run db:seed        # idempotent catalog upsert
# migrate the test DB too:
DATABASE_URL_UNPOOLED=postgresql://$USER@localhost:5432/servio_test npm run db:migrate

# App
cd servio-app
npm start              # ng serve on :4200
npx ng test --watch=false
npx ng lint
npm run build && npx cap sync ios && npx cap open ios     # then Cmd+R in Xcode
```
> `npx cap run ios` fails at deploy on this Mac ("Simulator.app does not exist"); use Xcode or `xcrun simctl install/launch`.

### Definition of done (every task)
- `servio-api`: `npm run typecheck` and `npm test` pass; new endpoints have tests (happy path + auth + validation + the money invariant they touch).
- `servio-app`: `npx ng build`, `npx ng lint`, `npx ng test --watch=false` pass with zero warnings.
- New env vars documented in `.env.example`; new decisions appended to `.brain/DECISIONS.md`; `.brain/TODO.md` boxes ticked; `.brain/CHANGELOG.md` entry per task group.
- Small, focused commits (`feat(api): …`, `feat(app): …`, `test: …`, `docs: …`).

---

## 1. Current state (what already exists)

### `servio-api/` — done
- Hono app: `src/index.ts` → `/api/v1`. Middleware: request id, CORS (Capacitor origins `capacitor://localhost`, `http://localhost`), error envelope `{ error: { code, message, requestId, details? } }`, `withDb` (per-request `pg` client, always closed), `requireUser` (bearer session).
- Routes: `GET /health`, `GET /catalog`, `POST /auth/request-code`, `POST /auth/verify-code`, `POST /auth/sign-out`, `GET /me`, `PATCH /me`.
- Schema (`src/db/schema.ts`, 17 tables): users, login_codes, sessions, pro_profiles, categories, service_skus, addon_skus, pro_skus, bookings, booking_events, addon_quotes, dispatch_offers, bulletin_requests, messages, reviews, ledger_entries, payouts. Enums mirror the app's state machine.
- Migrations: `0000_core_schema.sql`, `0001_ledger_guards.sql` (append-only + balanced-ledger deferred trigger + `updated_at` touch).
- Seed: `scripts/seed.ts` from `src/db/catalog-data.ts` (5 categories, 9 SKUs, 3 add-ons).
- Tests: 18 passing (`test/app`, `auth`, `money`, `ledger`).

### `servio-app/` — done (mock data)
- All customer + Pro screens, onboarding, live-tracking engine (`TrackingSimService`, `RouteTrack`, `app-tracking-map`), escrow lifecycle on one device.
- Data comes from mocks: `core/data/mock-data.ts`, `OrderService`, `WalletService`, `AuthService` (phone OTP mock), persisted to localStorage via `core/services/demo-store.ts`.
- Unit tests for money, route geometry, slide threshold, phone formatting.

---

## 2. Tasks

### Phase A — Backend core (booking, escrow, wallet)

**A1. Demo flag + Pro onboarding data model** — migration `0002_demo_and_pros`
- Add `is_demo boolean not null default false` to `users`, `bookings`, `bulletin_requests` (used by demo seeding/reset, Phase D).
- Add `bookings.code` generator: `SRV-` + 4–6 digit sequence (Postgres sequence `booking_code_seq`, start 8800).
- Accept: migration applies to `servio_dev` + `servio_test`; schema test asserts columns exist.

**A2. Pro profile & KYC endpoints**
- `POST /pro/apply` (current user becomes `PRO`, creates `pro_profiles` with `kyc_status=PENDING`), `PATCH /pro/profile` (headline, bio, credentials, SKUs from catalog only → `pro_skus`), `POST /pro/availability` `{ online, lat, lng }`.
- KYC documents via R2 (A6). Only `APPROVED` Pros may go online (403 `KYC_REQUIRED`).
- Accept: tests for role change, SKU must exist, offline/online guard.

**A3. Booking creation + escrow hold** — `POST /bookings`
- Body: `{ skuId, address{street,barangay,city,landmark?}, lat, lng, schedule, paymentMethod: 'GCASH'|'CARD', proId? }` (proId when booked from a helper profile; otherwise dispatch).
- Snapshot `sku_name`, `price_centavos`; `trust_fee_centavos = TRUST_FEE_CENTAVOS (5000)`.
- In **one DB transaction**: insert booking (`status=PENDING_ACCEPTANCE` or `ACCEPTED` if proId), event row, ledger txn `ESCROW_HOLD`: `customer:<id>` −(price+fee), `escrow:<bookingId>` +(price+fee); `escrow=HOLD_AUTHORIZED`. Payment is **mock** (`src/payments/mock.ts` behind a `PaymentProvider` interface `authorizeHold / capture / refund` so PayMongo can replace it later).
- Support `Idempotency-Key` header (table or unique column) so a retried "slide to authorize" never double-books.
- Accept: ₱1,100 SKU → booking total 115000, ledger txn balanced, idempotent retry returns the same booking.

**A4. Status machine** — `POST /bookings/:id/status` `{ to }`
- Allowed (Pro only, assigned Pro only): `ACCEPTED→EN_ROUTE→ARRIVED→IN_PROGRESS`. `COMPLETED` only via PIN (A7). Cancel rules (owner-approved, ADR-009): before `EN_ROUTE`, full refund; `EN_ROUTE`, ₱100 trip fee; `ARRIVED`, ₱200 visit fee (fees 100% to Pro). Customer `IN_PROGRESS` cancellations require an admin dispute. Pro cancellation gives a full refund plus a stored strike. No-show cancellations are free, checked using server time inside the transaction. Store `expected_arrival_at`, fixed `no_show_deadline_at`, and scheduled start/end timestamps. At `EN_ROUTE`, estimate ASAP travel with `CITY_PROFILES.tuguegarao` (20 km/h, road factor 1.3, 15–60 min clamp, 30 min fallback, +30 min grace); accepted-without-departure timeout is 15 min. Scheduled no-show deadline is window end +30 min. Never extend the deadline from live GPS.
- Every transition writes `booking_events`; illegal transitions → 409 `INVALID_TRANSITION`.
- `GET /bookings/:id` (customer or assigned Pro only; others 404), `GET /bookings?role=customer|pro&status=…` (cursor pagination). Response includes events (for stepper timestamps), approved add-ons, totals, and for the customer only: `completionPin` (A7).
- Accept: table-driven transition tests incl. wrong actor and wrong order.

**A5. Add-on quotes (ADR-004)**
- `POST /bookings/:id/addons` (assigned Pro; status `ARRIVED|IN_PROGRESS`; `{ addonSkuId, photoKey, note }`; one PENDING at a time — unique index exists).
- `POST /bookings/:id/addons/:quoteId/decision` `{ approve }` (customer). Approve = ledger txn `ADDON_HOLD` (customer −price, escrow +price) in the same transaction as the decision.
- Accept: ₱350 add-on → escrow 150000; Pro split later +29750; decline leaves escrow unchanged.

**A6. R2 uploads** — copy `../AdvanCare/backend/src/routes/storage.ts` pattern
- `POST /uploads/presign` `{ purpose: 'addon_evidence'|'kyc'|'request_photo'|'avatar', contentType, contentLength }` → presigned PUT (15 min, signature covers type+length), key `uploads/<purpose>/<yyyy>/<mm>/<uuid>.<ext>`. JPEG/PNG ≤5 MB, PDF ≤10 MB (KYC only).
- `GET /uploads/:key` → short-lived signed GET, only for users allowed to see the owning record.
- Accept: presign tests with dummy R2 creds (no network), key validation regex, authorization test.

**A7. Completion PIN + escrow release** — the core of ADR-002
- PIN = first 4 decimal digits of `HMAC-SHA256(PIN_SECRET, bookingId)` (never stored). Customer sees it in `GET /bookings/:id`.
- `POST /bookings/:id/verify-pin` `{ pin }` (assigned Pro, status `IN_PROGRESS` or `ARRIVED`): constant-time compare; wrong → `pin_attempts+1`, after 5 → 423 `PIN_LOCKED` (admin unlock). Right → one transaction: status `COMPLETED`, `escrow=COMPLETED`, event, ledger txn `ESCROW_RELEASE`: escrow −(price+fee+approved add-ons), `pro_wallet:<proId>` +85% of (price+add-ons), `platform_revenue` +15% of (price+add-ons) + fee; `pro_profiles.jobs_done+1`.
- Accept: ₱1,100 + ₱350 add-on → Pro +123250 (₱1,232.50), platform +26750, escrow nets to 0; replay of the same PIN → 409; locked after 5 wrong.

**A8. Wallet & cashout**
- `GET /wallet` (Pro): `availableCentavos` = SUM(`pro_wallet:<id>`), `pendingEscrowCentavos` = SUM of open escrows assigned to the Pro × 85%, `todayNetCentavos`, paginated ledger (credits green / debits / escrow rows as in the Wallet screen).
- `POST /wallet/cashout` `{ amountCentavos, gcashNumber }`: min 50000, fee 1500, balance check **inside** the transaction (`SELECT … FOR UPDATE` on a per-Pro advisory lock), ledger txn `PAYOUT`: pro_wallet −(amount+fee), payout_clearing +amount, platform_revenue +fee; `payouts` row `REQUESTED` with masked number `0917***4567`. Mock provider marks `PAID`.
- Accept: concurrent cashouts can't overdraw (test two parallel requests).

**A9. Tips, reviews, bulletin, chat (REST)**
- `POST /bookings/:id/review` `{ rating 1–5, compliments[], body?, tipCentavos }` (customer, after COMPLETED, once). Tip = ledger txn `TIP` customer→pro_wallet 100%. Update `pro_profiles.rating_avg/count`.
- Bulletin: `GET /bulletin?filter=all|open|urgent|nearby&lat&lng`, `POST /bulletin` (`skuId` must belong to `categoryId`; description ≤200; **no price field** — price comes from the SKU).
- Chat: `GET/POST /bookings/:id/messages` (participants only, ≤2000 chars, optional `photoKey`); system messages on status changes.
- Directory: `GET /pros?category=&lat=&lng=` → approved Pros with rating, distance, from-price (cheapest SKU), availability.
- Accept: tests for each; bulletin rejects unknown/mismatched SKU.

### Phase B — Real-time, dispatch, GPS, push

**B1. Dispatch** — `src/dispatch/`
- On `POST /bookings` without `proId`: find up to 5 Pros: `kyc_status=APPROVED`, `is_online`, has the SKU in `pro_skus`, `last_located_at` < 2 min, within **10 km** (Tuguegarao launch radius, configured in `CITY_PROFILES.tuguegarao`; do not increase the radius automatically for rural coverage). Use the Tuguegarao default center `17.613, 121.727` when a demo location is needed. Distance calculation: haversine in SQL locally; on Neon enable `postgis` and use `ST_DWithin` on a geography column — gate with a feature check. Order by distance then rating.
- Create `dispatch_offers` (expires in 60 s) one Pro at a time (round-robin). `POST /offers/:id/accept|decline`. Expiry handled by a Durable Object alarm (or Cron Trigger every minute as fallback) → next Pro; no Pro → booking `CANCELLED` + `REFUND`.
- Accept: deterministic tests with fake clock for accept/decline/expiry chain.

**B2. Durable Object `OrderRoom`** — one per booking (`wrangler.toml` `[[durable_objects.bindings]]` + migration tag)
- `GET /bookings/:id/live` → WebSocket upgrade (auth via `?token=` short-lived ticket from `POST /bookings/:id/live-ticket`, since browsers can't set headers on WS). Use the hibernation API.
- Messages: Pro → `{ type:'gps', lat, lng, heading?, accuracy, ts }` (throttle ≥1 s, reject if not assigned Pro); server → all: `gps`, `status`, `message`, `addon`. Persist the latest fix to `pro_profiles.last_*` at most every 15 s (not every fix).
- API writes (status, messages, add-ons) notify the room via `stub.fetch`.
- Accept: miniflare test connecting two sockets, Pro fix reaches customer, non-participant rejected.

**B3. App: real GPS + simulator fallback**
- Add `@capacitor/geolocation` (iOS `NSLocationWhenInUseUsageDescription` in `servio-app/ios/App/App/Info.plist`; Android permissions). Pro app: while booking is `EN_ROUTE`, `watchPosition` → send `gps` over the socket.
- `TrackingSimService` becomes `TrackingService` with two sources: **live** (WebSocket fixes) and **sim** (current `TUGUEGARAO_ROUTE` simulator). Keep `displayDistance(now)` interpolation; for live mode, snap fixes to the remaining route polyline (route from origin→destination fetched once via OSRM `router.project-osrm.org` in dev; document a licensed router for prod) and interpolate between fixes exactly as now.
- Fallback rules: no fix for 20 s → show "Reconnecting…" chip, keep last position; a **"Demo: simulate route"** toggle (dev/demo builds only) forces sim mode.
- Accept: unit tests for snapping + source switching; manual: two simulators (customer + Pro) show the marker move.

**B4. Push notifications (FCM)**
- Firebase project (owner creates) → `servio-app` `@capacitor/push-notifications`, `google-services.json` (Android), APNs key uploaded to Firebase (iOS). Register token: `POST /me/push-tokens`.
- Worker sends FCM HTTP v1 (service-account JWT signed in the Worker with WebCrypto; secret `FCM_SERVICE_ACCOUNT_JSON`). Events: new dispatch offer (Pro, high priority), accepted/arrived/completed (customer), add-on requested (customer), add-on decided (Pro), new chat message.
- Accept: unit test of the JWT/assertion builder and payload mapping; manual test on device.

### Phase C — App wiring (replace mocks)

**C1. API client**
- `environment.apiUrl` (`http://localhost:8787/api/v1` dev; iOS simulator can reach localhost; Android emulator uses `10.0.2.2`). `environment.useMockApi` flag keeps the current mock mode working for offline demos.
- `core/api/api.service.ts` (HttpClient + `provideHttpClient(withFetch())`), interceptor adds `Authorization: Bearer` + `X-Request-Id`, maps the error envelope to toasts. Store the token with `@capacitor/preferences`.

**C2. Auth screens → email code**
- `/auth/login`: email field (keep layout, brand icon, disclaimer), Continue → `POST /auth/request-code`. `/auth/verify-otp`: subtitle shows the email; `app-code-input` unchanged; auto-submit → `POST /auth/verify-code`; resend timer unchanged. In dev show the API's `devNote`.
- After first sign-in: profile step (name, optional PH mobile `+639…`) → `PATCH /me`.
- Remove the phone-OTP mock text "test code 123456" in non-mock mode.

**C3. Customer flows** — Home/Directory/Bulletin/Checkout/Tracking/Chat/Add-on/Completion/Review call the API (A3–A9). Prices from API centavos ÷ 100 into existing pipes. Keep all UI.

**C4. Pro flows** — Demo dependency implemented with approved availability and foreground `POST /pro/dispatch` offer maintenance (ADR-018); B2 supplies socket events. Dashboard (availability toggle → A2), Radar (dispatch offer from push/WebSocket → B1), Job execute (A4), Add-quote (camera → presign → R2 PUT → A5), Verify PIN (A7), Wallet/Cashout (A8). `DispatchAlertService` unchanged.

**C5. Role switching** — Profile "Switch to Servio Pro" goes to `/pro/apply` flow if not a Pro yet, else `/pro`.

### Phase D — Demo readiness (priority for the upcoming demo)

**D1. `npm run db:seed-demo`** (`servio-api/scripts/seed-demo.ts`) — refuses to run unless the DB host is localhost **or** the DB name/Neon branch is `servio_demo`/`demo`; never in `ENVIRONMENT=production`. All rows `is_demo=true`. Creates:
- Customer **Sophia M.** `demo.customer@servio.test`; Pros **Daniel K.** (`demo.pro@servio.test`, AC/electrical/laptop SKUs), Chris L., Ava L., Kevin T., **Sofia R.** (`demo.tutor@servio.test`, separate tutor account) — KYC approved, online, locations in Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur, Tuguegarao City, Cagayan; ratings/jobs matching `servio-app/src/app/core/data/mock-data.ts`.
- Active booking **SRV-8821** (`sku-ac-leak`, ₱1,100 + ₱50) `EN_ROUTE`, `HOLD_AUTHORIZED`, events at −11/−7/−1 min, the seeded chat thread.
- Completed history SRV-8807 / 8790 / 8772 with reviews and released escrow; the 6 bulletin requests.
- Daniel's wallet ledger reproducing ₱8,640.75 available / ₱1,870.00 pending / ₱3,316.25 today (create balanced historical txns that produce these sums).
- Demo images uploaded to the dev R2 bucket.

**D2. Demo sign-in** — `DEMO_LOGIN_CODE` env (e.g. `246810`) accepted **only** for `users.is_demo=true` **and** `ENVIRONMENT!='production'`; otherwise normal email codes. Test both branches.

**D3. Reset + backup**
- `npm run db:demo-reset`: guarded like D1; `TRUNCATE` all transactional tables (`sessions, login_codes, bookings, booking_events, addon_quotes, dispatch_offers, bulletin_requests, messages, reviews, ledger_entries, payouts, pro_skus, pro_profiles, users` — demo DB only; TRUNCATE bypasses the row-level append-only triggers by design, which is why it is restricted to the demo database), then `db:seed` + `db:seed-demo`.
- `npm run db:backup` → `pg_dump --format=custom` to `servio-api/backups/servio-<db>-<timestamp>.dump` (git-ignored); `npm run db:restore -- <file>` (guarded, demo/local only).
- Neon: document creating a `demo-baseline` branch from the seeded demo branch and restoring via "Reset from parent".
- App: Tracking "Reset demo order" calls `POST /demo/reset-order` (exists only when `ENVIRONMENT!='production'`, demo users only) → sets SRV-8821 back to EN_ROUTE via a compensating ledger txn (never deletes ledger rows).

**D4. Demo-day checklist** — `docs/DEMO_CHECKLIST.md`: reset, sign in both demo accounts on two simulators/devices, full flow (book → dispatch → track → add-on → PIN → wallet → review), reset again.

### Phase E — Admin web console (`servio-admin/`)
- **Stack:** Angular 22 standalone + SCSS (matches ARCHITECTURE.md "Admin Web (Angular/TS)"); talks to `servio-api` under `/api/v1/admin`.
- **Auth:** follow AdvanCare ADR-011 (`../AdvanCare/backend/src/staff/*`, `routes/admin/auth.ts`): email + password (PBKDF2) + TOTP, HttpOnly cookie sessions, admin `Origin` + custom header on writes, no public sign-up (`npm run admin:bootstrap`), append-only `audit_logs` (migration + trigger).
- **Screens:** KYC queue (view R2 docs via signed GET, approve/reject with reason), Catalog & pricing manager (edit `service_skus`/`addon_skus`; prices change for new bookings only), Live bookings monitor (status, map, events), Disputes (manual escrow release/refund — each is a compensating ledger txn with a required reason, audited), Payouts (mark paid/failed).
- Accept: staff auth tests ported from AdvanCare; every admin write audited; ledger invariants hold.

### Phase F — Android, deploy, CI

**F1. Android** — `npm i @capacitor/android && npx cap add android`; permissions (camera, location, notifications); `10.0.2.2` API URL for the emulator; app icon + splash from `assets/logo/` (`@capacitor/assets`); run on an emulator; CHANGELOG note.

**F2. Neon + Cloudflare deploy** (owner provides accounts/keys; never commit them)
- Neon project `servio`: branches `main` (prod), `demo`, `dev`. Enable `postgis` on Neon (B1). Run migrations with the **unpooled** URL.
- `npx wrangler hyperdrive create servio-neon --connection-string=<unpooled URL>` → put the id in `wrangler.toml` `[[env.production.hyperdrive]]` (currently commented).
- R2 buckets `servio-uploads-dev` / `servio-uploads` + API token; set `remote = true` on the dev bucket once it exists.
- Secrets: `wrangler secret put` for `DATABASE_URL`, `R2_*`, `SMTP_*`, `PIN_SECRET`, `FCM_SERVICE_ACCOUNT_JSON`, `DEMO_LOGIN_CODE` (non-prod only).
- `servio-app` `environment.prod.ts` → deployed API URL; `ALLOWED_ORIGINS` keeps `capacitor://localhost,http://localhost`.

**F3. CI** — `.github/workflows/ci.yml`: app (lint, test, build) and api (typecheck, test with a Postgres service container, `wrangler deploy --dry-run`). Optional: Neon branch per PR.

**F4. Map tiles** — CARTO now requires an API key: set `environment.cartoApiKey` (see `servio-app/src/app/shared/utils/map-tiles.ts`) or choose another licensed provider; OSM tiles are dev-only.

### Phase G — After the demo (do not start before A–F)
- PayMongo sandbox → production behind the `PaymentProvider` interface (+ webhooks, BSP/legal review of custodial escrow).
- Semaphore SMS as a second delivery channel for sign-in codes; Google + Apple sign-in together.
- Pro KYC upload screen (`/pro/onboarding`) and Request Detail sheet (`/request/:id`) UI.
- Accessibility pass, Filipino localization.

---

## 3. Owner-approved order & milestones (updated 2026-10-16)

**Demo: Monday, October 19, 2026.** Only this milestone matters until the demo. Prioritize a working end-to-end flow and report blockers early.

1. Demo implementation: A1 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → C1 → C2 → C3 → C4 → D1 → D2 → D3 → B2 → B3 → **F1 (Android packaging + icons/splash + dev/demo LAN access)** → D4. Include only the A2 availability / B1 dispatch pieces necessary for booking → Pro acceptance and in-app WebSocket alerts; defer broader launch dispatch work.
2. Demo devices: **iPhone 14 Plus customer**, installed from Xcode using a free Apple ID Personal Team (7-day provisioning); iPhone simulator on Mac backup. **Android phone Pro**, second Android backup Pro/customer. Mac hosts API/Postgres; Windows laptop available. No paid Apple Developer account.
3. Pro Android streams real GPS via B2/B3; keep **Demo: simulate route** ready indoors. **No FCM/B4 before the demo**: dispatch/add-on alerts use in-app WebSocket events.
4. Phones use the Mac's **LAN IP**, never localhost. Run `wrangler dev --ip 0.0.0.0`, configure the app API base URL (environment or hidden demo setting), and allow development LAN origins. Add iOS `NSAllowsLocalNetworking` / ATS exception and Android cleartext network configuration **only in dev/demo builds**. Document same-Wi-Fi setup and the complete reset/sign-in/flow/install procedure in `docs/DEMO_CHECKLIST.md`.
5. If LAN operation proves unreliable, propose Cloudflare + Neon deployment and **ask the owner first**. No Neon project or Cloudflare resources exist yet; never assume credentials/resources.
6. After the demo: Launch-ready B1 remainder → B4 → C5 → E → F2 → F3 → F4. Skip admin console, push, CI and deploy until then. Phase G remains explicitly gated on owner instruction.

## 4. Owner answers and remaining questions (updated 2026-10-16)

- **Cancellation/no-show:** answered; ADR-009. Tuguegarao constants supersede earlier traffic assumptions (ADR-008).
- **Date/devices:** Monday, October 19, 2026; iPhone 14 Plus customer, Android Pro, backup Android and iPhone simulator; Mac + Windows laptop. See section 3 and ADR-010.
- **Accounts:** Sophia M. (`demo.customer@servio.test`) is customer only. Tutor is a separate person/account **Sofia R.** (`demo.tutor@servio.test`). Daniel K. (`demo.pro@servio.test`) remains main Pro. No demo account is both customer and Pro.
- **Sender:** `SERVIO`. Gmail App Password is not configured. Use development API-log codes plus `DEMO_LOGIN_CODE` for demo users so sign-in works without email.
- **Business/legal:** use exactly **Business address to follow — prototype** in the email footer and legal pages. Do not invent a registered name, address, TIN or DTI/SEC number. Keep Terms, Privacy and Escrow Protection Policy short and label them **Prototype — not legal advice**.
- **Cloud:** no Neon/Cloudflare resources yet; deployment fallback requires owner approval. Actual personal-team signing and physical-device GPS/install verification require the owner's connected devices and Apple ID.
