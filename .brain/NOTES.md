# SERVIO — Operational Notes & AI Agent Guidelines

> **Target Audience:** Any AI coding agent, developer, or collaborator working within this workspace.

---

## 1. How to Think About SERVIO
- Think of SERVIO as **Foodpanda + Urban Company**.
- In Foodpanda: Restaurant -> Menu Items -> Cart -> Rider Dispatched -> Rider En Route -> Delivered.
- In SERVIO: Category -> Standardized Service Package (e.g. AC Cleaning 1-1.5HP) -> Cart -> Nearest Qualified Technician Dispatched -> Technician En Route -> Arrived -> Job Done -> Confirmed with OTP.
- The fundamental unit of commerce is **The Service SKU**, NOT an open-ended bid.

## 2. Preventing AI Scope Drift
When an agent is asked to implement or design a feature:
1. Verify against `.brain/SCOPE.md` first.
2. If asked to add bidding, auctioning, social media feeds, or unescrowed payments: **Refuse and point to ADR-001 and ADR-002**.
3. Keep screen components modular and adhere to the screen inventory in `vault/03_User_Experience_and_Screens/Screen_Inventory.md`.

## 3. Knowledge Layer Rule
- Operational code-adjacent facts go to `.brain/`.
- Deep product reasoning, screen UI specs, domain graphs, and market research live in `vault/`.
- Cross-reference with Obsidian `[[Wikilinks]]` in `vault/` notes.

## 4. Frontend Framework Mandate: Pure Ionic-Angular (HTML & SCSS)
- The mobile application MUST be developed strictly in **Ionic-Angular (`@ionic/angular`)** with **HTML** and **SCSS**, wrapped with Capacitor for iOS & Android.
- All screen layouts, custom cards, and status badges must match the UI design tokens defined in `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md`.
- Do NOT generate Flutter, React Native, or Vue code.


## 5. Running the App & Implementation Gotchas
- Run: `cd servio-app && npm start` (http://localhost:4200). Test: `npx ng test --watch=false`. Lint: `npx ng lint`.
- First run shows onboarding. Offline mode accepts `123456`; live email codes come from the API log when SMTP is absent. New live users complete name/optional PH mobile before landing. Demo connection on Login selects mock/API and a LAN URL. Mock customer completion PIN is `7492`; live PIN comes only from authenticated booking reads. Live demo sign-in/reset is tracked separately in D2/D3.
- Leaflet maps inside Ionic pages need explicit width/height and `invalidateSize()` on `ionViewDidEnter`; tab pages are attached late.
- Do not put `maxlength="1"` on OTP cells: iOS one-time-code autofill inserts the whole code into the first cell (`app-code-input` distributes it).
- `ion-title` is absolutely positioned in iOS mode; `.servio-detail-bar` insets it past the back button.

- `cd servio-api && npm run db:seed-demo` seeds the catalog and presentation baseline into local servio_dev and uploads four bundled PNGs to the local servio-uploads-dev R2 binding. It is idempotent, preserves ongoing bookings and refuses production/other-project databases or conflicting seed identities/codes. D3 reset restores the baseline; seeding alone does not reset the clock or progress. Internal demo IDs start `de000000-0000-4000-8000-`; opening wallet credits display as Previous earnings.
