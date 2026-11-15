# SERVIO — Project Context

> **Last Updated:** 2026-11-15 (brain cleanup, verified against `main` @ `74164cc`)
> **Status:** Working prototype, presented at finals on 2026-10-22 (commit `397a45d`). Since then only promo video, map basemap and project-map work. Payments are still simulated.
> **Repository Root:** `/Users/mclein/Documents/Developer/Personal_Projects/SERVIO` (GitHub `Mclein31/Servio`, branch `main`)
> **Knowledge Vault:** `vault/00_Index/MOC_Servio.md` (`vault` is a symlink to `Servio_Vault/`)

---

## 1. Project Overview & Identity

**SERVIO** is a standardized, on-demand local skills and services marketplace designed with the speed, predictability, and frictionless UX of modern delivery platforms (e.g., Foodpanda, Grab).

Instead of delivering restaurant meals or groceries, SERVIO delivers **vetted service professionals and skilled tradespeople** directly to the customer's doorstep (e.g., Air Conditioning Cleaning & Repair, Plumbing, Electrical, Home Cleaning, Appliance Maintenance). The catalog has five categories: Repairs, Tutoring, Errands, Beauty & Care, Tech Help.

### The Core Premise: "Foodpanda for Services"
Traditional service marketplaces (Craigslist, Facebook Groups, TaskRabbit) suffer from high friction: unpredictable hourly bids, vague job scopes, unverified handymen, and off-platform cash disputes.

SERVIO eliminates this friction by treating services as **standardized catalog items (SKUs)** with clear upfront pricing, instant algorithmic technician matching, live on-the-way GPS tracking, in-app escrow payment, and PIN-verified job completion.

**Launch city:** Tuguegarao City, Cagayan. Default map center is 17.613, 121.727 (verified on OpenStreetMap). Demo locations use Centro 10, Ugac Norte, Centro 5, Tanza, Caritan Centro and Atulayan Sur; the embedded demo tracking route runs 1.80 km from near the cathedral via Luna/Bassig Streets into Ugac Norte. ETA/cancellation constants live in `servio-api/src/config/cities.ts` (`CITY_PROFILES.tuguegarao`). There is no service radius any more (ADR-035). Sample catalog prices are prototype assumptions that still need Cagayan validation (ADR-008).

---

## 2. Key Personas & Platforms

1. **Unified Mobile App (Customer & Servio Pro), `servio-app/`:**
   - **Ionic-Angular (`@ionic/angular`)** with **HTML** and **SCSS**, wrapped with **Capacitor** for iOS and Android.
   - Bottom tabs (`ion-tabs`): **Home** (`/tabs/home`), **Directory**, **Bulletin**, **Tracking**, **Profile**. In Pro mode the first tab is the Pro **Dashboard** (`/tabs/pro`) instead of Home.
   - One account can be both customer and Pro; `POST /me/switch-role` toggles the active mode (ADR-030).
   - **Brand & UI assets:** logo/icon files in `assets/logo/`, illustration in `assets/design/`. Editable UI is in [SERVIO Figma](https://www.figma.com/design/ejP1MZ0Bzaqxzc31vgo5Bi/SERVIO) and the local `SERVIO.fig`; see `Servio_Vault/03_User_Experience_and_Screens/Figma_UI_Completion_Handoff.md`. Current app screenshots are in `Servio_Vault/03_User_Experience_and_Screens/assets/` (the old `assets/ui/` mockups were removed).
   - **Pricing direction:** Use local Philippine service-market examples, not dollar amounts relabeled as pesos. Sample fees, the ₱50 trust fee and the 85/15 Pro payout split are prototype assumptions pending validation.

2. **Admin / Dispatch Operator:** Planned web console (KYC review, catalog/pricing, disputes, escrow release/refund). **Not built.** Only staff support-report endpoints exist (`/support/admin/requests`, ADMIN role, no UI).

---

## 3. Technology Stack (verified 2026-11-15)

- **Mobile client:** Angular 22.2.3 standalone (zoneless, signals, OnPush), `@ionic/angular` 9, Capacitor 8.5 (iOS + Android projects committed), TypeScript ~6.0. Maps: Leaflet 1.9 with an OpenFreeMap vector basemap via MapLibre GL (raster OSM fallback). Native plugins: geolocation, camera, preferences, local-notifications, app, haptics, status-bar, keyboard, native-audio.
- **Backend:** `servio-api/` on Cloudflare Workers + Hono 4 + Valibot, Drizzle ORM over `pg` to Neon Postgres 17 (Hyperdrive in production, caching disabled; direct URL locally), R2 for uploads, Durable Objects `OrderRoom` (booking/Pro/user live rooms over WebSockets) and `Geocoder` (Nominatim queue). 13 migrations (`0000`–`0012`). Node 26 (`.nvmrc`).
- **Production:** Worker `servio-api` at `https://servio-api.mcleinonza0531.workers.dev/api/v1` (Cloudflare account `mcleinonza0531`, `account_id` pinned in `wrangler.toml`), Neon project `servio` (Singapore, branch `production`), R2 bucket `servio-uploads`. Production has no demo accounts.
- **Sign-in:** 6-digit email codes over Gmail SMTP (owner-configured App Password). No SMS, Google or Apple sign-in yet.
- **Payments:** Mock `PaymentProvider` behind a real double-entry escrow ledger. Holds, releases, tips, coupons and GCash cashouts are simulated; no PayMongo.
- **Notifications:** In-app inbox + header bell, and local phone notifications while the app is open or recently backgrounded. No FCM/APNs push (ADR-037).
- **Tests/CI:** None in the tree. The API Vitest suites and app specs were deleted in commit `397a45d` (2026-10-22); there is no GitHub Actions workflow. `npm run lint` (app) and `npm run typecheck` (API) still work.

---

## 4. Implemented Feature Set (summary)

Email-code accounts with profile/photo editing; saved map-pinned addresses with Nominatim autofill; catalog, directory and Bulletin (fixed-SKU requests that a Pro can reserve before customer checkout); checkout with idempotent mock escrow hold and loyalty coupons (3/10/15 completed orders); foreground nearest-Pro dispatch (60 s offers, up to 5 Pros); live GPS tracking, chat with photos and carrier phone calls; add-on quotes with photo evidence; customer completion PIN releasing escrow (85/15 split + ₱50 fee to platform); reviews and tips; ledger-derived Pro wallet and mock GCash cashout; cancellation fees and Pro strikes; notifications inbox; Help reports and payment preference; demo seed/reset tooling. Details per decision in `DECISIONS.md`.

---

## 5. Operating Rules for AI Agents

1. **Strict Scope Enforcement:** Always refer to `.brain/SCOPE.md` and `vault/02_Scope_and_Boundaries/Guardrails_for_AI.md` before writing code or proposing features. Do NOT invent unrelated modules (e.g., complex B2B enterprise procurement, crypto payments, social networking feeds).
2. **Standardized SKU Model:** Maintain the core design principle — services must be treated like menu items with defined base scopes and controlled add-on mechanics.
3. **Escrow First:** Never bypass the escrow state machine. Providers are only credited when the job status is `COMPLETED` and confirmed via the customer's completion PIN (cancellation fees in ADR-009 are the only exception).
4. **Knowledge Synchronization:** When architectural decisions or scope boundaries are refined, update `.brain/` and `vault/` in sync.
5. **Production safety:** Never run demo seed/reset commands against production; recreate Hyperdrive only with caching disabled (see `NOTES.md`).

## 6. Related Projects

- **AdvanCare** (same owner) — SERVIO copied its backend stack (Workers + Neon + R2) and email-code sign-in pattern (ADR-005, ADR-006). No code, credentials, storage or databases are shared (ADR-007). Its local Wrangler dev server can also occupy port 8787.
