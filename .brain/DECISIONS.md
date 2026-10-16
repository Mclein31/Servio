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
