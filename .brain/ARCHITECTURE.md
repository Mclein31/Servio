# SERVIO — System Architecture

> **Status:** As built · **Verified against code:** 2026-11-15 (`main` @ `74164cc`)
> **Related Vault Note:** `vault/04_Domain_and_System_Design/Domain_Model.md`
> **Machine-readable map:** `.brain/FLOW.json` (actors, screens, routes, decision points)

---

## 1. System Topology

```
+--------------------------------------------------------------+
|  servio-app  (Ionic 9 + Angular 22 + Capacitor 8, iOS/Android)|
|  REST via HttpClient(fetch)  ·  WebSockets via LiveService     |
+-----------------------------+--------------------------------+
                              | HTTPS /api/v1   wss (ticketed)
                              v
+--------------------------------------------------------------+
|  servio-api  Cloudflare Worker (Hono, Valibot, Drizzle)       |
|  middleware: request-id, CORS, error envelope, withDb, auth   |
|  routes: auth, me, catalog, community, addresses, bookings,   |
|          booking-social, pro, wallet, uploads, live, locations,|
|          notifications, support, demo, health                  |
|  Durable Objects: OrderRoom (booking:/pro:/user: rooms)       |
|                   Geocoder (single Nominatim queue + cache)    |
+------+-------------------+-------------------+---------------+
       | Hyperdrive (prod, |  R2 binding       | outbound
       | caching disabled) |  UPLOADS          |
       v                   v                   v
  Neon Postgres 17     R2 servio-uploads    Gmail SMTP (codes), Nominatim,
  (branch production)  (dev: local          OSRM (dev routing only)
                        servio-uploads-dev)
```

The app also loads map tiles directly from OpenFreeMap (vector style) or tile.openstreetmap.org (raster fallback).

There is no API gateway, Redis, Firebase, Supabase or PostGIS. Authorization is done in code on every endpoint (participants only, 404 otherwise; ADR-005).

---

## 2. Core Subsystems

### 2.1 Mobile Application (`servio-app/`)
- **Layout:** `core/` (api client, guards, services, data incl. `tuguegarao-route.ts`), `shared/` (components, modals, models, pipes, utils such as `map-tiles.ts`), `pages/`, `tabs/` (shell). SCSS tokens in `src/theme/variables.scss`, mixins in `src/theme/_mixins.scss`, globals in `src/global.scss`.
- **Tabs:** `/tabs/home`, `/tabs/directory`, `/tabs/bulletin`, `/tabs/tracking`, `/tabs/pro` (Pro mode, replaces Home), `/tabs/profile`.
- **Other routes:** `/onboarding`, `/auth/login`, `/auth/verify-otp`, `/auth/profile`, `/legal/:type`, `/addresses`, `/profile/edit`, `/rewards`, `/payment-methods`, `/notifications`, `/help`, `/checkout`, `/order/:id/{chat,addon-modal,completion,review}`, `/pro/radar-alert`, `/pro/order/:id/{execute,add-quote,verify-otp}`, `/pro/wallet` (+ redirect aliases). Not built: `/pro/onboarding` (KYC upload) and `/request/:id`.
- **State:** API mode uses `CommunityService` (discovery/catalog), `OrderService` (participant booking snapshots), `ProService`, `WalletService`, `RewardsService`; money/status writes happen on the API and refresh the presentation model. Offline mock mode alone persists the local order/wallet (`demo-store.ts`). Sessions live in Capacitor Preferences via `SessionService`.
- **Tracking:** `TrackingService` consumes authenticated OrderRoom GPS or an explicit demo-only Tuguegarao route source, snaps/interpolates along street geometry and shows Reconnecting on stale fixes. Road routes come from OSRM in development only; production glides the marker between real fixes without a route line.
- **Maps:** `servioTileLayer()` uses MapLibre GL (OpenFreeMap "liberty" style) inside Leaflet when WebGL2 exists, otherwise raster OSM tiles. Leaflet owns markers and routes.

### 2.2 Pro & Execution Workflows (Pro mode in the same app)
- **Availability toggle:** optimistic; requires a GPS fix ≤ 30 s old to go online. Upgrading or switching to Pro always starts offline (ADR-030).
- **Dispatch alert:** 60-second offer with alarm sound (native-audio) and haptics.
- **Job execution:** `ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED`, with optional add-on quote (photo evidence) and completion by entering the customer's PIN.
- **Wallet:** ledger-derived available balance, pending earnings, today's net (PH time), mock GCash cashout (min ₱500, ₱15 fee).

### 2.3 Dispatch (`servio-api/src/dispatch/demo-dispatch.ts`)
- Runs only when a Pro app sends the `POST /pro/dispatch` heartbeat (foreground); there is no cron/alarm yet.
- Candidates: approved, active, online, SKU-qualified Pros with a fix younger than two minutes, excluding prior offers; ranked by great-circle distance (plain SQL) then rating. No radius cap (ADR-035).
- One offer at a time, 60 s each, up to five Pros; exhaustion refunds the hold. An ASAP booking with no eligible Pro waits up to 5 minutes (`FIRST_OFFER_WAIT_MS`) before refunding.
- Direct (specific-Pro) bookings and Bulletin reservations skip dispatch; direct bookings start `ACCEPTED` without Pro consent (open product question).

### 2.4 Escrow & Ledger
- All money is integer centavos in an append-only, balanced double-entry ledger (`ledger_entries`) guarded by DB triggers (`0001_ledger_guards`).
- **Booking:** hold base price + ₱50 trust fee (minus any platform-funded coupon, ADR-038) inside one transaction with the booking row; optional idempotency key.
- **Cancellation (ADR-009):** free before `EN_ROUTE`; ₱100 at `EN_ROUTE`, ₱200 at `ARRIVED`, fee 100% to the Pro; Pro cancellation = full refund + strike (no penalty logic).
- **Completion (ADR-012):** customer PIN = HMAC(PIN_SECRET, booking id), 5 attempts then locked; release splits base + approved add-ons 85/15, platform also keeps the trust fee. Tips go 100% to the Pro.

### 2.5 Realtime (ADR-022, ADR-036)
- One `OrderRoom` Durable Object class hosts booking rooms (GPS, chat, status), `pro:` rooms (dispatch) and personal `user:<id>` rooms (all booking/bulletin invalidations and notifications).
- Clients get a 60 s single-use ticket, connect, and refetch authorized REST snapshots on events. 25 s of silence = dead socket → reconnect; 5 s polling only while disconnected.

---

## 3. Communication Protocols
- **HTTPS REST** (`/api/v1`): all reads and transactional writes.
- **WebSockets** (Durable Object hibernation API): invalidation events, live GPS, chat pings.
- **Local notifications** (`@capacitor/local-notifications`): shown for events received while the app is open or recently backgrounded. No remote push.

---

## 4. Data Model
22 Drizzle tables in `servio-api/src/db/schema.ts`: `users`, `user_addresses`, `login_codes`, `sessions`, `pro_profiles`, `categories`, `service_skus`, `addon_skus`, `pro_skus`, `bookings`, `customer_coupons`, `booking_events`, `addon_quotes`, `dispatch_offers`, `bulletin_requests`, `messages`, `reviews`, `ledger_entries`, `payouts`, `uploads`, `support_requests`, `notifications`. `booking_events` and `ledger_entries` are append-only (DB triggers). Migrations `0000`–`0012` in `servio-api/drizzle/`.
