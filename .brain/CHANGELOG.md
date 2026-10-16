# SERVIO — Changelog

All notable changes to the SERVIO project knowledge base, architecture, and codebase are documented here.

---

## [0.5.19] — 2026-10-16
### Fixed
- Booking peers may read the current avatar already included in their participant booking, while other customer photos remain private. Regression tests cover assigned Pro, stranger, missing auth and an old avatar. This unblocks loading Sophia’s seeded booking in the Pro app.
- Reset events now have strictly increasing timestamps after prior history, so the reset marker cannot hide Accepted/En Route when operations fall in the same millisecond.
- Directory tests use a distinct local origin so accumulated persistent test fixtures cannot displace the fixture at an identical-coordinate tie.
### Verified
- API typecheck and 151 tests pass; customer/Pro browser views load SRV-8821 after the permission fix. Ledger and event history remain append-only.

## [0.5.18] — 2026-10-16
### Added
- B2: Hibernatable booking and Pro dispatch rooms with short-lived signed session-bound single-use tickets, active-participant authorization, bounded connection lifetime and GPS validation/throttling. Profile location writes are conditional at 15-second intervals; status/money/no-show deadlines remain server-owned.
- Post-commit status/chat/add-on/reset events and deduplicated dispatch invalidations. REST polling remains a recovery path. Reset clears cached room GPS.
### Verified
- API typecheck and 149 tests pass. Miniflare connects two sockets: assigned Pro fixes reach customer, customer/invalid/throttled GPS is rejected, reconnect replays latest fix, profile write cadence holds, committed chat/add-on/status events arrive, session revocation/replay/cross-booking tickets fail, and money remains balanced/unchanged by GPS.

## [0.5.17] — 2026-10-16
### Added
- D3: Dedicated servio_demo full reset/backup/restore scripts with production/database/non-demo-row guards. Migrates an empty demo DB and reseeds catalog, baseline and local images; preserves normal dev/test databases (ADR-021).
- Participant-only prototype order reset appends compensating money/audit rows and a new base hold, clears mutable quotes/review, adjusts earned job/rating increments and restores fixed no-show timing. Current stepper starts after the reset marker. Existing money/events/chat stay intact.
- docs/DEMO_DATA.md covers setup, database selection, ignored custom backups, restore, R2 separation, guarded no-email sign-in and future owner-approved Neon branching.
### Verified
- Local dedicated demo DB migrated/reset/seeded, custom backup created and restored successfully. API typecheck and 144 tests, including reset auth/production/concurrency/ledger preservation and add-on/PIN/tip reversal; app build/lint and 32 tests pass with zero warnings.

## [0.5.16] — 2026-10-16
### Added
- D2: Optional six-digit DEMO_LOGIN_CODE skips email delivery for existing active demo customer/Pro accounts. Fixed-code login never creates accounts, never signs in staff, and is disabled in production; normal single-use codes and rate limits remain available.
### Verified
- API typecheck and 140 tests pass. Coverage includes normalized identity/session, no-email delivery despite hourly mail quota, production/unset/malformed guards, wrong code, non-demo/missing accounts, disabled/staff rejection and unchanged normal email-code authentication. No money paths changed.

## [0.5.15] — 2026-10-16
### Added
- D1: `npm run db:seed-demo` creates guarded, idempotent separate accounts, five approved Tuguegarao Pros, eight bookings including SRV-8821 and completed history, six catalog-priced bulletin posts, reviews/chat and four local R2 images. Script files now participate in API typechecking.
- Wallet reconciles to ₱8,640.75 available / ₱1,870 pending / ₱3,316.25 today using existing SKUs, balanced settlements/tips/cashout and internally marked opening earnings. Wallet labels use “Previous earnings”, per owner; no invented SKU or service price (ADR-019).
- Offline tutor renamed Sofia R., separate from customer Sophia M., with initials rather than the customer's avatar.
### Verified
- API typecheck and 135 tests pass, including database scope/production guards and catalog-only demo data. App build/lint and 31 tests pass with zero warnings. Seed ran locally with image uploads; second run preserved existing rows and ledger transaction IDs. Baseline checks assert all three wallet amounts, and every local ledger transaction remains balanced.

## [0.5.14] — 2026-10-16
### Fixed
- Demo dispatch permits an approved online Pro to queue another job while finishing a current booking, consistent with the owner's EN_ROUTE-based no-show policy. Removed the extra busy-Pro restriction; acceptance still changes no money and keeps all authorization/expiry locks. Regression test covers a second acceptance while another job is in progress.

## [0.5.13] — 2026-10-16
### Added
- C4: API-backed Pro availability, offer radar/acceptance, job status/cancellation, owned photo evidence/add-on quotes, customer PIN completion, ledger wallet/pagination and mock GCash cashout. Pro routes require a Pro account; chat shows the correct peer and both parties' actual messages.
- Minimal A2/B1 demo dependency: foreground dispatch heartbeat, fresh qualified nearby Pros, one 60-second offer at a time, acceptance locks, decline/expiry chain and balanced refund on exhaustion. Demo and non-demo pools remain separate (ADR-018).
- Session rejection stops foreground work; switching offline/live modes cannot persist live PINs or copy server balances into mock state. Completion receipt distinguishes the Pro's 85% from platform/trust fees; illustrative QR and sample evidence controls are restricted appropriately.
### Verified
- App build/lint and 31 tests pass with zero warnings; API typecheck and 132 tests pass, including dispatch auth/validation/privacy, concurrent acceptance, stale/offline/unapproved/unqualified/future/distant exclusions, expiry/refund balance, two-way chat and server-owned wallet/PIN behavior.
- Two independent browser accounts: customer → Pro message, Pro → customer reply, reload persistence; booking → Pro status → local R2 evidence PUT → customer ₱350 approval → PIN → Pro ₱1,232.50 / platform ₱267.50 / escrow zero → ₱100 tip → ₱500 mock cashout + ₱15 fee, leaving ₱817.50. Live radar also accepted an unassigned job; Pro cancellation refunded it and recorded a strike. Every local ledger transaction remains balanced.
- Temporary `demo.*.verify@servio.test` accounts/rows are explicitly demo data for local validation. D1/D3 provide the presentation baseline/reset. Physical GPS, camera capture and phone installation remain for B3/F1/D4.

## [0.5.12] — 2026-10-16
### Added
- C3: API catalog/directory/bulletin and posting, stable-key checkout with scheduled timestamps, participant booking/history, customer-only PIN, add-on approval, cancellation, review/100% tip submission and persisted photo/text chat. Live screens use API snapshots and identity; offline content remains separately usable.
- Public participant display summaries and catalog fee configuration, without contact/session metadata. Live booking/PIN state stays in memory and API fetches bypass browser cache. The simulator cannot alter live booking status (ADR-017).
### Verified
- App build/lint and 28 tests pass with zero warnings; API typecheck and 122 tests pass. Coverage includes centavo mapping, failed hold preserving escrow, ₱1,500 total / ₱1,232.50 Pro display, retry keys/no client prices, Philippine windows and participant privacy.
- Browser: live sign-in identity, empty customer state, catalog checkout → persisted ₱1,150 pending hold, bulletin create/read booking chat send/read, and cancellation → balanced compensating REFUND (both hold/refund sum to zero). Pro acceptance/settlement and cross-device realtime follow in C4/B2/B3.

## [0.5.11] — 2026-10-16
### Added
- C2: Email-code login/resend/verification, first sign-in name/optional PH mobile setup, session-aware role landing and demo-only API/LAN connection sheet, retaining the existing screen layouts and code-input behavior.
- Short prototype Terms, Privacy and Escrow pages and SERVIO email footer with the owner's placeholder address (ADR-016). Live sign-in shows the API development note; only offline mode accepts the test code.
### Verified
- Live browser: request logged code → verify → first profile save → customer home. Automated app checks cover normalization, session storage, profile setup, Pro routing, mock isolation, invalid codes and stale responses after sign-out. API typecheck/tests remain passing; no SMTP or physical-device email delivery was required.

## [0.5.10] — 2026-10-16
### Added
- C1: Angular Fetch HttpClient, API-relative Promise wrapper, scoped bearer/request-ID interceptor, safe error toasts and rejected-session clearing. Capacitor Preferences stores sessions separately from auth callers; mock tokens and API credentials are not forwarded to storage URLs.
- App API/mock/demo environment flags and validated, persisted demo connection settings for LAN/emulator addresses. Production has no connection override or assumed deployed URL. Blob upload/download helpers support the new storage endpoints (ADR-015).
### Verified
- App build/lint and API-client tests pass without warnings: auth/request/idempotency headers, foreign-origin exclusion, persisted LAN/mock configuration, URL validation, error-envelope toasts and session rejection. Existing tracking/money/OTP/slide tests remain passing.

## [0.5.9] — 2026-10-16
### Added
- A9: Once-only customer review after completion, 100% Pro tips with balanced entries, and integer rating_sum for exact aggregate averages (`0006_exact_review_averages`, migrated dev/test).
- Strict catalog/category bulletin creation and open/urgent/nearby feeds; approved Pro directory with distance, catalog from-price, availability and public reviews. Filters/ranking happen before the output limit.
- Participant-only chat, bounded text/owned photo attachments, read cursors and system messages for booking status changes; closed bookings reject new chat and KYC files cannot be reused as attachments. Shared booking helpers extracted for app/realtime integration (ADR-014).
### Verified
- API typecheck and 121 tests pass: review/tip auth, validation, duplicate concurrency, 100% tip balance and rollback; bulletin SKU/category/price constraints; chat privacy/photos/status messages/pagination; approved directory rates/distance; >100-candidate locality filtering regression. Philippine wallet day uses explicit UTC+08:00, retaining the no-old-city-string code guard.

## [0.5.8] — 2026-10-16
### Added
- A8: Pro-only wallet with ledger-derived available balance, 85% pending base/add-on earnings excluding trust fee, earnings since Philippine midnight, and stable pagination across posted/pending rows.
- Mock GCash cashout (₱500 minimum, ₱15 fee) checks balance while holding a per-Pro transaction lock, writes balanced payout/fee entries and a REQUESTED→PAID mock payout, and retains only the masked number (ADR-013).
### Verified
- API typecheck and wallet tests cover pending/completed balances, approved add-ons, locked concurrent cashouts, fee-aware insufficiency, auth/input validation, masked destinations, balanced entries, pagination and Philippine-day boundaries.

## [0.5.7] — 2026-10-16
### Added
- A7: Customer-only HMAC-derived completion PIN, assigned-Pro verification in ARRIVED/IN_PROGRESS, constant-time compare and persisted five-attempt 423 lockout. PINs are neither stored nor logged.
- One locked transaction captures mock escrow, completes the booking/event, credits aggregate service value at 85/15 (trust fee to platform), empties escrow and increments jobs_done. Concurrent/replayed PINs cannot release twice; failure rolls everything back. Completion event uses server clock after the booking lock (ADR-012).
### Verified
- Known independent HMAC vector, ₱1,100 + ₱350 → Pro ₱1,232.50 / platform ₱267.50 / escrow zero, auth/PIN visibility, input/state validation, committed lockout, capture rollback, missing secret, replay and concurrent release tests.

## [0.5.6] — 2026-10-16
### Added
- A6: Owned upload intents (`0005_upload_ownership`, migrated dev/test), strict purpose/type/size/key validation, 15-minute R2 PUT signatures covering type+length, and authorized 60-second downloads. Add-on evidence must be the Pro's own fully uploaded image.
- `UPLOADS_MODE=local` uses signed, bounded HTTP PUT/GET capabilities against Wrangler's local R2 binding, making photos work on local Wi-Fi without cloud resources; production rejects this mode. R2 mode uses only dedicated `servio-*` bucket credentials. ADR-011 and `.env.example` document the modes.
### Verified
- API typecheck and 96 tests pass. New tests cover local round-trip bytes, cache/nosniff headers, dummy-credential R2 presigning without network, auth/participant restrictions, unowned/incomplete evidence, size/type/purpose limits, tamper/expiry and production guard. Live cloud R2 remains unverified because the owner has not created resources.

## [0.5.5] — 2026-10-16
### Added
- A5: Catalog-only add-on quotes in ARRIVED/IN_PROGRESS, restricted to the assigned Pro, with validated evidence key/note and one pending quote at a time.
- Customer approval atomically adds a balanced `ADDON_HOLD`; decline leaves escrow unchanged. Booking reads include snapshotted add-ons in their totals. Concurrent approvals hold once; failed authorization rolls back the decision and ledger writes.
### Verified
- API typecheck and add-on tests cover ₱350 → ₱1,500 escrow, later ₱297.50 Pro share, auth, strict input/SKU validation, lifecycle restrictions, decline, replay, concurrent quote/approval and rollback. Upload ownership/content is integrated by the next task, A6.

## [0.5.4] — 2026-10-16
### Added
- A4: Participant-only booking detail and cursor-paginated customer/Pro lists, event/add-on totals, assigned-Pro status transitions and 409 invalid-transition guards. Completion still requires the upcoming PIN endpoint.
- Locked cancellation transactions refund full escrow before departure, keep a ₱100 trip / ₱200 visit fee entirely for the Pro, block in-progress customer cancellation for admin dispute, and refund fully with one strike when the Pro cancels. All movements use balanced compensating entries and record the reason in append-only events.
- `0004_booking_status_and_deadlines` stores schedule windows, arrival ETA, fixed no-show deadlines and Pro strikes; migrated dev/test. ASAP departure uses fresh Pro location or Tuguegarao fallback; scheduled deadlines remain window end +30 min. Server time controls no-show eligibility; expired new schedule windows are rejected before money writes.
- Owner demo answers recorded in ADR-010 and implementation plan sections 3/4: October 19; iPhone customer, Android Pro; LAN/local API and no-email demo sign-in; Android build required; FCM/admin/CI/deploy deferred. No cloud resources assumed.
### Verified
- API typecheck and 69 tests pass on Node 26, including status tables, wrong actor/order, cancellation amounts/balance, no-show timing, concurrent cancellation, schedule validation and pagination.

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


