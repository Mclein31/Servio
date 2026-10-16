# SERVIO — Architectural Decision Records (ADRs)

> **Status:** Active Decision Log  
> **Format:** Standard ADR (Context, Decision, Consequences)

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
- **Status:** Accepted
- **Context:**
  Unlike delivering a pizza, home repair frequently reveals unexpected damage (e.g. broken AC compressor or clogged drainage pipe requiring new piping).
- **Decision:**
  Provide a dedicated in-app "Request Add-on" modal for technicians. The technician selects standardized catalog spare parts or enters custom labor with photographic proof. The customer receives an instant push notification and must tap "Approve & Pay Difference" in-app.
- **Consequences:**
  - Positive: Prevents unauthorized surprise billing and keeps transaction volume on-platform.
  - Negative: Requires active internet connectivity on site for both customer and technician.

---

## ADR-005: Backend on Cloudflare Workers + Neon Postgres + R2 (AdvanCare Stack)

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** SERVIO needed a backend; the owner already runs AdvanCare on Cloudflare Workers with Neon and R2 and wants one setup across projects.
- **Decision:** `servio-api/` uses Cloudflare Workers + Hono + Valibot, Drizzle ORM over `pg` to Neon Postgres (Hyperdrive in production, direct URL locally), R2 for photos/KYC via presigned URLs, Durable Objects for live order rooms (GPS, status, chat), FCM for push. Money is integer centavos; the ledger is double-entry and append-only, enforced by database triggers.
- **Consequences:** No Supabase-style RLS — every endpoint must authorize in code (participants only, 404 otherwise). PostGIS is used on Neon; local dev uses haversine because Homebrew Postgres lacks PostGIS.

## ADR-006: Demo Scope — Email Codes, Mock Escrow, Real GPS With Simulator Fallback

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Sign-in is a 6-digit email code via Gmail SMTP (AdvanCare ADR-014 pattern); the app's phone login becomes email. Payments use a mock `PaymentProvider` with the full escrow ledger (PayMongo after the demo). Tracking uses real Pro GPS over a Durable Object, with the existing route simulator kept as a demo fallback. Admin console, Android, push and Cloudflare/Neon deploy are required before launch. Completion PINs are derived with HMAC(PIN_SECRET, booking id) and never stored.
- **Consequences:** SMS cost is avoided for the pilot (Semaphore later). Demo data lives in a dedicated demo database/Neon branch so reset can truncate safely.


## ADR-007: Transactional Mock Booking Holds and Retry Safety

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Checkout retries must never create multiple bookings or escrow holds. The demo uses mock money, while retaining production-style ledger invariants.
- **Decision:** `POST /bookings` snapshots the active catalog price and `TRUST_FEE_CENTAVOS` (default 5000). The mock provider authorization, booking, event and balanced hold entries execute within one database transaction. Optional `Idempotency-Key` values are scoped to the authenticated customer, fingerprint the validated request, and serialize with a transaction advisory lock plus a unique index; changed requests with the same key fail with 409. Mobile checkout must supply a stable key per authorization attempt. Direct Pros must be active, approved and qualified for the SKU.
- **Consequences:** Concurrent and sequential retries authorize once; failed authorization rolls back all booking writes. The stateless mock implements `authorizeHold/capture/refund`; a future real provider must provide its own external idempotency and reconciliation (Phase G, not implemented). SERVIO shares no code, packages, credentials, storage or database resources with any other project.


## ADR-008: Tuguegarao City Launch and City-Specific Travel Policy

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner decision)
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


## ADR-010: October 19 Demo Devices, Local Network and Launch Deferrals

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner decision)
- **Decision:** Demo is Monday, October 19, 2026. Customer uses physical iPhone 14 Plus with free Apple ID Personal Team signing (7-day provisioning), with Mac iPhone simulator backup. Main Pro uses Android; second Android is backup. Android packaging, camera/location/notification declarations, icon/splash and real GPS are required; FCM is deferred. Use in-app WebSocket dispatch/add-on events and keep simulator routing for indoor demos. Implement only availability/dispatch pieces needed by this flow before the demo. Defer admin console, CI and cloud deployment.
- **Network:** Mac hosts Postgres/API with `wrangler dev --ip 0.0.0.0`; app supports a configurable LAN API URL. Allow development LAN origins. Restrict iOS local-network ATS and Android cleartext exceptions to dev/demo builds. Document Wi-Fi, installs and fallbacks in the checklist. If LAN is unreliable, ask before deploying: owner has no SERVIO Neon/Cloudflare resources yet.
- **Identity/email:** Sophia M. is customer (`demo.customer@servio.test`); Sofia R. is the distinct tutor (`demo.tutor@servio.test`); Daniel K. is the main Pro (`demo.pro@servio.test`). Sender name SERVIO. No SMTP App Password yet: log development codes, and allow guarded `DEMO_LOGIN_CODE`. Business/email footer address is `Business address to follow — prototype`; short legal pages are labelled `Prototype — not legal advice`. Never invent registration details.
- **Consequences:** Physical signing/GPS/install verification depends on connected owner devices and their Apple ID. Phase G remains gated; no cloud resources, real payments or FCM are created for this demo without a later instruction.


## ADR-011: Upload Ownership and Local R2 Demo Adapter

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The owner has not created Cloudflare resources and requires the demo to run on local Wi-Fi. Evidence photos must still use the same ownership, type and size rules as cloud uploads.
- **Decision:** Record upload intents/owners in `uploads` (`0005_upload_ownership`). R2 mode uses dedicated `servio-*` buckets and signed PUTs covering Content-Type and Content-Length for 15 minutes; authorized downloads issue 60-second GET URLs. Only JPEG/PNG ≤5 MB and KYC-only PDF ≤10 MB are accepted. Add-on references must be complete uploads owned by the assigned Pro for `addon_evidence`.
- **Local demo:** `UPLOADS_MODE=local` signs key/method/type/length/expiry capabilities with domain-separated HMAC using PIN_SECRET and reads/writes the local Wrangler R2 binding. Production rejects local mode. The PUT stream is bounded to the declared length; URLs use the incoming API origin so LAN phones can reach them. `UPLOADS_MODE=r2` uses S3 presigning and the actual SERVIO bucket binding; no cloud resources are created by this task.
- **Authorization:** Upload owners may read their files. Booking participants may read attached evidence/chat photos; bulletin photos are readable with the bulletin; approved Pro avatars are directory-visible. KYC files are owner-only until an audited admin path is implemented. No file purpose may be repurposed into chat/evidence to disclose KYC.
- **Consequences:** Demo upload behavior is verifiable without cloud accounts; remote R2 operation remains a later integration check. The local bucket is persistent dev data, distinct from the Postgres ledger.


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


## ADR-014: Catalog Community APIs, Private Booking Chat and Exact Review Totals

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Reviews are customer-only after completion and once per booking. Tips use a balanced customer→Pro transaction with 100% to the Pro, never escrow/platform. Store an integer rating_sum with rating_count to compute the two-decimal display average without accumulating rounding drift (`0006_exact_review_averages`). Demo seed must initialize both from its baseline ratings.
- **Community:** Bulletin creation requires an active SKU matching its category and rejects price fields. Nearby eligibility and Pro SKU/category eligibility plus distance/rating order are applied before limiting results. The directory returns approved active Pros and public profile fields, never contact details.
- **Chat:** Only booking participants read messages; only active bookings accept new messages. Upload attachments must be complete and owned, with request_photo/addon_evidence purposes; KYC and avatar uploads cannot be repurposed into chat. Status transitions append system messages inside the same booking transaction.
- **Consequences:** Reviews/tips serialize on the booking and update aggregates atomically. Shared booking-read helpers are extracted for REST/realtime reuse. No bidding, arbitrary prices, social messaging or unapproved directory entries are introduced.


## ADR-015: App API Client, Session Boundary and Demo Connection Settings

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Use Angular HttpClient with Fetch and an interceptor scoped to the configured SERVIO API base. Store opaque bearer sessions in Capacitor Preferences via a separate SessionService to avoid an AuthService/interceptor dependency cycle. Add a request UUID and auth header only for the API; never transmit offline mock tokens or API bearer credentials to signed upload URLs. Map safe API error envelopes to Ionic toasts and clear rejected sessions.
- **Configuration:** App environment declares apiUrl/useMockApi/demo. Development defaults to localhost:8787/api/v1; Android emulator may select 10.0.2.2 and physical devices the Mac's LAN IP. Demo builds can persist a validated base URL and offline mock selection in Preferences; production does not load overrides. The subsequent auth task exposes this in a small demo-only connection sheet. Production API URL remains unset until an owner-approved deployment exists.
- **Consequences:** Existing mock mode remains usable offline. Live app callers use one typed Promise API wrapper; Blob uploads obtain a presign then PUT without API authentication headers. Tokens/connection settings never enter committed source.


## ADR-016: Email Sign-In and Prototype Identity Setup

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Retain the existing login/code-input layouts while switching identity to normalized email and the API's single-use six-digit code. Persist the API session, load `/me`, collect a name and optional `+639…` mobile on first sign-in, and land Pros in their workspace. Offline mode alone accepts `123456`; live mode displays the API development note rather than a test-code hint. Ignore profile responses belonging to a cleared/replaced session.
- **Demo/legal:** Login exposes demo-only API/LAN/offline connection settings. Short Terms, Privacy and Escrow pages use the owner's prototype label and placeholder business address; sign-in email footers use the same address. These pages are prototype copy pending legal review. No email provider credentials or fixed live demo code are introduced by C2.


## ADR-017: Server-Owned Customer Flows and Offline Isolation

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Keep the customer screens and peso-formatting pipes; map API integer centavos into presentation models at the service boundary. Live mode starts with no fabricated booking, history, helper or completion PIN and never persists booking/PIN state to the mock local store. Booking IDs remain UUIDs for API/routes; generated codes are display labels. Participant reads expose names/avatar keys/rating summaries without contact details or auth metadata. Catalog responses include trust/cancellation fees from the server configuration.
- **Writes:** Checkout reuses a request key for an unchanged retry payload, with Philippine scheduled windows stored as timestamps. Add-on/review/cancellation/chat state changes only after API success; the local simulator cannot change live statuses. Live photo chat uses owned upload intents. Demo customer identity remains separate from the Pro; offline-only cross-role shortcuts stay hidden in API mode.
- **Refresh:** Participant booking reads refresh every four seconds and open chat every three seconds until B2 adds room events; API fetches bypass browser disk/cache to avoid stale policy or private booking data. B3 supplies GPS. No live rider simulation or arrival is inferred by C3. Error/retry and empty states retain the existing layout.


## ADR-018: Demo Pro Workspace and Foreground Dispatch Dependency

- **Date:** 2026-10-16
- **Status:** Accepted (minimal A2/B1 dependency authorized by ADR-010)
- **Decision:** Wire Pro availability, status, cancellation, evidence upload/quote, PIN verification and wallet/cashout to their API transactions. Customer accounts cannot enter live Pro routes; the Pro chat identifies the customer as its peer. Only offline mock mode may credit/reset a local wallet or simulate a QR scan. Mode switches cannot copy live snapshots or PINs into the offline store. Rejected sessions clear profile signals and stop foreground polling.
- **Dispatch:** While the Pro workspace is open, an authenticated explicit `POST /pro/dispatch` heartbeat advances held, unassigned bookings. Select approved, active, online, SKU-qualified Pros with fixes younger than two minutes within the city radius (10 km), ordered by distance then rating; exclude prior offers. Separate demo/non-demo pools. Offer one at a time, up to five distinct Pros, each for 60 seconds. Acceptance uses a booking lock and per-Pro advisory lock; no escrow moves. Server expiry/decline advances the queue, and exhaustion appends a balanced full refund. Unheld bookings never enter dispatch. Before acceptance expose only SKU, coarse neighborhood, distance and amounts.
- **Queueing:** Pros may accept another job while finishing a current one, as anticipated by ADR-009. The fixed no-show clock starts at EN_ROUTE, not acceptance; pre-departure cancellation stays free. Do not impose an extra single-active-job policy.
- **Limits:** This is foreground demo dispatch, with REST polling until B2. Autonomous alarms, production PostGIS matching, Pro application/KYC onboarding and launch dispatch remain deferred. The live availability toggle uses a permissioned location fix; B3 adds native streaming and the explicit indoor route fallback. No cloud or push service is created.


## ADR-019: Reconciled Demo Baseline and Internal Data Markers

- **Date:** 2026-10-16
- **Status:** Accepted (owner delegated reconciliation and requested no “demo history” UI label)
- **Decision:** Seed 13 separate accounts, five approved Pros, six bulletin posts, eight fixed-SKU bookings, completed reviews and local R2 avatars/evidence. Sophia M. is customer only; Sofia R. is a distinct tutor, represented by initials. All seed rows use is_demo or reserved `de000000-0000-4000-8000-*` IDs/owned references. Guard the database before writes; refuse production, other local project databases, unknown remote databases and conflicting identities/order codes. Cloud resource creation remains gated; this image seeder uses local Wrangler R2.
- **Wallet reconciliation:** Preserve required totals: available 864075, pending 187000, today 331625 centavos. Pending consists of the active AC job and a queued scheduled AC job, each with an 85% ₱935 share. Replace the unsupported AC Cleaning sample with the existing AC repair SKU. Existing fixed prices/trust fees and 85/15 math are unchanged. Historical opening credits represent prior earnings: 656450 centavos before the recorded history and 57375 credited today. UI labels say **Previous earnings**; internal markers identify the prototype seed. These are seed-only imported balances, not an API path to arbitrary credits.
- **History:** Recorded catalog settlements/tips plus the opening credits and a ₱2,500 cashout + ₱15 fee reconcile exactly. Rating sums are integers; the two-decimal stored average rounds to the original one-decimal card ratings. Historical profile totals already include the seeded completions/reviews.
- **Idempotency:** Stable record/transaction IDs preserve ongoing state on repeated seeding. No ledger/event rows are edited/deleted. Explicit order codes advance the normal sequence beyond all existing codes. Reset is a separate D3 operation.
