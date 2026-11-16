# SERVIO — Operational Notes & AI Agent Guidelines

> **Target Audience:** Any AI coding agent, developer, or collaborator working within this workspace.
> **Updated:** 2026-11-16

---

## 1. How to Think About SERVIO
- Think of SERVIO as **Foodpanda + Urban Company**.
- In Foodpanda: Restaurant -> Menu Items -> Cart -> Rider Dispatched -> Rider En Route -> Delivered.
- In SERVIO: Category -> Standardized Service Package (e.g. AC Cleaning 1-1.5HP) -> Cart -> Nearest Qualified Technician Dispatched -> Technician En Route -> Arrived -> Job Done -> Confirmed with the customer's completion PIN.
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
- `.brain/` has its own `.obsidian/` config (it can be opened as a vault); leave it alone.

## 4. Frontend Framework Mandate: Pure Ionic-Angular (HTML & SCSS)
- The mobile application MUST be developed strictly in **Ionic-Angular (`@ionic/angular`)** with **HTML** and **SCSS**, wrapped with Capacitor for iOS & Android.
- All screen layouts, custom cards, and status badges must match the UI design tokens defined in `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md`.
- Do NOT generate Flutter, React Native, or Vue code.

## 5. Running the App & Implementation Gotchas
- **App:** `cd servio-app && npm start` (http://localhost:4200). Lint: `cd servio-app && npm run lint`. Build: `cd servio-app && npm run build`. There is currently no `typecheck` script or test runner in `servio-app/package.json` (specs and the `angular.json` test target were removed on 2026-10-22).
- **API:** `cd servio-api && npm run dev` (Wrangler, port 8787). Checks: `cd servio-api && npm run typecheck` (checks `src/`, `scripts/`, and `test/`) and `cd servio-api && npm test` (runs `tsx --import ./test/setup.ts --test test/*.test.ts`, 17 unit/handler tests with mocked DB/DO stubs). Dry-run Worker build: `cd servio-api && npm run build`.
- **CI:** `.github/workflows/ci.yml` runs on `push` and `pull_request` using Node from `servio-api/.nvmrc` (`26`) with npm caching, executing `npm ci`, `npm run typecheck`, and `npm test` in `servio-api/`.
- **Port clash:** AdvanCare's local Wrangler can also hold port 8787 and answer "Route not found" for SERVIO paths. Do not kill the unrelated process; pick another port.
- First run shows onboarding. Offline mode accepts `123456`; live email codes come from the API log when SMTP is absent. New live users complete name/optional PH mobile before landing. The demo connection sheet on Login selects mock/API and a LAN URL. Mock customer completion PIN is `7492`; the live PIN comes only from authenticated booking reads. Live demo accounts use the locally configured `DEMO_LOGIN_CODE` (D2), without email. Staff cannot use mobile sign-in.
- `cd servio-api && npm run db:seed-demo` seeds the catalog and presentation baseline into local `servio_dev` and uploads four bundled PNGs to the local `servio-uploads-dev` R2 binding. It is idempotent, preserves ongoing bookings and refuses production/other-project databases or conflicting seed identities/codes. Full reset (`npm run db:demo-reset`) uses the dedicated local `servio_demo` database, never mixed `servio_dev`; seeding alone does not reset the clock or progress. Internal demo IDs start `de000000-0000-4000-8000-`; opening wallet credits display as Previous earnings.
- Leaflet maps inside Ionic pages need explicit width/height and `invalidateSize()` on `ionViewDidEnter`; tab pages are attached late.
- Do not put `maxlength="1"` on OTP cells: iOS one-time-code autofill inserts the whole code into the first cell (`app-code-input` distributes it).
- `ion-title` is absolutely positioned in iOS mode; `.servio-detail-bar` insets it past the back button.
- iOS: the app is forced to light appearance; `ServioBridgeViewController` (in `AppDelegate.swift`, set in `Main.storyboard`) hides the iOS 26 top scroll-edge gray fade.
- `OrderService.keep(id)` must be used on completion/review screens, otherwise the post-PIN live refresh drops the completed booking.

## 6. Production & Native Gotchas
- **Hyperdrive caching must stay disabled.** Cached SELECTs (~60 s) made `/me` and bookings stale (role flip-back, 20 s+ lag). Recreate Hyperdrive `servio-neon` only with `--caching-disabled` (ADR-036).
- Production runs only on the `mcleinonza0531` Cloudflare account (`account_id` pinned). Old `servio-ph` / `gellyborgie` workers.dev deployments are not production.
- Deploy: `cd servio-api && npm run deploy` (`--env production`); secrets via `npm run secrets:production` from ignored `PROD_*` values. Neon CLI: `neon deploy --no-env-pull` so it does not overwrite the local `DATABASE_URL`.
- Never run demo seed/reset/restore against production; production has no demo accounts and ignores `DEMO_LOGIN_CODE`.
- Phone app update: `cd servio-app && npm run native:production`, then `npx cap open ios` / `npx cap open android` and Run on the device. Syncing assets does **not** update an installed app; rebuild and reinstall after frontend changes. Backend-only deploys fix missing-endpoint errors without reinstalling.
- Free Apple ID (Personal Team) signing expires after 7 days; no paid Apple account, so no TestFlight or remote push.
- Gmail SMTP uses implicit TLS on port 465 only (no STARTTLS/587); use an App Password; production fails closed without credentials.

## 7. Removed Repo Files (recover from git if needed)
Brain/vault notes still mention these; they no longer exist in the working tree.
- `docs/` (`PRODUCTION.md`, `DEMO_CHECKLIST.md`, `DEMO_DATA.md`, `EMAIL_SETUP.md`, `MAPS.md`, `TRACKING.md`) and `assets/ui/` mockups — removed in `28e3e97` (2026-10-21). Read with `git show 28e3e97^:docs/PRODUCTION.md`.
- `CODEX_IMPLEMENTATION_PLAN.md` — removed in `f5f6665` (2026-10-18). `git show f5f6665^:CODEX_IMPLEMENTATION_PLAN.md`.
- API tests (`servio-api/test/`, `vitest.config.ts`) and app `*.spec.ts` — removed in `397a45d` (2026-10-22).
- Promo video sources (Remotion project, scripts, audio) were never committed; only the rendered MP4s are in `promo-video/`.
