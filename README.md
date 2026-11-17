# SERVIO

> **Standardized On-Demand Services & Skilled Trades Platform**  
> An enterprise-grade, mobile-first marketplace engineering the predictability, security, and velocity of on-demand logistics into local trade and professional services.

<p align="center">
  <img src="assets/logo/logo.png" alt="SERVIO Platform Logo" width="300"/>
</p>

---

## Executive Overview

Informal and traditional channels for local service procurement (such as social media groups, unvetted classifieds, and offline word-of-mouth) introduce significant transactional friction: unstandardized pricing structures, ambiguous scopes of work, unverified service personnel, and vulnerable off-platform payment arrangements.

**SERVIO** addresses this market inefficiency through the **unitization and standardization of local services**. By restructuring trade skills and professional tasks into cataloged, fixed-scope Service Keeping Units (SKUs), the platform establishes transparent upfront pricing, automated algorithmic technician dispatch, real-time telemetry and tracking, and double-entry escrow settlement protected by two-party cryptographic completion validation.

### Core Architectural Pillars

- **Standardized Service Catalog (SKU Architecture):** Modular, transparently scoped services across five core verticals: Technical Repairs, Academic & Professional Tutoring, Logistics & Errands, Wellness & Personal Care, and Information Technology Support.
- **Automated Algorithmic Dispatch:** Proximity-driven matching engine that evaluates technician availability, qualifications, location freshness, and performance metrics within deterministic offer windows.
- **Real-Time Telemetry & Geolocation:** Low-latency route tracking and spatial visualization utilizing high-performance vector tiles and WebSocket synchronization.
- **Financial Ledger & Escrow Settlement:** An immutable, double-entry ledger architecture enforcing escrow holds during order execution, settled upon dual-party verification (HMAC-derived customer authorization PIN).
- **Unified Dual-Role Mobile Client:** A consolidated client architecture supporting dynamic role switching between Customer and Service Professional (`POST /me/switch-role`) under a unified authentication identity.
- **Synchronous Community Marketplace:** A broadcast bulletin board enabling structured, SKU-anchored service solicitations claims-processed in real time by certified local professionals.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│     servio-app (Ionic 9 + Angular 22 + Capacitor 8 Mobile)      │
│     • REST via HttpClient(fetch)   • WebSockets via LiveService │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS /api/v1   wss (ticketed)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     servio-api (Cloudflare Workers + Hono 4 + Drizzle ORM)      │
│     • Validation: Valibot           • State: Durable Objects    │
│     • Durable Objects:                                          │
│       - OrderRoom: Live tracking & room events                  │
│       - Geocoder: Nominatim geocoding & caching                 │
│       - Dispatcher: Event-armed Pro dispatch                    │
└───────┬────────────────────────┬────────────────────────┬───────┘
        │ Hyperdrive             │ R2 Storage             │ Outbound
        ▼                        ▼                        ▼
  Neon Postgres 17        Cloudflare R2          Gmail SMTP (Auth Codes)
  (Singapore / Hyperdrive) (Media & Attachments) OpenFreeMap / Leaflet (Maps)
```

---

## 🧰 Tech Stack

### Mobile Client (`servio-app/`)
- **Framework:** [Angular 22](https://angular.dev/) (Standalone components, Zoneless, Signals, `OnPush`)
- **UI & Components:** [Ionic Framework 9](https://ionicframework.com/) (`@ionic/angular`) + SCSS design tokens
- **Mobile Runtime:** [Capacitor 8.5](https://capacitorjs.com/) (iOS & Android native bridges)
- **Maps:** Leaflet 1.9 + [OpenFreeMap](https://openfreemap.org/) vector basemap via MapLibre GL (OSM raster fallback)
- **Native Plugins:** Geolocation, Camera, Preferences, Local Notifications, Haptics, Native Audio, Status Bar, Keyboard

### Backend API (`servio-api/`)
- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/) (Node.js compatibility, Hyperdrive connection pooling)
- **Web Framework:** [Hono 4](https://hono.dev/) with Valibot schema validation
- **Database & ORM:** [Neon Postgres 17](https://neon.tech/) managed with [Drizzle ORM](https://orm.drizzle.team/)
- **Realtime & Concurrency:** Cloudflare Durable Objects (`OrderRoom`, `Geocoder`, `Dispatcher`) with WebSocket Hibernation API
- **File Storage:** Cloudflare R2 bucket (`servio-uploads`)
- **Auth & Communications:** Passwordless 6-digit email OTP (Gmail SMTP), local push notifications

---

## 📂 Repository Structure

```text
SERVIO/
├── assets/                     # Brand logos, icons, and design illustrations
├── servio-app/                 # Ionic + Angular mobile application (iOS/Android)
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/           # Auth, API client, guards, and tracking services
│   │   │   ├── pages/          # Screens (Checkout, Tracking, Chat, Orders, Wallet)
│   │   │   ├── shared/         # Reusable components, models, and map utils
│   │   │   └── tabs/           # Shell navigation (Home, Directory, Bulletin, Pro)
│   │   └── theme/              # SCSS design tokens and styling
│   ├── android/                # Native Android Capacitor wrapper
│   └── ios/                    # Native iOS Capacitor wrapper
├── servio-api/                 # Cloudflare Workers backend API
│   ├── drizzle/                # Database migrations (0000–0012)
│   ├── scripts/                # Database seeders, demo data, and secret utilities
│   └── src/
│       ├── db/                 # Drizzle schemas, relations, and ledger guards
│       ├── dispatch/           # Dispatching algorithm & queue management
│       ├── live/               # OrderRoom Durable Objects & WebSocket handlers
│       └── routes/             # Hono REST endpoints (/auth, /bookings, /pro, etc.)
├── promo-video/                # Project promo videos and media deliverables
├── Servio_Vault/ (or vault/)   # Project Obsidian knowledge base
├── .brain/                     # Engineering context, ADRs, state, and specs
└── SERVIO.fig                  # Master Figma design document
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** v22+ (v26 recommended, see `.nvmrc`)
- **Package Manager:** `npm`
- **Cloudflare CLI:** `wrangler` (`npm install -g wrangler`)
- **Native Mobile Tooling (Optional):** Android Studio / Xcode for running native builds

---

### 1. Backend Setup (`servio-api`)

1. **Navigate to the API directory:**
   ```bash
   cd servio-api
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.dev.vars.example` (or set up `.dev.vars` for local development):
   ```ini
   DATABASE_URL="postgres://user:password@ep-sample.ap-southeast-1.aws.neon.tech/servio?sslmode=require"
   JWT_SECRET="your-development-jwt-secret"
   PIN_SECRET="your-development-pin-secret"
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-gmail-app-password"
   ```

3. **Run Migrations & Seed Data:**
   ```bash
   # Run Drizzle migrations
   npm run db:migrate

   # Seed development demo data
   npm run db:seed-demo
   ```

4. **Start the Local Development Server:**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:8787/api/v1`.

---

### 2. Frontend Setup (`servio-app`)

1. **Navigate to the App directory:**
   ```bash
   cd ../servio-app
   npm install
   ```

2. **Start the Development Web Server:**
   ```bash
   npm start
   ```
   Open your browser at `http://localhost:4200`.

3. **Run on Mobile (Capacitor):**
   ```bash
   # Build the Angular client
   npm run build

   # Sync with native projects
   npx cap sync

   # Open in Android Studio or Xcode
   npx cap open android
   # or
   npx cap open ios
   ```

---

## 🔒 Escrow Protocol & Transactional Security

SERVIO implements an append-only, double-entry financial ledger (`ledger_entries`) reinforced with database-level triggers to guarantee transaction consistency, auditability, and fraud mitigation:

1. **Escrow Initialization & Hold:**
   Upon order checkout, total service consideration plus a platform trust fee (₱50) are placed in a cryptographic escrow hold under a single atomic transaction.
2. **Cancellation & Dispute Provisions:**
   - **Pre-Dispatch:** Full refund with zero penalty prior to the technician transitioning to `EN_ROUTE`.
   - **Post-Dispatch / Arrival:** Tiered cancellation fee assessment (credited 100% to the allocated professional to offset transit and opportunity costs).
   - **Professional Default:** Complete customer refund initiated with automated provider penalty/strike assignment.
3. **Dual-Party Cryptographic Completion:**
   - At checkout, an HMAC-derived 4-digit verification token is provisioned to the customer.
   - Upon work fulfillment and customer sign-off, the service professional validates the completion token.
   - Verification triggers automated escrow release: **85%** net disbursement to the service provider, **15%** + trust fee retained by the platform.
   - Discretionary gratuities (tips) route 100% directly to the provider balance.

---

## 📍 Target Deployment & Market Validation

- **Pilot Jurisdiction:** Tuguegarao City, Cagayan Valley, Philippines
- **Geographic Center:** `17.613° N, 121.727° E`
- **Initial Catalog Verticals:**
  - **Repairs & Maintenance:** HVAC servicing, electrical diagnostics, structural plumbing, and home appliance restoration.
  - **Academic & Skill Instruction:** Certified K-12 STEM instruction, collegiate mentoring, and specialized tutoring.
  - **Logistics & Errands:** Priority regional courier, official document retrieval, and task fulfillment.
  - **Wellness & Personal Care:** Licensed personal grooming, styling, and therapeutic wellness.
  - **Information Technology Support:** Device diagnostics, local network architecture, and workstation troubleshooting.

---

## 📄 Intellectual Property & Licensing

All rights reserved. This repository and associated architecture documentation are developed for presentation, commercial evaluation, and academic purposes. Unauthorized reproduction, distribution, or commercial exploitation is strictly prohibited.
