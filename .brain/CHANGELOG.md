# SERVIO — Changelog

All notable changes to the SERVIO project knowledge base, architecture, and codebase are documented here.

## [0.5.36] — 2026-10-22
### Changed
- **Bulletin hides completed requests:** `GET /bulletin` excludes `COMPLETED` rows (including the author's own); `CommunityService.requests` filters them too, so Bulletin and the Home preview show only unfinished requests.
- **Rating from Order History:** booking payloads include `reviewRating`; unrated completed customer bookings show a "Rate" pill and a "Rate {Pro}" button (`/order/:id/review`), rated ones show the stars given. Submitting a review refreshes history.
- **iOS status bar:** app forced to light appearance (`UIUserInterfaceStyle` in both plists, `StatusBar.setStyle(Light)`); `ServioBridgeViewController` (in `AppDelegate.swift`, set in `Main.storyboard`) hides the iOS 26 top scroll-edge effect that drew a gray fade.
- **Rating on the completion screen:** the rating/tip form is now `app-rating-form` (shared by `/order/:id/review` and the completion sheet). Once escrow is released, the completion sheet shows the form inline; after submitting it returns to Tracking.
### Fixed
- **Completed booking dropped while on completion/review screens:** `OrderService.keep(id)` makes `refresh()` keep that booking even after it leaves the active statuses; previously the post-PIN live refresh emptied the order, so customers never saw "Job complete".
- **Completion PIN sheet swipe:** the sheet now drags down with the finger (dismisses to Tracking past 120 px, otherwise snaps back) and the page no longer rubber-bands.

## [0.5.35] — 2026-10-21
### Changed
- **Pro dashboard inside the tab bar:** dashboard moved to `/tabs/pro` (`/pro` redirects); in Pro mode the first tab is "Dashboard" instead of Home.
- **Instant availability toggle:** `ProService.availability` updates optimistically, saves the latest choice in the background, accepts a GPS fix up to 30 s old, and reverts with an error on failure.
### Fixed
- **Completion PIN reset on the Pro screen:** `OrderService.complete` now trusts the `verify-pin` response instead of the shared order state, which the post-completion live refresh replaced with an empty order (showing "Incorrect PIN" and clearing the boxes). Profile/wallet refresh failures no longer surface as PIN errors.

## [0.5.34] — 2026-10-21
### Added
- **Notifications inbox (ADR-037):** table `notifications` (migration 0010; 0011 drops the briefly-added `push_tokens`). `GET /notifications`, `POST /notifications/read` (ids / booking+kind / all). Rows are written after commit in `live/notify.ts` from `live/notices.ts` rules (booking created/status/cancel/complete, messages, add-on quote/decision, reviews, dispatch offers and no-Pro refunds, bulletin accept/release/cancel); the actor is never notified. Each insert sends `{type:'notification'}` to the recipient's `user:` room.
- **Header bell** (`app-notification-bell`) with a red unread dot on Home, Profile and the Pro dashboard; `/notifications` page with mark-all-read, pull to refresh and tap-to-open. Opening a chat marks its message notifications read.
- **Free system alerts:** `@capacitor/local-notifications` shows new notifications as phone notifications when they arrive over the live socket while the app is backgrounded. No Firebase/APNs or paid Apple account. A fully closed app gets nothing until reopened (the bell then catches up).
### Removed
- FCM push (owner declined Firebase and a paid Apple account): `@capacitor/push-notifications`, `lib/push.ts`, device-token endpoints and `push_tokens`.
### Fixed
- Demo reset TRUNCATE now includes `support_requests` and `notifications`.
### Verified
- API typecheck and 203 tests; production migrations 12/12; Worker `e1fbf224-b63c-47aa-8e1c-94d66165abea`. App lint and 119/120 tests (pre-existing profile-editor failure). Bell/page/local alerts not yet checked on physical phones.

## [0.5.33] — 2026-10-21
### Fixed (realtime latency audit)
- **Stale reads / role flip-back:** production had moved to other Cloudflare accounts whose Hyperdrive configs cache SELECTs (~60 s), so `/me` and booking reads returned stale rows (Profile switched back to Pro; updates lagged 20 s+). Production is back on `mcleinonza0531` with Hyperdrive `servio-neon` (`4eab0f26…`, caching disabled); `account_id` is pinned in `wrangler.toml`. Worker version `e4fd6b86-db6e-422e-9651-b82872b9fe50`.
- **Personal live room (`user:<id>`, `/me/live-ticket`, `/me/live`):** every booking create/status/cancel/message/add-on/offer and bulletin accept/release/cancel notifies both participants; pending-offer Pros get a `dispatch` refetch on booking changes; new ASAP bookings wake eligible online Pros immediately.
- **Client sockets:** dead-socket detection (25 s silence → reconnect), reconnect on app resume/online, 5 s polling only while the socket is down (30 s otherwise). Chat messages show a toast when that chat is not open.
- **Dispatch:** an ASAP booking with no eligible Pro yet waits up to 5 minutes (`FIRST_OFFER_WAIT_MS`) instead of refunding instantly.
- **Performance:** `GET /bookings` batches details (4 queries per page instead of 5 per booking); room broadcasts no longer open a DB connection per event; GPS throttle 750 ms.
- **Tracking:** production (no road route) glides the marker between real fixes instead of jumping.
### Verified
- API typecheck and 197 tests; app lint, typecheck and 114/115 tests (the profile-editor photo-removal spec fails identically on the previous commit). Production health/route smoke checks; Android debug APK built against the new host.
### Known / not changed
- Other deployments (`servio-ph`, `gellyborgie` workers.dev) are outside this account and must be deleted by their owners. Direct (specific-Pro) bookings still start ACCEPTED without Pro consent; a Pro with an active job still sees one active booking at a time. No push notifications yet.

## [0.5.32] — 2026-10-17
### Fixed
- **Tracking Card Layout & Dock**: Replaced hardcoded negative margin hack (`-124px`) with a sticky `.tracking-dock` container and responsive `.tracking-widget` (centered with `max-width: 680px`), eliminating content overlap on Home tab and awkward layouts on tablet screens.
- **Order History Cancellation Tracking**: Updated `OrderService.history` to record both `COMPLETED` and `CANCELLED` bookings. Cancellation transitions the order state with `escrow: 'REFUNDED'`, records the cancellation timestamp, and displays a dedicated cancelled pill and refund note in Order History and Live Tracking.
- **Self-Booking Prevention (Defense in Depth)**:
  - `servio-api`: Added validation in `POST /bookings` rejecting direct bookings when `input.proId === customerId` (`SELF_BOOKING_NOT_ALLOWED`), and guarded `POST /pro/jobs/:id/accept` against accepting jobs booked by the same user.
  - `servio-app`: Added checks in `OrderService.book()`, `checkout.page`, `helper-card.component`, and `helper-profile-modal.component` preventing users from booking their own service, disabling the booking button and displaying "Your Profile" / "Your Pro Profile". Gated name-matching heuristic strictly to mock mode to prevent false positives in live multi-user environments.
- **Community Category Card (Beauty & Care)**: Exposed all 5 service categories on the Home tab, widened card width to min 124px, added multi-line wrapping with line clamp for labels and captions, uniform 126px min-height, and a 5-column tablet grid (`repeat(5, minmax(0, 1fr))`) on screens >= 640px to eliminate card overflow and uneven heights.
- **Navigation Bar Compaction & Universal Safe Area**: Reduced `--servio-tab-bar-height` to 44px, compacted tab pills (36px), icons (18px), labels (10px), and reduced `--servio-app-bar-height` to 54px. Removed restrictive `:host-context(.plt-ios)` from `.servio-tab-bar` so `env(safe-area-inset-bottom, 0px)` universally protects Android 14+ edge-to-edge gesture navigation as well as iOS. Unified Home app bar height to `var(--servio-app-bar-height)` to eliminate header tab-switch jank.
- **Mobile & Tablet Responsiveness**: Added responsive container constraints (`max-width: 720px; margin: 0 auto;`) for sections, action bars, bottom sheets, and tab dock. Added 3-column and 4-column tablet breakpoints to Directory helper grid.
- **Profile Metric Accuracy**: Fixed `ProfilePage.liveMetrics` to filter completed bookings (`h.status === 'COMPLETED'`) so cancelled orders do not artificially increment the "Completed" jobs metric.

### Verified
- Automated code-reviewer subagent audit completed; all 7 prioritized findings addressed and verified with sign-off.
- `servio-app` unit tests: all 15 test files (53 tests) pass cleanly.
- `servio-app` linting: passed with 0 errors.
- `servio-api` typecheck: passed with 0 errors.

## [0.5.31] — 2026-10-17
### Fixed
- Directory category navigation filter leak: resolved issue where newly onboarded Pros appeared under all categories regardless of active filter chip due to `POST /me/upgrade-pro` linking every catalog SKU and setting placeholder headline `'Community Service Professional'`.
- `servio-api`: Updated `POST /me/upgrade-pro` to accept optional `categoryId` and `headline`, scoping linked `pro_skus` strictly to the chosen category. Added `POST /me/pro-trade` endpoint enabling Pros to change their trade category and re-scope assigned SKUs.
- `servio-app`: Updated Pro onboarding in `ProfilePage` to prompt the user to select their primary trade category (Repairs, Tutoring, Errands, Beauty & Care, Tech Help). Added a "Change Service Category" item under Pro settings to switch service categories on the fly with immediate Directory refresh.
- Synchronized active Pro records in Neon PostgreSQL to reflect specific trade category SKUs.

## [0.5.30] — 2026-10-16
### Added
- Servio Pro onboarding and dual-persona mode switching across `servio-api` and `servio-app` (ADR-030).
- `servio-api`: `POST /me/upgrade-pro` activates a customer account into an approved Pro, initializes `isOnline: false`, and batch links catalog SKUs. `POST /me/switch-role` enables toggling between `CUSTOMER` and `PRO` modes.
- `servio-api`: Added active booking guard on `switch-role` rejecting exit to Customer mode when assigned to in-progress jobs (`ACCEPTED`, `EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`) to protect escrow integrity. Protected staff accounts from role mutation.
- `servio-api`: `GET /me` now returns `proProfiles` unconditionally when present, decoupling Pro standing from active mode.
- `servio-app`: `ProfilePage` dynamically presents "Switch to Servio Pro" (direct mode toggle) for approved Pros in Customer mode, or "Become a Servio Pro" (onboarding modal) for non-pro customers. In Pro mode, displays "Servio Pro Dashboard" and "Switch to Customer Mode".
### Verified
- Automated code-reviewer subagent audit completed; all 9 prioritized findings addressed and verified.
- `servio-app` unit tests: all 15 test files (53 tests) pass. Angular and API TypeScript checks pass with 0 errors.
- `servio-api` deployed to production Cloudflare Worker (`https://servio-api.mcleinonza0531.workers.dev`).
- Native iOS assets re-built and synchronized via `npm run native:production`.

## [0.5.29] — 2026-10-16
### Deployed
- `servio-api` production Worker at https://servio-api.mcleinonza0531.workers.dev (Hyperdrive `servio-neon` → Neon `servio`/production, R2 `servio-uploads`, `preview_urls = false`). Ten production secrets uploaded with `npm run secrets:production` from ignored `PROD_*` values.
- `servio-uploads` CORS (`servio-api/r2-cors.json`): GET/PUT/HEAD with `content-type` from capacitor://localhost, http://localhost, https://localhost.
- App `environment.prod.ts` points at the production Worker; `npm run native:production` builds against it. Demo builds still use the LAN API.
### Verified
- Live health: production, database ok via Hyperdrive. Catalog returns 5/9/3. CORS preflight from capacitor://localhost allowed; wrong codes and unauthenticated presign rejected. Signed R2 PUT (with app-origin preflight), signed GET and delete succeeded with the production keys.
- Not yet verified: real Gmail delivery from the Worker and a full signed-in phone flow against production. Production has no demo accounts (demo login is disabled there).

## [0.5.28] — 2026-10-16
### Added
- Neon project `servio` (sparkling-shadow-22356922, Singapore, Postgres 17), branch `production`, linked via `servio-api/neon.ts` (`neon init`). All 8 migrations applied over the direct URL; catalog seeded (5 categories, 9 SKUs, 3 add-ons). No demo data on Neon.
- Neon URLs live in ignored `servio-api/.env` as `NEON_DATABASE_URL` / `NEON_DATABASE_URL_UNPOOLED`; local `DATABASE_URL` stays on `servio_dev`. Run `neon deploy --no-env-pull` so the CLI does not overwrite the local URL.
### Verified
- Worker build dry-run passes; local Worker pointed at Neon's pooled URL returned health `database: ok` and the seeded catalog. Driver stays `pg` (node-postgres), Neon's recommendation for Cloudflare + Hyperdrive. Hyperdrive `servio-neon` (4eab0f26…, direct URL, caching disabled) created and bound in `[env.production]`; production dry-run shows the binding. R2 bucket `servio-uploads` exists. Worker deploy, production secrets and bucket CORS still pending.

## [0.5.27] — 2026-10-16
### Fixed
- Saved Addresses opened directly after an app reload showed an empty list: the address book's identity effect ran after the first refresh started and discarded it. Identity now syncs before each refresh (regression test added).
- Editing the default address no longer offers an "unset default" checkbox the API rejects (422 DEFAULT_REQUIRED); it explains how to change the default instead.
- Bulletin post neighborhood prefills from the customer's selected saved address instead of a fixed Ugac Norte value.
### Verified
- Browser rehearsal against the local API: add address, edit label/text and move the pin of an existing address, reload; PATCH persisted the new coordinates. API 165 tests, app lint/build and 52 tests pass.

## [0.5.26] — 2026-10-16
### Documented
- D4 runbook: Monday October 19 device/account setup, dedicated reset/backup, LAN reachability and CORS, Android JDK21/APK and free Apple Personal Team install, complete booking/add-on/PIN/wallet/review/reset flow, indoor route fallback and Gmail real-account steps.
- Verification table explicitly separates passing tests/builds from remaining Android installer, physical signing/GPS/camera and inbox checks. Full Demo milestone remains in progress.
### Verified
- Final API typecheck and 165 tests pass; Worker dry-run packaging succeeds without deploying. App build/lint and 50 tests pass with zero warnings; refreshed Android/iOS simulator builds succeed. Native iPhone session receives the Pro's simulated source with the correct label after the replay correction.

## [0.5.25] — 2026-10-16
### Added
- F1 native packages: SERVIO Android project, camera/location/notification declarations, existing-logo icons/splash, API-connected demo build/sync command and foreground location strings. Development defaults to API mode.
- Android Debug-only cleartext configuration, iOS Debug-only local-network plist, strict Release configurations and guards against packaging the demo network settings as Release. Native HTTPS localhost CORS origin included.
### Maintenance
- Angular 22.2.3 / Vitest 4.1.12 security patches and a compatible xcode uuid override; app dependency audit reports zero vulnerabilities. API runtime dependency audit is clear; four moderate advisories remain in its development-only Drizzle/esbuild toolchain.
### Verification
- App build/lint and 50 tests pass with zero warnings. Android debug APK builds; Release rejects demo config and the production network manifest denies cleartext. iOS simulator build succeeds, API sign-in and Tuguegarao tracking load on iPhone 14 Plus.
- Android emulator installation failed with a package-service broken pipe; a cold restart remained offline. Physical Personal Team signing, GPS/camera, actual Gmail delivery and cloud deployment remain unverified/deferred. Native Xcode emitted third-party Camera/AppIntents warnings; app build/lint/tests were warning-free.

## [0.5.24] — 2026-10-16
### Fixed
- Native rehearsal exposed stale progress when a remote demo sender restarted its route. Receivers now restart interpolation from the new simulated position and keep its source label. Delayed live router responses cannot replace embedded demo geometry.
- Added regression coverage for replay after a previously received endpoint and a delayed OSRM response after switching sources.

### Verified
- App build/lint and 50 tests pass with zero warnings, including both source-replay regressions.

## [0.5.23] — 2026-10-16
### Added
- Account-owned saved addresses with serialized defaults, explicit Tuguegarao map pins, current-location action, Profile address book and checkout location selection. Bookings snapshot the selected coordinates and validate the 10 km city coverage before any mock hold.
- Migration 0007, seeded Sophia home, demo-reset support, late-refresh/GPS guards and address-sensitive retry keys. Empty optional directions no longer block booking.
### Verified
- API typecheck and 165 tests; app build/lint and 48 tests pass with zero warnings. Browser persisted/reopened a Centro 10 pin and showed it at checkout. Payments remain mock.

## [0.5.22] — 2026-10-16
### Added
- Gmail SMTP local setup and real-account verification guide, owner-selected sender configuration, serialized OTP attempt/expiry/one-time checks and bounded SMTP cleanup.
### Verified
- API typecheck and 161 tests pass, including fake SMTP delivery/failure/timeout and concurrent code checks. Actual inbox delivery remains pending owner-configured credentials; no email was sent.

## [0.5.21] — 2026-10-16
### Added
- Functional profile Edit: persisted name, optional PH mobile, photo upload/removal and signed current-avatar display. Reuses the profile setup design, prefills the account, preserves failed edits and keeps the sign-in email read-only.
- PATCH /me validates non-empty updates and completed owned avatar uploads, rejecting other owners/purposes and identity/role changes. Payments remain simulated.
### Verified
- API typecheck and 154 tests; app build/lint and 42 tests pass with zero warnings. Browser saved Sophia’s contact edit through the API and returned to Profile. Real email delivery still requires sender configuration; no email credentials or real-payment resource was added.

## [0.5.20] — 2026-10-16
### Added
- B3 implementation: native foreground Geolocation, shared live socket lifecycle, immediate booking/chat/add-on/dispatch refresh, remaining-street snapping/interpolation, 20-second reconnect indicator and explicit Tuguegarao route fallback. Real booking pins survive arrival; queued-job selection preserves the current customer’s GPS stream.
- Separate conditional Pro location refresh prevents a delayed heartbeat from switching an offline Pro back online. Simulated GPS is accepted only for demo bookings outside production. iOS location descriptions and plugin binding included.
- Owner added real-user account/profile/map-address readiness while retaining mock payments; implementation plan/TODO updated. docs/TRACKING.md documents sources and current native verification limits.
### Verified
- API typecheck and 152 tests pass; app build/lint and 40 tests pass with zero warnings. Tests cover native watch cleanup, queue-safe GPS identity, arbitrary arrival coordinates, explicit source switching, reconnect retention, socket leases, street snapping and offline heartbeat guards. Two-browser rehearsal receives the Pro’s simulated source on the customer map. Native GPS/device rehearsal remains pending F1/D4.

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



## 2026-10-18 — Address pinning, calls and icons

- Owner selected key-free Leaflet/OpenStreetMap maps. Pin taps/drags/GPS reverse geocode through Nominatim with stale-response protection, caching and global request limits (`docs/MAPS.md`).
- Tracking/chat/Pro call actions open the peer's number via a participant-only active-booking endpoint; missing numbers show the requested message.
- Remaining UI glyph/custom success icons replaced with Ionicons. See ADR-031.

## 2026-10-18 — Branded launch preload

- Added a SERVIO preload from the initial HTML through Angular startup. It remains for at least 1.4 seconds and until initial routing completes, shielding onboarding and other entry pages from interaction until ready. Existing entry guards still choose onboarding, login or home; reduced-motion preferences disable the loading animation.

## 2026-10-18 — Provider card booking recovery

- Directory cards now expose Book Now and navigate directly to checkout; tapping the card still opens service selection in the profile.
- Helper profiles reuse the displayed directory record instead of requiring a second request. Missing-record fetch failures stay visible with Retry/Close instead of silently dismissing; booking requires a helper and selected SKU.
- Verified browser offline Directory → checkout, 65 app tests, lint, TypeScript, production build and zero dependency audit findings. Live booking was not verified: local port 8787 currently belongs to AdvanCare's Wrangler process and returns Route not found for SERVIO endpoints. Do not terminate that unrelated backend to resolve the port conflict.

## 2026-10-18 — Production booking bundle verification

- Confirmed provider-card fixes are shared production code, not conditional on offline mode. Added rendered API-path tests using CommunityService + ApiService with HTTP test responses, UUID providers/SKUs and offline fallback disabled; covered checkout handoff and visible failed-request retry.
- All 67 app tests, lint and TypeScript pass. Ran native:production and synced the optimized production bundle into iOS and Android; verified all three bundle copies contain the deployed HTTPS SERVIO API endpoint and native configs disable cleartext.
- Deployed API health returned environment=production, database=ok via Hyperdrive. This corrects the earlier implication that the unrelated local backend blocked all production access. No authenticated production booking was created. Updated native assets require rebuilding/installing the app on the device; sync alone does not update installed apps.

## 2026-10-18 — Bulletin acceptance, production category route, Profile options and preload

- Corrected the original screenshot diagnosis: Bulletin cards were inert and had no backend acceptance flow. Added accessible request details; stored approved/exact-SKU Pro reservation; customer-only confirmation checkout with selected Pro/SKU/address; atomic booking link and retry protection; participant release/open-booking actions and status synchronization. Preserved pending reservations beyond the latest feed page and exact-ID Pro lookup. Browser verification caught and fixed a lingering modal over checkout by awaiting dismissal before routing.
- Fixed category persistence/display: account responses include offered SKU IDs, the chooser reflects the saved category, and active Pro My Services uses actual catalog data. Failed saves retain the dialog; empty service categories cannot clear offerings. Deployed the previously absent pro-trade endpoint.
- Completed Help & Community Safety with FAQs, guidance, saved reports, retry protection, owner-only history and staff-only API review. Added saved GCASH/CARD preferences and checkout selection; no real payment credentials or charges.
- Branded preload is two seconds independent of navigation readiness, with a visible 36px orange spinner and reduced-motion support; a slow initial route uses a connection status. Timer regression tests cover slow and ready navigation.
- Validation: 186 API tests and 77 app tests pass with local database suites executed, app lint/build/type checks pass. Local API browser verified Pro acceptance → customer confirmation → mock booking → Tracking; category persistence; payment preference; support report submission. Fixed a pre-existing upload test setup to change ownership before testing an incomplete owned file, rather than expecting two different results for identical non-owner requests.
- Applied additive production migrations 0008/0009 (history 8 → 10). Deployed production Worker version 639c8009-668e-48bd-91df-5e9f4aa734c2. Authenticated deployed API smoke checks passed for category/preference/report persistence and request acceptance/release; temporary test identities/records removed; no production booking or hold created. Native production assets synced to iOS/Android; physical apps still require rebuilding/installing. See docs/PRODUCTION.md and ADR-032/033.
- Dependency audit: app has zero vulnerabilities; API has no high/critical findings and retains four moderate transitive development-tool findings under drizzle-kit/esbuild. No forced dependency downgrade was applied.

## 2026-10-18 — Measured distance, owner cancellation, service removal and loading latency

- Continued from booking_bug because main did not yet contain the committed prior booking/Profile fixes. The working checkout remains booking_bug; no merge or commit was made.
- Replaced city-center-as-viewer distance display with actual device-origin queries. Missing origin/provider coordinates or stale fixes show unavailable distance; own helper cards show Your profile. Added permission-aware Use my location on discovery pages, two-minute viewer expiry, fifteen-minute provider freshness in both SQL ranking and response, and matching expiry masking for helpers/Bulletins. New posts can include a rounded approximate pin from the selected saved place, with a compose explanation.
- Added My requests and owner-only soft cancellation for unbooked requests, hidden from other users after cancellation. Linked bookings still require normal booking cancellation. Added Remove on each owned service listing; removes only the actor's SKU, preserves confirmed jobs and reopens matching unbooked reservations. A review caught accept-vs-withdrawal concurrency; both operations now serialize on the Pro row before the request row, tested against concurrent HTTP calls.
- Investigated loading: production health/catalog probes took about one second from this Mac. Auth awaited the signed profile-photo request, and the directory awaited all signed avatar requests before making cards available. Photos now hydrate independently; a regression test verifies slow avatars/GPS cannot block usable account/directory data. No physical-device latency benchmark was performed.
- Verification: 191 API tests and 83 app tests pass; lint, production build and native production sync pass. Deployed Worker 6d8fca71-c659-4d6c-b871-3d6fa67f39ca; no migration required. Authenticated production smoke checks passed: no-origin distance is null, matching measured coordinates give zero, author cancellation hides the post from another user, removed final SKU removes the provider from directory. The measured exact-provider production request took 123ms during the smoke check; this is one sample, not an app-wide latency result. Temporary records were removed; no production booking/hold created. Phones still require rebuilding/installing the updated client.

- 2026-10-18: Removed the owner-rejected 10 km address/booking/dispatch cutoff; retained city selection and valid coordinate checks. Added saved-pin and distant-provider regression coverage (ADR-035).
