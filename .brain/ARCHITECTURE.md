# SERVIO — System Architecture

> **Status:** Architecture Blueprint  
> **Related Vault Note:** `vault/04_Domain_and_System_Design/Domain_Model.md`

---

## 1. System Topology Overview

SERVIO follows a modular, client-server event-driven architecture designed to support low-latency real-time dispatch, geospatial queries, and transactional financial integrity.

```
+-------------------------------------------------------------+
|                      CLIENT APPLICATIONS                    |
|                                                             |
|   [ Servio Unified Mobile App ]               [ Admin Web ] |
|   (Ionic + Angular + HTML/SCSS / Capacitor)     (Angular/TS)|
+-------------------+-----------------------------------------+
                    |
                    v
+-------------------------------------------------------------+
|                   API GATEWAY / EDGE PROXY                  |
|                 (Auth, Rate Limiting, SSL)                  |
+-------------------------------------------------------------+
                    |
      +-------------+-------------+-------------+
      |                           |             |
      v                           v             v
+-------------+             +-----------+ +-----------+
| Booking &   |             | Geospatial| | Escrow &  |
| Dispatch    |<----------->| Radar &   | | Payments  |
| Engine      |             | Tracking  | | Service   |
+-------------+             +-----------+ +-----------+
      ^                           ^             ^
      |                           |             |
+-----+-------+             +-----+-----+       |
| Service     |             | Real-Time |       |
| Catalog     |             | Messaging |       |
| & Ratings   |             | (Chat/Call|       |
+-------------+             +-----------+       |
      |                           |             |
      +-------------+-------------+-------------+
                    |
                    v
+-------------------------------------------------------------+
|                     DATA PERSISTENCE LAYER                  |
|   - Primary DB (PostgreSQL / Supabase with PostGIS)         |
|   - Real-Time State & Cache (Redis / Firebase Realtime)     |
|   - Object Storage (S3 / Cloud Storage for KYC & Photos)   |
+-------------------------------------------------------------+
```

---

## 2. Core Subsystems

### 2.1 Mobile Application (Ionic-Angular with HTML & SCSS — Unified Client Architecture)
The mobile app is developed strictly in the **Ionic-Angular framework (`@ionic/angular`)** using **HTML** and **SCSS**, wrapped with **Capacitor**. It employs a unified 5-tab bottom navigation architecture designed for both customers seeking services and local community helpers offering skills:
- **`Home` (`/home`):** Global search, "Stronger Together" hero banner, category pills, live neighborhood bulletin feed, top helpers nearby carousel, and active tracking mini-widget.
- **`Directory` (`/directory`):** 2-column helper grid with availability status, skills, rating, distance, and direct profile booking.
- **`Bulletin` (`/bulletin`):** Real-time neighborhood request board with status filters (`Open`, `Urgent`, `Nearby`) and interactive request map.
- **`Tracking` (`/tracking`):** Live map execution tracking with dynamic ETA, 5-stage milestone stepper (`Posted` -> `Accepted` -> `On the Way` -> `Arrived` -> `Done`), and in-app chat banner.
- **`Profile` (`/profile`):** Dual-role dashboard managing user requests, metrics (Requests Posted, Jobs Completed), and "My Services" offerings ($XX/hr).

> **Visual Screen Mockups:** Stored in `assets/ui/` (e.g. `01_screen_home.png` to `05_screen_tracking.png`) and fully specified in `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md`.

### 2.2 Pro & Execution Workflows (Within Unified Client / Pro Mode)
- **Go Online / Offline Toggle:** Background location streaming using battery-efficient geospatial geofences.
- **Dispatch Radar Modal:** 60-second animated acceptance ticker showing job title, base payout, distance, and customer location.
- **Job Execution Stepper:** One-tap transitions: `Accept` -> `Navigate to Site` -> `Arrive` -> `Start Job` -> `Request Add-on (Optional)` -> `Complete (Request OTP)`.
- **In-App Digital Wallet:** Accumulated ledger showing Pending Clearances, Available Balance, and Cash Collected.

### 2.3 Dispatch & Geospatial Engine
- **Spatial Indexing:** Uses PostGIS / H3 hexagonal spatial indexing to query active online providers within radius `R` (default 10km).
- **Matching Algorithm:** Filter by category qualification -> Sort by distance + rating -> Dispatch round-robin / broadcast.

### 2.4 Escrow & Financial State Machine
- When order is placed: **Authorize / Hold** funds in Escrow.
- If customer cancels before dispatch: **Full Refund**.
- If customer cancels after arrival: **Trip Fee Deducted** and paid to provider.
- When job is completed with valid OTP: **Release Escrow** -> Split into Provider Payout (80-85%) and Platform Commission (15-20%).

---

## 3. Communication Protocols
- **HTTP / REST / GraphQL:** Transactional CRUD (Auth, catalog, profile, payment intent).
- **WebSockets / Server-Sent Events (SSE):** Real-time order status broadcasts and chat.
- **FCM (Firebase Cloud Messaging) / APNs:** High-priority push notifications for dispatch alerts and message pings.

---

## 4. Client Implementation (`servio-app/`)

- **Stack:** Angular 22 standalone (zoneless, signals, OnPush) + `@ionic/angular` 9 (iOS mode) + Capacitor 8. SCSS tokens in `src/theme/variables.scss`, mixins in `src/theme/_mixins.scss`, global utilities in `src/global.scss`.
- **Layout:** `core/` (guards, services, mock data), `shared/` (components, modals, models, pipes, utils), `pages/` (screens), `tabs/` (shell).
- **State:** API mode uses `CommunityService` for discovery/catalog and `OrderService` for participant booking snapshots; money/status writes occur on the API and refresh the presentation model. Mock mode alone persists the local order/wallet (`demo-store.ts`). Auth sessions use Capacitor Preferences through `SessionService`.
- **Tracking:** `TrackingSimService` emits a simulated GPS fix every second along `core/data/tuguegarao-route.ts`; renderers call `displayDistance(now)` each animation frame. API mode cannot advance status through the simulator. B2/B3 replace the fix source with real GPS and a demo fallback while keeping the renderer.
- **Routes:** `/onboarding`, `/auth/login`, `/auth/verify-otp`, `/tabs/{home,directory,bulletin,tracking,profile}`, `/checkout`, `/order/:id/{chat,addon-modal,completion,review}`, `/pro`, `/pro/radar-alert`, `/pro/order/:id/{execute,add-quote,verify-otp}`, `/pro/wallet` (+ aliases from the screen inventory).
