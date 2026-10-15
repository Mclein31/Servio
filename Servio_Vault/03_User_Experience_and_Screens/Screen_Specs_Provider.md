---
title: "SERVIO — Servio Pro (Technician) Screen Specifications"
tags:
  - type/ux
  - specs/provider
aliases:
  - Servio Pro Screen Specs
  - Technician UI Specifications
created: 2026-10-14
updated: 2026-10-14
---

# 🔧 Servio Pro (Technician) Screen Specifications

Detailed component breakdown, workflow logic, and interaction controls for the **Servio Pro** Flutter mobile application used by skilled service professionals.

---

## 1. PRO-04: Pro Dashboard & Dispatch Radar

### Layout & Visual Hierarchy
- **Header Status Bar:**
  - Online / Offline Master Switch: Large toggle switch (`[ ONLINE - Ready for Jobs ]` vs `[ OFFLINE ]`).
  - Signal strength & GPS status indicator.
  - Active trade badge: `HVAC Specialist (Verified)`.
- **Today's Metric Cards:**
  - Net Earnings Today: `$142.50`
  - Completed Jobs: `3 Jobs`
  - Acceptance Rate: `96%`
  - Current Rating: `★ 4.95`
- **Active Dispatch Radar View:**
  - Animated radar pulse visualization when online.
  - Subtext: *"Scanning for service orders within 10km of Makati City..."*
- **Quick Links:**
  - Wallet balance snapshot + "Cashout" button.
  - Equipment & safety checklist reminder.

---

## 2. PRO-05: Incoming Job Alert Modal (The 60s Countdown)

### Layout & Visual Hierarchy
- **Trigger:** Full-screen high-priority alert dialog accompanied by repetitive audio chime and haptic vibration pattern (similar to Uber/Foodpanda driver alerts).
- **Timer Header:**
  - Circular animated countdown ring from `60` down to `0` seconds.
- **Job Card Details:**
  - Service Title: **"AC Water Leak Inspection & Repair"**
  - Customer Neighborhood: **"Bel-Air Village, Makati (2.4 km away)"** *(Exact unit withheld until acceptance)*.
  - Guaranteed Pro Payout: **`$29.75`** *(85% of base price after platform commission)*.
  - Estimated Job Time: `45-60 mins`.
- **Action Buttons:**
  - **[ PASS / DECLINE ]** (Red outline button — immediate re-broadcast to next technician).
  - **[ ACCEPT JOB ]** (Full-width vibrant green button with thumb-zone ergonomics).

---

## 3. PRO-06: Active Job Execution Stepper

### Layout & Visual Hierarchy
- **Job Overview Card:**
  - Customer full address, gate code, parking tips, and customer name.
  - Direct communication actions: **[Call Customer]** & **[Open In-App Chat]**.
- **External Navigation Integration:**
  - Quick action: **[Navigate with Google Maps / Waze]** (passes destination coordinates to native maps app).
- **The Execution Action Button (One-Tap Status Advance):**
  - The primary bottom button dynamically changes label and state:
    1. *Stage 1 (Accepted):* Button reads **`[ Tap When En Route ]`** -> emits `EN_ROUTE`.
    2. *Stage 2 (En Route):* Button reads **`[ Tap When Arrived On-Site ]`** -> emits `ARRIVED`.
    3. *Stage 3 (Arrived):* Button reads **`[ Start Working ]`** -> emits `IN_PROGRESS` (starts job timer).
    4. *Stage 4 (In Progress):* Button reads **`[ Work Finished — Request Customer OTP ]`** -> navigates to OTP screen.
- **Secondary Actions:**
  - **[ + Request Add-on / Spare Part ]** button (always accessible while in progress).
  - **[ Report Emergency / Safety Issue ]** link.

---

## 4. PRO-07: In-App Add-on & Extra Work Quotation

### Layout & Visual Hierarchy
- **Title:** *"Submit Additional Work or Spare Part"*
- **Camera Capture Box:**
  - Large viewfinder button to snap mandatory photographic evidence of damaged part on-site.
  - Image preview with retake option.
- **Category / Part Selector:**
  - Dropdown of standardized parts (e.g., Capacitor, Freon Top-Up, PVC Drain Hose, Magnetic Contactor) OR "Custom Specialized Labor".
- **Price Input:**
  - Price field pre-filled with platform recommended retail price (editable within safety bounds).
- **Customer Impact Summary:**
  - Displays: *"Customer will be billed $12.00. Your payout increases by +$10.20."*
- **Submit CTA:**
  - **[ Send Quote to Customer Phone ]** -> Pushes instant modal to `CUST-13`.

---

## 5. PRO-08: Validate Completion OTP Screen

### Layout & Visual Hierarchy
- **Header:** *"Complete Job & Unlock Payout"*
- **Instruction Prompt:**
  - *"Ask the customer to open their Servio app and provide their 4-Digit Completion Code after they inspect your completed work."*
- **Input Pad:**
  - 4 large distinct digit boxes with native numeric keyboard.
  - Secondary fallback button: **[ Scan Customer QR Code ]** (activates camera scanner).
- **Submit Action:**
  - **[ Verify Code & Collect Payout ]** button.
- **Success State Animation:**
  - Green checkmark confetti burst + *"Success! $29.75 has been credited to your Servio Pro Wallet."*

---

## 6. PRO-09: Pro Digital Wallet & Payouts

### Layout & Visual Hierarchy
- **Balance Card:**
  - Total Available Balance: **`$342.10`** (Eligible for instant bank/e-wallet cashout).
  - Pending Escrow (Jobs currently in progress): **`$68.00`**.
- **Withdrawal Action:**
  - **[ Transfer to Bank Account / GCash / GrabPay ]** button.
- **Transaction Ledger:**
  - Chronological list of completed jobs, date, customer order ID, base payout, tips, and platform fee breakdown.
  - Color-coded badges: `[CREDITED]`, `[CASHOUT_PROCESSED]`, `[DISPUTE_HOLD]`.

---

## 🔗 Related Notes
- [[Screen_Inventory]] — Master screen index.
- [[Screen_Specs_Customer]] — Customer screen specs.
- [[Order_Lifecycle_State_Machine]] — Status triggers and transitions.
- [[MOC_Servio]] — Back to Master Map of Content.
