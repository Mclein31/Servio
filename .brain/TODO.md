# SERVIO — Operational Roadmap & Task Checklist

> **Status:** Prototype complete (finals presented 2026-10-22); launch work below is not scheduled · **Updated:** 2026-11-16
> **Legend:** `[ ]` Not Started | `[/]` In Progress / partly verified | `[x]` Completed
> **Branches:** all work is on `main`. `booking_bug` is stale: its three 2026-10-18 fixes were re-committed on `main` (`e028135`, `c94d166`, `bf13476`); `bugfix/ui`, `feature/app-and-backend` and `fix/realtime-and-notifications` are fully merged.

---

## Known gaps (from the 2026-10-22 backend audit, re-checked against code 2026-11-15)

Full write-up: `archive/BACKEND_AUDIT.md` §13 (2 items resolved 2026-11-16; remaining items still open).

- [ ] **Self-service Pro approval:** `POST /me/upgrade-pro` sets `kycStatus: 'APPROVED'` with a seeded 5.0 rating and no ID check (`servio-api/src/routes/me.ts`). Needs real KYC review before real users.
- [ ] **Payments are mock** (`payments/mock.ts`): nothing is charged or paid out.
- [x] **Dispatch only advances while a Pro app is open** (`POST /pro/dispatch` heartbeat). Add a Cloudflare Cron Trigger / DO alarm so held bookings never wait indefinitely. — done 2026-11-16: added event-armed `Dispatcher` Durable Object alarm (`src/dispatch/dispatcher.ts`, `src/dispatch/scheduled.ts`, `wrangler.toml` `DISPATCHER` + `servio-dispatcher-v1`) reusing `dispatchTick` and shared `notifyDispatch` (`src/live/notify.ts`), instead of a polling cron (ADR-039); not yet deployed.
- [ ] **No remote push** (ADR-037): a closed app gets nothing until reopened.
- [ ] **No road route line in production:** OSRM routing is development-only; needs a licensed/self-hosted router.
- [ ] **GPS stops when the Pro backgrounds the app** (foreground location only); customer sees Reconnecting.
- [ ] **New DB connection per request** (`middleware/db.ts`); Hyperdrive mitigates in production.
- [ ] **No service area:** `lib/service-area.ts` only checks coordinate bounds (by owner choice, ADR-035); revisit before launch.
- [ ] **Completion PIN lockout has no unlock** after 5 wrong tries; needs an admin/support path.
- [ ] **No admin tools** for KYC, catalog or disputes (only staff support-report API).
- [ ] **Pro cancellation strikes are stored but never enforced.**
- [ ] **Gmail SMTP for sign-in codes** (daily limit, spam risk); move to a transactional email service before launch.
- [ ] Direct (specific-Pro) bookings start `ACCEPTED` without Pro consent — product decision pending (ADR-036).
- [x] Remove unused `@neon/env` dependency from `servio-api/package.json`. — done 2026-11-16: confirmed no imports/CLI usage and uninstalled via `npm uninstall @neon/env` (updating `package.json` and `package-lock.json`).

## Quality

- [ ] Restore automated tests: API Vitest suites (`servio-api/test/`, `vitest.config.ts`) and app `*.spec.ts` files were deleted in `397a45d`; recover with `git checkout 397a45d^ -- <paths>` and re-add the test scripts/`angular.json` test target.
- [ ] CI (GitHub Actions): app build + lint + tests, API typecheck + tests, migrations against a Neon branch. (`.github/` currently holds only an unrelated `modernize/java-upgrade` hook.)
- [/] Real Gmail inbox delivery: implemented and tested with fake SMTP; actual delivery from the production Worker was never recorded as verified.
- [ ] Bell/inbox/local alerts not yet checked on physical phones (0.5.34).

## Phase 1 remaining (launch)

### Backend / payments / identity
- [ ] Pro KYC submission endpoint + review flow (uploads already support KYC-purpose PDFs, owner-only).
- [ ] PayMongo sandbox: GCash + card, payment intents, webhooks into the ledger; mock provider stays for tests.
- [ ] Payouts to GCash / InstaPay.
- [ ] Legal check: custodial escrow of GCash funds vs. BSP e-money rules.
- [ ] Google sign-in + Sign in with Apple (required together on iOS).
- [ ] Switch sign-in delivery to Semaphore SMS when budget allows (same flow).
- [ ] Remote push (FCM + paid Apple Developer account) — declined for now; revisit before launch.

### Mobile app
- [ ] Pro KYC upload screen (`/pro/onboarding`) and Request Detail screen (`/request/:id`) from the screen inventory.
- [ ] Error / offline / loading states across all API-backed screens (partly addressed by ADR-034 nonblocking loading).
- [ ] Accessibility pass (VoiceOver labels, contrast, dynamic type) and a dark-mode decision (app is currently forced to light appearance).
- [ ] Reconcile Figma vs implementation-brief content differences (see `archive/CHANGELOG_ARCHIVE.md` 0.4.0).
- [ ] Check OpenFreeMap / OSM tile usage terms before public launch.

### Product / business
- [ ] Validate representative Philippine catalog pricing (Cagayan), the ₱50 trust fee, cancellation fees and the 85/15 payout split.
- [ ] Privacy policy, Terms of Service, Escrow Protection Policy (Data Privacy Act compliance); current legal pages are prototype copy.
- [ ] TestFlight / Play internal testing builds; App Store & Play listings (needs paid Apple account).

### Admin web console
- [ ] Provider verification dashboard (KYC document inspection, approve/reject).
- [ ] Service catalog & pricing manager.
- [ ] Active bookings monitor & dispute resolution panel (manual escrow release/refund, PIN unlock).

## Phase 2: Post-MVP Enhancements
- [ ] Dynamic surge pricing and peak demand algorithms.
- [ ] Automated SMS fallback for offline technicians.
- [ ] Multi-language and localization support (Filipino / English).
- [ ] Provider tier badges (Top Rated, Master Certified).

---

## Done

### Foundations
- [x] 3-layer Brain architecture (`.brain/` and `vault/`), project context, scope boundaries, ADRs.
- [x] Obsidian vault with linked nodes, screen inventory and research.
- [x] Git repo and Ionic-Angular project (`servio-app/`, Angular 22 + Ionic 9 + Capacitor 8).
- [x] Editable Figma customer/Pro flows, branding and onboarding graphics (`SERVIO.fig`).
- [x] Backend stack ADR (ADR-005/006).
- [x] Launch city Tuguegarao: verified OSM center/barangays, embedded 1.80 km route, city ETA profile.

### Backend (`servio-api/`)
- [x] Workers + Hono + Drizzle scaffold, migrations with append-only/balanced ledger guards, local `servio_dev`/`servio_test`, catalog seed, middleware, health/catalog routes.
- [x] Email-code sign-in (Gmail SMTP over `cloudflare:sockets`, dev log fallback), sessions, rate limits, `GET/PATCH /me` (name, mobile, avatar — ADR-026).
- [x] A1–A9: booking codes, booking create with price snapshot + ₱50 fee + mock escrow hold + idempotency, status machine with cancellation fees/strikes/no-show deadlines, add-on quotes, owned uploads (R2 + local adapter), HMAC completion PIN with lockout and atomic release (85/15), ledger wallet + mock GCash cashout, reviews/tips, Bulletin, chat, directory.
- [x] Dispatch: nearest qualified online Pros, 60 s offers, expiry/decline, refund on exhaustion (foreground heartbeat; no radius per ADR-035; no PostGIS).
- [x] B2: Durable Object booking/Pro rooms with single-use tickets; later `user:` rooms (ADR-036).
- [x] Saved addresses (0007), Bulletin reservation (0008), payment preference + support reports (0009), notifications (0010/0011), loyalty coupons (0012).
- [x] Notifications: in-app inbox, header bell with unread dot, free local alerts (ADR-037).
- [x] Deploy `servio-api` to Workers (production env, Hyperdrive, secrets) — https://servio-api.mcleinonza0531.workers.dev.
- [x] Neon production database + migrations (13/13); R2 production bucket + CORS.

### Mobile app (`servio-app/`)
- [x] Design tokens, tab shell, Home / Directory / Bulletin / Tracking / Profile, onboarding.
- [x] C1–C4: API client/sessions, live email sign-in + profile setup, live customer flows (checkout, tracking, chat, add-on, PIN, cancel, review/tip), live Pro workspace (availability, offers, job status, evidence quotes, PIN, wallet/cashout).
- [x] B3: native Geolocation streaming, socket tracking/chat/dispatch, street snapping, explicit demo route fallback.
- [x] Dual-persona Pro mode (ADR-030), Pro dashboard inside the tab bar.
- [x] Native iOS and Android projects; app icon + splash for both (ADR-029); `npm run native:demo` / `native:production`.
- [x] Maps: key-free OpenFreeMap vector basemap with raster OSM fallback (2026-11-04) — replaces the old "add a CARTO API key" task; Nominatim pin autofill (ADR-031).
- [x] Carrier phone calls between booking participants (ADR-031); Rewards page and checkout coupons (ADR-038).

### Demo data & tooling
- [x] D1 guarded idempotent demo seed (Sophia M., Daniel K., Chris L., Ava L., Kevin T., Sofia R.; staff account cannot use mobile sign-in), active order #SRV-8821, history #SRV-8807/#SRV-8790/#SRV-8772, six Bulletin posts, reconciled wallet (₱8,640.75 available, ₱1,870.00 escrow, ₱3,316.25 today), local R2 photos, all rows marked demo.
- [x] D2 fixed `DEMO_LOGIN_CODE` sign-in for existing demo accounts outside production.
- [x] D3 `npm run db:demo-reset` / `db:backup` / `db:restore` against dedicated `servio_demo` only; production guard; in-app "Reset demo order" button.

### Closed — demo milestone ended (finals presented 2026-10-22)
These were open when the demo ran; their final state was not recorded and they are no longer tracked.
- B3/F1/D4 two-device physical GPS rehearsal, Android emulator install (package-service broken pipe), physical installs/permissions, demo-day checklist (`docs/DEMO_CHECKLIST.md`, now removed from the repo).
- "Remaining work is specified in `CODEX_IMPLEMENTATION_PLAN.md`" — that file was removed on 2026-10-18 (`f5f6665`).
