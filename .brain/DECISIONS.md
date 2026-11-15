# SERVIO — Architectural Decision Records (ADRs)

> **Status:** Active Decision Log · **Cleaned:** 2026-11-15
> **Format:** Standard ADR (Context, Decision, Consequences)
> Core and recent ADRs are kept in full below. ADR-006, 007, 010, 011 and 014–029 (demo-milestone implementation decisions) were moved verbatim to [archive/DECISIONS_ARCHIVE.md](archive/DECISIONS_ARCHIVE.md); see the [index](#archived-adrs-index) at the bottom for their status.

---

## ADR-001: Standardized Catalog Packages vs Open Bid Marketplace

- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:**
  Traditional gig apps (like TaskRabbit or Thumbtack) require customers to post a job and wait for custom quotes or message multiple freelancers. This creates cognitive friction, delayed turnaround times, and pricing disputes.
- **Decision:**
  SERVIO will adopt the **Urban Company / Foodpanda standardized catalog model**. Services are pre-packaged as standardized SKUs with clear base pricing, explicit inclusions, exclusions, and standardized add-ons. Diagnostic inspections are fixed-price visits.
- **Consequences:**
  - Positive: Instant checkout, predictable customer expectations, automated algorithmic dispatch without negotiation delays.
  - Negative: Requires rigid service definition and structured variation handling for non-standard repairs.

---

## ADR-002: Escrow-Based Payment Settlement with Completion OTP

- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:**
  Home services present significant trust asymmetry: customers fear paying upfront and receiving sub-par service or no-shows; technicians fear doing the labor and getting stiffed or haggled upon completion.
- **Decision:**
  Funds are held in platform escrow upon booking authorization. Payment is automatically released only when the technician prompts the customer for a single-use 4-digit Completion OTP generated in the customer app.
- **Consequences:**
  - Positive: Complete protection for both parties; eliminates off-platform payment disputes.
  - Negative: Requires customer to be present at job completion to communicate OTP, with fallback dispute resolution workflow if customer is unreachable.

---

## ADR-003: Ionic-Angular Framework with HTML & SCSS

- **Date:** 2026-10-14
- **Status:** Accepted (Replaces Flutter)
- **Context:**
  SERVIO requires an agile, cross-platform mobile application delivering responsive, app-store quality iOS and Android experiences alongside high developer ergonomics and rapid CSS/SCSS layout velocity.
- **Decision:**
  Develop the client mobile application strictly using the **Ionic-Angular framework (`@ionic/angular`)** with **HTML templates and SCSS stylesheets**, bundled for iOS and Android via **Capacitor**.
- **Consequences:**
  - Positive: High-fidelity custom styling via SCSS variables, rich ecosystem of Ionic mobile components (`ion-tabs`, `ion-card`, `ion-badge`, `ion-content`), robust Angular dependency injection, state management, and direct Capacitor native hardware integration (Camera, Geolocation, Push Notifications).
  - Negative: Requires adhering to Ionic lifecycle events (`ionViewDidEnter`) and avoiding unoptimized DOM recalculations during real-time GPS tracking animations.

---

## ADR-004: In-App Extra Scope & Add-on Quotation Flow

- **Date:** 2026-10-14
- **Status:** Accepted (push-notification detail superseded by ADR-037)
- **Context:**
  Unlike delivering a pizza, home repair frequently reveals unexpected damage (e.g. broken AC compressor or clogged drainage pipe requiring new piping).
- **Decision:**
  Provide a dedicated in-app "Request Add-on" modal for technicians. The technician selects standardized catalog spare parts or enters custom labor with photographic proof. The customer receives an instant push notification and must tap "Approve & Pay Difference" in-app.
- **Update (2026-11-15):** There is no remote push. The customer learns of a quote through the booking's live room, the in-app inbox/bell and a local notification while the app is open or recently backgrounded (ADR-036, ADR-037).
- **Consequences:**
  - Positive: Prevents unauthorized surprise billing and keeps transaction volume on-platform.
  - Negative: Requires active internet connectivity on site for both customer and technician.

---

## ADR-005: Backend on Cloudflare Workers + Neon Postgres + R2 (AdvanCare Stack)

- **Date:** 2026-10-16
- **Status:** Accepted; partially superseded — "FCM for push" by ADR-037 (no push service); "PostGIS is used on Neon" never happened: dispatch and discovery rank by a plain-SQL great-circle distance (`servio-api/src/dispatch/demo-dispatch.ts`, verified 2026-11-15)
- **Context:** SERVIO needed a backend; the owner already runs AdvanCare on Cloudflare Workers with Neon and R2 and wants one setup across projects.
- **Decision:** `servio-api/` uses Cloudflare Workers + Hono + Valibot, Drizzle ORM over `pg` to Neon Postgres (Hyperdrive in production, direct URL locally), R2 for photos/KYC via presigned URLs, Durable Objects for live order rooms (GPS, status, chat), FCM for push. Money is integer centavos; the ledger is double-entry and append-only, enforced by database triggers.
- **Consequences:** No Supabase-style RLS — every endpoint must authorize in code (participants only, 404 otherwise). PostGIS is used on Neon; local dev uses haversine because Homebrew Postgres lacks PostGIS.

## ADR-008: Tuguegarao City Launch and City-Specific Travel Policy

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner decision); the 10 km dispatch radius and city-center service area are superseded by ADR-035. The D1 demo seed mentioned below was implemented later (ADR-019, archived)
- **Context:** SERVIO's launch moves from Metro Manila/Makati to Tuguegarao City, Cagayan. Existing catalog prices and 85/15 math remain prototype assumptions.
- **Decision:** Use Tuguegarao city proper center **17.613, 121.727**, verified by [OpenStreetMap](https://www.openstreetmap.org/?mlat=17.613&mlon=121.727#map=16/17.613/121.727) / [Nominatim reverse lookup](https://nominatim.openstreetmap.org/reverse?lat=17.613&lon=121.727&format=jsonv2&zoom=16) as Del Rosario Street in the city proper. Demo barangays are Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur, checked against the [city's official barangay enumeration](https://tuguegaraocity.gov.ph/public/files/issuances/2014/RESOLUTION/087-2014.pdf) and [PSA PSGC](https://psa.gov.ph/classification/psgc/barangays/0201529034). Use barangay + landmark when a street is uncertain. Generic public-market errands avoid unverifiable store branches.
- **Tracking:** Embed the OSRM driving geometry generated on 2026-10-16 from `121.73025,17.6132` (near [Sts. Peter & Paul Metropolitan Cathedral, OSM way 152287557](https://www.openstreetmap.org/way/152287557)) to `121.7189,17.6184` (residential Ugac Norte). The router returns **1,802.3 m**, via Luna Street and Bassig Street, ending at **17.618111, 121.718927**. See `servio-app/src/app/core/data/tuguegarao-route.ts` for the source URL and OSM/ODbL attribution. Geometry is embedded; the demo router is development-only. Preserve onboarding SVG geometry, styling and motion; localize only its two street labels. Migrate a cached demo order address to the launch city without changing money or lifecycle progress.
- **Travel policy:** `servio-api/src/config/cities.ts` owns both cancellation fees and `CITY_PROFILES.tuguegarao`: road factor **1.3**, average speed **20 km/h**, whole-minute upward rounding, clamp **15–60 min**, fallback **30 min** without a fix younger than **120 s**, no-show grace **30 min**, accepted-without-departure timeout **15 min**, dispatch radius **10 km**. Select a profile with `LAUNCH_CITY`; adding another city needs a config entry and environment selection, not estimator changes. `estimateTravelMinutes(from, to)` isolates the estimate for a later router replacement. These are owner-provided assumptions, not measured traffic data.
- **Consequences:** All app/API code and fixtures use Tuguegarao locations. Prices, SKUs, identities, order numbers and payout math are preserved by this task. Pricing research in the Figma handoff remains primarily Metro Manila research and must be re-validated for Cagayan. Future D1 seed data uses the updated locations; the seed itself is not yet implemented.

## ADR-009: Cancellation Fees, Pro Strikes and Fixed No-Show Deadlines

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner decision; implementation tracked as A4)
- **Decision:** Customer cancellations before `EN_ROUTE` refund the full hold. `EN_ROUTE` cancellation keeps ₱100; `ARRIVED` keeps ₱200; each fee goes 100% to the assigned Pro, with no platform cut, and the remainder is refunded. In-progress customer cancellations become admin disputes. A Pro may cancel any active booking: full customer refund plus a stored cancellation strike, with no penalty logic yet. Cancellation reasons are required in booking events and all money movements are compensating, balanced, append-only ledger transactions. These fees are an explicit owner-authorized exception to ADR-002's completion-only Pro credit, not an alternate completion path.
- **Timing:** Add nullable `expected_arrival_at` and `no_show_deadline_at` timestamps; scheduled bookings also store start/end timestamps, not just a label. For ASAP, compute arrival when entering `EN_ROUTE`, using a fresh Pro fix or fallback and the current city profile (ADR-008). Fix the no-show deadline at expected arrival +30 min. Live GPS may improve the display ETA but never extend the deadline. An ASAP booking still `ACCEPTED` after 15 min can be cancelled free; other pre-departure cancellations are already free. For scheduled bookings, deadline = window end +30 min. Free no-show cancellation requires server `now()` strictly greater than the deadline and status still `EN_ROUTE`; after arrival, the visit fee applies. Check eligibility while holding the booking lock inside the cancel transaction.
- **Consequences:** Fees and travel constants stay together in `src/config/cities.ts`. Fee amounts are prototype assumptions to validate later. No ledger rows or booking events may be edited/deleted.


## ADR-012: Derived PIN Encoding and Atomic Completion

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Decode the 32+ byte base64 PIN_SECRET, HMAC-SHA256 the booking UUID, interpret the full digest as an unsigned integer and use its first four decimal digits (left-pad short values). Never store or log a PIN; return it only in authenticated customer booking reads. Verify only for the assigned Pro in ARRIVED/IN_PROGRESS, using constant-time comparison. Wrong attempts commit before returning an error; the fifth locks with 423.
- **Settlement:** Hold the booking row lock while checking state/attempts and escrow balance, capturing mock payment, appending one balanced release, marking completion, logging the event and incrementing jobs_done. Compute 85/15 on aggregate base + approved add-ons; platform receives its remainder plus the trust fee. Timestamp completion with server clock after acquiring the lock so concurrent lifecycle events remain ordered.
- **Consequences:** Retries/concurrent PIN submissions cannot double-credit the Pro; capture failure rolls back settlement. Cancellation fees remain the explicit ADR-009 exception. Secret rotation changes active derived PINs and must be coordinated.


## ADR-013: Ledger-Derived Wallet and Serialized Mock Cashouts

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Available balance is the sum of the Pro wallet account. Pending earnings are the rounded 85% share of base + approved add-ons for assigned open held bookings, excluding the trust fee; they appear as derived pending rows, never spendable wallet credits. Today's net earnings sum wallet credits since Philippine midnight (fixed Philippine UTC+08:00), so withdrawing earnings does not change today's earnings metric.
- **Cashout:** Require integer centavos, minimum 50000, fee 1500, and a valid PH GCash number. Acquire a transaction advisory lock per Pro before reading the balance and debiting amount + fee. Append a balanced PAYOUT (wallet → clearing + fee) and create REQUESTED then mock PAID payout in the same transaction. Store only the masked destination.
- **Read consistency:** Return wallet totals, pending items and entries from one repeatable-read, read-only transaction, so a concurrent release cannot disappear between separate response queries.
- **Consequences:** Concurrent requests cannot overdraw; escrow cannot be cashed out before PIN completion (or an owner-authorized cancellation fee). No real payout provider or real transfer is implemented.


## ADR-030: Dual-Persona Account Architecture and Pro Mode Switching

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:**
  Users need the ability to transition from a customer account into a verified Servio Pro service provider and smoothly toggle between customer and provider interfaces without separate sign-in credentials.
- **Decision:**
  1. **Dual-Persona Model:** `users.role` represents the active user mode (`'CUSTOMER'` | `'PRO'`), while the existence of a record in `pro_profiles` represents Pro qualification and KYC standing (`'APPROVED'`). `GET /me` returns `proProfiles` whenever present, regardless of whether `users.role` is currently `'CUSTOMER'` or `'PRO'`.
  2. **Active Job Invariant:** A Pro cannot switch to `'CUSTOMER'` mode if they are currently assigned to an incomplete booking (`ACCEPTED`, `EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`). `POST /me/switch-role` throws `409 ACTIVE_BOOKINGS_EXIST` to prevent job abandonment and escrow lockout.
  3. **Initial Offline State:** Upgrading or toggling into Pro mode always initializes `isOnline: false`. Becoming online strictly requires explicit user interaction with the dashboard availability toggle (`/pro/availability`), which captures fresh GPS coordinates required for algorithmic dispatch prefiltering.
  4. **Admin Protection:** Staff/admin accounts (`users.role === 'ADMIN'`) are protected and cannot be mutated or demoted via self-service mobile endpoints.
  5. **Client UX Flow:** In `ProfilePage`, accounts with an approved Pro profile have a direct "Switch to Servio Pro" action calling `auth.switchRole('PRO')` without re-prompting. Non-pro customer accounts receive the "Become a Servio Pro" activation dialog calling `auth.upgradeToPro()`.


## ADR-031: Key-free map address autofill and booking phone calls

- **Date:** 2026-10-18
- **Status:** Accepted (owner requested); tile source partly superseded by the 2026-11-04 vector basemap (see Update below). Supersedes the masked-call direction in SCOPE.md
- **Decision:** The owner chose a key-free alternative after confirming no Google key was available. Retain Leaflet with standard OpenStreetMap tiles for addresses, tracking and bulletin. Reverse geocode pin selections through authenticated `/locations/reverse` using Nominatim, a singleton rate limiter and bounded cache. Ignore stale responses and allow manual completion of missing details. See `docs/MAPS.md`.
- **Calls:** The owner explicitly requested dialing the other participant's saved number. Active assigned booking participants can request their peer's number through `/bookings/:id/contact` and open the device dialer. This supersedes the earlier masked-only direction for this flow. Public discovery never includes these numbers. Missing numbers show “Call not available. User did not add his number”. These are carrier calls, not proxy masking or VoIP.
- **Icons:** UI controls use registered Ionicons; artwork and QR graphics remain illustrations.
- **Update (2026-11-04, commit `f84bdc7`, no separate ADR):** The basemap is now the key-free OpenFreeMap vector style rendered by MapLibre GL inside Leaflet; raster OSM tiles are the fallback when WebGL2 is unavailable. Nominatim reverse geocoding is unchanged. `docs/MAPS.md` was removed from the repo in commit `28e3e97`.

## ADR-032: Bulletin acceptance reserves a Pro before customer checkout

- **Date:** 2026-10-18
- **Status:** Accepted (owner requested accepting Bulletin cards as a service provider)
- **Decision:** A fixed-SKU Bulletin is not an authorized booking. An active approved Pro offering its exact active SKU may reserve another customer's OPEN/URGENT post. Store accepting Pro/time and later booking link; serialize acceptance, release and checkout on the Bulletin row. The author then explicitly selects their own service address/schedule/payment at checkout. Revalidate the author, accepted Pro, SKU and unlinked reservation before authorizing the existing mock escrow and linking a booking in the same transaction. Include the request in checkout idempotency. Pro acceptance itself cannot charge a customer or create an active job.
- **UX:** Bulletin cards open request details. Accepted requests show Awaiting customer confirmation; the owner can Confirm & book Pro, either participant can release an unbooked reservation, and confirmed participants can open the booking. Await modal dismissal before navigation. Poll while Bulletin is visible, retain pending participant reservations beyond the feed's newest-100 limit, and resolve checkout's Pro by exact ID. Synchronize linked request status on job progress/completion/cancellation.
- **Limits:** The existing self-service Pro upgrade grants APPROVED status; this flow enforces that stored status but does not add independent identity vetting. No real payment processor is enabled.

## ADR-033: Account payment preference and saved support reports

- **Date:** 2026-10-18
- **Status:** Accepted (owner requested completing both Profile options)
- **Decision:** Persist an owner-scoped GCASH/CARD preference and preselect it at checkout once per checkout screen. Do not collect wallet/card credentials or represent simulated payments as live charges. Help provides FAQs, safety guidance and owner-scoped problem reports with validated content, retry-key deduplication and optional participant-validated booking association. Only ADMIN accounts can list all reports or update review status through staff endpoints. No email delivery, response-time promise or staff dashboard is introduced.
- **Category:** Return offered SKU IDs in account/profile trade responses; render actual catalog services and initialize the category dialog from those IDs rather than hardcoded Repairs. The production Worker must be deployed alongside client changes to avoid missing-route errors.

## ADR-034: Measured discovery, listing withdrawal and nonblocking discovery loading

- **Date:** 2026-10-18
- **Status:** Accepted (owner requested)
- **Distance:** Discovery supplies an actual device fix after permission. It never uses the city center as the displayed viewer origin. No origin or no recent provider fix means unavailable distance, not zero. Viewer fixes expire after two minutes; provider fixes after fifteen minutes. Both public display and pre-limit provider ranking apply freshness. Distances are approximate straight-line measurements, not road routes. The center remains an internal map/ranking fallback only. Explicit Use my location requests permission; automatic refresh uses already-granted permission only. New Bulletins may share a rounded approximate pin from the selected saved address, with an explicit explanation in the compose form.
- **Withdrawal:** Authors may soft-cancel OPEN/URGENT or unbooked ACCEPTED Bulletins; cancellation removes them from other users' feeds and is available in My requests. Confirmed requests must use booking cancellation/refund rules. Pros may remove individual offered SKU rows, leaving confirmed jobs intact and reopening their affected unbooked reservations. Acceptance and withdrawal serialize on the same Pro row before the request row; withdrawal uses a non-key row lock so booking FK checks do not deadlock it.
- **Loading:** Authentication does not wait for the profile photo; helper cards render before signed avatar lookups finish. GPS runs independently of the initial catalog/directory/Bulletin load. These remove deterministic extra waits; no measured physical-device speed guarantee is claimed.


## ADR-035: Remove the fixed service radius

- **Date:** 2026-10-18
- **Status:** Accepted (explicit owner request)
- **Decision:** Remove the 10 km city-center restriction from saved-address and booking validation and the 10 km customer-to-Pro dispatch cutoff. A saved address or booking may use any city; retain only valid coordinate bounds, approved/online/SKU-qualified Pro requirements and fresh provider positions. Rank eligible providers by distance without a radius cap. Catalog coverage reports `radiusKm: null`. This supersedes earlier radius and city-selection policies in ADR-008, dispatch and address decisions. Editing saved places still does not move existing bookings.


## ADR-036: Single production account, uncached Hyperdrive and personal live rooms

- **Date:** 2026-10-21
- **Status:** Accepted (owner requested fixing the realtime latency audit on the `mcleinonza0531` account)
- **Decision:** Production runs only on Cloudflare account `da540d88…` (`account_id` pinned in wrangler.toml) with Hyperdrive `servio-neon` caching disabled; recreate Hyperdrive only with `--caching-disabled`. Each signed-in user holds a personal `user:<id>` room receiving booking/bulletin invalidations for every booking they participate in; booking rooms keep GPS/chat/status and `pro:` rooms keep dispatch. Rooms authorize sockets at connect (5-minute expiry) and broadcast without per-event database checks. Clients treat 25 s of socket silence as dead, reconnect on resume, and poll every 5 s only while disconnected (30 s recovery otherwise). An unoffered ASAP booking waits up to 5 minutes for an eligible Pro before the full mock refund.
- **Limits:** No push notifications; direct bookings still skip Pro consent (product decision pending).

## ADR-037: Server inbox, header bell and free local alerts (no push service)

- **Date:** 2026-10-21
- **Status:** Accepted (owner requested a bell with an unread dot and rejected Firebase/paid Apple accounts)
- **Decision:** The `notifications` table is the record. Notices are derived after commit from the same events as live rooms (ADR-036) by pure rules in `live/notices.ts`, never notifying the acting user. The client shows a header bell with a red dot and an inbox page. New notifications received over the live socket while the app is backgrounded are shown with `@capacitor/local-notifications` (free on Android and iOS, works with a Personal Team).
- **Limits:** No remote push: when the OS has closed the app, nothing is shown until it is reopened. Remote push would need FCM (free Firebase project) and, for iOS, a paid Apple Developer membership.

## ADR-038: Platform-funded loyalty coupons at order milestones

- **Date:** 2026-10-22
- **Status:** Accepted (owner requested discounts for loyal customers at e.g. 3, 10 and 15 orders)
- **Decision:** A customer earns one coupon each time their **completed** bookings reach a milestone in `servio-api/src/config/loyalty.ts` (defaults: 3 → 10% up to ₱100, 10 → 15% up to ₱200, 15 → 20% up to ₱300). Coupons are issued on PIN completion and backfilled by `GET /me/rewards`, once per milestone (`customer_coupons` unique on customer + milestone). The customer optionally picks one at checkout (`couponId`); the server locks it, discounts the base SKU price only (never the trust fee or add-ons, never the whole price) and stores `bookings.discount_centavos`.
- **Money:** SERVIO funds the discount. The hold debits the customer for total − discount and `platform_promotions` for the discount, so escrow and the Pro's 85% stay whole. Capture charges the customer total − discount. Cancellation refunds the customer what they paid minus any fee, returns the funding to `platform_promotions` and makes the coupon available again.
- **Limits:** Milestones do not repeat after the last one, coupons do not expire and offline mock mode has no coupons. A reward notice (`REWARD`) is sent when a completion unlocks a coupon. Demo order reset does not revoke coupons already earned.

---

## Archived ADRs index

Full text: [archive/DECISIONS_ARCHIVE.md](archive/DECISIONS_ARCHIVE.md). Status reviewed 2026-11-15.

| ADR | Title | Status |
|---|---|---|
| 006 | Demo Scope — Email Codes, Mock Escrow, Real GPS With Simulator Fallback | Accepted; FCM part superseded by ADR-037; "Android and Cloudflare/Neon deploy before launch" done (ADR-029, deploy 2026-10-16) |
| 007 | Transactional Mock Booking Holds and Retry Safety | Accepted (idempotency keys, ₱50 trust fee snapshot) |
| 010 | October 19 Demo Devices, Local Network and Launch Deferrals | Historical (demo held); "no cloud deployment" superseded by the 2026-10-16 production deploy and ADR-036 |
| 011 | Upload Ownership and Local R2 Demo Adapter | Accepted |
| 014 | Catalog Community APIs, Private Booking Chat and Exact Review Totals | Accepted |
| 015 | App API Client, Session Boundary and Demo Connection Settings | Accepted; "production API URL remains unset" superseded (now `https://servio-api.mcleinonza0531.workers.dev/api/v1`) |
| 016 | Email Sign-In and Prototype Identity Setup | Accepted |
| 017 | Server-Owned Customer Flows and Offline Isolation | Accepted; 3–4 s polling superseded by live rooms (ADR-022, ADR-036) |
| 018 | Demo Pro Workspace and Foreground Dispatch Dependency | Accepted; 10 km radius superseded by ADR-035; foreground-only dispatch is still a known gap (TODO) |
| 019 | Reconciled Demo Baseline and Internal Data Markers | Accepted |
| 020 | Explicit Demo Login Capability | Accepted |
| 021 | Disposable Demo Database and Compensating Order Replay | Accepted |
| 022 | Hibernatable Booking Rooms and Session-Bound Tickets | Accepted; extended by ADR-036 (`user:` rooms, connect-time authorization) |
| 023 | Participant Avatar Access | Accepted |
| 024 | Live GPS Sources, Queue-Safe Tracking and Explicit Indoor Fallback | Accepted; OSRM routing still development-only |
| 025 | Real-User Flows with Mock Payments | Accepted |
| 026 | Editable Account Profiles and Owned Photos | Accepted |
| 027 | Gmail Delivery and Serialized Email-Code Verification | Accepted |
| 028 | Owned Saved Places and Explicit Booking Pins | Accepted; 10 km service-area validation superseded by ADR-035 |
| 029 | Native Demo Packages and Release Network Boundaries | Accepted; Vitest/test tooling mentioned there was removed from the repo on 2026-10-22 |
