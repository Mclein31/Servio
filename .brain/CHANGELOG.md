# SERVIO — Changelog

All notable changes to the SERVIO project knowledge base, architecture, and codebase are documented here.

---

## [0.5.3] — 2026-10-16
### Changed
- Launch city is Tuguegarao City, Cagayan (ADR-008). Verified city-proper map center on OSM and replaced the former route with a 1,802.3 m OSRM driving route from near the cathedral via Luna/Bassig Streets into residential Ugac Norte, retaining OSM/ODbL attribution.
- Localized bulletin pins/feed, helper bios, profile/radar/checkout/chat text and the demo booking address. Cached demo addresses migrate without resetting lifecycle or financial state. Prices, SKUs, identities, order numbers and the 85/15 split are unchanged. Onboarding illustration geometry/styling/motion are unchanged; its two street labels are localized.
- Added `CITY_PROFILES.tuguegarao` and `LAUNCH_CITY`: 20 km/h, road factor 1.3, 15–60 min clamp, 30 min fallback, +30 min grace, 15 min accepted timeout. Cancellation fees share the same config; ADR-009 records the owner's cancellation/no-show policy for A4 implementation.
- Updated project context, D1/B1/B3 plan notes and Figma pricing handoff; existing sample prices require Cagayan validation. D1 demo seed is still pending and will use these locations.
### Verified
- Existing dependency audit findings (Angular/tooling high/critical and transitive moderate advisories) remain outside this city task; no dependencies were changed.
- Node 26: app build/lint and 16 tests pass without warnings; API typecheck and 41 tests pass. Route length, rider progression and cached-address migration have tests. Browser verification shows the rider moving on Tuguegarao streets. No former-city strings remain in app/API source, scripts or fixtures.

## [0.5.2] — 2026-10-16
### Added
- A3: Authenticated `POST /bookings`, fixed catalog price snapshots, configurable ₱50 trust fee, approved/qualified direct Pro validation, and atomic mock authorization + booking event + balanced escrow hold. No Pro credit on booking.
- Per-customer idempotency keys with payload fingerprints, transaction locks and a unique constraint (`0003_booking_idempotency`, migrated dev/test). Concurrent retries return one booking and one hold; changed payloads return 409.
- Replaceable mock `PaymentProvider` interface; no real payment integration. Auth, validation, rollback and money checks pass with all 38 API tests and typecheck on Node 26.

## [0.5.1] — 2026-10-16
### Added
- A1: `0002_demo_and_pros` adds non-null `is_demo` flags to users, bookings and bulletin requests. Booking codes now default to a dedicated Postgres sequence starting at SRV-8800, capped at six digits without cycling.
- Database schema tests verify flags, defaults, sequence configuration and generated unique codes. Migration applied to `servio_dev` and `servio_test`; API typecheck and 20 tests pass on Node 26.

## [0.5.0] — 2026-10-16
### Added
- `servio-api/` (Cloudflare Workers + Hono + Drizzle + Neon-ready): 17-table schema, ledger guard triggers (append-only, balanced double-entry), catalog seed, request-id/CORS/error/db/session middleware, `GET /health`, `GET /catalog`, email-code sign-in (`/auth/request-code`, `/auth/verify-code`, `/auth/sign-out`), `GET/PATCH /me`. 18 Vitest tests in workerd against a local throwaway Postgres.
- `CODEX_IMPLEMENTATION_PLAN.md`: task-by-task plan (with acceptance criteria) for the remaining backend, app wiring, demo data/reset/backup, admin console, Android, push and deploy.
- ADR-005 (backend stack) and ADR-006 (demo scope decisions).

## [0.4.0] — 2026-10-15
### Added
- `servio-app/`: Ionic 9 + Angular 22 standalone + Capacitor 8 client implementing all five implementation prompts (tokens/atomic components, 5-tab shell, onboarding + phone OTP, customer escrow lifecycle, Servio Pro execution) against `SERVIO.fig` styling and mock data.
- Foodpanda-style live tracking engine (`shared/utils/route-track.ts`, `core/services/tracking-sim.service.ts`, `app-tracking-map`): street-following OSM route, 1 s GPS heartbeat with per-frame interpolation, corner braking, smoothed heading cone, grey travelled / orange remaining route, follow camera with re-center. Onboarding Track slide uses the same motion model in SVG.
- Escrow lifecycle wired end to end on one device: checkout hold → Pro accept/en-route/arrived/working → add-on quote → customer approval → completion PIN 7492 → wallet credit (85/15 split).
- Unit tests (Vitest) for peso split/formatting, slide threshold, PH mobile formatting and route geometry.

### Changed / Notes
- CARTO basemaps now require an API key; maps use CARTO Light when `environment.cartoApiKey` is set, otherwise light-filtered OSM tiles (dev only).
- Content conflicts resolved toward one coherent demo order: #SRV-8821 is “Split AC Water Leak Repair” (₱1,100 + ₱50 fee) by Daniel K. for Sophia M. everywhere; “Laptop Repair Pickup” moved to order history. Signed-in user is Sophia M. (brief) rather than Figma’s Mia Santos. Status-badge colours follow the brief (Open = blue) rather than Figma (Open = green).

## [0.3.1] — 2026-10-15
### Changed
- Applied Figma’s built-in iPhone 14 Plus preset to all 26 mobile screens (428 × 926), reflowed artwork/content, and verified the Midnight portrait device shell in Play preview.
- Matched remaining warm feature cards to the main-screen solid brand orange with white text.

## [0.3.0] — 2026-10-14
### Added
- Editable SERVIO Figma screen completion, brand/logo master variants, shared tokens and customer/Pro prototype navigation.
- Three introductory onboarding screens with original vector graphics and one-time Smart Animate reveals.
- `Servio_Vault/03_User_Experience_and_Screens/Figma_UI_Completion_Handoff.md` with pricing research, prototype assumptions and implementation boundaries.
- Generated sample repair evidence asset at `assets/design/sample-drain-hose-evidence.png`.
- Original transparent neighborhood helping illustration at `assets/design/neighborhood-help-illustration.png`, used as a linked Home/onboarding artwork component.

### Changed
- Replaced USD sample pricing with representative local Philippine service rates; retained consistent example escrow totals and the brief's 85% Pro payout math.
- Corrected Bulletin's stretched add control to 48 × 48 and documented the fixed-price catalog/offers-sheet distinction.
- Corrected the stale Flutter initialization task to Ionic-Angular.

## [0.2.2] — 2026-10-14
### Added
- Integrated official SERVIO brand logo and app icon assets:
  - `assets/logo/servio_logo_light.png` (Light logo with white background container).
  - `assets/logo/servio_app_icon_orange.png` (Solid brand orange squircle app icon).
  - Synchronized assets into `assets/logo/` and `vault/03_User_Experience_and_Screens/assets/`.
- Updated `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md` with brand asset specs and emblem anatomy.

## [0.2.1] — 2026-10-14
### Changed
- Standardized the mobile client framework to **pure Ionic-Angular (`@ionic/angular`) with HTML templates and SCSS styling**, replacing Flutter.
- Updated ADR-003 in `.brain/DECISIONS.md`, `.brain/PROJECT_CONTEXT.md`, and `.brain/ARCHITECTURE.md`.
- Updated `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md` with complete Ionic component tree, `src/theme/variables.scss` tokens, and `tabs.page.html` templates.
- Enforced Ionic-Angular framework constraint in `vault/02_Scope_and_Boundaries/Guardrails_for_AI.md` and `.brain/NOTES.md`.

## [0.2.0] — 2026-10-14
### Added
- Integrated user-approved visual screen design mockups into dedicated UI asset folders:
  - `assets/ui/01_screen_home.png`
  - `assets/ui/02_screen_directory.png`
  - `assets/ui/03_screen_bulletin.png`
  - `assets/ui/04_screen_profile.png`
  - `assets/ui/05_screen_tracking.png`
- Created `vault/03_User_Experience_and_Screens/UI_Assets_and_Screen_Specs_for_Codex.md` with pixel-level widget blueprints, design system tokens, and screen mockups for Codex.
- Updated `vault/03_User_Experience_and_Screens/Screen_Inventory.md` to map directly to the 5-tab core navigation (`Home`, `Directory`, `Bulletin`, `Tracking`, `Profile`).
- Synchronized `.brain/PROJECT_CONTEXT.md` and `.brain/ARCHITECTURE.md` with the 5-tab unified client topology.


