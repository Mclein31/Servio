---
title: "SERVIO — Admin & Dispatcher Console Screen Specifications"
tags:
  - type/ux
  - specs/admin
aliases:
  - Admin Screen Specs
  - Operations Console Specs
created: 2026-10-14
updated: 2026-10-14
---

# 🖥️ Admin & Dispatcher Console Screen Specifications

Specifications for the operational web dashboard used by operations managers, dispatch controllers, and compliance staff to oversee the SERVIO platform.

---

## 1. ADM-02: Live Dispatch & City Operations Map

### Layout & Visual Hierarchy
- **Primary Viewport:** Full-screen high-resolution vector map (Mapbox / Google Maps) of the active operational territory.
  - **Online Technicians Layer:** Green dots indicating idle technicians; blue dots indicating technicians en route; orange dots indicating technicians currently working on-site.
  - **Active Orders Layer:** Pulsing markers for unassigned/broadcasting orders; flagged markers for delayed or overdue jobs.
- **Left Collapsible Control Panel:**
  - Real-time KPI ticker: `Online Pros: 142` | `Active Jobs: 38` | `Unmatched Orders: 2` | `Avg Acceptance Time: 34s`.
  - Filter by trade category: `[All] [HVAC] [Plumbing] [Electrical] [Cleaning]`.
- **Manual Intervention Drawer:**
  - Allows dispatch operator to manually re-assign or force-broadcast an order if the automated radar fails to find an available pro after 3 cycles (180s).

---

## 2. ADM-03: Provider KYC & Onboarding Review

### Layout & Visual Hierarchy
- **Split-Screen Reviewer Layout:**
  - **Left Pane (50%):** Dual high-resolution document viewer with pan/zoom tools displaying:
    - Government ID (Front and Back).
    - Trade Certification / Vocational Diploma (e.g. TESDA / City Guilds HVAC Certificate).
    - Selfie verification photo comparison.
  - **Right Pane (50%):** Provider profile data and validation controls:
    - Full legal name, date of birth, national ID number, contact number, home address.
    - Trade category check-boxes.
    - Background check status toggle (`Clean Police Clearance` / `Pending`).
- **Decision Controls:**
  - **[ REJECT APPLICATION ]** (Opens modal with mandatory rejection reason sent via SMS/Email to provider).
  - **[ APPROVE & ACTIVATE PRO ]** (Transitions provider status to `ACTIVE_VERIFIED`, sends welcome SMS, and unlocks Pro App dashboard).

---

## 3. ADM-04: Master Catalog & SKU Pricing Manager

### Layout & Visual Hierarchy
- **Hierarchical Category Tree View:**
  - Level 1: Core Trade Categories (e.g. Air Conditioning, Plumbing, Electrical).
  - Level 2: Subcategories (e.g. Split Inverter, Window Type, Central Ducted).
  - Level 3: Service SKUs (e.g. General Cleaning, Freon Top-up, Water Leak Repair).
- **SKU Editor Modal:**
  - SKU Title, Subtitle, and SEO Slug.
  - Base Customer Price (e.g. `$35.00`).
  - Standard Pro Payout (e.g. `$29.75` / 85%).
  - Platform Commission (e.g. `$5.25` / 15%).
  - Estimated Service Duration slider (e.g. 45 - 90 mins).
  - Inclusions editor (Dynamic bullet list).
  - Exclusions editor (Dynamic bullet list).
  - Standardized Add-on association picker.

---

## 4. ADM-05: Bookings, Escrow & Disputes Monitor

### Layout & Visual Hierarchy
- **Data Table View:**
  - Columns: Order ID, Date/Time, Customer, Assigned Pro, Category, Status, Total Amount, Escrow Status, Actions.
  - Quick filters: `[All]`, `[Active]`, `[Disputed]`, `[Overdue]`, `[Refund Requested]`.
- **Dispute Audit Drawer:**
  - Displays complete audit trail:
    - Customer original complaint text & uploaded photos.
    - Technician completion timestamp and submitted photos.
    - Complete chat transcript log and masked call log durations.
    - Escrow state: `$37.50 [HELD_IN_DISPUTE]`.
- **Administrative Settlement Actions:**
  - **[ Release 100% to Provider ]** (If customer made fraudulent or invalid claim).
  - **[ Issue 100% Refund to Customer ]** (If provider caused damage or failed to execute).
  - **[ Split Settlement (50/50) ]** (Mediated compromise).
  - **[ Dispatch Warranty Re-Visit ]** (Assign new technician at zero cost to customer, funded by platform warranty pool).

---

## 🔗 Related Notes
- [[Screen_Inventory]] — Master screen catalog.
- [[Security_and_Trust_Model]] — Admin audit protocols.
- [[Order_Lifecycle_State_Machine]] — Dispute state flows.
- [[MOC_Servio]] — Back to Master Map of Content.
