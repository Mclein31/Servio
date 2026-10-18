# SERVIO — Project Context

> **Last Updated:** 2026-10-18
> **Status:** Demo + real-user flow readiness on `feature/app-and-backend`
> **Repository Root:** `/Users/mclein/Documents/Developer/Personal_Projects/SERVIO`  
> **Knowledge Vault:** `vault/00_Index/MOC_Servio.md`

---

## 1. Project Overview & Identity

**SERVIO** is a standardized, on-demand local skills and services marketplace designed with the speed, predictability, and frictionless UX of modern delivery platforms (e.g., Foodpanda, Grab).

Instead of delivering restaurant meals or groceries, SERVIO delivers **vetted service professionals and skilled tradespeople** directly to the customer's doorstep (e.g., Air Conditioning Cleaning & Repair, Plumbing, Electrical, Home Cleaning, Appliance Maintenance).

### The Core Premise: "Foodpanda for Services"
Traditional service marketplaces (Craigslist, Facebook Groups, TaskRabbit) suffer from high friction: unpredictable hourly bids, vague job scopes, unverified handymen, and off-platform cash disputes.

**Launch city:** Tuguegarao City, Cagayan. Default map center is 17.613, 121.727 (verified on OpenStreetMap). Demo locations use Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur; the embedded tracking route runs 1.80 km from near the cathedral via Luna/Bassig Streets into Ugac Norte. Backend ETA/cancellation constants live in `servio-api/src/config/cities.ts` (`CITY_PROFILES.tuguegarao`). Sample catalog prices are unchanged and require Cagayan validation; see ADR-008.

SERVIO eliminates this friction by treating services as **standardized catalog items (SKUs)** with clear upfront pricing, instant algorithmic technician matching, live on-the-way GPS tracking, in-app escrow payment, and OTP-verified job completion.

---

## 2. Key Personas & Platforms

1. **Unified Mobile App (Customer & Community Pro):**
   - Developed purely with the **Ionic-Angular framework (`@ionic/angular`)** using **HTML** and **SCSS** styling, wrapped with **Capacitor** for iOS & Android.
   - Structured around a 5-tab bottom navigation (`ion-tabs`, `ion-tab-bar`):
     1. **`Home` (`/home`):** Search, promo hero, category grid, live bulletin snippet, top helpers nearby, and active tracking widget.
     2. **`Directory` (`/directory`):** Browse local helpers with skill tags, ratings, distance, and direct booking.
     3. **`Bulletin` (`/bulletin`):** Live neighborhood request board with urgency filters (`Open`, `Urgent`, `Nearby`) and map view.
     4. **`Tracking` (`/tracking`):** Live map execution tracking with dynamic ETA, 5-stage milestone stepper (`Posted` -> `Accepted` -> `On the Way` -> `Arrived` -> `Done`), and in-app chat.
     5. **`Profile` (`/profile`):** Dual-role dashboard managing user requests, metrics (Requests Posted, Jobs Completed), and "My Services" offerings with Philippine peso pricing and explicit units.
   - **Brand & UI Assets:** Logo/icon assets in `assets/logo/`, approved UI references in `assets/ui/`. Editable UI work is in [SERVIO Figma](https://www.figma.com/design/ejP1MZ0Bzaqxzc31vgo5Bi/SERVIO); see `Servio_Vault/03_User_Experience_and_Screens/Figma_UI_Completion_Handoff.md` for 26 iPhone 14 Plus screens, linked branding, introductory onboarding, prototype motion and representative Philippine pricing.
   - **Pricing Direction:** Use local Philippine service-market examples, not dollar amounts relabeled as pesos or exchanged at a USD/PHP rate. Sample fees and the brief's 85% Pro payout are prototype assumptions pending validation.

2. **Admin / Dispatch Operator (Web Admin Console):**
   - Vetting & KYC verification of technicians.
   - Master catalog, category, and pricing management.
   - Dispatch oversight, dispute resolution, escrow release controls, and refund handling.

---

## 3. Technology Stack Guidelines (Target)

**Current implementation:** Ionic 9 / Angular 22.2.3 / Capacitor 8 client; Hono Cloudflare Workers API, Drizzle/Postgres, R2 uploads and Durable Object booking/Pro sockets. Real email-code customer creation, editable account profiles and owner-scoped map-pinned addresses are implemented; payment holds/releases/tips/cashouts remain mock. Gmail credentials are owner-configured locally (`docs/EMAIL_SETUP.md`). `npm run native:demo` prepares LAN-capable Debug packages; Release uses strict network settings. The runbook and remaining physical-device checks are in `docs/DEMO_CHECKLIST.md`. No SERVIO cloud resources have been created or deployed by this work. Maps use key-free OpenStreetMap tiles with pin-triggered Nominatim address autofill via a cached, globally rate-limited API endpoint (`docs/MAPS.md`). Active booking calls open the peer’s number in the device dialer via a participant-only endpoint (ADR-031).


- **Mobile Client:** **Ionic-Angular (`@ionic/angular` + Angular 17/18+ Standalone Components)** with **HTML5** and **SCSS** styling, packaged for mobile via **Capacitor**.
- **Backend / API:** Modular REST/GraphQL services with real-time WebSocket/Firestore connections for live order state updates and messaging.
- **Database:** Relational/Document hybrid (e.g., PostgreSQL with PostGIS / Supabase) for strict transactional consistency on bookings/escrow plus flexible geospatial queries.
- **Cloud & Infrastructure:** Cloud-native architecture with push notifications (FCM / APNs via Capacitor Push), geolocation/mapping (Leaflet / Google Maps JS SDK / Mapbox), and secure payment gateway (Stripe / PayMongo / GCash integration).

---

## 4. Operating Rules for AI Agents

1. **Strict Scope Enforcement:** Always refer to `.brain/SCOPE.md` and `vault/02_Scope_and_Boundaries/Guardrails_for_AI.md` before writing code or proposing features. Do NOT invent unrelated modules (e.g., complex B2B enterprise procurement, crypto payments, social networking feeds).
2. **Standardized SKU Model:** Maintain the core design principle — services must be treated like menu items with defined base scopes and controlled add-on mechanics.
3. **Escrow First:** Never bypass the escrow state machine. Providers are only credited when the job status is `COMPLETED` and confirmed via Customer OTP.
4. **Knowledge Synchronization:** When architectural decisions or scope boundaries are refined, update `.brain/` and `vault/` in sync.
