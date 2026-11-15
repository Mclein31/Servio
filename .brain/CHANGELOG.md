# SERVIO — Changelog

All notable changes to the SERVIO project knowledge base, architecture, and codebase are documented here.

> Entries dated 2026-10-16 and earlier (v0.2.0 – v0.5.30: knowledge base, app build-out, backend A1–A9/B2/B3/C1–C4/D1–D3/F1, Neon/Worker deployment, Pro mode) are in [archive/CHANGELOG_ARCHIVE.md](archive/CHANGELOG_ARCHIVE.md).
> Older entries mention `docs/*.md`, `assets/ui/` and test counts; those files were later removed from the repo — see `NOTES.md` §7 for how to read them from git.

## 2026-11-15 — Brain cleanup
### Changed (knowledge base only; no code changes)
- Verified `.brain/` against the repo (`main` @ `74164cc`) and rewrote PROJECT_CONTEXT, ARCHITECTURE, TODO and NOTES to the current state: completed academic prototype (presented at finals 2026-10-22), actual Workers/Neon/R2/Durable Objects topology, OpenFreeMap vector basemap, no automated tests in the tree.
- TODO: moved finished backend/app items (bookings, escrow, PIN, wallet, dispatch, Durable Object rooms, native GPS, Android project, icons/splash, deploy) to **Done**; closed obsolete demo-rehearsal items; added the open findings from the 2026-10-22 backend audit as **Known gaps**.
- DECISIONS: kept core and recent ADRs in full, moved ADR-006/007/010/011/014–029 verbatim to `archive/DECISIONS_ARCHIVE.md` with an index; marked superseded parts (FCM push → ADR-037; 10 km radius → ADR-035; PostGIS → SQL great-circle distance; masked calls → ADR-031; OSM raster tiles → vector basemap).
- CHANGELOG: moved entries ≤ 2026-10-16 to `archive/CHANGELOG_ARCHIVE.md`; put the unversioned 2026-10-18 entries in date order; backfilled the 2026-11-04/11-11 commits.
- Archived `BACKEND_AUDIT.md` (finals backend cheat sheet + audit) to `archive/`; its 12 open findings now live in TODO.
- SCOPE: added implementation-status notes where the build deviates from the guardrails (email-only sign-in, self-service Pro approval, carrier calls, no admin console).
- Recorded removed repo files (`docs/`, `CODEX_IMPLEMENTATION_PLAN.md`, `assets/ui/`, test suites) and how to recover them from git in NOTES.

## 2026-11-11 — Project map (backfilled from git)
- Added `.brain/FLOW.json` (project map of actors, screens, API routes and decision points for Jarviee Project Maps); commits `da3a4d3`, `74164cc`.

## 2026-11-04 — Vector basemap (backfilled from git)
### Changed
- Maps now render a key-free OpenFreeMap vector style (`environment.mapStyleUrl` = `tiles.openfreemap.org/styles/liberty`) through MapLibre GL inside Leaflet (`@maplibre/maplibre-gl-leaflet`, `maplibre-gl`), so roads and labels stay sharp at any pixel density; compact attribution copied from the style. Leaflet still owns routes and markers. Devices without WebGL2 fall back to raster OSM tiles (`environment.mapTileUrl`). See `servio-app/src/app/shared/utils/map-tiles.ts`. Commit `f84bdc7`.

## [0.5.39] — 2026-11-01
### Changed
- **Promo video v2, feature-led (owner request):** `promo-video/servio-promo-vo.mp4` and `servio-promo.mp4` were replaced with a 39 s, 1920×1080, 30 fps cut built around designed feature graphics instead of a tour of phone screens. In order: verified pro cards and categories, Community Bulletin request and reservation, fixed price tag with breakdown, one-tap booking with a dispatch radar, live 3D map with in-app chat, escrow unlocked by the completion PIN, ratings/tips/reward coupon, and an end card listing 8 features. Only the Bulletin and Home captures appear as phone screens.
- **New VO script (9 lines, recorded by the owner in ElevenLabs "Scotty – High energy promos"):** takes are trimmed, internal pauses tightened, sped up 7 % (pitch preserved) and placed by whisper word timings. The v1 soundtrack was re-cut on its 100 BPM bar grid so the drop hits "Meet Servio" and the outro hits the tagline. Both mixes are normalized to −14 LUFS.
- **3D rider rebuilt:** a semi-realistic cartoon rider (helmet and visor, jacket, jeans, hands on the grips) on a rounded moped with spinning wheels and a headlight that leans into turns, sized to the town's houses. The scene opens on a ¾ front close-up and cranes up to the route map.
- The v2 Remotion source stayed outside the repo, as with v1. The previous cut is in commit `692fd94`.

## [0.5.38] — 2026-10-31
### Added
- **30-second promo video (`promo-video/`):** Remotion + React Three Fiber project that renders `out/servio-promo.mp4` (1920×1080, 30 fps). It includes an extruded 3D SERVIO mark traced from `assets/logo/logo.png` (`scripts/trace-logo.cjs`), a cel-shaded 3D town with a cartoon scooter for tracking, CSS-3D phones showing real app captures, and a procedurally synthesized soundtrack (`scripts/make_soundtrack.py`). The voiceover script is in `promo-video/VOICEOVER_SCRIPT.md`; drop the recording at `public/audio/voiceover.wav` and run `npm run render:vo`. Owner direction: no download CTA and no city-specific messaging. Voiceover: 8 ElevenLabs takes ("Scotty – High energy promos") are in `public/audio/vo/`, placed by `scripts/build_voiceover.py`; the final cut is `out/servio-promo-vo.mp4`.
### Changed
- **Vault screen captures refreshed:** `Servio_Vault/03_User_Experience_and_Screens/assets/0[1-5]_screen_*.png` now show the current app (mock-API demo login, 430×932 @3x, saved at 860 px wide) instead of the old dollar-priced mockups. Full-resolution captures, plus onboarding, checkout, completion PIN and chat, are in `promo-video/public/screens/`.
- **Promo re-cut to the voiceover:** scene cuts and every on-screen word now come from voice word onsets (`scripts/vo_timings.py` → `src/vo.ts` → `cue()` in `theme.ts`), and the on-screen copy matches the spoken script. New soundtrack: 100 BPM future-bass pop in D major (`scripts/music_synth.py`).
### Removed
- **Promo source cleaned out (owner request):** `promo-video/` now holds only the rendered `servio-promo-vo.mp4` (final, with voiceover) and `servio-promo.mp4` (music only). The Remotion project, scripts, audio and captures referenced above are no longer in the repo; the ElevenLabs voice takes are still in `~/Downloads`.

## [0.5.37] — 2026-10-22
### Added
- **Loyalty coupons (ADR-038):** customers earn a coupon at 3, 10 and 15 completed orders (`config/loyalty.ts`). New `customer_coupons` table and `bookings.discount_centavos` (migration `0012_loyalty_coupons`), `GET /me/rewards`, optional `couponId` on `POST /bookings`, and a `REWARD` notification kind. SERVIO funds discounts through the `platform_promotions` ledger account; Pro payouts are unchanged and cancelled bookings return their coupon.
- **App:** Loyalty Rewards page (`/rewards`, linked from Profile) with progress, coupons and milestones; checkout coupon picker (best coupon preselected, can be removed) with a discount line; customer totals on Tracking, the PIN sheet, add-on approval, receipt and history show the discounted amount.
- Verified on local `servio_dev` with wrangler dev: backfill, redeem, reuse rejection, cancel refund + coupon return, and completion ledger (customer −₱1,050, promotions −₱100, Pro +₱935, platform +₱215). App build and lint pass. Automated test suites are currently removed from the working tree, so none were run.
- Production: migration 0012 applied to Neon (13/13) and Worker deployed (version 61a1ed4c); `/me/rewards` responds with auth required and health is ok.

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
