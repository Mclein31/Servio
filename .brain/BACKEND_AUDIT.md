# SERVIO Backend Cheat Sheet (plain-English version)

> **Written:** 2026-10-21 · **Simplified:** 2026-10-22 · **Covers:** `servio-api/` (the server) and the parts of `servio-app/` (the phone app) that talk to it.
> Links open the real code. Each section starts with a plain explanation, then the details.

---

## 0. Words you'll hear (glossary)

| Word | Plain meaning |
|---|---|
| **Backend / server / API** | The program on the internet that the app asks for data ("give me my bookings", "create a booking"). |
| **Frontend / app** | What the user sees and taps on the phone. |
| **Endpoint / route** | One "door" on the server, like `POST /bookings`. Each one does one job. |
| **GET / POST / PATCH / DELETE** | The type of request: read / create or do something / edit / remove. |
| **JSON** | The text format the app and server use to send data: `{ "name": "Ana" }`. |
| **Database (Postgres)** | Where everything is saved permanently: users, bookings, money, messages. Think of a big set of Excel sheets (tables). |
| **Table / row** | A sheet / one line in that sheet (one booking = one row in `bookings`). |
| **Transaction** | A group of DB changes that either **all** happen or **none** happen. No half-finished money moves. |
| **Lock (`FOR UPDATE`)** | "I'm using this row, wait your turn." Stops two people changing the same thing at once. |
| **Token** | A long random string the app gets after login. It's like a wristband at an event: show it and you're let in. |
| **Hash** | A one-way scramble. You can check if something matches, but you can't un-scramble it. Used so stolen data is useless. |
| **HMAC** | A hash mixed with a secret key only the server knows, so nobody else can make a valid one. |
| **WebSocket** | A phone line that stays open between app and server so the server can push updates instantly. Normal requests are more like sending letters. |
| **Cloudflare Worker** | Our server code, run by Cloudflare on their computers worldwide. We don't manage any machine. |
| **Durable Object** | A tiny always-the-same mini-server on Cloudflare. We use them as "chat rooms" for live updates. |
| **R2** | Cloudflare's file storage (like Google Drive for the app's photos). |
| **Mock** | Fake version used for testing/demos (e.g. fake payments). |
| **Centavos** | We store ₱150.50 as `15050` so math never has decimal mistakes. |

---

## 1. The big picture

**In one sentence:** the phone app sends requests over the internet to our server on Cloudflare; the server checks them, reads/writes the database, and sends back an answer. For live things (tracking, chat), the app also keeps a WebSocket open so the server can push updates.

```
 PHONE APP (Ionic/Angular)                       CLOUDFLARE (our server)
 ─────────────────────────                       ─────────────────────────────────────────
   normal requests (HTTPS + JSON) ───────────▶   Worker "servio-api"  ──▶ Postgres database (Neon)
                                                       │              ──▶ R2 (photos, documents)
   live connection (WebSocket)    ◀──────────▶   OrderRoom "rooms" (one per booking / user / Pro)
   "what address is this pin?"    ───────────▶   Geocoder ──▶ OpenStreetMap (free address lookup)
```

| Part | Plain meaning | Code |
|---|---|---|
| Runtime | Where the server runs: Cloudflare Workers. | [wrangler.toml](../servio-api/wrangler.toml) |
| Router (Hono) | The receptionist: looks at the URL and sends it to the right code. | [src/index.ts:26-50](../servio-api/src/index.ts#L26-L50) |
| Validation (Valibot) | The bouncer: rejects bad input (missing fields, wrong types) with `422`. | [src/lib/validation.ts](../servio-api/src/lib/validation.ts) |
| Database (Drizzle + Postgres) | Saves everything. Drizzle lets us write queries in TypeScript. | [src/db/schema.ts](../servio-api/src/db/schema.ts) |
| Migrations | Step-by-step instructions to build/change the DB tables (0000 → 0011). | [servio-api/drizzle/](../servio-api/drizzle/) |
| Realtime | `OrderRoom` keeps the live connections. | [src/live/order-room.ts](../servio-api/src/live/order-room.ts) |
| Files | Photos go to R2. | [src/routes/uploads.ts](../servio-api/src/routes/uploads.ts) |
| Email | Sends login codes through Gmail (see §8). | [src/lib/mailer.ts](../servio-api/src/lib/mailer.ts) |
| Payments | **Fake (mock)** — no real money moves yet. | [src/payments/mock.ts](../servio-api/src/payments/mock.ts) |
| Money math | Pro gets 85%. | [src/lib/money.ts](../servio-api/src/lib/money.ts) |
| City settings | Tuguegarao center, speed for ETA, cancellation fees. | [src/config/cities.ts](../servio-api/src/config/cities.ts) |

### All the "doors" (route files)

| File | What it handles |
|---|---|
| [routes/auth.ts](../servio-api/src/routes/auth.ts) | Login with email code, sign out |
| [routes/me.ts](../servio-api/src/routes/me.ts) | My profile, become a Pro, switch Customer/Pro, payment methods |
| [routes/addresses.ts](../servio-api/src/routes/addresses.ts) | My saved addresses |
| [routes/catalog.ts](../servio-api/src/routes/catalog.ts) | List of services and prices (public) |
| [routes/bookings.ts](../servio-api/src/routes/bookings.ts) | Create a booking, see bookings, change status, add-ons, finish with PIN, cancel |
| [routes/booking-social.ts](../servio-api/src/routes/booking-social.ts) | Reviews + tips, chat messages |
| [routes/pro.ts](../servio-api/src/routes/pro.ts) | Pro online/offline, location, job offers (accept/decline) |
| [routes/community.ts](../servio-api/src/routes/community.ts) | Bulletin board posts, list of nearby Pros |
| [routes/wallet.ts](../servio-api/src/routes/wallet.ts) | Pro wallet balance, cash out |
| [routes/uploads.ts](../servio-api/src/routes/uploads.ts) | Photo/document uploads |
| [routes/live.ts](../servio-api/src/routes/live.ts) | Opening a live (WebSocket) connection |
| [routes/notifications.ts](../servio-api/src/routes/notifications.ts) | Notification inbox |
| [routes/locations.ts](../servio-api/src/routes/locations.ts) | Map pin → street address |
| [routes/support.ts](../servio-api/src/routes/support.ts) | Help/report a problem |
| [routes/health.ts](../servio-api/src/routes/health.ts) | "Is the server OK?" check |
| [routes/demo.ts](../servio-api/src/routes/demo.ts) | Reset a demo order (turned off in production) |

### What happens to every request (like an airport check)

1. **Tag it** — [requestId](../servio-api/src/middleware/request-id.ts) gives it an ID number and logs how long it took. If something breaks, we search the logs by this ID.
2. **Check where it's from** — [cors](../servio-api/src/middleware/cors.ts) only allows our app (e.g. `capacitor://localhost`).
3. **Open the database** — [withDb](../servio-api/src/middleware/db.ts).
4. **Check the wristband** — [requireUser](../servio-api/src/middleware/auth.ts#L40) checks the login token. Pro-only doors also run [requirePro](../servio-api/src/middleware/pro.ts).
5. **Do the work** in the route.
6. **If anything fails**, [errorHandler](../servio-api/src/middleware/error.ts) sends a clean error: `{ error: { code, message, requestId } }`.
7. **After success**, [notifyLive](../servio-api/src/live/notify.ts#L20) tells the right live rooms "something changed" (§5).

### How the app side calls the server

| Piece | Plain meaning | Code |
|---|---|---|
| `ApiService` | The app's "messenger": builds the URL and sends the request. | [api.service.ts:14](../servio-app/src/app/core/api/api.service.ts#L14) |
| `apiInterceptor` | Automatically attaches the login token to every request; shows an error popup; logs you out if the token is rejected (401). | [api.interceptor.ts:13](../servio-app/src/app/core/api/api.interceptor.ts#L13) |
| `SessionService` | Saves the token on the phone so you stay logged in. | [session.service.ts](../servio-app/src/app/core/api/session.service.ts) |
| `ApiSettingsService` | Which server to use, and demo (mock) mode on/off. | [api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts) |
| Server address | Dev: `http://localhost:8787/api/v1` · Live: `https://servio-api.mcleinonza0531.workers.dev/api/v1` | [environment.ts](../servio-app/src/environments/environment.ts), [environment.prod.ts](../servio-app/src/environments/environment.prod.ts) |

---
## 2. Booking lifecycle (the main flow)

**In plain words:** a booking moves through steps like a delivery order on Grab/Foodpanda. Only the Pro can move it forward, one step at a time. It only finishes when the Pro types the customer's secret PIN.

```
WAITING FOR PRO ──(Pro accepts)──▶ ACCEPTED ──▶ ON THE WAY ──▶ ARRIVED ──▶ WORKING ──(PIN)──▶ DONE
 (PENDING_ACCEPTANCE)                           (EN_ROUTE)                (IN_PROGRESS)    (COMPLETED)
        │                              │             │            │             │
        └────────── CANCELLED ◀────────┴─────────────┴────────────┘   (can't cancel while working → contact support)
```
If the customer picked a specific Pro, it skips "waiting" and starts at ACCEPTED.

| Step | Who | App code | Server code |
|---|---|---|---|
| Book | Customer | [checkout.page.ts:112](../servio-app/src/app/pages/checkout/checkout.page.ts#L112) → [order.service.ts:173](../servio-app/src/app/core/services/order.service.ts#L173) | `POST /bookings` [bookings.ts:42-115](../servio-api/src/routes/bookings.ts#L42-L115) |
| Get a job offer | Pro | [pro.service.ts:55](../servio-app/src/app/core/services/pro.service.ts#L55) | `POST /pro/dispatch` [pro.ts:43](../servio-api/src/routes/pro.ts#L43) |
| Accept / decline | Pro | [radar-alert.page.ts:78](../servio-app/src/app/pages/pro/radar-alert/radar-alert.page.ts#L78) → [pro.service.ts:96](../servio-app/src/app/core/services/pro.service.ts#L96) | `POST /offers/:id/accept` [pro.ts:56-84](../servio-api/src/routes/pro.ts#L56-L84) |
| On the way / Arrived / Start | Pro | [job-execute.page.ts:58](../servio-app/src/app/pages/pro/job-execute/job-execute.page.ts#L58) → [order.service.ts:325](../servio-app/src/app/core/services/order.service.ts#L325) | `POST /bookings/:id/status` [bookings.ts:170-229](../servio-api/src/routes/bookings.ts#L170-L229) |
| Ask for an add-on | Pro | [order.service.ts:329](../servio-app/src/app/core/services/order.service.ts#L329) | `POST /bookings/:id/addons` [bookings.ts:238](../servio-api/src/routes/bookings.ts#L238) |
| Approve add-on | Customer | [order.service.ts:219](../servio-app/src/app/core/services/order.service.ts#L219) | `POST …/addons/:q/decision` [bookings.ts:256](../servio-api/src/routes/bookings.ts#L256) |
| Finish (PIN) | Pro types the customer's PIN | [verify-otp.page.ts:47](../servio-app/src/app/pages/pro/verify-otp/verify-otp.page.ts#L47) → [order.service.ts:335](../servio-app/src/app/core/services/order.service.ts#L335) | `POST /bookings/:id/verify-pin` [bookings.ts:283-320](../servio-api/src/routes/bookings.ts#L283-L320) |
| Cancel | Either | [tracking.page.ts:96](../servio-app/src/app/pages/tracking/tracking.page.ts#L96) → [order.service.ts:343](../servio-app/src/app/core/services/order.service.ts#L343) | `POST /bookings/:id/status {to:'CANCELLED'}` [bookings.ts:183-210](../servio-api/src/routes/bookings.ts#L183-L210) |
| Review + tip | Customer | [order.service.ts:370](../servio-app/src/app/core/services/order.service.ts#L370) | `POST /bookings/:id/review` [booking-social.ts:18-49](../servio-api/src/routes/booking-social.ts#L18-L49) |

### What the server does when you tap "Book" (all-or-nothing)
1. **Checks the form** — service, address, location, ASAP or scheduled, GCash or card.
2. **Stops duplicates** — the app sends a unique "Idempotency-Key" with each booking attempt. If the same key comes twice (double-tap, bad signal retry), the server returns the first booking instead of making a second one.
3. **Bulletin check** — if it came from a bulletin post, makes sure it's your post and the same Pro.
4. **Pro check** — if you picked a Pro: they must be an approved Pro, offer that service, and not be you.
5. **Saves the booking** — status ACCEPTED (Pro picked) or waiting.
6. **Holds the money** (fake for now) and writes it in the money log (ledger, §3), plus a history entry and a system chat message.

If any step fails, **nothing** is saved (that's what a transaction means).

### Status rules ([bookings.ts:165-167](../servio-api/src/routes/bookings.ts#L165-L167))
- Only the **assigned Pro** moves it forward, one step only. Skipping → `409 INVALID_TRANSITION`.
- When the Pro taps **On the way**, the server guesses the arrival time (ETA): straight-line distance × 1.3 (roads curve) ÷ 20 km/h, kept between 15 and 60 min ([cities.ts:36](../servio-api/src/config/cities.ts#L36)). It also sets a "late" deadline 30 min after that.
- **DONE** can only happen through the PIN.

---
## 3. Money: escrow, fees, ledger, wallet

**In plain words:** when you book, the money is **held** (not given to the Pro yet) — that's "escrow", like a middleman holding the payment. When the job is done (PIN), the held money is split: 85% to the Pro, 15% + ₱50 to SERVIO. If cancelled, you get a refund minus any fee.

### Cancellation fees ([bookings.ts:183-210](../servio-api/src/routes/bookings.ts#L183-L210), [cities.ts:2](../servio-api/src/config/cities.ts#L2))

| Who cancels | When | Pro gets | Customer gets back |
|---|---|---|---|
| Customer | waiting / accepted | ₱0 | everything |
| Customer | Pro is on the way | ₱100 (gas/time) | the rest |
| Customer | Pro is on the way **but late** | ₱0 | everything |
| Customer | Pro has arrived | ₱200 (visit) | the rest |
| Customer | work started | **not allowed** → contact support | — |
| Pro | any time | ₱0 | everything (Pro gets a "strike") |
| System | no Pro accepted (5 tries / 5 min) | ₱0 | everything ([demo-dispatch.ts:44-57](../servio-api/src/dispatch/demo-dispatch.ts#L44-L57)) |

A reason is required. Before refunding, the server re-counts the held money; if it doesn't add up → `409 ESCROW_INVALID` (safety stop).

### The ledger (money log)
Think of a bank passbook where **every peso moved is written twice**: once where it left, once where it went. Each move's lines add up to **zero**, so money can't appear or disappear. We never save a "balance" number; we add up the log each time (`SUM`).

| Account | Plain meaning |
|---|---|
| `customer:<id>` | what the customer paid / got back |
| `escrow:<bookingId>` | the money being held for that job |
| `pro_wallet:<id>` | the Pro's earnings |
| `platform_revenue` | SERVIO's cut + fees |
| `payout_clearing` | money sent out when a Pro cashes out |

**Example (₱1,000 service):** customer pays ₱1,000 + ₱50 trust fee = ₱1,050. Book → customer −1050, escrow +1050. Done → escrow −1050, Pro wallet +850 (85%), SERVIO +200 (15% = ₱150, plus the ₱50 fee). Each line adds up to zero. Split math: [money.ts:11](../servio-api/src/lib/money.ts#L11), release: [bookings.ts:298-310](../servio-api/src/routes/bookings.ts#L298-L310).

### Completion PIN ([completion-pin.ts](../servio-api/src/lib/completion-pin.ts))
- A 4-digit code made from the booking ID + a server secret. It is **not saved anywhere**; the server can re-create it any time.
- Only the **customer** sees it ([lib/bookings.ts:32](../servio-api/src/lib/bookings.ts#L32)). The Pro must get it from the customer in person = proof the job was done.
- 5 wrong tries → locked (`423 PIN_LOCKED`).

### Wallet ([wallet.ts](../servio-api/src/routes/wallet.ts))
- **See wallet:** balance, today's earnings, money still on hold for active jobs, history.
- **Cash out:** minimum ₱500, ₱15 fee, to a GCash number. Locked so two cashouts can't happen at once. Marked **PAID instantly (fake)**.

---
## 4. Dispatch — how a Pro gets a job

**In plain words:** like Grab looking for a driver. The server offers the job to the **closest** available Pro. They have 60 seconds to accept. If not, it tries the next one, up to 5 Pros.

**Going online:** Pro taps the toggle → app gets phone GPS → `POST /pro/availability` ([pro.service.ts:75](../servio-app/src/app/core/services/pro.service.ts#L75), [pro.ts:19](../servio-api/src/routes/pro.ts#L19)). Only approved Pros. While online, location updates every 30 s ([tracking.service.ts:154-157](../servio-app/src/app/core/services/tracking.service.ts#L154-L157)).

**Who gets picked** ([demo-dispatch.ts:16-58](../servio-api/src/dispatch/demo-dispatch.ts#L16-L58)): a Pro who is approved, online, offers that service, isn't the customer, sent GPS in the last 2 min, wasn't already offered this job, and isn't holding another offer. Closest first, then best rating.

**What keeps it running:** the Pro's app asks the server every 15 s "any jobs?" (`POST /pro/dispatch`, [pro.service.ts:38-53](../servio-app/src/app/core/services/pro.service.ts#L38-L53)). Each time, the server also moves the matching forward. A new offer opens the radar screen with a sound + vibration ([dispatch-alert.service.ts](../servio-app/src/app/core/services/dispatch-alert.service.ts)).

⚠️ Weak spot: if **no** Pro has the app open, nobody "pushes" the matching forward, so the booking just waits (see §13 #3).

**Accepting** ([pro.ts:56-84](../servio-api/src/routes/pro.ts#L56-L84)): locks the booking, checks it's still free and the 60 s haven't passed, then assigns the Pro. Two Pros tapping at the same time → only one wins.

---
## 5. Realtime (live updates without refreshing)

**In plain words:** normally the app has to *ask* the server for news. With a WebSocket, the app keeps a line open, and the server can *tell* the app the moment something changes ("the Pro is on the way!"). We group these lines into **rooms**, like group chats.

### Rooms
| Room | Who is inside | What they hear |
|---|---|---|
| `booking:<id>` | the customer + the Pro of that booking | status changes, add-ons, new chat messages, **Pro's live location** |
| `user:<id>` | just you | "your bookings changed", "new notification" |
| `pro:<id>` | just that Pro | "you have a new job offer" |

Each room is one `OrderRoom` Durable Object ([order-room.ts](../servio-api/src/live/order-room.ts)).

### Getting into a room safely (two steps)
1. App asks for a **ticket**: `POST /bookings/:id/live-ticket` (with the login token). Server gives a ticket that works **once** and only for **60 seconds** ([tickets.ts:13](../servio-api/src/live/tickets.ts#L13), [routes/live.ts:16-28](../servio-api/src/routes/live.ts#L16-L28)).
2. App connects with that ticket. The room checks: real ticket? not used before? still logged in? are you part of this booking? max 8 connections per person ([order-room.ts:22-66](../servio-api/src/live/order-room.ts#L22-L66)).

**Why a ticket?** A WebSocket can't carry the login token the normal way, so it would end up in the URL (where it can leak into logs). A one-time, 60-second ticket is useless if leaked.

### How a change reaches your phone
1. Something happens, e.g. the Pro taps "On the way" (`POST /bookings/:id/status`).
2. After the server saves it, [notifyLive](../servio-api/src/live/notify.ts#L20-L105) looks at what happened and pings the right rooms. It does this in the background so the Pro's app isn't slowed down.
3. The room sends a small message to everyone inside, like `{type:'status'}` ([order-room.ts:96-105](../servio-api/src/live/order-room.ts#L96-L105)).
4. Your app hears it and **re-downloads the booking** with a normal request ([order.service.ts:118-146](../servio-app/src/app/core/services/order.service.ts#L118-L146)).

The message is just a **"hey, check again"** (a hint), not the data itself. That way the database is always the one source of truth.

### Keeping the connection alive ([live.service.ts](../servio-app/src/app/core/services/live.service.ts))
- One connection per room, shared by all screens.
- App says "ping" every 10 s. Nothing heard for 25 s → reconnect.
- Reconnect waits 1 s, 2 s, … up to 10 s between tries; also reconnects when you reopen the app or get internet back.
- **Backup plan:** while disconnected, the app checks the server every 5 s by itself (every 30 s when connected) ([order.service.ts:158-169](../servio-app/src/app/core/services/order.service.ts#L158-L169)).

---
## 6. Live GPS tracking & maps

**In plain words:** the Pro's phone sends its location about once a second through the booking's live room. The customer's map moves the rider icon smoothly. Maps and address lookups use free OpenStreetMap.

| Part | Plain explanation | Code |
|---|---|---|
| Pro's GPS | Phone reads location ~every 1 s while the app is open and the Pro is online/on the way. | [tracking.service.ts:148](../servio-app/src/app/core/services/tracking.service.ts#L148) |
| Sending it | Sent through the **WebSocket**, max once per second. | [tracking.service.ts:229](../servio-app/src/app/core/services/tracking.service.ts#L229), [live.service.ts:42](../servio-app/src/app/core/services/live.service.ts#L42) |
| Server checks | Only the assigned Pro, only while ON THE WAY, time must be recent (≤ 2 min), not faster than every 0.75 s. Fake GPS only allowed for demo bookings. | [order-room.ts:71-95](../servio-api/src/live/order-room.ts#L71-L95) |
| Server saves | The last point (so someone joining late sees it right away) + the Pro's last location in the DB every 15 s. | same |
| Customer's map | Leaflet library + free OpenStreetMap pictures. Rider icon slides smoothly. | [tracking-map.component.ts](../servio-app/src/app/shared/components/tracking-map/tracking-map.component.ts), [map-tiles.ts](../servio-app/src/app/shared/utils/map-tiles.ts) |
| Road line | Uses the free OSRM route server — **only in test builds**. | [tracking.service.ts:218-228](../servio-app/src/app/core/services/tracking.service.ts#L218-L228) |
| "Reconnecting…" | Shown if no location for 20 s. | [tracking.service.ts:74](../servio-app/src/app/core/services/tracking.service.ts#L74) |
| Pin → address | Move the pin, wait 0.35 s, ask the server for the street name. | [addresses.page.ts:90-113](../servio-app/src/app/pages/addresses/addresses.page.ts#L90-L113) |
| Address lookup | One shared `Geocoder` asks OpenStreetMap (Nominatim). It waits 1.1 s between requests (their rule) and remembers answers for 7 days. | [geocoder.ts:28-63](../servio-api/src/locations/geocoder.ts#L28-L63) |
| Nearby Pros / posts | Distance is calculated in the database with the haversine formula (distance on a round Earth). "Nearby" = under 3 km. | [community.ts:26-31](../servio-api/src/routes/community.ts#L26-L31), [community.ts:66-116](../servio-api/src/routes/community.ts#L66-L116) |

---
## 7. Chat, calls, notifications

**Chat** — each message is a row in the `messages` table, linked to a booking.
- **Send:** `POST /bookings/:id/messages` with text and/or a photo ([booking-social.ts:66-82](../servio-api/src/routes/booking-social.ts#L66-L82)). Only the customer and Pro. Closed when the job ends.
- **Read:** `GET /bookings/:id/messages?after=<last id>` — "give me only messages newer than the last one I have" ([booking-social.ts:51-64](../servio-api/src/routes/booking-social.ts#L51-L64)).
- **Live:** new message → room ping → chat screen re-downloads ([order-chat.page.ts:76-95](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L76-L95)).
- Automatic messages ("Booking status: en route") are added by the server with no sender.

**Calls** — no in-app calling. During an active job, `GET /bookings/:id/contact` gives the other person's phone number ([bookings.ts:124-135](../servio-api/src/routes/bookings.ts#L124-L135)) and the phone's normal dialer opens ([booking-call.service.ts](../servio-app/src/app/core/services/booking-call.service.ts)). After the job, the number is hidden again.

**Notifications** — an inbox inside the app, **not** real push notifications.
- The server decides who gets what ([notices.ts](../servio-api/src/live/notices.ts)), saves it in the `notifications` table, and pings your `user:` room.
- Bell + list: `GET /notifications`, `POST /notifications/read` ([routes/notifications.ts](../servio-api/src/routes/notifications.ts)); app: [notification.service.ts](../servio-app/src/app/core/services/notification.service.ts).
- If the app is in the background (still running), the **app itself** shows a phone notification. If the app is fully closed, nothing arrives (no Firebase/Apple push yet).

---
## 8. Login with an email code (and how the email is sent)

**In plain words:** no passwords. You type your email, we email you a 6-digit code, you type the code, and you're in. The app then keeps a "wristband" (token) so you stay logged in for 30 days.

### 8.1 The login steps

```
 App                         Server                                 Gmail
  │ 1. "send code to ana@…"   │                                       │
  │ ────────────────────────▶ │ make code 482913, save its HASH       │
  │                           │ ─── 2. email "482913 is your code" ─▶ │ ──▶ Ana's inbox
  │ 3. "ana@…, code 482913"   │                                       │
  │ ────────────────────────▶ │ hash it, compare, OK → create session │
  │ ◀──── 4. token ────────── │                                       │
```

**Step 1 — `POST /auth/request-code`** ([auth.ts:42-83](../servio-api/src/routes/auth.ts#L42-L83))
1. **Speed limit:** max 10 tries per minute per phone (IP) and per email ([auth.ts:32-40](../servio-api/src/routes/auth.ts#L32-L40)). Stops spam.
2. **Demo shortcut:** in test builds, demo accounts skip email and use a fixed code.
3. **Max 5 codes per hour** per email.
4. **Make the code:** a random number 000000–999999 ([auth.ts:24](../servio-api/src/routes/auth.ts#L24)).
5. **Cancel older codes** for that email — only the newest one works.
6. **Save only the hash** of `email + code` with an expiry 10 minutes from now ([auth.ts:25](../servio-api/src/routes/auth.ts#L25), [:61-64](../servio-api/src/routes/auth.ts#L61-L64)). Even someone who sees the database can't read the code.
7. **Email it** with `sendMail()` (see 8.2). If the email fails, the code is cancelled right away so a code nobody received can't be used ([auth.ts:78-81](../servio-api/src/routes/auth.ts#L78-L81)).

**Step 3 — `POST /auth/verify-code`** ([auth.ts:85-134](../servio-api/src/routes/auth.ts#L85-L134))
1. Find the newest unused code for that email (and **lock** it so two tries can't race).
2. Expired? → "wrong or expired". 5 wrong tries already? → `CODE_LOCKED`, ask for a new one.
3. Hash what you typed and compare with the saved hash (timing-safe = takes the same time whether it's close or not, so hackers learn nothing from timing).
4. Wrong → add 1 to the try counter. Right → mark the code **used** (it works only once).
5. New email? Create a user as `CUSTOMER`. Turned-off account or admin → blocked.
6. Create a **session** and send back the token.

**The session / token** ([middleware/auth.ts:14-46](../servio-api/src/middleware/auth.ts#L14-L46)): 32 random bytes, the DB stores only its hash, lasts 30 days. Sign-out marks it revoked. The app saves it with Capacitor Preferences and sends it on every request as `Authorization: Bearer <token>`.

**Roles:** `CUSTOMER`, `PRO`, `ADMIN`. One account can switch between Customer and Pro mode ([me.ts:185-226](../servio-api/src/routes/me.ts#L185-L226)), but not during an active job, and switching to Customer sets you offline.

### 8.2 How the email is actually sent (SMTP) — [mailer.ts](../servio-api/src/lib/mailer.ts)

**What is SMTP?** It's the language email servers speak, like a script at a post office counter. Our server walks up to Gmail's counter and has a short conversation: "Hi" → "here's my login" → "from me" → "to Ana" → "here's the letter" → "bye". Gmail answers each line with a **3-digit number** that means OK or not OK.

**Why we wrote it by hand:** the usual email library (nodemailer) needs normal Node.js network features that Cloudflare Workers don't have. Workers *can* open a raw secure connection with `connect()` from `cloudflare:sockets` ([mailer.ts:2](../servio-api/src/lib/mailer.ts#L2)), so we speak SMTP ourselves. No extra library, no paid email service.

**Settings (stored as secret environment variables, not in the code)** — [env.ts:21-26](../servio-api/src/env.ts#L21-L26)

| Setting | Meaning | Default |
|---|---|---|
| `SMTP_HOST` | Which email server | `smtp.gmail.com` |
| `SMTP_PORT` | Which "door" | `465` (encrypted from the start) |
| `SMTP_USER` | The Gmail address we send from | — |
| `SMTP_PASSWORD` | Its password (for Gmail, an app password) | — |
| `MAIL_FROM` / `MAIL_FROM_NAME` | What the receiver sees as sender | `SMTP_USER` / `SERVIO` |

#### Step 1 — `sendMail()` decides what to do ([mailer.ts:20-39](../servio-api/src/lib/mailer.ts#L20-L39))
1. **Is the email address safe?** No spaces, `<`, `>`, quotes, commas or line breaks ([:14](../servio-api/src/lib/mailer.ts#L14)). If not → `422`.
2. **Is email set up?** (`SMTP_USER` + `SMTP_PASSWORD` exist)
   - Not set up **on a dev computer** → don't send; just **print the code in the server log** and return `'logged'`. That's how you log in locally without Gmail.
   - Not set up **in production** → `503 EMAIL_UNAVAILABLE` ("can't send email right now").
3. **Build the letter** with `buildMessage()` (step 2).
4. **Send it** with `smtpSend()` (step 3). If Gmail fails → `502 EMAIL_FAILED` ("try again in a minute"). The real error goes only to the server log, never to the user.

#### Step 2 — `buildMessage()` writes the letter ([mailer.ts:103-120](../servio-api/src/lib/mailer.ts#L103-L120))
An email is just text: a **header** (envelope info) + a blank line + the **body**.

```
From: SERVIO <servio@gmail.com>
To: <ana@example.com>
Subject: 482913 is your SERVIO code
Date: Thu, 22 Oct 2026 03:00:00 GMT
Message-ID: <random-id@servio.app>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="srv-abc123"

--srv-abc123
Content-Type: text/plain; charset=UTF-8          ← plain-text version
Content-Transfer-Encoding: base64
WW91ciBTRVJWSU8gc2lnbi1pbiBjb2RlIGlz...
--srv-abc123
Content-Type: text/html; charset=UTF-8           ← pretty version (big orange code)
Content-Transfer-Encoding: base64
PGRpdiBzdHlsZT0iZm9udC1mYW1pbHk6...
--srv-abc123--                                   ← end
```

What each trick is for:
- **Two versions (plain + HTML):** "multipart/alternative" = the email app shows the pretty one if it can, else the plain one. The **boundary** is a random divider line between them.
- **Base64:** turns the text into safe letters/numbers so emojis, `₱`, `’` don't get broken on the way ([:93-98](../servio-api/src/lib/mailer.ts#L93-L98)). Lines are cut at 76 characters (email rule) ([:100](../servio-api/src/lib/mailer.ts#L100)).
- **Special characters in the subject/name** get wrapped as `=?UTF-8?B?…?=` (the email way of saying "this part is base64") ([:101](../servio-api/src/lib/mailer.ts#L101)).
- **Header injection block** ([:104-106](../servio-api/src/lib/mailer.ts#L104-L106)): if a subject or address had a line break, someone could sneak in extra header lines (like `Bcc: everyone@…`). Any line break → refuse.
- **Message-ID + Date:** required by email rules; helps avoid the spam folder.

The actual text of the login email is in [auth.ts:72-74](../servio-api/src/routes/auth.ts#L72-L74): subject `482913 is your SERVIO code`, "works once, expires in 10 minutes, never share it".

#### Step 3 — `smtpSend()` has the conversation with Gmail ([mailer.ts:41-87](../servio-api/src/lib/mailer.ts#L41-L87))

1. **Open a secure line** to `smtp.gmail.com:465` with encryption on (`secureTransport: 'on'`) ([:42](../servio-api/src/lib/mailer.ts#L42)). Everything after this, including the password, is encrypted.
2. **Talk, line by line.** `send()` writes one line (ending in `\r\n`, the email "Enter key"); `reply(code)` waits for Gmail's answer and checks the number.

| # | We send | Gmail answers | Meaning |
|---|---|---|---|
| 1 | *(nothing, just connect)* | `220` | "Hello, I'm ready." |
| 2 | `EHLO servio.app` | `250` | "Hi, I'm servio.app." → "Nice to meet you." |
| 3 | `AUTH PLAIN <base64 of user + password>` | `235` | "Here's my login." → "Logged in." |
| 4 | `MAIL FROM:<servio@gmail.com>` | `250` | "It's from me." → "OK." |
| 5 | `RCPT TO:<ana@example.com>` | `250` | "It's for Ana." → "OK." |
| 6 | `DATA` | `354` | "I'm about to send the letter." → "Go ahead, end with a dot." |
| 7 | *the whole letter* + a line with only `.` | `250` | "Done." → "Queued for delivery." |
| 8 | `QUIT` | — | "Bye." |

If **any** answer is a different number than expected, it stops with an error like `SMTP 535: bad password` ([:57](../servio-api/src/lib/mailer.ts#L57)).

Small details that matter:
- **Reading answers** ([:49-64](../servio-api/src/lib/mailer.ts#L49-L64)): Gmail can reply in several lines (`250-…`, `250-…`, then `250 …`). A **space** after the number means "this is the last line". The code keeps reading until it sees that.
- **Dot-stuffing** ([:89-91](../servio-api/src/lib/mailer.ts#L89-L91)): a line with only `.` means "end of letter". So if the letter itself has a line starting with `.`, we add a second dot (`..`) so Gmail doesn't think the letter ended early. Gmail removes the extra dot.
- **15-second timeout** ([:13](../servio-api/src/lib/mailer.ts#L13), [:122-131](../servio-api/src/lib/mailer.ts#L122-L131)): if Gmail is slow or stuck, give up after 15 s and close the line, so the user isn't waiting forever.
- **Always hang up** (`finally { socket.close() }`, [:84-86](../servio-api/src/lib/mailer.ts#L84-L86)): even after an error, the connection is closed.

#### What can go wrong (and what the user sees)

| Problem | What the user sees | Code |
|---|---|---|
| Bad email address | "Enter a valid email address." (`422`) | [mailer.ts:21](../servio-api/src/lib/mailer.ts#L21) |
| Email not set up (production) | "We can't send email right now." (`503`) | [mailer.ts:28](../servio-api/src/lib/mailer.ts#L28) |
| Wrong Gmail password / Gmail down / timeout | "We couldn't send the email. Try again in a minute." (`502`) | [mailer.ts:37](../servio-api/src/lib/mailer.ts#L37) |
| Asked too many times | "Too many tries…" (`429`) | [auth.ts:37](../servio-api/src/routes/auth.ts#L37), [:56](../servio-api/src/routes/auth.ts#L56) |
| Local dev, no Gmail set up | Nothing sent — the code is printed in the terminal running `npm run dev` | [mailer.ts:23-25](../servio-api/src/lib/mailer.ts#L23-L25) |

**Limits to know:** Gmail caps how many emails one account can send per day, and emails from a personal Gmail can land in spam. For real launch, switch `SMTP_HOST`/`USER`/`PASSWORD` to a proper email service — no code change needed.

---
## 9. Offline (demo) mode vs online (real) mode

**In plain words:** "offline mode" is a **pretend version** of the app that works with no server at all — for demos. It is **not** "works without internet and syncs later".

One switch controls it: `ApiSettingsService.useMockApi` ([api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts)).

| | Real (online) mode | Demo (offline) mode |
|---|---|---|
| How to turn on | It's the default | Demo builds only: "Demo connection" → **Offline demo** ([demo-connection.service.ts](../servio-app/src/app/core/services/demo-connection.service.ts)) |
| Login | real email code | any email, code **`123456`** ([auth.service.ts:10](../servio-app/src/app/core/services/auth.service.ts#L10)) |
| Data | from the server | built-in sample data ([mock-data.ts](../servio-app/src/app/core/data/mock-data.ts)) |
| Saving | in the database | in the phone's browser storage (`localStorage`) ([demo-store.ts](../servio-app/src/app/core/services/demo-store.ts)) |
| Status / PIN / wallet | server does it | the app fakes it ([order.service.ts:204](../servio-app/src/app/core/services/order.service.ts#L204)) |
| Tracking | real GPS | a pretend rider driving a fixed Tuguegarao route ([tuguegarao-route.ts](../servio-app/src/app/core/data/tuguegarao-route.ts)) |
| Chat | real messages | fake reply after 1.4 s |
| Bulletin accept/cancel | works | "requires an API connection" |

**How the code switches:** every action looks like
`if (useMockApi()) { do it on the phone } else { ask the server }` — e.g. [order.service.ts:325-374](../servio-app/src/app/core/services/order.service.ts#L325-L374).

**No internet in real mode?** Requests fail and you see "Cannot reach SERVIO". Nothing is saved for later.

**Fake GPS for demo accounts:** in real mode, a demo Pro can turn on simulated GPS. The server only accepts it for demo bookings, never in production.

---
## 10. Bulletin (neighborhood request board)

**In plain words:** like a community Facebook post: "Need someone to fix my sink." A Pro raises their hand, then the customer turns it into a normal booking.

1. **Customer posts** → `POST /bulletin` ([community.ts:33](../servio-api/src/routes/community.ts#L33)). Status `OPEN` or `URGENT`.
2. **A Pro reserves it** → `POST /bulletin/:id/accept` ([community.ts:127](../servio-api/src/routes/community.ts#L127)). No money yet.
3. **Customer checks out** → a normal booking is created with that Pro, with money held.
4. **Before checkout**, the Pro can let go (`release`) and the customer can `cancel`. After checkout, normal booking cancel rules apply.

---
## 11. Uploads (photos, avatars, ID documents)

**In plain words:** the app doesn't send the photo through every request. It uploads the photo once, gets a **name tag (key)** for it, and from then on just sends the name tag.

1. **Ask permission:** `POST /uploads/presign` with type and size → server makes a random file name and a **temporary upload link** valid 15 min ([uploads.ts:52-63](../servio-api/src/routes/uploads.ts#L52-L63)).
2. **Upload** the file to that link ([api.service.ts:92-98](../servio-app/src/app/core/api/api.service.ts#L92-L98)). In production it goes through our Worker into R2.
3. **Use the key** (e.g. `photoKey`) in chat, add-ons, profile. The server checks it's your file and the right kind ([lib/uploads.ts:15-23](../servio-api/src/lib/uploads.ts#L15-L23)).
4. **Viewing:** `GET /uploads/:key` checks you're allowed to see it, then gives a link that works for 60 seconds ([uploads.ts:111-148](../servio-api/src/routes/uploads.ts#L111-L148)). ID documents (KYC) only the owner can see.

Limits: JPEG/PNG up to 5 MB; PDF up to 10 MB (ID documents only). The app shrinks photos before uploading.

---
## 12. Database tables (what's saved where) — [schema.ts](../servio-api/src/db/schema.ts)

| Table | Holds |
|---|---|
| `users`, `sessions`, `login_codes` | accounts, logged-in devices, email codes (hashed) |
| `user_addresses` | saved addresses |
| `pro_profiles` | Pro info: ID check status, online, last location, rating |
| `categories`, `service_skus`, `addon_skus`, `pro_skus` | service menu, prices, add-ons, who offers what |
| `bookings`, `booking_events`, `addon_quotes` | bookings, their history, add-on requests |
| `dispatch_offers` | job offers sent to Pros |
| `bulletin_requests` | bulletin posts |
| `messages`, `reviews`, `notifications` | chat, ratings, inbox |
| `ledger_entries`, `payouts` | money log, cash-outs |
| `uploads`, `support_requests` | files, help reports |

Booking codes look like `SRV-1234`. All money is whole centavos, and the database itself refuses bad values (e.g. negative prices).

---
## 13. Audit: what's good, what needs fixing

### What's done well
- **No double charges / double accepts:** every money or status change is all-or-nothing and locks the rows it touches.
- **No duplicate bookings** on double-tap (idempotency key).
- **Money log that must balance** (double-entry ledger) instead of a balance number that could drift.
- **Secrets are never saved readable:** tokens and login codes are hashed; PIN and live tickets use HMAC.
- **Every input is checked**, and every error has the same shape + a request ID.
- **You only see your own bookings** (`participantBooking`, [lib/bookings.ts:18](../servio-api/src/lib/bookings.ts#L18)).

### What needs fixing (before real users)

| # | Problem (plain) | Where | Why it matters |
|---|---|---|---|
| 1 | **Anyone can become a Pro instantly.** No ID check; they even get a fake 5.0 rating. | [me.ts:86-108](../servio-api/src/routes/me.ts#L86-L108) | Strangers could take jobs. OK for a prototype only. |
| 2 | **Payments are fake.** Nothing actually charges or pays out. | [payments/mock.ts](../servio-api/src/payments/mock.ts), [wallet.ts:81-82](../servio-api/src/routes/wallet.ts#L81-L82) | No real money moves. |
| 3 | **Matching only runs when a Pro's app is open.** No timer on the server. | [pro.ts:43-45](../servio-api/src/routes/pro.ts#L43-L45) | A booking could wait forever with money on hold. Fix: a Cloudflare Cron Trigger (timer) every minute. |
| 4 | **No real push notifications.** | [notification.service.ts](../servio-app/src/app/core/services/notification.service.ts) | Pros miss jobs when the app is closed. |
| 5 | **No road line on the map in production.** | [tracking.service.ts:204](../servio-app/src/app/core/services/tracking.service.ts#L204) | Customer sees the dot but not the route. |
| 6 | **GPS stops when the Pro leaves the app.** | [tracking.service.ts:145](../servio-app/src/app/core/services/tracking.service.ts#L145) | Customer sees "Reconnecting…". |
| 7 | **New DB connection per request.** | [middleware/db.ts](../servio-api/src/middleware/db.ts) | A bit slower; Hyperdrive helps in production. |
| 8 | **No service area.** | [service-area.ts](../servio-api/src/lib/service-area.ts) | Someone could book from another country. |
| 9 | **PIN lock has no unlock.** 5 wrong tries = stuck. | [bookings.ts:290](../servio-api/src/routes/bookings.ts#L290) | Job can't be finished without manual DB fix. |
| 10 | **No admin tools** for ID review, menu, disputes. | [support.ts:38-50](../servio-api/src/routes/support.ts#L38-L50) | Admin features not built yet. |
| 11 | **Pro cancelling has no real penalty** (strikes are counted but not used). | [bookings.ts:207](../servio-api/src/routes/bookings.ts#L207) | Pros can cancel freely. |
| 12 | **Login emails come from Gmail.** Daily send limit, may go to spam. | [mailer.ts](../servio-api/src/lib/mailer.ts) | Switch to an email service before launch (settings only). |

---
## 14. Plugins & libraries (what each one does)

### Mobile app — Capacitor plugins (native phone features)

| Plugin | What it does in SERVIO | Used in |
|---|---|---|
| `@capacitor/core` | Base of Capacitor. `Capacitor.isNativePlatform()` checks if we're on a real phone vs browser. | many services |
| `@capacitor/android`, `@capacitor/ios` | Wrap the web app into a real Android / iOS app. | [android/](../servio-app/android/), [ios/](../servio-app/ios/) |
| `@capacitor/geolocation` | Reads phone GPS — Pro live tracking, going online, "use my location" on the address map. | [tracking.service.ts](../servio-app/src/app/core/services/tracking.service.ts), [addresses.page.ts](../servio-app/src/app/pages/addresses/addresses.page.ts) |
| `@capacitor/camera` | Picks/takes photos — chat photos, add-on proof photos, profile avatar. | [order-chat.page.ts:154](../servio-app/src/app/pages/order/order-chat/order-chat.page.ts#L154), [add-quote.page.ts:55](../servio-app/src/app/pages/pro/add-quote/add-quote.page.ts#L55), [profile-setup.page.ts:55](../servio-app/src/app/pages/auth/profile-setup/profile-setup.page.ts#L55) |
| `@capacitor/preferences` | Small key-value storage on the phone — saves the login token and API settings. | [session.service.ts](../servio-app/src/app/core/api/session.service.ts), [api-settings.service.ts](../servio-app/src/app/core/api/api-settings.service.ts) |
| `@capacitor/local-notifications` | Shows phone notifications created by the app itself (not server push). | [notification.service.ts](../servio-app/src/app/core/services/notification.service.ts) |
| `@capacitor/app` | Tells us when the app goes to background / comes back → reconnect WebSocket, pause GPS. | [live.service.ts:30](../servio-app/src/app/core/services/live.service.ts#L30), [tracking.service.ts:93](../servio-app/src/app/core/services/tracking.service.ts#L93) |
| `@capacitor/haptics` | Vibrates the phone when a new job offer arrives. | [dispatch-alert.service.ts:77](../servio-app/src/app/core/services/dispatch-alert.service.ts#L77) |
| `@capacitor-community/native-audio` | Loops the alarm sound for a new job offer. | [dispatch-alert.service.ts:25-70](../servio-app/src/app/core/services/dispatch-alert.service.ts#L25-L70) |
| `@capacitor/status-bar` | Sets the top status bar style (dark text on light). | [app.component.ts:22](../servio-app/src/app/app.component.ts#L22) |
| `@capacitor/keyboard` | Installed; handles keyboard resizing natively. No code calls it directly. | — |
| `@capacitor/cli` (dev) | `npx cap sync / open` — copies the web build into the native projects. | [capacitor.config.ts](../servio-app/capacitor.config.ts) |

### Mobile app — other libraries

| Library | What it does |
|---|---|
| `@angular/*` (v22) | The app framework: components, routing, forms, HTTP. |
| `@ionic/angular` (v9) | Mobile UI components (buttons, modals, tabs, toasts) that look native. |
| `ionicons` | The icon set ([icons.ts](../servio-app/src/app/icons.ts)). |
| `leaflet` | Draws the maps (tracking, address pin) with OpenStreetMap tiles. |
| `rxjs` | Streams/observables used by Angular HTTP and services. |
| `@fontsource/inter` | Bundles the Inter font locally (no Google Fonts call) ([global.scss](../servio-app/src/global.scss)). |
| `eslint`, `angular-eslint`, `typescript-eslint` (dev) | Code linting (`npm run lint`). |

### Backend (servio-api) libraries

| Library | What it does in SERVIO | Used in |
|---|---|---|
| `hono` | Small, fast web router for Cloudflare Workers — defines all `/api/v1` routes. | [index.ts](../servio-api/src/index.ts) |
| `valibot` + `@hono/valibot-validator` | Checks every request body/query/param; bad input → `422`. | [validation.ts](../servio-api/src/lib/validation.ts) |
| `drizzle-orm` | Type-safe SQL query builder for Postgres (tables in TypeScript). | [schema.ts](../servio-api/src/db/schema.ts) |
| `pg` | The actual Postgres driver (opens the DB connection). | [client.ts](../servio-api/src/db/client.ts) |
| `@aws-sdk/client-s3` + `s3-request-presigner` | Talks to R2 (S3-compatible) and makes signed upload/download URLs. | [uploads.ts](../servio-api/src/routes/uploads.ts) |
| `@neon/config` | Neon branch settings — preview DB branches auto-delete after 7 days. | [neon.ts](../servio-api/neon.ts) |
| `@neon/env` | Installed but not imported anywhere (can be removed). | — |
| `wrangler` (dev) | Cloudflare CLI — `npm run dev` (local server) and `npm run deploy`. | [wrangler.toml](../servio-api/wrangler.toml) |
| `drizzle-kit` (dev) | Generates/runs SQL migrations (`db:generate`, `db:migrate`). | [drizzle/](../servio-api/drizzle/) |
| `tsx` (dev) | Runs TypeScript scripts: seed, demo reset, backup/restore. | [scripts/](../servio-api/scripts/) |
| `typescript`, `@cloudflare/workers-types`, `@types/pg` (dev) | Type checking. | — |

### Cloudflare features (configured in [wrangler.toml](../servio-api/wrangler.toml), not npm)

| Feature | What it does |
|---|---|
| Workers | Runs the API serverless, close to users. |
| Durable Objects | `OrderRoom` (WebSocket rooms) and `Geocoder` (one global address lookup queue). |
| R2 | File storage for photos and KYC docs. |
| Hyperdrive | Connection pooling/caching to the Neon Postgres DB (production). |
| Rate Limiting (`AUTH_LIMITER`) | 10 login requests per minute per IP/email. |

### Free external services
- **Neon** — hosted Postgres database.
- **OpenStreetMap** tiles — map images.
- **Nominatim** — turns lat/lng into an address.
- **OSRM** — road route line (dev builds only).
- **Gmail SMTP** — sends login codes.

---
## 15. Questions & answers (short version)

### General / architecture

**Q: What is the backend built with?**
A: TypeScript on Cloudflare Workers, using Hono. Database is Postgres (Neon) through Drizzle ORM. Files go to R2. Realtime uses Durable Objects + WebSockets. → [index.ts](../servio-api/src/index.ts)

**Q: What is the app built with?**
A: Ionic + Angular, packaged as Android/iOS apps by Capacitor.

**Q: Why serverless (Cloudflare Workers)?**
A: No server to manage, scales by itself, free tier, and it runs close to the user.

**Q: How does the app talk to the backend?**
A: HTTPS + JSON for normal calls, WebSocket for live updates. → [api.service.ts](../servio-app/src/app/core/api/api.service.ts)

**Q: What is a REST API / what does `/api/v1` mean?**
A: Each URL is a resource (`/bookings`, `/wallet`) and the method says the action (GET = read, POST = create/do, PATCH = edit, DELETE = remove). `v1` is the version so we can change the API later without breaking old apps.

**Q: Where are routes registered?**
A: [index.ts:33-50](../servio-api/src/index.ts#L33-L50).

**Q: Why Postgres and not Firebase?**
A: Money and bookings need transactions and row locks so two Pros can't take the same job and money isn't paid twice.

**Q: What is an ORM / why Drizzle?**
A: It lets us write DB queries in TypeScript with type checking instead of raw SQL strings. Drizzle is light and works on Workers.

**Q: What is a migration?**
A: A SQL file that changes the DB structure step by step (0000 → 0011). → [drizzle/](../servio-api/drizzle/)

**Q: What is Hyperdrive?**
A: Cloudflare's connection pool for Postgres. It keeps DB connections warm so each request is faster.

**Q: How are errors handled?**
A: Code throws `ApiError`; the server returns `{ error: { code, message, requestId } }`. The app shows the message as a toast. → [error.ts](../servio-api/src/middleware/error.ts)

**Q: How is input validated?**
A: Valibot checks every body/query/param. Wrong input → `422 VALIDATION_FAILED`. → [validation.ts](../servio-api/src/lib/validation.ts)

**Q: What is CORS and why is it there?**
A: It only lets allowed origins (our app, e.g. `capacitor://localhost`) call the API from a browser/webview. → [cors.ts](../servio-api/src/middleware/cors.ts)

**Q: What is the request ID for?**
A: Every request gets an `X-Request-Id` so we can find that exact request in the logs when debugging.

**Q: How do you check if the server is up?**
A: `GET /api/v1/health` → `ok` or `degraded` + DB latency. → [health.ts](../servio-api/src/routes/health.ts)

**Q: How do you deploy?**
A: `npm run deploy` in `servio-api` (Wrangler → Cloudflare). The app is built with `ng build` then `npx cap sync`.

**Q: Is the catalog cached?**
A: Yes, `GET /catalog` is public and cached 5 minutes. → [catalog.ts:36](../servio-api/src/routes/catalog.ts#L36)

### Login & accounts

**Q: How does login work?**
A: Enter email → get a 6-digit code → enter code → get a session token. No passwords. → [auth.ts](../servio-api/src/routes/auth.ts)

**Q: How is the code protected?**
A: Only its hash is stored, valid 10 min, 5 wrong tries max, single-use, rate-limited.

**Q: Where is the token saved on the phone?**
A: Capacitor Preferences. → [session.service.ts](../servio-app/src/app/core/api/session.service.ts)

**Q: How long does a session last?**
A: 30 days. Sign-out revokes it. The DB only stores its hash. → [middleware/auth.ts](../servio-api/src/middleware/auth.ts)

**Q: What happens on a 401?**
A: The app clears the session and sends you back to login. → [api.interceptor.ts](../servio-app/src/app/core/api/api.interceptor.ts)

**Q: What roles are there?**
A: `CUSTOMER`, `PRO`, `ADMIN`. One account can switch Customer ↔ Pro (not during an active job). → [me.ts:185-226](../servio-api/src/routes/me.ts#L185-L226)

**Q: Are Pros verified (KYC)?**
A: The system supports it (only `APPROVED` Pros get jobs), but right now upgrading to Pro auto-approves. Admin review is future work. → [me.ts:86-108](../servio-api/src/routes/me.ts#L86-L108)

**Q: Can I save addresses?**
A: Yes, `/me/addresses` (add, edit, delete). → [addresses.ts](../servio-api/src/routes/addresses.ts)

### Booking

**Q: What happens when I tap "Book"?**
A: App sends `POST /bookings`. Server validates, creates the booking, holds the money (mock), writes ledger rows, then alerts Pros. → [bookings.ts:42-115](../servio-api/src/routes/bookings.ts#L42-L115)

**Q: What if I tap Book twice?**
A: Same `Idempotency-Key` → same booking returned, no duplicate. → [bookings.ts:59-67](../servio-api/src/routes/bookings.ts#L59-L67)

**Q: What is idempotency?**
A: Doing the same request many times gives the same result as doing it once.

**Q: What are the booking statuses?**
A: `PENDING_ACCEPTANCE → ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED`, or `CANCELLED`.

**Q: Can a Pro skip a step?**
A: No. One step at a time, only by the assigned Pro. Skipping → `409 INVALID_TRANSITION`.

**Q: How is a Pro chosen?**
A: Nearest online, approved Pro who offers that service with fresh GPS. Offered one at a time, 60 s each, up to 5 Pros. → [demo-dispatch.ts](../servio-api/src/dispatch/demo-dispatch.ts)

**Q: What if no Pro accepts?**
A: After 5 tries or 5 minutes → auto-cancel + full refund.

**Q: Can I pick a specific Pro?**
A: Yes. Then the booking starts as `ACCEPTED` directly. You can't book yourself.

**Q: Can I schedule for later?**
A: Yes — ASAP or a scheduled time window.

**Q: How is the ETA calculated?**
A: Straight-line distance × 1.3 ÷ 20 km/h, kept between 15–60 min. → [cities.ts:36-40](../servio-api/src/config/cities.ts#L36-L40)

**Q: How do add-ons work?**
A: Pro sends an add-on + photo → customer approves/declines → approved amount is added to the hold. One at a time. → [bookings.ts:238-281](../servio-api/src/routes/bookings.ts#L238-L281)

**Q: How is the job completed?**
A: Customer shows a 4-digit PIN, Pro types it. Correct → money released, status `COMPLETED`. → [bookings.ts:283-320](../servio-api/src/routes/bookings.ts#L283-L320)

**Q: Is the PIN stored?**
A: No. It's computed from `HMAC(secret, bookingId)` every time. Only the customer sees it.

**Q: What if the Pro gets the PIN wrong?**
A: 5 tries, then `423 PIN_LOCKED`.

**Q: How do reviews and tips work?**
A: After `COMPLETED`, the customer gives 1–5 stars (+ optional tip). One review per booking. The Pro's average rating updates; the tip goes 100% to the Pro's wallet. → [booking-social.ts:18-49](../servio-api/src/routes/booking-social.ts#L18-L49)

**Q: Where is booking history?**
A: `GET /bookings` lists your bookings; `GET /bookings/:id` shows one. Status history is in `booking_events`.

### Cancelling

**Q: How do I cancel?**
A: Give a reason → `POST /bookings/:id/status {to:'CANCELLED'}`. Server computes fee and refunds the rest.

**Q: Is there a fee?**
A: Before Pro leaves: free. En route: ₱100. Arrived: ₱200. In progress: not allowed (support). Pro is late (no-show): free. → [cities.ts:2](../servio-api/src/config/cities.ts#L2)

**Q: What if the Pro cancels?**
A: Customer gets a full refund; Pro gets a strike (not enforced yet).

**Q: Can I cancel a bulletin post?**
A: Yes, before it becomes a booking. → [community.ts:163](../servio-api/src/routes/community.ts#L163)

### Money

**Q: Is payment real?**
A: No, it's a mock. It sits behind a `PaymentProvider` interface so PayMongo/GCash can be added later. → [provider.ts](../servio-api/src/payments/provider.ts)

**Q: What is escrow?**
A: The money is held when you book and only released to the Pro when the job is completed (PIN).

**Q: How is the money split?**
A: Pro gets 85% of service + add-ons. SERVIO gets 15% + ₱50 trust fee. → [money.ts:11](../servio-api/src/lib/money.ts#L11)

**Q: Why centavos?**
A: Integers avoid decimal rounding errors (₱150.50 = 15050).

**Q: What is the ledger?**
A: Every money movement is saved as rows that add up to zero (double-entry). Balances are calculated with `SUM()`, never stored.

**Q: How does a Pro withdraw?**
A: `POST /wallet/cashout` — min ₱500, ₱15 fee, to GCash. Mock: marked PAID instantly. → [wallet.ts](../servio-api/src/routes/wallet.ts)

**Q: How do you stop double payouts?**
A: DB transactions + row locks (`FOR UPDATE`) — only one request can change that booking/wallet at a time.

### Realtime, tracking & maps

**Q: How do updates show without refreshing?**
A: WebSockets. The server pings the right "room" and the app re-fetches the data. → [order-room.ts](../servio-api/src/live/order-room.ts)

**Q: What is a Durable Object?**
A: A small Cloudflare server instance with its own memory/storage. We use one per booking/user/Pro room to hold the WebSockets.

**Q: Why send "hints" instead of the data itself?**
A: The DB stays the only source of truth; the app always gets fresh, correct data with a normal GET.

**Q: How is the WebSocket secured?**
A: The app first gets a 60-second, one-time signed ticket. The room checks it and that you belong to that booking. → [tickets.ts](../servio-api/src/live/tickets.ts)

**Q: Why a ticket and not the login token?**
A: WebSockets can't send an `Authorization` header, so the token would go in the URL. A short one-time ticket is safer.

**Q: What if the connection drops?**
A: Auto-reconnect with backoff (max 10 s); meanwhile the app polls every 5 s. → [live.service.ts](../servio-app/src/app/core/services/live.service.ts)

**Q: How does live tracking work?**
A: Pro phone sends GPS ~every second over the WebSocket. Server accepts it only from the assigned Pro while `EN_ROUTE` and broadcasts it to the customer's map.

**Q: Does tracking work with the app closed?**
A: No, only in the foreground for now.

**Q: Which map do you use?**
A: Leaflet + free OpenStreetMap tiles. No API key, no cost.

**Q: How does a pin become an address?**
A: `GET /locations/reverse` → Nominatim (OpenStreetMap). Max 1 request/1.1 s, cached 7 days. → [geocoder.ts](../servio-api/src/locations/geocoder.ts)

**Q: How do you find nearby Pros?**
A: SQL haversine (distance on a sphere) formula, nearest first, then by rating. → [community.ts:26-31](../servio-api/src/routes/community.ts#L26-L31)

**Q: What is haversine?**
A: A formula that gives the distance between two GPS points on Earth.

**Q: How does a Pro go online?**
A: Toggle → sends GPS to `POST /pro/availability`. Only approved Pros. Location refreshes every 30 s.

**Q: How does a Pro get alerted of a new job?**
A: Live socket event → radar screen with looping sound (native-audio) + vibration (haptics).

**Q: Is there a service area limit?**
A: Not yet — any valid lat/lng is accepted.

### Chat, calls, notifications

**Q: How does chat work?**
A: Messages are DB rows per booking. New message → WebSocket ping → other side re-fetches. Closed after the job ends. → [booking-social.ts](../servio-api/src/routes/booking-social.ts)

**Q: Can I send photos?**
A: Yes — upload first, then send the `photoKey`.

**Q: How does calling work?**
A: Not in-app. During an active job the app gets the other person's number and opens the phone dialer.

**Q: Push notifications?**
A: In-app inbox + local phone alerts while the app is running. No Firebase push yet, so nothing when fully closed.

### Uploads

**Q: How are photos uploaded?**
A: Ask for a signed URL (`/uploads/presign`) → upload the file to it → send only the key to other endpoints. → [uploads.ts](../servio-api/src/routes/uploads.ts)

**Q: What is a signed URL?**
A: A temporary link (15 min to upload, 60 s to view) that only works for that one file.

**Q: Limits?**
A: JPEG/PNG ≤ 5 MB, PDF ≤ 10 MB (KYC only). KYC files are only visible to the owner.

### Offline / demo mode

**Q: What is offline mode?**
A: A demo with no server: login code `123456`, sample data, saved in `localStorage`, simulated tracking. → [mock-data.ts](../servio-app/src/app/core/data/mock-data.ts)

**Q: How does the code switch between mock and real?**
A: `if (useMockApi()) { do it locally } else { call the API }` in each service.

**Q: Does real mode work without internet?**
A: No. No offline queue — you see "Cannot reach SERVIO".

**Q: How do you demo on a phone with a local server?**
A: "Demo connection" → enter the Mac's Wi-Fi IP, e.g. `http://192.168.1.10:8787/api/v1`.

### Security

**Q: How do you stop people seeing other bookings?**
A: `participantBooking()` only finds a booking if you're its customer or Pro; otherwise `404`. → [lib/bookings.ts:18-23](../servio-api/src/lib/bookings.ts#L18-L23)

**Q: Are secrets stored in plain text?**
A: No. Tokens and codes are hashed; PIN and tickets use HMAC; comparisons are timing-safe. Server secrets are Cloudflare secrets, not in code.

**Q: What is rate limiting?**
A: Limits how often you can call login (10/min) to stop spam and brute-force guessing.

**Q: Hashing vs encryption?**
A: Hashing is one-way (can't get the original back) — good for tokens/codes. Encryption can be reversed with a key.

### Limitations / future work

**Q: What's not finished?**
A: Real payments, real KYC review, admin console, remote push, background GPS, auto-dispatch without a Pro app open (needs a Cron Trigger), service-area limit, PIN unlock. See §13.

**Q: What would you improve first?**
A: Add a Cron Trigger for dispatch (so bookings never get stuck), real payments, and push notifications.

### Email (SMTP) — quick answers

**Q: What is SMTP?**
A: The standard "language" for sending email. Our server talks it to Gmail line by line (see §8.2).

**Q: Why not use a library like nodemailer?**
A: It needs Node.js network features Cloudflare Workers don't have. Workers can open a raw secure connection, so we wrote a small SMTP sender (~130 lines). → [mailer.ts](../servio-api/src/lib/mailer.ts)

**Q: Which email account sends the codes?**
A: A Gmail account set in the secret `SMTP_USER` / `SMTP_PASSWORD`. Not in the code.

**Q: Is the password safe on the way?**
A: Yes. The connection is encrypted (port 465, TLS) before the password is sent.

**Q: What does `220 / 250 / 235 / 354` mean?**
A: Gmail's answers: 220 ready, 250 OK, 235 logged in, 354 "send the letter now". Anything else = error.

**Q: Why are there two versions of the email?**
A: Plain text + HTML. The email app shows the pretty one if it can.

**Q: What is header injection and how do you stop it?**
A: Sneaking a line break into a subject/address to add hidden fields like `Bcc`. We refuse any value with a line break.

**Q: What if Gmail is down?**
A: After 15 s we give up; the user sees "couldn't send, try again", and that code is cancelled.

**Q: How do I log in locally without Gmail?**
A: Leave SMTP unset. The code is printed in the `npm run dev` terminal.

**Q: Is the code saved in the database?**
A: Only its hash. Works once, 10 minutes, 5 wrong tries max.
