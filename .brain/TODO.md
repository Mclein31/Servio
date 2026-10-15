# SERVIO — Operational Roadmap & Task Checklist

> **Status:** Active Roadmap  
> **Legend:** `[ ]` Not Started | `[/]` In Progress | `[x]` Completed

---

## Phase 0: Knowledge Architecture & Foundations
- [x] Establish 3-layer Brain architecture (`.brain/` and `vault/`).
- [x] Document project context, strict scope boundaries, and ADRs.
- [x] Map comprehensive Obsidian Vault with linked nodes, screen inventory, and research.
- [ ] Initialize repository Git structure and base Ionic-Angular project layout.
- [x] Create editable Figma customer/Pro flows, linked branding and introductory onboarding graphics/prototype animations.
- [ ] Validate representative Philippine catalog pricing, fees and payout assumptions before implementation.

---

## Phase 1: MVP Core Development

### 1. Backend & Data Layer
- [ ] Database schema migrations (Users, Profiles, Categories, Services, Bookings, Transactions, Reviews).
- [ ] Authentication endpoints & phone OTP verification.
- [ ] Service catalog CRUD & query APIs.
- [ ] Booking creation, calculation engine & escrow authorization mock/integration.
- [ ] Dispatch matching logic (spatial bounding box & radius matching).
- [ ] WebSockets / Real-time state channel for active order tracking.

### 2. Unified Mobile App (Ionic-Angular with HTML & SCSS)
- [ ] Initialize Ionic-Angular project with Capacitor (`ionic start servio-app tabs --type=angular`).
- [ ] Setup design tokens in `src/theme/variables.scss` (#FF5C00 primary, pastels, card shadows, rounded radii).
- [ ] Implement 5-tab router (`tabs.page.html` with `ion-tabs` & `ion-tab-bar`).
- [ ] Build **Home Page** (`home.page.html` / `.scss`) matching `01_screen_home.png` (Search, hero promo, category cards, bulletin preview, top helpers, active tracking widget).
- [ ] Build **Directory Page** (`directory.page.html` / `.scss`) matching `02_screen_directory.png` (Category chips, 2-column helper grid cards with availability badge).
- [ ] Build **Bulletin Page** (`bulletin.page.html` / `.scss`) matching `03_screen_bulletin.png` (Search, urgency filters, hero map banner, vertical request cards feed).
- [ ] Build **Tracking Page** (`tracking.page.html` / `.scss`) matching `05_screen_tracking.png` (Hero active card, map route snippet, 5-stage stepper, chat trigger, other requests).
- [ ] Build **Profile Page** (`profile.page.html` / `.scss`) matching `04_screen_profile.png` (User card, 4-stat badges, "My Services" Philippine peso prices with explicit units, settings list).
- [ ] Implement introductory onboarding with first-run persistence and reduced-motion support from the Figma handoff.
- [ ] Implement reusable components: `app-status-badge`, `app-stepper`, `app-helper-card`, `app-search-filter`.
- [ ] Capacitor native plugins configuration (Geolocation, Camera for KYC/photos, Push Notifications).

### 4. Admin Web Console
- [ ] Provider verification dashboard (KYC document inspection, approve/reject).
- [ ] Service catalog & pricing manager.
- [ ] Active bookings monitor & dispute resolution panel.

---

## Phase 2: Post-MVP Enhancements
- [ ] Dynamic surge pricing and peak demand algorithms.
- [ ] Automated SMS fallback for offline technicians.
- [ ] Multi-language and localization support.
- [ ] Provider tier badges (Top Rated, Master Certified).
