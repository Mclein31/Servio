# SERVIO Backend Audit & Q&A Guide

> **Written:** 2026-10-21 · **Scope:** `servio-api/` (Cloudflare Worker) and the `servio-app/` code that talks to it.
> All links are relative to this file. Line numbers match the code as of this date.

---

## 1. The big picture

```
 Ionic/Angular app (phone)                         Cloudflare
 ─────────────────────────                         ──────────────────────────────────────────────
 OrderService / ProService ...                     Worker "servio-api"  (Hono router)
   │  HTTPS JSON  (Bearer token)  ───────────────▶   /api/v1/*  routes ──▶ Postgres (Neon via Hyperdrive)
   │                                                     │                 R2 bucket (photos/KYC)
   │                                                     ▼
   │  WebSocket (wss, 60s ticket) ◀──────────────▶   OrderRoom Durable Object (one per "room")
   │                                                     booking:<id>  user:<id>  pro:<id>
   │
   └─ /locations/reverse ───────────────────────▶   Geocoder Durable Object ──▶ OpenStreetMap Nominatim
```

| Layer | What it is | Where |
|---|---|---|
| Runtime | Cloudflare Worker (serverless, runs at the edge) | [wrangler.toml](../servio-api/wrangler.toml) |
| HTTP router | Hono, every route under `/api/v1` | [src/index.ts:26-50](../servio-api/src/index.ts#L26-L50) |
| Validation | Valibot schemas on every body/query/param → `422 VALIDATION_FAILED` | [src/lib/validation.ts](../servio-api/src/lib/validation.ts) |
| Database | Postgres via Drizzle ORM; new connection per request | [src/db/client.ts](../servio-api/src/db/client.ts), [src/db/schema.ts](../servio-api/src/db/schema.ts) |
| Migrations | SQL files 0000 → 0011 | [servio-api/drizzle/](../servio-api/drizzle/) |
| Realtime | `OrderRoom` Durable Object holding WebSockets | [src/live/order-room.ts](../servio-api/src/live/order-room.ts) |
| Files | R2 bucket, upload via signed URLs | [src/routes/uploads.ts](../servio-api/src/routes/uploads.ts) |
| Email | Raw SMTP over TLS socket to Gmail | [src/lib/mailer.ts](../servio-api/src/lib/mailer.ts) |
| Payments | **Mock only** — returns fake references | [src/payments/mock.ts](../servio-api/src/payments/mock.ts) |
| Money math | Centavos (integers), Pro gets 85% | [src/lib/money.ts](../servio-api/src/lib/money.ts) |
| City config | Tuguegarao center, ETA speed, cancellation fees | [src/config/cities.ts](../servio-api/src/config/cities.ts) |

### Route files at a glance

| File | Endpoints |
|---|---|
| [routes/auth.ts](../servio-api/src/routes/auth.ts) | `POST /auth/request-code`, `/auth/verify-code`, `/auth/sign-out` |
| [routes/me.ts](../servio-api/src/routes/me.ts) | `GET/PATCH /me`, `/me/upgrade-pro`, `/me/pro-trade`, `/me/switch-role`, `/me/payment-methods`, `DELETE /me/services/:skuId` |
| [routes/addresses.ts](../servio-api/src/routes/addresses.ts) | `GET/POST /me/addresses`, `PATCH/DELETE /me/addresses/:id` |
| [routes/catalog.ts](../servio-api/src/routes/catalog.ts) | `GET /catalog` (public, cached 5 min) |
| [routes/bookings.ts](../servio-api/src/routes/bookings.ts) | `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `/contact`, `/status`, `/addons`, `/addons/:q/decision`, `/verify-pin` |
| [routes/booking-social.ts](../servio-api/src/routes/booking-social.ts) | `POST /bookings/:id/review`, `GET/POST /bookings/:id/messages` (chat) |
| [routes/pro.ts](../servio-api/src/routes/pro.ts) | `POST /pro/availability`, `/pro/location`, `/pro/dispatch`, `/offers/:id/accept|decline` |
| [routes/community.ts](../servio-api/src/routes/community.ts) | `GET/POST /bulletin`, `/bulletin/:id`, `/accept`, `/release`, `/cancel`, `GET /pros` |
| [routes/wallet.ts](../servio-api/src/routes/wallet.ts) | `GET /wallet`, `POST /wallet/cashout` |
| [routes/uploads.ts](../servio-api/src/routes/uploads.ts) | `POST /uploads/presign`, `PUT/GET /uploads/blob/:key`, `GET /uploads/:key` |
| [routes/live.ts](../servio-api/src/routes/live.ts) | `POST …/live-ticket`, `GET …/live` (WebSocket upgrade) |
| [routes/notifications.ts](../servio-api/src/routes/notifications.ts) | `GET /notifications`, `POST /notifications/read` |
| [routes/locations.ts](../servio-api/src/routes/locations.ts) | `GET /locations/reverse` |
| [routes/support.ts](../servio-api/src/routes/support.ts) | help reports + admin review |
| [routes/health.ts](../servio-api/src/routes/health.ts) | `GET /health` |
| [routes/demo.ts](../servio-api/src/routes/demo.ts) | `POST /demo/reset-order` (disabled in production) |

### What happens on every request

1. [requestId](../servio-api/src/middleware/request-id.ts) — gives the request an `X-Request-Id` and logs method/path/status/duration.
2. [corsMiddleware](../servio-api/src/middleware/cors.ts) — only allows origins in `ALLOWED_ORIGINS` (e.g. `capacitor://localhost`).
3. [notifyLive](../servio-api/src/live/notify.ts#L20) — wraps every `/api/v1` call; **after** a successful `POST` it pushes realtime events (see §4).
4. Per-route: [withDb](../servio-api/src/middleware/db.ts) opens a Postgres connection → [requireUser](../servio-api/src/middleware/auth.ts#L40) checks the Bearer token → optional [requirePro](../servio-api/src/middleware/pro.ts).
5. Errors are thrown as `ApiError` and turned into `{ error: { code, message, requestId } }` by [errorHandler](../servio-api/src/middleware/error.ts).

### How the app calls it

| Piece | Job | Where |
|---|---|---|
| `ApiService` | Builds `apiUrl + path`, does GET/POST/PATCH, uploads photos | [api.service.ts:14](../servio-app/src/app/core/api/api.service.ts#L14) |
| `apiInterceptor` | Adds `Authorization: Bearer …` + `X-Request-Id`, shows error toast, clears session on 401 | [api.interceptor.ts:13](../servio-app/src/app/core/api/api.interceptor.ts#L13) |
| `SessionService` | Stores the token in Capacitor Preferences | [session.service.ts](../servio-app/src/app/core/api/session.service.ts) |
| `ApiSettingsService` | Which API URL to use, and whether mock/offline mode is on | [api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts) |
| Environments | Dev → `http://localhost:8787/api/v1`; Prod → `https://servio-api.mcleinonza0531.workers.dev/api/v1` | [environment.ts](../servio-app/src/environments/environment.ts), [environment.prod.ts](../servio-app/src/environments/environment.prod.ts) |

---
## 2. Booking lifecycle (the core flow)

```
PENDING_ACCEPTANCE ──(Pro accepts offer)──▶ ACCEPTED ──▶ EN_ROUTE ──▶ ARRIVED ──▶ IN_PROGRESS ──(PIN)──▶ COMPLETED
        │                                      │            │           │             │
        └──────────── CANCELLED ◀──────────────┴────────────┴───────────┘   (customer can't cancel here → dispute)
```
If the customer picked a specific Pro (`proId`) the booking starts directly at `ACCEPTED`.

| Step | Who | App call site | Backend handler |
|---|---|---|---|
| Book | Customer | [checkout.page.ts:112](../servio-app/src/app/pages/checkout/checkout.page.ts#L112) → [order.service.ts:173](../servio-app/src/app/core/services/order.service.ts#L173) | `POST /bookings` [bookings.ts:42-115](../servio-api/src/routes/bookings.ts#L42-L115) |
| Get offer | Pro | [pro.service.ts:55](../servio-app/src/app/core/services/pro.service.ts#L55) | `POST /pro/dispatch` [pro.ts:43](../servio-api/src/routes/pro.ts#L43) |
| Accept / decline | Pro | [radar-alert.page.ts:78](../servio-app/src/app/pages/pro/radar-alert/radar-alert.page.ts#L78) → [pro.service.ts:96](../servio-app/src/app/core/services/pro.service.ts#L96) | `POST /offers/:id/accept` [pro.ts:56-84](../servio-api/src/routes/pro.ts#L56-L84) |
| On the way / Arrived / Start | Pro | [job-execute.page.ts:58](../servio-app/src/app/pages/pro/job-execute/job-execute.page.ts#L58) → [order.service.ts:325](../servio-app/src/app/core/services/order.service.ts#L325) | `POST /bookings/:id/status` [bookings.ts:170-229](../servio-api/src/routes/bookings.ts#L170-L229) |
| Request add-on | Pro | [order.service.ts:329](../servio-app/src/app/core/services/order.service.ts#L329) | `POST /bookings/:id/addons` [bookings.ts:238](../servio-api/src/routes/bookings.ts#L238) |
| Approve add-on | Customer | [order.service.ts:219](../servio-app/src/app/core/services/order.service.ts#L219) | `POST /bookings/:id/addons/:q/decision` [bookings.ts:256](../servio-api/src/routes/bookings.ts#L256) |
| Complete (PIN) | Pro types customer's PIN | [verify-otp.page.ts:47](../servio-app/src/app/pages/pro/verify-otp/verify-otp.page.ts#L47) → [order.service.ts:335](../servio-app/src/app/core/services/order.service.ts#L335) | `POST /bookings/:id/verify-pin` [bookings.ts:283-320](../servio-api/src/routes/bookings.ts#L283-L320) |
| Cancel | Either | [tracking.page.ts:96](../servio-app/src/app/pages/tracking/tracking.page.ts#L96) → [order.service.ts:343](../servio-app/src/app/core/services/order.service.ts#L343) | `POST /bookings/:id/status {to:'CANCELLED'}` [bookings.ts:183-210](../servio-api/src/routes/bookings.ts#L183-L210) |
| Review + tip | Customer | [order.service.ts:370](../servio-app/src/app/core/services/order.service.ts#L370) | `POST /bookings/:id/review` [booking-social.ts:18-49](../servio-api/src/routes/booking-social.ts#L18-L49) |

### What `POST /bookings` does, in order (one DB transaction)
1. Validates body (SKU, address, lat/lng, ASAP vs scheduled window, GCASH/CARD).
2. **Idempotency:** if the app sends the same `Idempotency-Key`, it returns the existing booking instead of creating a duplicate (advisory lock + `requestHash`). Prevents double-booking on double-tap or retry.
3. If booking from a bulletin request, checks the customer owns it and the same Pro accepted it.
4. Checks SKU is active; if a Pro was chosen, checks they're `PRO`, KYC `APPROVED`, and offer that SKU; blocks self-booking.
5. Inserts the booking (`status` = `ACCEPTED` if Pro chosen, else `PENDING_ACCEPTANCE`; `escrow` = `HOLD_AUTHORIZED`).
6. Calls `mockPayments.authorizeHold`, writes a `booking_events` row, a system chat message, and two **ledger entries** (customer −total, escrow +total).

### Status rules ([bookings.ts:165-167](../servio-api/src/routes/bookings.ts#L165-L167))
- Only the **assigned Pro** can move forward, and only one step: `ACCEPTED→EN_ROUTE→ARRIVED→IN_PROGRESS`.
- On `EN_ROUTE`, the server computes the ETA from the Pro's last GPS (if < 120 s old) using haversine × 1.3 road factor ÷ 20 km/h, clamped 15–60 min ([cities.ts:36](../servio-api/src/config/cities.ts#L36)), plus a no-show deadline (+30 min).
- `COMPLETED` can only be reached through `/verify-pin`.

## 3. Cancellation & money (escrow)

### Cancellation fees ([bookings.ts:183-210](../servio-api/src/routes/bookings.ts#L183-L210), [cities.ts:2](../servio-api/src/config/cities.ts#L2))

| Who cancels | When | Fee to Pro | Refund to customer |
|---|---|---|---|
| Customer | PENDING / ACCEPTED | ₱0 | full |
| Customer | EN_ROUTE | ₱100 trip fee | rest |
| Customer | EN_ROUTE but Pro is past the no-show deadline | ₱0 (`NO_SHOW`) | full |
| Customer | ARRIVED | ₱200 visit fee | rest |
| Customer | IN_PROGRESS | **blocked** → `DISPUTE_REQUIRED` | — |
| Pro | any active stage | ₱0 | full, and Pro gets a `cancellationStrikes +1` |
| System | no Pro accepted (5 tries or 5 min with none) | ₱0 | full ([demo-dispatch.ts:44-57](../servio-api/src/dispatch/demo-dispatch.ts#L44-L57)) |

A reason is required. The escrow balance is recomputed from the ledger before refunding; if it looks wrong → `409 ESCROW_INVALID`.

### The ledger (double-entry)
Every money movement inserts rows into `ledger_entries` with one shared `txnId`; the amounts in a transaction sum to zero. Balances are never stored — they are `SUM(amount_centavos)` per account.

| Account | Meaning |
|---|---|
| `customer:<id>` | what the customer paid/got back |
| `escrow:<bookingId>` | money held for that job |
| `pro_wallet:<id>` | Pro earnings (the wallet balance) |
| `platform_revenue` | SERVIO commission + trust fee + cashout fees |
| `payout_clearing` | money sent out to GCash on cashout |

On completion ([bookings.ts:298-310](../servio-api/src/routes/bookings.ts#L298-L310)): escrow −total → Pro gets 85% of (service + approved add-ons) → platform gets 15% + ₱50 trust fee. Split math: [money.ts:11](../servio-api/src/lib/money.ts#L11).

### Completion PIN ([completion-pin.ts](../servio-api/src/lib/completion-pin.ts))
- 4 digits = `HMAC-SHA256(PIN_SECRET, bookingId)` → never stored, recomputed when needed.
- Only the **customer** sees it (added to the booking response only when `userId === customerId`, [lib/bookings.ts:32](../servio-api/src/lib/bookings.ts#L32)).
- Pro has 5 tries, then `423 PIN_LOCKED`. Comparison is timing-safe.

### Wallet ([wallet.ts](../servio-api/src/routes/wallet.ts))
- `GET /wallet`: available balance, today's earnings (PH time), "pending escrow" for active jobs, paginated ledger.
- `POST /wallet/cashout`: min ₱500, ₱15 fee, GCash `09xxxxxxxxx`. Locks the wallet, checks balance, writes ledger, creates payout — **immediately marked `PAID` (mock)**.

---
## 4. Dispatch — how a Pro gets matched

**Online/offline toggle:** [pro.service.ts:75](../servio-app/src/app/core/services/pro.service.ts#L75) grabs phone GPS → `POST /pro/availability {online, lat, lng}` ([pro.ts:19](../servio-api/src/routes/pro.ts#L19)). Only KYC-`APPROVED` Pros can go online. While online, the phone refreshes its position every 30 s via `POST /pro/location` ([tracking.service.ts:154-157](../servio-app/src/app/core/services/tracking.service.ts#L154-L157)).

**Matching** — [advanceDispatch](../servio-api/src/dispatch/demo-dispatch.ts#L16-L58):
1. Skip if a live offer (60 s) is still pending.
2. Find the **nearest** eligible Pro with SQL ([demo-dispatch.ts:25-37](../servio-api/src/dispatch/demo-dispatch.ts#L25-L37)): role PRO, active, KYC approved, online, offers this SKU, not the customer, GPS fresher than 120 s, not already offered this booking, not holding another pending offer. Sort by distance → rating.
3. Create a `dispatch_offers` row that expires in 60 s.
4. Up to 5 Pros are tried one at a time. If none accept (or none found for 5 min) → auto-cancel + full refund.

**Who runs it?** `dispatchTick` runs whenever any Pro calls `POST /pro/dispatch` ([pro.ts:43-54](../servio-api/src/routes/pro.ts#L43-L54)). The app calls it every 15 s and immediately when the Pro's live socket says `dispatch` ([pro.service.ts:38-53](../servio-app/src/app/core/services/pro.service.ts#L38-L53)). A new offer sends the Pro to the radar screen with sound + haptics ([dispatch-alert.service.ts](../servio-app/src/app/core/services/dispatch-alert.service.ts)).

**Accept** ([pro.ts:56-84](../servio-api/src/routes/pro.ts#L56-L84)) locks the Pro and booking, rechecks it's still pending & unexpired, sets `proId` + `ACCEPTED`. Decline/expired → `advanceDispatch` offers the next Pro.

## 5. Realtime ("online" live updates)

### Rooms
One `OrderRoom` Durable Object per resource name:

| Room | Who joins | Receives |
|---|---|---|
| `booking:<id>` | customer + assigned Pro | status changes, add-ons, chat messages, **live GPS** |
| `user:<id>` | that user | "something about your bookings changed", new notification |
| `pro:<id>` | that Pro | "new dispatch offer" |

### Connecting securely (two steps)
1. App: `POST /bookings/:id/live-ticket` (or `/me/…`, `/pro/…`) with the Bearer token → server returns a **60-second HMAC-signed ticket** ([tickets.ts:13](../servio-api/src/live/tickets.ts#L13), [routes/live.ts:16-28](../servio-api/src/routes/live.ts#L16-L28)).
2. App opens `wss://…/live?token=…` → Worker forwards to the room → room verifies signature, session not revoked, user is a participant, ticket not reused, ≤ 8 sockets per user ([order-room.ts:22-66](../servio-api/src/live/order-room.ts#L22-L66)). Sends `{type:'connected', serverNow}`.

Why a ticket? Browsers can't put an `Authorization` header on a WebSocket, so the token would end up in the URL; a short one-time ticket is safer.

### How events get pushed
[notifyLive](../servio-api/src/live/notify.ts#L20-L105) runs **after** every successful POST (in `waitUntil`, so the HTTP response isn't delayed). It looks at the path (`/bookings/:id/status`, `/messages`, `/offers/:id/accept`, `/bulletin/:id/accept`…), then `POST`s `http://order-room/notify` on the right rooms, which broadcasts to all sockets ([order-room.ts:96-105](../servio-api/src/live/order-room.ts#L96-L105)). It also writes inbox notifications ([notices.ts](../servio-api/src/live/notices.ts)).

Events are **hints**, not data: the app reacts by re-fetching the booking with a normal GET ([order.service.ts:118-146](../servio-app/src/app/core/services/order.service.ts#L118-L146)). This keeps the DB the single source of truth.

### Client side — [live.service.ts](../servio-app/src/app/core/services/live.service.ts)
- `watch(resource)` shares one socket per room ([live.service.ts:35](../servio-app/src/app/core/services/live.service.ts#L35)).
- Ping every 10 s; no message for 25 s → reconnect. Ticket renewed every 4.5 min.
- Reconnect with backoff 1 s → 2 s → … → max 10 s; also on app resume and when the phone regains internet.
- **Fallback polling:** if the socket is down, `OrderService` re-fetches bookings every 5 s; when up, every 30 s ([order.service.ts:158-169](../servio-app/src/app/core/services/order.service.ts#L158-L169)).

## 6. Live GPS tracking & maps

| Part | How | Where |
|---|---|---|
| Pro phone GPS | `Geolocation.watchPosition` every ~1 s while app in foreground and Pro online / en route | [tracking.service.ts:148](../servio-app/src/app/core/services/tracking.service.ts#L148) |
| Send GPS | Sent **over the booking WebSocket** (not HTTP), max 1/s | [tracking.service.ts:229](../servio-app/src/app/core/services/tracking.service.ts#L229), [live.service.ts:42](../servio-app/src/app/core/services/live.service.ts#L42) |
| Server check | Only the assigned Pro while `EN_ROUTE`; timestamp within 2 min; ≥ 750 ms apart; simulated GPS only for demo bookings outside production | [order-room.ts:71-95](../servio-api/src/live/order-room.ts#L71-L95) |
| Server stores | Last fix in room storage (new joiners get it instantly) + `pro_profiles.last_lat/lng` (max every 15 s) | same |
| Customer map | Leaflet + OpenStreetMap tiles, rider marker animated every frame | [tracking-map.component.ts](../servio-app/src/app/shared/components/tracking-map/tracking-map.component.ts), [map-tiles.ts](../servio-app/src/app/shared/utils/map-tiles.ts) |
| Road route | OSRM public router (`router.project-osrm.org`) — **only in non-production builds** | [tracking.service.ts:218-228](../servio-app/src/app/core/services/tracking.service.ts#L218-L228) |
| "Reconnecting…" | Shown when no fix for 20 s | [tracking.service.ts:74](../servio-app/src/app/core/services/tracking.service.ts#L74) |
| Address pin → address | Tap/drag pin → wait 350 ms → `GET /locations/reverse` | [addresses.page.ts:90-113](../servio-app/src/app/pages/addresses/addresses.page.ts#L90-L113) |
| Reverse geocoding | One global `Geocoder` Durable Object calls Nominatim, ≤ 1 request / 1.1 s (OSM policy), caches 7 days | [geocoder.ts:28-63](../servio-api/src/locations/geocoder.ts#L28-L63), [locations.ts](../servio-api/src/routes/locations.ts) |
| Nearby Pros / requests | SQL haversine distance; Pro distance only if GPS < 15 min old; "Nearby" bulletin = < 3 km | [community.ts:26-31](../servio-api/src/routes/community.ts#L26-L31), [community.ts:66-116](../servio-api/src/routes/community.ts#L66-L116) |

## 7. Chat, calls, notifications

**Chat** — messages are rows in `messages` tied to a booking.
- Send: `POST /bookings/:id/messages` with `body` and/or `photoKey` ([booking-social.ts:66-82](../servio-api/src/routes/booking-social.ts#L66-L82)). Closed after COMPLETED/CANCELLED. Only participants.
- Read: `GET /bookings/:id/messages?after=<lastId>` (cursor) ([booking-social.ts:51-64](../servio-api/src/routes/booking-social.ts#L51-L64)).
- Realtime: `notifyLive` broadcasts `{type:'message'}` to `booking:<id>`; chat page re-fetches ([order-chat.page.ts:76-95](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L76-L95)). Send: [order-chat.page.ts:133](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L133); photo: [order-chat.page.ts:149](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L149).
- System messages ("Booking status: en route") are inserted by the server with `senderId = null`.

**Calls** — not VoIP. `GET /bookings/:id/contact` returns the other person's phone number only during an active assigned booking ([bookings.ts:124-135](../servio-api/src/routes/bookings.ts#L124-L135)); the app opens `tel:` ([booking-call.service.ts](../servio-app/src/app/core/services/booking-call.service.ts)).

**Notifications** — server inbox, not remote push.
- Rules for who gets what: [notices.ts](../servio-api/src/live/notices.ts). Saved in `notifications` table, then `user:<id>` room is pinged ([notify.ts:14-18](../servio-api/src/live/notify.ts#L14-L18)).
- Bell + list: `GET /notifications`, `POST /notifications/read` ([routes/notifications.ts](../servio-api/src/routes/notifications.ts)); app: [notification.service.ts](../servio-app/src/app/core/services/notification.service.ts).
- If the app is in the background (but still alive) it shows a **local** phone notification. No Firebase/APNs, so nothing arrives when the app is fully closed.

---
## 8. Login (email code)

1. App [auth.service.ts:81](../servio-app/src/app/core/services/auth.service.ts#L81) → `POST /auth/request-code` ([auth.ts:42-83](../servio-api/src/routes/auth.ts#L42-L83)): rate-limited (10/min per IP and per email, max 5 codes/hour), makes a random 6-digit code, stores only its **SHA-256 hash**, emails it via Gmail SMTP. Valid 10 min. In local dev without SMTP, the code is printed in the API log.
2. App [auth.service.ts:92](../servio-app/src/app/core/services/auth.service.ts#L92) → `POST /auth/verify-code` ([auth.ts:85-134](../servio-api/src/routes/auth.ts#L85-L134)): max 5 wrong tries, code is single-use, creates the user if new (role `CUSTOMER`), returns a session token.
3. Session: random 32-byte token, DB stores only its hash, valid 30 days ([middleware/auth.ts:14-46](../servio-api/src/middleware/auth.ts#L14-L46)). Sign-out sets `revokedAt`.
4. Demo accounts (non-production only) can use a fixed `DEMO_LOGIN_CODE`.

**Roles:** `CUSTOMER`, `PRO`, `ADMIN`. One account can switch between Customer and Pro mode ([me.ts:185-226](../servio-api/src/routes/me.ts#L185-L226)); switching to Customer is blocked while you have an active job and also sets you offline.

## 9. Offline (mock) mode vs online (API) mode

There is a single switch: `ApiSettingsService.useMockApi` ([api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts)).

| | Online / API mode | Offline / mock mode |
|---|---|---|
| Turned on by | default in every build | Demo builds only: "Demo connection" dialog → **Offline demo** ([demo-connection.service.ts](../servio-app/src/app/core/services/demo-connection.service.ts)) |
| Login | real email code | any email, code **`123456`** ([auth.service.ts:10](../servio-app/src/app/core/services/auth.service.ts#L10)); token starts with `mock.` and is never sent to the server |
| Data | from the API / Postgres | hard-coded data in [mock-data.ts](../servio-app/src/app/core/data/mock-data.ts) |
| Booking state | server | saved to `localStorage` (`servio.demo.*`) via [demo-store.ts](../servio-app/src/app/core/services/demo-store.ts) |
| Status changes, PIN, wallet | API endpoints | changed locally in `OrderService` (e.g. [order.service.ts:204](../servio-app/src/app/core/services/order.service.ts#L204), [:234](../servio-app/src/app/core/services/order.service.ts#L234)) |
| Tracking | real GPS over WebSocket | simulated rider on a fixed Tuguegarao route ([tuguegarao-route.ts](../servio-app/src/app/core/data/tuguegarao-route.ts)) |
| Chat | real messages | auto-replies after 1.4 s |
| Bulletin accept/cancel | works | throws "requires an API connection" |

Pattern used everywhere: `if (this.api.settings.useMockApi()) { …local… } else { await this.api.post(…) }` — e.g. [order.service.ts:325-374](../servio-app/src/app/core/services/order.service.ts#L325-L374).

"Offline" here means **demo without a server**; the app does **not** queue actions to sync later. With mock mode off and no internet, requests fail and a toast says "Cannot reach SERVIO".

There's also a **simulated GPS** toggle for demo accounts in API mode (`TrackingService.simulate`): the Pro phone sends fake GPS along the demo route with `simulated: true`, which the server only accepts for demo bookings outside production.

## 10. Bulletin (neighborhood requests)

1. Customer posts: `POST /bulletin` ([community.ts:33](../servio-api/src/routes/community.ts#L33)) → status `OPEN`/`URGENT`.
2. A qualified Pro reserves it: `POST /bulletin/:id/accept` ([community.ts:127](../servio-api/src/routes/community.ts#L127)) → `ACCEPTED`, `acceptedProId` set. No booking/money yet.
3. Customer confirms in checkout: `POST /bookings` with `bulletinId` + that `proId` → creates a normal booking with escrow and links it.
4. Before checkout either side can `release` (back to open), and the author can `cancel`. Once a booking exists, cancellation follows booking rules.

## 11. Uploads (photos, avatars, KYC)

1. App: `POST /uploads/presign {purpose, contentType, contentLength}` → server makes a random key `uploads/<purpose>/YYYY/MM/<uuid>.jpg` and a signed URL valid 15 min ([uploads.ts:52-63](../servio-api/src/routes/uploads.ts#L52-L63)).
2. App `PUT`s the file straight to that URL ([api.service.ts:92-98](../servio-app/src/app/core/api/api.service.ts#L92-L98)) — production goes through the Worker into R2 (`UPLOADS_MODE=worker`).
3. App sends only the key (e.g. `photoKey`) to other endpoints; server checks owner, purpose, and that size/type match ([lib/uploads.ts:15-23](../servio-api/src/lib/uploads.ts#L15-L23)).
4. Viewing: `GET /uploads/:key` checks permission (owner, booking participant, approved Pro avatar…) and returns a 60-second download URL ([uploads.ts:111-148](../servio-api/src/routes/uploads.ts#L111-L148)). KYC files are owner-only.

JPEG/PNG ≤ 5 MB; PDF ≤ 10 MB (KYC only). The app converts/shrinks images first.

## 12. Database tables (quick map) — [schema.ts](../servio-api/src/db/schema.ts)

`users`, `sessions`, `login_codes`, `user_addresses`, `pro_profiles` (KYC, online, last GPS, rating), `categories`, `service_skus`, `addon_skus`, `pro_skus` (which Pro offers what), `bookings`, `booking_events` (status history), `addon_quotes`, `dispatch_offers`, `bulletin_requests`, `messages`, `reviews`, `ledger_entries`, `payouts`, `uploads`, `support_requests`, `notifications`.

Booking codes are `SRV-<sequence>`. All money columns are **integer centavos** with DB `CHECK` constraints.

---
## 13. Audit findings (things to know or fix)

### Strengths
- **Transactions + row locks** around every money/status change (`SELECT … FOR UPDATE`, advisory locks), so double taps and races don't double-charge or double-accept.
- **Idempotent booking creation** and support reports.
- **Double-entry ledger** instead of stored balances, with DB checks.
- **Secrets are hashed** (session tokens, login codes); PIN and live tickets use HMAC; comparisons are timing-safe.
- **Strict input validation** on every route; consistent error shape with request IDs.
- **Participant checks** on every booking read/write (`participantBooking`, [lib/bookings.ts:18](../servio-api/src/lib/bookings.ts#L18)).

### Gaps / risks

| # | Finding | Where | Impact |
|---|---|---|---|
| 1 | **Becoming a Pro skips KYC.** `/me/upgrade-pro` sets `kycStatus: 'APPROVED'` immediately and gives a fake 5.0 rating with 1 review. | [me.ts:86-108](../servio-api/src/routes/me.ts#L86-L108) | Anyone can take jobs with no vetting. Fine for a prototype; must change before real users. |
| 2 | **Payments are fully mocked.** Holds, captures, refunds, tips and cashouts only write ledger rows; cashout is set to `PAID` instantly. | [payments/mock.ts](../servio-api/src/payments/mock.ts), [wallet.ts:81-82](../servio-api/src/routes/wallet.ts#L81-L82) | No real money moves. |
| 3 | **Dispatch only runs when some Pro polls `/pro/dispatch`.** There is no cron trigger. If no Pro app is open, a pending booking is never offered and never auto-cancelled/refunded. | [pro.ts:43-45](../servio-api/src/routes/pro.ts#L43-L45), [wrangler.toml](../servio-api/wrangler.toml) | Customer could wait forever with money on hold. Fix: add a Cron Trigger calling `dispatchTick`. |
| 4 | **No remote push notifications.** Only in-app inbox + local alerts while the app process is alive. | [notification.service.ts](../servio-app/src/app/core/services/notification.service.ts) | Pros miss job offers when the app is closed. |
| 5 | **Road routing is disabled in production builds** and uses the public OSRM demo server in dev. | [tracking.service.ts:204](../servio-app/src/app/core/services/tracking.service.ts#L204) | In production the map shows the live dot without a road path. |
| 6 | **GPS only while the app is in the foreground.** | [tracking.service.ts:145](../servio-app/src/app/core/services/tracking.service.ts#L145) | If the Pro switches apps, tracking pauses ("Reconnecting…"). |
| 7 | **New DB connection on every request** (and separate ones inside `notifyLive` and `OrderRoom`). Hyperdrive pools in production, but local dev opens many connections. | [middleware/db.ts](../servio-api/src/middleware/db.ts) | Extra latency/connection load. |
| 8 | **No service-area limit.** `validateServiceLocation` only checks lat/lng are valid numbers; `radiusKm: null`. | [service-area.ts](../servio-api/src/lib/service-area.ts), [catalog.ts:40](../servio-api/src/routes/catalog.ts#L40) | Bookings can be placed anywhere in the world. |
| 9 | **4-digit PIN** with 5 attempts → 0.05% guess chance; locked bookings need support to unlock, but no unlock endpoint exists. | [bookings.ts:290](../servio-api/src/routes/bookings.ts#L290) | Stuck job if a Pro mistypes 5 times. |
| 10 | **No admin console API** for KYC review, catalog management or disputes; only support-report status. | [support.ts:38-50](../servio-api/src/routes/support.ts#L38-L50) | Admin features in the brief aren't built yet. |
| 11 | Pro-cancel has no fee and only increments `cancellationStrikes`, which nothing reads. | [bookings.ts:207](../servio-api/src/routes/bookings.ts#L207) | No real penalty for Pros cancelling. |

---
## 14. Example questions & answers

### General / architecture

**Q: What is your backend built with?**
A: A Cloudflare Worker written in TypeScript using the Hono framework. Data is in PostgreSQL (Neon, reached through Cloudflare Hyperdrive) via Drizzle ORM. Photos are in Cloudflare R2. Realtime uses Durable Objects with WebSockets. Entry point: [servio-api/src/index.ts](../servio-api/src/index.ts).

**Q: How does the mobile app talk to the backend?**
A: Over HTTPS with JSON. Every call goes through `ApiService` ([api.service.ts](../servio-app/src/app/core/api/api.service.ts)); an interceptor adds `Authorization: Bearer <token>` and a request ID ([api.interceptor.ts](../servio-app/src/app/core/api/api.interceptor.ts)). Live updates use a WebSocket ([live.service.ts](../servio-app/src/app/core/services/live.service.ts)).

**Q: Where are all the API routes registered?**
A: [index.ts:33-50](../servio-api/src/index.ts#L33-L50) mounts every route file under `/api/v1`.

**Q: Why Postgres and not Firebase?**
A: Bookings and money need strict transactions and row locking (two Pros must not accept the same job; money must not be released twice). Postgres gives that; see the `transaction(...)` + `.for('update')` calls in [bookings.ts](../servio-api/src/routes/bookings.ts).

**Q: How do you handle errors?**
A: Routes throw `ApiError(status, code, message)` ([errors.ts](../servio-api/src/lib/errors.ts)); [error.ts](../servio-api/src/middleware/error.ts) turns it into `{ error: { code, message, requestId } }`. The app shows `message` as a toast and signs you out on 401.

### Booking

**Q: What happens when I tap "Book"?**
A: [checkout.page.ts:112](../servio-app/src/app/pages/checkout/checkout.page.ts#L112) calls `OrderService.book()` ([order.service.ts:173](../servio-app/src/app/core/services/order.service.ts#L173)), which sends `POST /bookings` with an `Idempotency-Key`. The server ([bookings.ts:42-115](../servio-api/src/routes/bookings.ts#L42-L115)) validates, creates the booking, places a mock escrow hold, records ledger entries and a system message, then `notifyLive` alerts online Pros.

**Q: What if the user taps Book twice or the network retries?**
A: The same `Idempotency-Key` returns the same booking ([bookings.ts:59-67](../servio-api/src/routes/bookings.ts#L59-L67)). A different body with the same key gets `409 IDEMPOTENCY_CONFLICT`.

**Q: How is a Pro chosen?**
A: If the customer picked one, they're assigned directly. Otherwise [demo-dispatch.ts:16-58](../servio-api/src/dispatch/demo-dispatch.ts#L16-L58) offers the job to the **nearest** online, approved Pro who offers that service and has fresh GPS (< 2 min), one at a time, 60 s each, up to 5 Pros.

**Q: What if no Pro accepts?**
A: After 5 tries (or 5 minutes with no one found) the booking is cancelled with a full refund and the message "No available Pro" ([demo-dispatch.ts:44-57](../servio-api/src/dispatch/demo-dispatch.ts#L44-L57)).

**Q: How does the Pro move the job forward?**
A: Job screen ([job-execute.page.ts:58](../servio-app/src/app/pages/pro/job-execute/job-execute.page.ts#L58)) → `POST /bookings/:id/status` ([bookings.ts:170](../servio-api/src/routes/bookings.ts#L170)). Only the assigned Pro, only one step at a time; a skip gets `409 INVALID_TRANSITION`.

**Q: How do you calculate the ETA?**
A: When the Pro taps "On the way", the server uses the Pro's last GPS: straight-line distance × 1.3 (roads aren't straight) ÷ 20 km/h, kept between 15 and 60 minutes ([cities.ts:36-40](../servio-api/src/config/cities.ts#L36-L40)).

**Q: How do add-ons work?**
A: At ARRIVED/IN_PROGRESS the Pro uploads a photo and picks an add-on from the catalog (`POST /bookings/:id/addons`). The customer approves/declines (`…/decision`); approval adds another escrow hold ([bookings.ts:238-281](../servio-api/src/routes/bookings.ts#L238-L281)). One pending add-on at a time.

**Q: How is the job marked complete?**
A: The customer's app shows a 4-digit PIN; the Pro types it in. `POST /bookings/:id/verify-pin` ([bookings.ts:283-320](../servio-api/src/routes/bookings.ts#L283-L320)) checks it, releases escrow (85% Pro, 15% + ₱50 trust fee platform), sets COMPLETED, and increments the Pro's jobs done.

**Q: Where does the PIN come from? Is it stored?**
A: Not stored. It's `HMAC(PIN_SECRET, bookingId)` cut to 4 digits ([completion-pin.ts](../servio-api/src/lib/completion-pin.ts)), so the server can recompute it. Only the customer's response includes it.

### Cancelling

**Q: How does cancelling work?**
A: Tracking page ([tracking.page.ts:96](../servio-app/src/app/pages/tracking/tracking.page.ts#L96)) asks for a reason → `POST /bookings/:id/status {to:'CANCELLED', reason}` ([bookings.ts:183-210](../servio-api/src/routes/bookings.ts#L183-L210)). Server computes the fee, refunds the rest, writes ledger rows, sets escrow REFUNDED.

**Q: Is there a cancellation fee?**
A: Customer: free before the Pro leaves; ₱100 while en route; ₱200 after arrival; not allowed once work started (must contact support). Free if the Pro is past the no-show deadline. Pro cancelling: customer gets full refund, Pro gets a strike. Amounts: [cities.ts:2](../servio-api/src/config/cities.ts#L2).

**Q: Can I cancel a bulletin request?**
A: Yes, before it becomes a booking: `POST /bulletin/:id/cancel` ([community.ts:163](../servio-api/src/routes/community.ts#L163)). After that, use booking cancellation.

### Realtime, tracking & maps

**Q: How do updates appear without refreshing?**
A: WebSockets. The app joins rooms (`booking:<id>`, `user:<id>`, `pro:<id>`) on an `OrderRoom` Durable Object ([order-room.ts](../servio-api/src/live/order-room.ts)). After any change, [notify.ts](../servio-api/src/live/notify.ts) pings the right rooms; the app then re-fetches the booking ([order.service.ts:118-146](../servio-app/src/app/core/services/order.service.ts#L118-L146)).

**Q: What if the WebSocket disconnects?**
A: [live.service.ts](../servio-app/src/app/core/services/live.service.ts) pings every 10 s, reconnects after 25 s of silence with backoff (max 10 s), and reconnects when the app resumes or internet returns. Meanwhile `OrderService` polls every 5 s.

**Q: How is the WebSocket secured?**
A: The app first gets a 60-second signed, single-use ticket using its login token ([routes/live.ts:16-28](../servio-api/src/routes/live.ts#L16-L28), [tickets.ts](../servio-api/src/live/tickets.ts)). The room checks the signature, the session, and that you're part of that booking ([order-room.ts:58-66](../servio-api/src/live/order-room.ts#L58-L66)).

**Q: How does live tracking work?**
A: The Pro's phone reads GPS about every second ([tracking.service.ts:148](../servio-app/src/app/core/services/tracking.service.ts#L148)) and sends it over the booking WebSocket. The room accepts it only from the assigned Pro while EN_ROUTE, saves the latest point, and broadcasts it ([order-room.ts:71-95](../servio-api/src/live/order-room.ts#L71-L95)). The customer's Leaflet map animates the marker ([tracking-map.component.ts](../servio-app/src/app/shared/components/tracking-map/tracking-map.component.ts)).

**Q: What map do you use? Do you pay for it?**
A: Leaflet with free OpenStreetMap tiles ([map-tiles.ts](../servio-app/src/app/shared/utils/map-tiles.ts)). No API key.

**Q: How does dropping a pin fill in the address?**
A: [addresses.page.ts:90-113](../servio-app/src/app/pages/addresses/addresses.page.ts#L90-L113) → `GET /locations/reverse?lat&lng` → a single `Geocoder` Durable Object asks OpenStreetMap Nominatim, max 1 request per 1.1 s, and caches results for 7 days ([geocoder.ts](../servio-api/src/locations/geocoder.ts)). If busy, `429` and the app retries once.

**Q: How do you find nearby Pros?**
A: `GET /pros?lat&lng` computes distance in SQL with the haversine formula ([community.ts:26-31](../servio-api/src/routes/community.ts#L26-L31)) and sorts nearest first, then by rating. Distance is only shown if the Pro's GPS is less than 15 min old.

**Q: How does the Pro go online/offline?**
A: Toggle → [pro.service.ts:75](../servio-app/src/app/core/services/pro.service.ts#L75) sends `POST /pro/availability` with current GPS ([pro.ts:19-32](../servio-api/src/routes/pro.ts#L19-L32)). Only approved Pros can go online. Switching to customer mode forces offline.

### Chat, calls, notifications

**Q: How does chat work?**
A: Messages are DB rows per booking. Send: `POST /bookings/:id/messages`; read: `GET /bookings/:id/messages?after=` ([booking-social.ts:51-82](../servio-api/src/routes/booking-social.ts#L51-L82)). New messages trigger a WebSocket event so the other side re-fetches ([order-chat.page.ts:76-95](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L76-L95)). Only the customer and Pro can see it; it closes when the job ends.

**Q: Can you send photos in chat?**
A: Yes — upload via `/uploads/presign` then send the `photoKey` ([order-chat.page.ts:149-165](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L149-L165)). Viewing gets a 60-second signed URL.

**Q: How does calling work?**
A: Not in-app voice. During an active job, `GET /bookings/:id/contact` returns the other person's number ([bookings.ts:124-135](../servio-api/src/routes/bookings.ts#L124-L135)) and the phone dialer opens.

**Q: Do you have push notifications?**
A: Partly. There's a server inbox with a bell + unread dot ([routes/notifications.ts](../servio-api/src/routes/notifications.ts)), and local phone alerts while the app is open/backgrounded ([notification.service.ts](../servio-app/src/app/core/services/notification.service.ts)). No Firebase remote push yet, so a fully closed app gets nothing.

### Offline / online mode

**Q: What is offline mode?**
A: A demo mode with no server. Toggle in the demo-only "Demo connection" dialog ([demo-connection.service.ts](../servio-app/src/app/core/services/demo-connection.service.ts)). Login code `123456`, sample data from [mock-data.ts](../servio-app/src/app/core/data/mock-data.ts), state saved in `localStorage`, simulated tracking. Each service checks `useMockApi()` and does the action locally instead of calling the API.

**Q: Does the app work without internet in real mode?**
A: No. It doesn't queue actions offline; requests fail with "Cannot reach SERVIO". The live socket and polling resume automatically when internet returns.

**Q: How do you demo on a real phone with a local server?**
A: In a demo build, open "Demo connection" and enter the Mac's Wi-Fi IP, e.g. `http://192.168.1.10:8787/api/v1` (`10.0.2.2` for Android emulator) ([api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts)).

### Money & security

**Q: Is the payment real?**
A: No — it's a mock provider ([payments/mock.ts](../servio-api/src/payments/mock.ts)) behind a `PaymentProvider` interface ([provider.ts](../servio-api/src/payments/provider.ts)), so PayMongo/GCash can replace it later without changing the booking logic.

**Q: How do you keep money accurate?**
A: All amounts are integer centavos; every movement is a double-entry ledger transaction that sums to zero; balances are computed with `SUM()`; DB constraints block bad values ([schema.ts:381-398](../servio-api/src/db/schema.ts#L381-L398)).

**Q: How does a Pro withdraw?**
A: `POST /wallet/cashout` — minimum ₱500, ₱15 fee, to a GCash number. Balance is checked under a lock ([wallet.ts:63-86](../servio-api/src/routes/wallet.ts#L63-L86)). Simulated, marked PAID right away.

**Q: How do you stop someone from seeing other people's bookings?**
A: Every booking route uses `participantBooking()` ([lib/bookings.ts:18-23](../servio-api/src/lib/bookings.ts#L18-L23)), which only finds the booking if you're its customer or Pro; otherwise `404`.

**Q: How are passwords handled?**
A: There are no passwords. Login is a one-time email code (hashed, 10 min, 5 tries, rate-limited). The session token is stored only as a hash ([middleware/auth.ts](../servio-api/src/middleware/auth.ts)).

**Q: Are Pros verified?**
A: The data model supports KYC (`kycStatus`, KYC file uploads), and only `APPROVED` Pros can get jobs. But in this prototype, `/me/upgrade-pro` approves automatically ([me.ts:86-108](../servio-api/src/routes/me.ts#L86-L108)) — admin review is future work.

**Q: How do you check the server is up?**
A: `GET /api/v1/health` runs `select 1` and returns `ok` or `degraded` with DB latency ([health.ts](../servio-api/src/routes/health.ts)).
