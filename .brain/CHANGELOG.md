# SERVIO — Changelog

All notable changes to the SERVIO project knowledge base, architecture, and codebase are documented here.

---

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


