---
title: "SERVIO — Customer Journey Map"
tags:
  - type/ux
  - journey/customer
aliases:
  - Customer Journey Map
  - End-to-End User Flow
created: 2026-10-14
updated: 2026-10-14
---

# 🗺️ Customer Journey Map: The "Foodpanda for Services" Experience

This map illustrates the step-by-step journey of a customer from the moment an in-home problem occurs to the verified completion of service.

---

## The Journey Stages

```
[ 1. Discovery ] ---> [ 2. SKU Selection ] ---> [ 3. Checkout & Escrow ]
       |                      |                         |
       v                      v                         v
[ 4. Radar Matching ] -> [ 5. Live Tracking ] -> [ 6. On-Site Service ]
                                                        |
                                                        v
                                             [ 7. OTP Sign-Off & Review ]
```

---

### Stage 1: Problem Awareness & Discovery
- **User Scenario:** The customer's split-type inverter AC starts leaking water down the bedroom wall.
- **Action:** Customer opens SERVIO.
- **Screen:** `CUST-04: Home & Discovery`
- **Experience:**
  - Customer sees quick category pills: **[Air Conditioning]**, **[Plumbing]**, **[Electrical]**, **[Cleaning]**.
  - Taps **[Air Conditioning]** and sees immediate popular options: "General Cleaning", "Freon Re-Gas", "Water Leak Repair", "Diagnostic Inspection".
- **Mindset:** Anxious, looking for fast relief and predictable cost.

---

### Stage 2: SKU Specification & Customization
- **Action:** Selects "AC Water Leak Inspection & Repair".
- **Screen:** `CUST-06: Service Package Detail`
- **Experience:**
  - Standardized price clearly displayed: *$35 (Includes drain pipe flush & coil tray clearing)*.
  - Duration estimate: *45 - 60 minutes*.
  - Inclusions / Exclusions explicitly listed.
  - Unit counter: Customer sets "1 Unit".
  - Warranty badge highlighted: *30-Day Workmanship Guarantee*.
- **Mindset:** Reassured; knows what is included without haggling.

---

### Stage 3: Location, Scheduling & Escrow Checkout
- **Action:** Confirms address and selects dispatch mode.
- **Screens:** `CUST-07`, `CUST-08`, `CUST-09`
- **Experience:**
  - Selects saved home address with gate code note: *"Unit 402, Ring buzzer 402"*.
  - Chooses **[Instant Dispatch — Nearest Tech (15-30m)]**.
  - Reaches Checkout: Total = $35.00 + $2.50 Platform/Insurance Fee = $37.50.
  - Selects payment method (Apple Pay / Card / E-Wallet).
  - Slides to Confirm: Payment is **held in platform escrow** (authorized, not yet transferred to technician).

---

### Stage 4: Algorithmic Matching (The Radar)
- **Action:** Platform matches nearest technician.
- **Screen:** `CUST-10: Searching for Pro (Radar)`
- **Experience:**
  - Pulsating radar animation searching active technicians within 10km.
  - Within 28 seconds, Pro "Ramon Santos (4.9 ★, 342 AC Jobs)" accepts the order.
  - Customer receives success haptic buzz and phone chime.

---

### Stage 5: Live Route Tracking & Communication
- **Action:** Customer monitors technician's approach.
- **Screen:** `CUST-11: Live Order Tracking` & `CUST-12: In-App Chat`
- **Experience:**
  - Real-time map shows Ramon on his motorcycle en route with a dynamic 14-minute ETA.
  - Ramon sends a quick chat message: *"On my way, ETA 10 minutes."*
  - Customer tracks him right up to the building entrance.

---

### Stage 6: On-Site Execution & In-App Add-on (If Needed)
- **Action:** Technician inspects and performs repair.
- **Screens:** `CUST-11`, `CUST-13: Add-on Modal`
- **Experience:**
  - Ramon updates status to **[Arrived]** -> **[In Progress]**.
  - *Scenario:* Ramon discovers the drain hose is cracked and requires replacement.
  - Rather than demanding cash, Ramon submits an in-app add-on: *"New Heavy-Duty Drain Hose (+$8.00)"* with a photo of the cracked hose.
  - Customer's phone vibrates with `CUST-13`: Customer inspects photo and taps **[Approve & Authorize +$8.00]**.

---

### Stage 7: Verified Completion, OTP Release & Review
- **Action:** Job finished, cold air restored, leak stopped.
- **Screens:** `CUST-14: Completion OTP Modal` & `CUST-15: Review`
- **Experience:**
  - Ramon cleans up the workspace and taps "Finish Job" on his app.
  - Customer app displays a bright green card: **Your Completion Code: [ 8 4 1 9 ]**.
  - Instruction: *"Only share this code if the repair is completed to your satisfaction."*
  - Customer gives code to Ramon, who inputs it into his app.
  - Escrow automatically unlocks: Ramon's wallet is credited.
  - Customer rates Ramon 5 stars, selects badges: `[Punctual] [Clean Work] [Master Expert]`, and downloads the 30-day warranty certificate.

---

## 🔗 Related Notes
- [[Screen_Inventory]] — All screen definitions.
- [[Screen_Specs_Customer]] — Customer screen components.
- [[Order_Lifecycle_State_Machine]] — Underlying state machine transitions.
- [[MOC_Servio]] — Back to Master Map of Content.
