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
