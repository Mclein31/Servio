---
title: "SERVIO — Project Scope & Feature Boundaries"
tags:
  - type/scope
  - architecture/boundaries
aliases:
  - Project Scope
  - Feature Boundaries
created: 2026-10-14
updated: 2026-10-14
---

# 🎯 Project Scope & Feature Boundaries

To maintain velocity, architectural integrity, and prevent feature creep, this document establishes the strict boundaries of what is **In-Scope (MVP)**, **Post-MVP (Phase 2)**, and **Out-of-Scope (Forbidden)** for SERVIO.

---

## 1. Feature Matrix by Phase

| Feature Category | MVP (Phase 1) | Post-MVP (Phase 2) | Anti-Scope (Out-of-Scope Forever) |
| :--- | :--- | :--- | :--- |
| **Service Catalog** | Standardized fixed-price SKUs, diagnostic visits, unit counters (e.g. 1-3 AC units) | Seasonal packages, subscription bundles | Open-ended text bidding ("name your price" auctions) |
| **Technician Matching** | Algorithmic proximity radar (nearest first, no fixed radius), 60s acceptance countdown | Provider preference filters, scheduled recurring bookings | Unvetted public job boards, direct customer cold-calling |
| **Geospatial & Tracking** | Live polyline route tracking, dynamic ETA, GPS map pins | Geofenced auto-arrival check-ins, turn-by-turn in-app turn navigator | Background surveillance when offline |
| **Payment & Finance** | In-app Escrow hold, credit card/wallet capture, Completion OTP release | Split payments, tipping, instant cashout rails | Unescrowed direct cash without platform record, Crypto/Web3 |
| **Communication** | In-app order-scoped text chat & masked VoIP calling | Automated voice IVR notifications, canned responses | Unrestricted social friending, off-app phone leakage |
| **Scope Adjustments** | In-app Add-on quote with photo upload & customer 1-tap approval | Multi-item diagnostic checklist, third-party parts receipt scanner | Verbal non-logged price hikes on site |
| **Trust & Safety** | Manual admin KYC document approval, 2-sided star ratings | Automated AI ID verification, background check API integration | Unverified guest technicians |
| **Platform Ops** | Web admin dashboard for KYC, active bookings & dispute overrides | Automated fraud anomaly detection, customer LTV analytics | Fully decentralized autonomous governance |

---

## 2. In-Depth MVP Feature Requirements

### A. Authentication & User Profiles
- Single authentication flow for Customers (Phone OTP / Email).
- Dedicated registration onboarding for Service Providers:
  - Full legal name, phone, email, home base address.
  - Trade specialization selection (e.g., HVAC / Air Conditioning, Plumbing, Electrical).
  - Government Photo ID upload (Front/Back) and optional Trade Certificate upload.
  - Account state defaults to `PENDING_VERIFICATION` until Admin approval.

### B. Catalog & Booking Flow
- Category drill-down: Category -> Subcategory -> Service Item SKU.
- Standardized item attributes:
  - Title, High-res thumbnail, Base Price, Estimated Duration (e.g. "60-90 mins").
  - Inclusions (Bullet points of what is covered).
  - Exclusions (What is explicitly NOT covered without add-on).
  - Warranty badge (e.g. "30-Day Servio Warranty").
- Cart checkout with location selector, service date/time picker (Instant vs Scheduled), and payment authorization.

### C. The 6-State Order Lifecycle
The core MVP must strictly implement this state machine:
`DRAFT` -> `SEARCHING_PRO` -> `ACCEPTED` -> `EN_ROUTE` -> `ARRIVED` -> `IN_PROGRESS` -> `COMPLETED` (or `CANCELLED` / `DISPUTED`).

---

## 3. Strict Anti-Scope (What Must NOT Be Built)

1. **No Open-Bid Freelancer Directory:** Do NOT create a directory where users post free-form jobs and wait for 20 contractors to message them with competing bids. All orders must be standardized SKUs or fixed inspection visits.
2. **No Social Feed / Community Wall:** SERVIO is a transactional commerce platform, not a social network.
3. **No Direct Cash Deals Without Escrow:** Every transaction must be tracked and authorized through the platform state machine.
4. **No Multi-Vendor Marketplace of Physical Tools:** Do not build an e-commerce storefront selling spare parts to consumers or technicians.

---

## 🔗 Related Notes
- [[Guardrails_for_AI]] — Concrete constraints and syntax checks for AI agents.
- [[Feature_Roadmap]] — High-level milestone schedule.
- [[Screen_Inventory]] — The screens that implement this scope.
- [[Order_Lifecycle_State_Machine]] — State machine details.
- [[MOC_Servio]] — Back to Master Map of Content.

Owner update (2026-10-18): remove the fixed 10 km limit for address pins, booking validation and provider matching. Valid coordinates and Tuguegarao city selection remain required. Earlier radius references are superseded by ADR-035.
