---
title: "SERVIO — Multi-Phase Feature Roadmap"
tags:
  - type/scope
  - product/roadmap
aliases:
  - Feature Roadmap
  - Development Milestones
created: 2026-10-14
updated: 2026-10-14
---

# 🗺️ Multi-Phase Feature Roadmap

This roadmap defines the sequential progression of SERVIO from initial concept to regional scale, preventing premature optimization and ensuring focus on core marketplace liquidity.

---

## 🏗️ Phase 0: Foundations & Knowledge Systems (Current)
- **Goal:** Establish immutable product vision, knowledge architecture, and operational rules.
- **Deliverables:**
  - Complete `.brain/` operational operational context, architecture, and ADRs.
  - Comprehensive `vault/` Obsidian knowledge graph with bidirectional links.
  - Scope boundaries and AI guardrails finalized.

---

## 🚀 Phase 1: Core MVP (Proof of Market Liquidity)
- **Goal:** Launch the two-sided mobile marketplace in one focused geographical city (e.g. Metro Manila / Singapore / Kuala Lumpur) covering 3 primary high-frequency home categories:
  1. **Air Conditioning:** Cleaning, Freon Re-gas, Leak Repair.
  2. **Plumbing:** Pipe Leak Repair, Drain Unclogging, Faucet/Toilet Replacement.
  3. **Electrical:** Circuit Breaker Tripping, Outlet Replacement, Lighting Installation.
- **Key Deliverables:**
  - **Customer App (Flutter):** Category catalog, 2-step booking, real-time dispatch, live map tracking, in-app chat, completion OTP modal.
  - **Servio Pro App (Flutter):** KYC onboarding, online/offline status, radar dispatch popup (60s timer), job execution stepper, photo-verified add-on quote generator, wallet ledger.
  - **Admin Web Console:** KYC document verification, master catalog & pricing manager, active bookings monitor, manual dispute override.
  - **Escrow Settlement:** Secure card/digital wallet pre-authorization and instant wallet release on completion OTP.

---

## 📈 Phase 2: Retention, Density & Quality Scaling
- **Goal:** Expand service categories, improve provider retention, and optimize dispatch efficiency.
- **Key Deliverables:**
  - **Category Expansion:** Home Deep Cleaning, Handyman Carpentry, Appliance Repair (Refrigerators, Washing Machines).
  - **Scheduled Slot Optimizer:** Batch nearby scheduled appointments into efficient technician geographic clusters.
  - **Provider Performance Tiers:** Badges (Verified Pro, Top Rated, Master Craftsman) based on rating volume and on-time SLA.
  - **Dynamic Surge & Peak Hours:** Smart surge pricing during extreme weather (e.g. summer heatwaves driving 5x AC repair demand).
  - **Automated Payout Rails:** Direct local bank / e-wallet automated payouts for technicians.

---

## 🌐 Phase 3: Ecosystem & Defensibility Scale
- **Goal:** Lock in platform loyalty and expand enterprise/commercial capabilities.
- **Key Deliverables:**
  - **Servio Care Subscription:** Monthly home maintenance plans (e.g., quarterly AC maintenance + emergency plumbing coverage).
  - **Official Parts Supply Chain:** Direct fulfillment of verified wholesale spare parts to technicians via platform partner depots.
  - **Multi-Technician Commercial Jobs:** Team booking for commercial offices and retail stores.
  - **AI Visual Diagnostic Assistant:** Pre-diagnostic image analysis suggesting likely fault codes before the technician arrives.

---

## 🔗 Related Notes
- [[Project_Scope]] — Strict feature boundaries.
- [[Guardrails_for_AI]] — Operational rules for coding agents.
- [[Business_and_Revenue_Model]] — Commercialization strategy across phases.
- [[MOC_Servio]] — Back to Master Map of Content.
