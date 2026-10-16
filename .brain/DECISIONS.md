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
