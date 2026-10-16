---
title: SERVIO — Figma UI Completion Handoff
created: 2026-10-14
updated: 2026-10-16
tags: [type/ux, design-system/screens, handoff]
---

# SERVIO Figma UI handoff

Design file: [SERVIO](https://www.figma.com/design/ejP1MZ0Bzaqxzc31vgo5Bi/SERVIO)

The file was empty when inspected. Five core tabs were reconstructed as editable layouts using the approved workspace images. Eighteen additional frames cover Splash, customer onboarding/authentication and booking, and Pro execution. Three introductory onboarding screens were subsequently added, bringing the main screen inventory to 26.

All 26 phone screens use Figma’s built-in iPhone 14 Plus frame preset (428 × 926), applied through Frame Dimension Presets. Page Prototype settings use iPhone 14 Plus, Midnight, Portrait; the device shell was visually verified in inline Play preview. Layouts use auto layout, shared color/spacing variables, Inter typography, linked logo instances, and reusable action, input, status, navigation and execution-state components. Scroll regions allow longer forms to coexist with fixed actions and safe areas. Illustrative maps, sample identities, payment choices and balances are prototype content rather than live integrations.

## Canvas and branding

- Row 1: Home, Directory, Bulletin, Tracking and Profile.
- Row 2: Splash and customer authentication, booking, chat, approval, completion and review.
- Row 3: seven Pro screens.
- `Assets/Brand-Identity`: both official 1024 px sources, orange swatch and 16 px clear-space guidance.
- `Component/Branding/Logo`: AppIcon-Orange at 32, 64, 120 and 128 px; BrandMark-Light at 48 and 88 px; horizontal 32 px lockup.
- Lower canvas: Discover, Trust and Track onboarding; motion guidance; component masters.

The oversized orange plus on Bulletin was caused by a fill-width icon container. It was corrected to a fixed 48 × 48 touch control. The masked-call control was similarly constrained. Directory identity containers use hug height to avoid clipping names.

## Philippine pricing

**Launch-city update (2026-10-16):** SERVIO launches in **Tuguegarao City, Cagayan**. The existing sample prices primarily reflect Metro Manila research (with supplemental Philippine examples below); they are retained for demo continuity and **must be re-validated against Cagayan rates before launch**. Do not treat the sample prices, trust fee or payout split as validated local pricing. See `.brain/DECISIONS.md`, ADR-008.

The user explicitly rejected both a symbol-only currency replacement and exchange-rate conversion. Use representative Philippine service prices, selected within published local ranges. These are design assumptions, not measured nationwide averages or approved live catalog prices.

| Service | Sample price | Unit |
| --- | ---: | --- |
| Tutoring | ₱350 | hour |
| Electrical labor | ₱500 | hour |
| Handyman | ₱400 | hour |
| Local grocery errand | ₱150 | errand, purchases excluded |
| Electrical inspection | ₱450 | visit |
| Sink leak repair | ₱1,500 | job, parts separately quoted |
| Basic AC leak repair | ₱1,100 | job, parts separately quoted |

Research sources, checked 2026-10-14:

- [Teko NCR service rates](https://www.teko.ph/pricing/teko-out-of-warranty-service-rates): check-up ₱450; minimum repair labor ₱1,100; split AC cleaning ₱1,775. Published minimums and quotations are not final prices for all faults.
- [Taskly plumbing guide](https://taskly.ph/services/plumbing): exposed-pipe leak repairs listed at ₱1,000–₱2,500.
- [Potentials tutoring rates](https://www.potentialsbaguio.com/one-on-one-tutorials-and-coaching/): school-level sessions approximately ₱255–₱340/hour; [Tutor BASE](https://www.tutorbasecenter.com/) lists ₱400/hour local remote sessions. ₱350 is a representative selection.
- [Workermo errand guide](https://workermo.com/guides/errand-service-cost-philippines): grocery/store errands ₱100–₱200, excluding purchases.

Example booking math: ₱1,100 service + illustrative ₱50 trust fee = ₱1,150 escrow. A ₱350 drain-hose add-on makes ₱1,500 total. Retaining the supplied brief’s 85% Pro share gives ₱935 base payout and ₱297.50 add-on payout. Optional sample tips are ₱50, ₱100 and ₱200. Fees, commission and part quotations require product validation before launch.

Three sample wallet credits are ₱1,375 (₱1,500 × 85% + ₱100 tip), ₱1,508.75 (₱1,775 × 85%) and ₱432.50 (₱450 × 85% + ₱50 tip); total daily net ₱3,316.25. Available balance ₱8,640.75 and pending ₱1,870 are illustrative wallet balances.

## Onboarding and motion

- `Screen/Core/Onboarding-Discover`: find verified local helpers.
- `Screen/Core/Onboarding-Trust`: understand escrow and completion-code control.
- `Screen/Core/Onboarding-Track`: follow arrival and communicate in the app.

Original editable vector graphics are linked to `Component/Onboarding/Discover`, `/Trust` and `/Track`. Discover and Trust use Start and Ready variants: Start waits 350 ms, then uses a 600 ms Ease Out Smart Animate reveal.

Track is a delivery-style location tracking map shared by introductory onboarding and `Screen/Customer/Tracking`. The portrait is a fixed 42 px location marker with a blue accuracy halo, aligned to the white street centerlines. A fixed home destination pin stays separate from the driver marker. Orange shows the **remaining route**, starting at the marker and ending at the home frontage; completed segments turn neutral. Five states follow `(64,174)` → `(64,90)` → `(231,90)` → `(231,174)` → `(278,174)`, using linear Smart Animate segments lasting 2.2, 4.1, 2.1 and 1.2 seconds, with a 500 ms initial delay and 120 ms corner pauses. ETA/distance update from 12 min/1.2 km → 8 min/850 m → 3 min/300 m → 1 min/80 m → Arrived/At your address. The old full-route/trailing-line illustration is superseded.

Geometry was checked at 132 interpolated positions: marker-to-route-start error was zero; the remaining segment endpoint drift was at most 0.001 px. The Tracking prototype was played from On the Way through Arrived. The street map is illustrative geography, not a surveyed or licensed map tile. Live location labels demonstrate the intended UX; no GPS feed is connected in Figma.

Motion runs once and settles. Next uses a 320 ms Smart Animate screen transition. Skip and Log in lead to phone login. Splash leads into Discover. Ready provides the static illustration variant; implementation must honor device reduced-motion settings.

These are Figma prototype animations. Native app animations, persistent first-run onboarding state, payment processing, form entry, calls, uploads, live location and OTP validation still need implementation.

## Scope reconciliation

The request/offers sheet was included because it was explicitly requested in the design brief. Existing ADR-001 and scope guardrails still define a standardized fixed-price catalog and prohibit open bidding. Treat the offers sheet as a design concept; it does not authorize a production bidding marketplace.

The workspace contains assets and documentation but no initialized Git repository or application source at this handoff. Production implementation remains Ionic-Angular with HTML/SCSS and Capacitor.

The repair evidence image at `assets/design/sample-drain-hose-evidence.png` is generated sample imagery for a fictional booking. It must not be presented as evidence of an actual customer job.

## Neighborhood illustration

The user requested the friendly neighborhood helping illustration style from the approved Home reference. Original artwork is saved at `assets/design/neighborhood-help-illustration.png` and linked in Figma as `Component/Illustration/NeighborHelp`. It supports the Home hero and Discover onboarding. The Home headline, body and Browse Directory action remain separate editable layers. The Home hero fits the 388 px content width within the iPhone 14 Plus frame. Onboarding artwork scales proportionally from 353 × 280 to 388 × 307.76; the live tracking map fills its wider card.

The Pro Dashboard displays net earnings in its own full-width card, with equal Jobs Done and Rating cards below. Peso amounts must remain on one line rather than wrapping their centavos into a second line.

## Header and action consistency

Main tab titles use Inter Bold 28/34, detail app-bar titles use Inter Bold 20/26, and the SERVIO wordmark retains its official 22/28 style. Main and detail app bars are 64 px high, immediately below the 54 px status safe area, with 20 px side padding. Auth and onboarding hero headings retain the larger display hierarchy. Home, Directory, Bulletin and Pro Dashboard headers were moved out of scrolling content.

Primary orange actions and the orange Wallet surface use white text on an action orange of `#D04A00`, with `#C24400` for the pressed state. Official logo orange remains `#FF5C00`.

## Orange card alignment and device preview — 2026-10-15

The Home and Bulletin feature cards are the current reference: solid SERVIO brand orange `#FF5C00` with white foreground text. Nine warm card surfaces (including the warm card master and screen instances) were matched to that reference. Small tinted category/icon wells and the pale backgrounds inside illustration artwork retain their supporting tints. Primary action/Wallet orange remains `#D04A00`. White nested buttons and identity cards retain their white surfaces.

Screen IDs and prototype connections were preserved. The built-in frame preset and prototype device are separate settings, and both are now set to iPhone 14 Plus. Native Figma preview confirmed the visible Midnight phone shell and the wider onboarding layout. Figma reported pending synchronization during this edit; local changes and preview were verified, but cloud synchronization was not confirmed.
