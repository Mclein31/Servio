---
title: "SERVIO — Customer App Screen Specifications"
tags:
  - type/ux
  - specs/customer
aliases:
  - Customer Screen Specs
  - Customer UI Specifications
created: 2026-10-14
updated: 2026-10-14
---

# 📱 Customer App Screen Specifications

Detailed component breakdown, data bindings, user interactions, and edge cases for the core screens in the Customer Flutter application.

---

## 1. CUST-04: Home & Service Discovery

### Layout & Visual Hierarchy
- **Top App Bar:**
  - Delivery location pill: Current street name + down chevron (tappable to switch address).
  - Notification bell + Cart/Active Job indicator icon badge.
- **Search Header:**
  - Search input with placeholder: *"Search 'AC cleaning', 'leaking sink', 'circuit breaker'..."*
- **Hero Promotional Banner Carousel:**
  - 3 rotating cards (e.g., *"Summer Heatwave Ready: 20% Off AC Chemical Wash"*, *"Certified Plumbers in 30 Mins"*).
- **Service Categories Grid (4x2 Grid):**
  - High-contrast icons with clear typography:
    1. ❄️ Air Conditioning
    2. 🔧 Plumbing & Drains
    3. ⚡ Electrical & Wiring
    4. 🧹 Deep Cleaning & Disinfection
    5. 🔨 Appliance Repair (Fridge/Washer)
    6. 🪚 Handyman & Carpentry
    7. 🎨 Painting & Touchup
    8. 🔍 Diagnostic / Inspection Visit
- **Emergency / Instant Dispatch Callout Card:**
  - Highlighted banner: *"Need an urgent technician right now? Tap here for instant 30-min dispatch."*
- **Popular Standardized Services List:**
  - Horizontal card scroll featuring top-rated SKUs with price and rating tags.

---

## 2. CUST-06: Service Package Detail (The SKU Screen)

### Layout & Visual Hierarchy
- **Header:** Full-bleed image carousel showing professional technician performing the service with proper safety gear.
- **Title Block:**
  - Service title (e.g., *"AC General Cleaning — Split Inverter"*).
  - Rating summary: `★ 4.9 (1.2k bookings)`.
  - Base Price: Bold highlight: `$35.00` / unit.
  - Duration estimate chip: `⏱ 60-75 mins`.
- **Warranty Callout Box:**
  - Shield icon: *"Backed by Servio 30-Day Workmanship Guarantee"*.
- **Tabbed Information Section:**
  - **Tab 1: What's Included (Green Checkmarks):**
    - Pressure wash of cooling coils & blower wheel.
    - Chemical clean of drainage tray & vacuum line flush.
    - Air filter disinfection.
    - Post-service temperature & amp draw verification.
  - **Tab 2: What's Excluded (Grey Crosses):**
    - Freon charging (available as separate SKU or add-on).
    - Circuit board electrical soldering.
    - External scaffolding installation.
- **Unit Counter Selector:**
  - Stepper `[-]  1 Unit  [+]` with dynamic subtotal update.
- **Fixed Bottom CTA Bar:**
  - Total price calculation + *"Continue to Schedule"* prominent button.

---

## 3. CUST-09: Cart & Escrow Checkout Summary

### Layout & Visual Hierarchy
- **Address Card:**
  - Map snippet thumbnail with pin + Street Address + Gate instructions.
- **Schedule Card:**
  - Tag: `[Instant Dispatch (Arriving 20-35 mins)]` OR `[Tomorrow, 10:00 AM - 12:00 PM]`.
- **Itemized Bill Breakdown:**
  - Base Service (1 Unit x $35.00): `$35.00`
  - Platform Trust & 30-Day Warranty Fee: `$2.50`
  - Taxes / Local Surcharge: `$0.00`
  - **Total Authorization Amount:** `$37.50`
- **Escrow Trust Notice:**
  - Lock icon: *"Your payment is held securely in platform escrow. Money is only transferred to the technician after you provide your completion OTP on site."*
- **Payment Method Selector:**
  - Apple Pay / Google Pay, Credit/Debit Card, or Verified In-App Wallet.
- **Action Control:**
  - Slider button: `>>> Slide to Authorize & Book >>>` (prevents accidental single-tap bookings).

---

## 4. CUST-11: Live Order Tracking (Foodpanda-Style)

### Layout & Visual Hierarchy
- **Top 60% of Screen: Interactive Map View:**
  - Real-time map displaying:
    - Customer destination pin.
    - Assigned technician avatar pin moving along dynamic route polyline.
    - Floating pill: *"ETA: 12 mins • Arriving via Honda Click (Plate: ABC-1234)"*.
- **Bottom 40%: Collapsible Persistent Bottom Sheet:**
  - **Status Progress Stepper:**
    - `[Confirmed]` -> `[En Route]` -> `[Arrived]` -> `[In Progress]` -> `[Complete]`
  - **Technician Profile Card:**
    - Circular photo, Verified Pro badge, Name (*Ramon Santos*).
    - Rating (`★ 4.95`), total completed jobs count (`342 jobs`).
    - Quick action buttons: **[Call Pro (Masked)]** and **[Chat Message]**.
  - **Emergency / Cancel Option:**
    - Accessible cancel button (subject to cancellation fee policy if en route).

---

## 5. CUST-13: In-App Add-on Quotation Modal

### Layout & Visual Hierarchy
- **Trigger:** Modal slides up automatically with haptic alert when technician requests additional parts on site.
- **Header:** *"Additional Work Required by Technician"*
- **Itemization:**
  - Diagnosis: *"Cracked AC Drainage Pipe causing water overflow"*.
  - Photo Evidence: High-resolution photo taken by technician with red highlight circle.
  - Part Name: *"Heavy Duty PVC Flexible Hose (3 meters)"*.
  - Cost Difference: `+$12.00` (Directly adjusted on escrow hold).
- **Action Buttons:**
  - **[Decline Add-on]** (Technician completes only original scope without guarantee on unaddressed fault).
  - **[Approve & Authorize +$12.00]** (Instantly updates total order bill).

---

## 6. CUST-14: Completion OTP Modal

### Layout & Visual Hierarchy
- **Visual Display:**
  - Prominent emerald green security container.
  - Large digitized 4-digit code: **`7  4  9  2`** (with high readability font).
  - QR Code fallback for technician camera scan.
- **Safety Advisory:**
  - *"⚠️ Important: Inspect your appliance and verify the repair before sharing this code. Giving this code authorizes the immediate release of funds to your technician and triggers your 30-day warranty."*
- **Checklist Confirmation Checklist:**
  - `[x] Appliance turned on and tested`
  - `[x] Work area cleaned up`

---

## 🔗 Related Notes
- [[Screen_Inventory]] — Master screen index.
- [[Screen_Specs_Provider]] — Companion technician screens.
- [[Order_Lifecycle_State_Machine]] — State logic powering these screens.
- [[MOC_Servio]] — Back to Master Map of Content.
