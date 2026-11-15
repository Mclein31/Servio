# SERVIO — Archived ADRs

> Moved verbatim from `../DECISIONS.md` on 2026-11-15 (brain cleanup). These are the demo-milestone implementation ADRs (Oct 2026).
> Current status of each (including superseded parts) is listed in the index at the bottom of `../DECISIONS.md`. Note: `docs/*.md` files referenced below were removed from the repo in commit `28e3e97` (2026-10-21); read them with `git show 28e3e97^:docs/<FILE>.md`.

---

## ADR-006: Demo Scope — Email Codes, Mock Escrow, Real GPS With Simulator Fallback

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Sign-in is a 6-digit email code via Gmail SMTP (AdvanCare ADR-014 pattern); the app's phone login becomes email. Payments use a mock `PaymentProvider` with the full escrow ledger (PayMongo after the demo). Tracking uses real Pro GPS over a Durable Object, with the existing route simulator kept as a demo fallback. Admin console, Android, push and Cloudflare/Neon deploy are required before launch. Completion PINs are derived with HMAC(PIN_SECRET, booking id) and never stored.
- **Consequences:** SMS cost is avoided for the pilot (Semaphore later). Demo data lives in a dedicated demo database/Neon branch so reset can truncate safely.

## ADR-007: Transactional Mock Booking Holds and Retry Safety

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Checkout retries must never create multiple bookings or escrow holds. The demo uses mock money, while retaining production-style ledger invariants.
- **Decision:** `POST /bookings` snapshots the active catalog price and `TRUST_FEE_CENTAVOS` (default 5000). The mock provider authorization, booking, event and balanced hold entries execute within one database transaction. Optional `Idempotency-Key` values are scoped to the authenticated customer, fingerprint the validated request, and serialize with a transaction advisory lock plus a unique index; changed requests with the same key fail with 409. Mobile checkout must supply a stable key per authorization attempt. Direct Pros must be active, approved and qualified for the SKU.
- **Consequences:** Concurrent and sequential retries authorize once; failed authorization rolls back all booking writes. The stateless mock implements `authorizeHold/capture/refund`; a future real provider must provide its own external idempotency and reconciliation (Phase G, not implemented). SERVIO shares no code, packages, credentials, storage or database resources with any other project.

## ADR-010: October 19 Demo Devices, Local Network and Launch Deferrals

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner decision)
- **Decision:** Demo is Monday, October 19, 2026. Customer uses physical iPhone 14 Plus with free Apple ID Personal Team signing (7-day provisioning), with Mac iPhone simulator backup. Main Pro uses Android; second Android is backup. Android packaging, camera/location/notification declarations, icon/splash and real GPS are required; FCM is deferred. Use in-app WebSocket dispatch/add-on events and keep simulator routing for indoor demos. Implement only availability/dispatch pieces needed by this flow before the demo. Defer admin console, CI and cloud deployment.
- **Network:** Mac hosts Postgres/API with `wrangler dev --ip 0.0.0.0`; app supports a configurable LAN API URL. Allow development LAN origins. Restrict iOS local-network ATS and Android cleartext exceptions to dev/demo builds. Document Wi-Fi, installs and fallbacks in the checklist. If LAN is unreliable, ask before deploying: owner has no SERVIO Neon/Cloudflare resources yet.
- **Identity/email:** Sophia M. is customer (`demo.customer@servio.test`); Sofia R. is the distinct tutor (`demo.tutor@servio.test`); Daniel K. is the main Pro (`demo.pro@servio.test`). Sender name SERVIO. No SMTP App Password yet: log development codes, and allow guarded `DEMO_LOGIN_CODE`. Business/email footer address is `Business address to follow — prototype`; short legal pages are labelled `Prototype — not legal advice`. Never invent registration details.
- **Consequences:** Physical signing/GPS/install verification depends on connected owner devices and their Apple ID. Phase G remains gated; no cloud resources, real payments or FCM are created for this demo without a later instruction.

## ADR-011: Upload Ownership and Local R2 Demo Adapter

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The owner has not created Cloudflare resources and requires the demo to run on local Wi-Fi. Evidence photos must still use the same ownership, type and size rules as cloud uploads.
- **Decision:** Record upload intents/owners in `uploads` (`0005_upload_ownership`). R2 mode uses dedicated `servio-*` buckets and signed PUTs covering Content-Type and Content-Length for 15 minutes; authorized downloads issue 60-second GET URLs. Only JPEG/PNG ≤5 MB and KYC-only PDF ≤10 MB are accepted. Add-on references must be complete uploads owned by the assigned Pro for `addon_evidence`.
- **Local demo:** `UPLOADS_MODE=local` signs key/method/type/length/expiry capabilities with domain-separated HMAC using PIN_SECRET and reads/writes the local Wrangler R2 binding. Production rejects local mode. The PUT stream is bounded to the declared length; URLs use the incoming API origin so LAN phones can reach them. `UPLOADS_MODE=r2` uses S3 presigning and the actual SERVIO bucket binding; no cloud resources are created by this task.
- **Authorization:** Upload owners may read their files. Booking participants may read attached evidence/chat photos; bulletin photos are readable with the bulletin; approved Pro avatars are directory-visible. KYC files are owner-only until an audited admin path is implemented. No file purpose may be repurposed into chat/evidence to disclose KYC.
- **Consequences:** Demo upload behavior is verifiable without cloud accounts; remote R2 operation remains a later integration check. The local bucket is persistent dev data, distinct from the Postgres ledger.

## ADR-014: Catalog Community APIs, Private Booking Chat and Exact Review Totals

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Reviews are customer-only after completion and once per booking. Tips use a balanced customer→Pro transaction with 100% to the Pro, never escrow/platform. Store an integer rating_sum with rating_count to compute the two-decimal display average without accumulating rounding drift (`0006_exact_review_averages`). Demo seed must initialize both from its baseline ratings.
- **Community:** Bulletin creation requires an active SKU matching its category and rejects price fields. Nearby eligibility and Pro SKU/category eligibility plus distance/rating order are applied before limiting results. The directory returns approved active Pros and public profile fields, never contact details.
- **Chat:** Only booking participants read messages; only active bookings accept new messages. Upload attachments must be complete and owned, with request_photo/addon_evidence purposes; KYC and avatar uploads cannot be repurposed into chat. Status transitions append system messages inside the same booking transaction.
- **Consequences:** Reviews/tips serialize on the booking and update aggregates atomically. Shared booking-read helpers are extracted for REST/realtime reuse. No bidding, arbitrary prices, social messaging or unapproved directory entries are introduced.

## ADR-015: App API Client, Session Boundary and Demo Connection Settings

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Use Angular HttpClient with Fetch and an interceptor scoped to the configured SERVIO API base. Store opaque bearer sessions in Capacitor Preferences via a separate SessionService to avoid an AuthService/interceptor dependency cycle. Add a request UUID and auth header only for the API; never transmit offline mock tokens or API bearer credentials to signed upload URLs. Map safe API error envelopes to Ionic toasts and clear rejected sessions.
- **Configuration:** App environment declares apiUrl/useMockApi/demo. Development defaults to localhost:8787/api/v1; Android emulator may select 10.0.2.2 and physical devices the Mac's LAN IP. Demo builds can persist a validated base URL and offline mock selection in Preferences; production does not load overrides. The subsequent auth task exposes this in a small demo-only connection sheet. Production API URL remains unset until an owner-approved deployment exists.
- **Consequences:** Existing mock mode remains usable offline. Live app callers use one typed Promise API wrapper; Blob uploads obtain a presign then PUT without API authentication headers. Tokens/connection settings never enter committed source.

## ADR-016: Email Sign-In and Prototype Identity Setup

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Retain the existing login/code-input layouts while switching identity to normalized email and the API's single-use six-digit code. Persist the API session, load `/me`, collect a name and optional `+639…` mobile on first sign-in, and land Pros in their workspace. Offline mode alone accepts `123456`; live mode displays the API development note rather than a test-code hint. Ignore profile responses belonging to a cleared/replaced session.
- **Demo/legal:** Login exposes demo-only API/LAN/offline connection settings. Short Terms, Privacy and Escrow pages use the owner's prototype label and placeholder business address; sign-in email footers use the same address. These pages are prototype copy pending legal review. No email provider credentials or fixed live demo code are introduced by C2.

## ADR-017: Server-Owned Customer Flows and Offline Isolation

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Keep the customer screens and peso-formatting pipes; map API integer centavos into presentation models at the service boundary. Live mode starts with no fabricated booking, history, helper or completion PIN and never persists booking/PIN state to the mock local store. Booking IDs remain UUIDs for API/routes; generated codes are display labels. Participant reads expose names/avatar keys/rating summaries without contact details or auth metadata. Catalog responses include trust/cancellation fees from the server configuration.
- **Writes:** Checkout reuses a request key for an unchanged retry payload, with Philippine scheduled windows stored as timestamps. Add-on/review/cancellation/chat state changes only after API success; the local simulator cannot change live statuses. Live photo chat uses owned upload intents. Demo customer identity remains separate from the Pro; offline-only cross-role shortcuts stay hidden in API mode.
- **Refresh:** Participant booking reads refresh every four seconds and open chat every three seconds until B2 adds room events; API fetches bypass browser disk/cache to avoid stale policy or private booking data. B3 supplies GPS. No live rider simulation or arrival is inferred by C3. Error/retry and empty states retain the existing layout.

## ADR-018: Demo Pro Workspace and Foreground Dispatch Dependency

- **Date:** 2026-10-16
- **Status:** Accepted (minimal A2/B1 dependency authorized by ADR-010)
- **Decision:** Wire Pro availability, status, cancellation, evidence upload/quote, PIN verification and wallet/cashout to their API transactions. Customer accounts cannot enter live Pro routes; the Pro chat identifies the customer as its peer. Only offline mock mode may credit/reset a local wallet or simulate a QR scan. Mode switches cannot copy live snapshots or PINs into the offline store. Rejected sessions clear profile signals and stop foreground polling.
- **Dispatch:** While the Pro workspace is open, an authenticated explicit `POST /pro/dispatch` heartbeat advances held, unassigned bookings. Select approved, active, online, SKU-qualified Pros with fixes younger than two minutes within the city radius (10 km), ordered by distance then rating; exclude prior offers. Separate demo/non-demo pools. Offer one at a time, up to five distinct Pros, each for 60 seconds. Acceptance uses a booking lock and per-Pro advisory lock; no escrow moves. Server expiry/decline advances the queue, and exhaustion appends a balanced full refund. Unheld bookings never enter dispatch. Before acceptance expose only SKU, coarse neighborhood, distance and amounts.
- **Queueing:** Pros may accept another job while finishing a current one, as anticipated by ADR-009. The fixed no-show clock starts at EN_ROUTE, not acceptance; pre-departure cancellation stays free. Do not impose an extra single-active-job policy.
- **Limits:** This is foreground demo dispatch, with REST polling until B2. Autonomous alarms, production PostGIS matching, Pro application/KYC onboarding and launch dispatch remain deferred. The live availability toggle uses a permissioned location fix; B3 adds native streaming and the explicit indoor route fallback. No cloud or push service is created.

## ADR-019: Reconciled Demo Baseline and Internal Data Markers

- **Date:** 2026-10-16
- **Status:** Accepted (owner delegated reconciliation and requested no “demo history” UI label)
- **Decision:** Seed 13 separate accounts, five approved Pros, six bulletin posts, eight fixed-SKU bookings, completed reviews and local R2 avatars/evidence. Sophia M. is customer only; Sofia R. is a distinct tutor, represented by initials. All seed rows use is_demo or reserved `de000000-0000-4000-8000-*` IDs/owned references. Guard the database before writes; refuse production, other local project databases, unknown remote databases and conflicting identities/order codes. Cloud resource creation remains gated; this image seeder uses local Wrangler R2.
- **Wallet reconciliation:** Preserve required totals: available 864075, pending 187000, today 331625 centavos. Pending consists of the active AC job and a queued scheduled AC job, each with an 85% ₱935 share. Replace the unsupported AC Cleaning sample with the existing AC repair SKU. Existing fixed prices/trust fees and 85/15 math are unchanged. Historical opening credits represent prior earnings: 656450 centavos before the recorded history and 57375 credited today. UI labels say **Previous earnings**; internal markers identify the prototype seed. These are seed-only imported balances, not an API path to arbitrary credits.
- **History:** Recorded catalog settlements/tips plus the opening credits and a ₱2,500 cashout + ₱15 fee reconcile exactly. Rating sums are integers; the two-decimal stored average rounds to the original one-decimal card ratings. Historical profile totals already include the seeded completions/reviews.
- **Idempotency:** Stable record/transaction IDs preserve ongoing state on repeated seeding. No ledger/event rows are edited/deleted. Explicit order codes advance the normal sequence beyond all existing codes. Reset is a separate D3 operation.

## ADR-020: Explicit Demo Login Capability

- **Date:** 2026-10-16
- **Status:** Accepted (D2, owner-authorized no-email demo)
- **Decision:** An optional six-digit DEMO_LOGIN_CODE enables reusable sign-in only for an existing active is_demo customer or Pro outside production. Never create an identity through this path, bypass disabled accounts, or admit ADMIN mobile sign-in. Request-code avoids SMTP and the hourly email-code quota for eligible demo accounts while retaining IP/email rate limits. Responses mention the configured code without returning its value. Normal single-use email codes remain valid for other accounts.
- **Consequences:** Configure the code in ignored local environment, never committed source. Production ignores it even if configured accidentally. This capability does not affect completion PINs or money permissions.

## ADR-021: Disposable Demo Database and Compensating Order Replay

- **Date:** 2026-10-16
- **Status:** Accepted (D3 safety boundary)
- **Context:** servio_dev contains normal development accounts and bookings alongside the seeded presentation data. A full TRUNCATE there would destroy non-demo history.
- **Decision:** Create a separate local servio_demo database for full presentation reset. Reset/restore require a dedicated servio_demo/demo name and non-production environment; reset locks and refuses non-demo users/bookings/bulletins before TRUNCATE, including uploads metadata. The normal dev/test databases remain untouched. Full reset reruns migrations, catalog, baseline and local R2 images. Backups are ignored custom pg_dump files, restored with pg_restore only into a dedicated demo database; reset currently requires local R2. No cloud resources are created.
- **Order replay:** Only the reserved Sophia/Daniel participants can reset SRV-8821 through the API outside production. Lock the booking and Pro wallet, reverse its cumulative net ledger positions and re-hold the original base+fee. Keep every ledger/event/chat row; append a reset marker and lifecycle events, remove mutable quote/review state and reverse corresponding job/rating increments. The app shows the current timeline after that marker. Refuse if previously cashed-out earnings would make the wallet negative; use full disposable DB reset then. Other bookings/cashouts are preserved.
- **Consequences:** Full reset invalidates demo sessions; order replay does not. Database backups exclude R2 bytes; preserve local Wrangler state or reseed baseline images. Future Neon demo-baseline branching is documented but unverified until owner-approved cloud setup.

## ADR-022: Hibernatable Booking Rooms and Session-Bound Tickets

- **Date:** 2026-10-16
- **Status:** Accepted (B2)
- **Decision:** Use one OrderRoom Durable Object per booking and a separate named Pro room for dispatch invalidations, following [Cloudflare's hibernation API](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/). Authenticate a 60-second signed, single-use ticket bound to resource/user/session hash; never put the bearer session in a socket URL. Domain-separate its HMAC from the completion PIN. Recheck active participant/session at upgrade and broadcast/GPS; renew connections after five minutes. Store identity attachments and latest GPS across hibernation, cap concurrent per-user sockets and serialize/throttle GPS to one accepted fix per second.
- **GPS:** Only the assigned EN_ROUTE Pro can send bounded fresh GPS coordinates. Persist profile location conditionally at most once per 15 seconds across rooms. The socket never changes booking status, money or fixed no-show deadlines. Invalid/malformed/customer GPS yields safe errors. Location broadcasts contain no completion PIN.
- **Events:** After a successful committed REST write, send status/message/addon invalidations so clients fetch their authorized snapshots. Pro dispatch offer IDs are deduplicated in its room, avoiding a poll/event feedback loop. A notification outage cannot turn a committed financial write into an HTTP error; retain REST polling as recovery. Dispatch maintenance remains foreground for this demo; launch alarms/PostGIS remain deferred.
- **Consequences:** No new credential or cloud resource is created. Local Wrangler supplies the SQLite-backed namespace. App connection/reconnect and native location consumption are implemented in B3. Database reset clears the latest room GPS through a post-commit notification; old ledger/events stay append-only.

## ADR-023: Participant Avatar Access

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Permit a booking peer to download the current avatar that is already returned in their participant booking. Require that the upload belongs to the peer and equals that user’s current avatarKey, with an existing participant booking linking the two accounts. Customer avatars remain unavailable to unrelated users; changing the current avatar revokes peer access to the previous key. Existing public approved-Pro avatars and owner access are unchanged.
- **Context:** The seeded customer has a photo; the assigned Pro could read her avatar key but the download path previously rejected it and prevented presentation mapping of the booking. The app also falls back to initials when an avatar is temporarily unavailable. Evidence/KYC authorization remains purpose-specific.

## ADR-024: Live GPS Sources, Queue-Safe Tracking and Explicit Indoor Fallback

- **Date:** 2026-10-16
- **Status:** Accepted (B3 implementation; native rehearsal pending F1/D4)
- **Decision:** Keep one renderer/interpolator for live and simulated sources. Capacitor foreground precise-location watches stream assigned EN_ROUTE fixes through authenticated booking rooms; idle online fixes use a separate conditional /pro/location endpoint that can never reactivate an offline Pro. Track travel bookings independently from the selected booking, so queueing/viewing another job does not stop the current customer’s stream. Preserve geometry through arrival and use the booking’s actual pin.
- **Transport:** Reference-count booking/Pro sockets, renew ticket connections, reconnect with bounded backoff, and retain the last fix during an outage. Post-commit room events refresh the existing chat/status/add-on/dispatch screens; REST polling remains recovery. A 20-second stale fix shows Reconnecting. Snap to remaining route segments and interpolate along real streets; hide a guessed route when routing fails.
- **Demo source:** An explicit demo-account/build control runs the embedded Tuguegarao route; a Pro streams it to the customer with a simulated flag. Server rejects that flag for non-demo bookings or production. It never advances a live status or changes money. Reload defaults to live GPS. iOS location strings/SPM binding are present; Android declarations follow in F1.
- **Routing:** OSRM demo routing is development-only and queried once per source/order. OpenStreetMap/ODbL attribution remains visible. Production requires a licensed/self-hosted provider. See docs/TRACKING.md and [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation).

- **Rehearsal correction:** A remote simulated sender can restart without changing booking status. Reset interpolation when its new route fix restarts behind the previous endpoint; reject late live-routing responses after switching to the embedded route. Preserve the simulated source label even if routing is unavailable.

## ADR-025: Real-User Flows with Mock Payments

- **Date:** 2026-10-16
- **Status:** Accepted (explicit owner request)
- **Decision:** Extend the current work to real verified-email customer accounts, editable profile information/photo and saved map-pinned service addresses. Keep escrow, tips and payouts simulated. Complete these flows before the remaining Android/demo checklist work. This does not authorize PayMongo, SMS/social sign-in, cloud resource creation, invented legal details or unverified Pro dispatch.
- **Dependency:** Real email delivery requires sender credentials configured in the ignored local environment. Ask for provider choice, not credentials in chat; independently finish the account/profile/address implementation. Production deployment, physical signing/GPS and actual email delivery must be reported separately from local/unit verification.

## ADR-026: Editable Account Profiles and Owned Photos

- **Date:** 2026-10-16
- **Status:** Accepted (owner-requested real-user readiness)
- **Decision:** Reuse the profile setup layout for profile editing. Save trimmed names, optional E.164 Philippine mobile numbers and a current avatar via authenticated PATCH /me. A photo must be a completed avatar-purpose upload owned by the same account; no KYC/evidence/other-owner key can be attached. Null removes the current avatar. Reject empty patches and unknown identity/role/demo fields. Keep the sign-in email read-only until a separate verified email-change flow is specified.
- **UX:** Preserve edits on failure, disable save while uploading/saving, prefill the signed-in account and refresh signed avatar URLs on profile entry. The existing Edit button now opens this flow. First-time users still complete their profile after email verification. Phone numbers are contact details, not SMS-verified identity; all payment operations remain mock.
- **Consequences:** No new secret/environment variable or schema migration. API tests cover persistence, owner/session/purpose validation, invalid identity changes and unchanged ledger rows; app tests cover prefill, validation, photo removal and failed-save recovery.

## ADR-027: Gmail Delivery and Serialized Email-Code Verification

- **Date:** 2026-10-16
- **Status:** Accepted (owner selected Gmail SMTP)
- **Decision:** Deliver six-digit sign-in codes over Gmail implicit TLS on port 465 using an owner-configured App Password in the ignored local environment. Use SERVIO as sender display name and retain the prototype address footer. Missing credentials only permit the explicit development log fallback; production fails closed. Demo codes remain restricted to seeded demo identities.
- **Security:** Serialize verification attempts and one-time consumption on the code row, rechecking expiry and attempt limits at consumption. SMTP closes on timeout and clears its timer after completion. Normal verified-email sign-in creates a customer account; no real payment integration is enabled.
- **Verification:** Fake SMTP and database tests pass. Actual Gmail inbox delivery requires the owner's local credentials and inbox check in docs/EMAIL_SETUP.md; no credentials were inspected or messages sent during implementation.

## ADR-028: Owned Saved Places and Explicit Booking Pins

- **Date:** 2026-10-16
- **Status:** Accepted
- **Decision:** Store saved addresses per authenticated account with one default, serialized through the owner row and protected by a partial unique index. Validate city and coordinates against the configured Tuguegarao 10 km service area both when saving and when booking, before creating any hold. The booking retains its own address/coordinate snapshot. Editing a saved place never moves an existing booking.
- **UX:** Add an Ionic address book reachable from Profile and checkout. Require an explicit map tap, pin drag or successful current-location fix for each new place; start the map at the verified Tuguegarao center. Keep manual entrance/barangay/directions text and OSM attribution. No invented automatic address or geocoding service. First address becomes default; deleting it promotes the oldest remaining place. Live accounts start without a sample address.
- **Concurrency:** Ignore refreshes older than an address mutation, account-crossing results and GPS results from a closed editor. Include the full selected address/pin in the checkout retry fingerprint; omit empty optional booking directions. Demo seed includes Sophia's saved home, reset includes the new table.
- **Verification:** API typecheck and 165 tests; app build/lint and 48 tests pass. Browser saved and reopened a Centro 10 pin and displayed it at checkout. Native location permission/device verification remains separate. No new secret or environment variable.

## ADR-029: Native Demo Packages and Release Network Boundaries

- **Date:** 2026-10-16
- **Status:** Accepted (owner-required F1 implementation; Android emulator/physical rehearsal pending)
- **Decision:** Add the standalone SERVIO Android project and existing-brand icons/splash for both platforms. Declare camera, foreground coarse/precise location and notification permissions; keep FCM/background location deferred. Prepare optimized API-connected bundles with `npm run native:demo`; retain explicit offline fallback behind the demo connection sheet. Normal development now starts in API mode.
- **Network:** Debug Android uses its own cleartext network security configuration for changing LAN/emulator addresses. Release denies cleartext. iOS Debug uses Info-Demo.plist with NSAllowsLocalNetworking and local-network usage text; Release uses the strict Info.plist. Capacitor demo config enables Android HTTP/mixed content; native Release build guards reject that configuration until native:production has prepared HTTPS settings. No server URL/secrets are bundled from the ignored API environment. CORS includes the native HTTPS localhost origin and local LAN configuration is documented.
- **Toolchain:** Node 26, Gradle JDK 21, Android SDK 36. Patch Angular to 22.2.3 and Vitest to 4.1.12; override xcode's uuid dependency to compatible CommonJS 11.1.1 (it uses v4) to clear the app dependency audit. Native iOS build exercises the Xcode parser/output.
- **Limits:** Android debug APK builds and Release network manifest checks pass. iPhone 14 Plus simulator opens the app, signs in through the API and loads tracking. Initial Android emulator package installation failed with a package-service broken pipe; a subsequent cold start remained offline; physical signing/GPS/camera and owner Gmail delivery remain unverified. This work creates no cloud resource and does not enable real payments.

