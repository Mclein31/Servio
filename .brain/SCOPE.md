# SERVIO — Scope & Boundaries Guardrail

> **Status:** Active Boundary Definition  
> **Related Vault Note:** `vault/02_Scope_and_Boundaries/Project_Scope.md`  
> **Rule for Agents:** Any code, architecture, or database schema must comply strictly with the boundaries defined below.
> **Reviewed:** 2026-11-15 — see §4 for where the current prototype deviates from these boundaries.

---

## 1. MVP Scope (Phase 1 — Core On-Demand Marketplace)

The MVP is strictly focused on establishing a working two-sided on-demand services marketplace operating with standardized service items and escrow payments.

### In-Scope Features:

1. **Authentication & Identity:**
   - Phone number OTP & Email login (Firebase Auth / Supabase Auth style).
   - Profile setup (Customer: name, phone, saved addresses; Provider: personal info, trade category, ID document upload for manual KYC).

2. **Catalog & Discovery (Customer):**
   - Hierarchical category browsing (e.g., Air Conditioning, Plumbing, Electrical, Cleaning).
   - Standardized Service SKU display (Base Price, estimated duration, inclusions, exclusions, warranty info).
   - Location-aware availability checking.

3. **Booking & Checkout:**
   - Booking modes: **Instant On-Demand** (nearest technician dispatch) OR **Scheduled Slot** (date + morning/afternoon window).
   - Address picker with GPS pin and delivery notes (landmarks, gate codes, parking tips).
   - Payment authorization (Escrow hold via Card / Digital Wallet / Cash with platform guarantee).

4. **Technician Dispatch & Job Lifecycle:**
   - Provider radar broadcast to nearest online, qualified technicians ordered by distance, without a fixed radius cutoff (owner update, 2026-10-18).
   - 60-second acceptance countdown for providers.
   - Real-time job status updates:
     - `PENDING_ACCEPTANCE`
     - `ACCEPTED` (Provider assigned)
     - `EN_ROUTE` (Live GPS tracking visible to customer)
     - `ARRIVED`
     - `IN_PROGRESS`
     - `COMPLETED` (Requires Customer OTP confirmation)
     - `CANCELLED`

5. **In-App Communication:**
   - Order-scoped text chat between customer and assigned technician (active only during the active order lifecycle).
   - Calls: the owner chose carrier calls via the device dialer using the peer's saved number, available only to active booking participants (ADR-031), instead of masked voice calls.

6. **Add-on / Extra Scope Approval:**
   - If a technician diagnoses additional work needed (e.g., replacement capacitor for AC), they submit an in-app "Extra Parts / Service" quote with photo proof.
   - Customer must tap "Approve & Pay Difference" on their app before technician proceeds.

7. **Escrow Settlement & Reviews:**
   - Auto-release escrow to provider's in-app wallet upon customer OTP entry.
   - Bidirectional 5-star ratings and written reviews with tags.

8. **Admin Operations:**
   - Basic web console: review pending provider applications (KYC approval/rejection), inspect active bookings, manual dispute overrides.

---

## 2. Post-MVP Scope (Phase 2 & Beyond — DO NOT IMPLEMENT NOW)

- **Do NOT implement in Phase 1:**
  - Automated dynamic surge pricing algorithms.
  - Multi-tier provider subscriptions or paid ad-placement boosts.
  - Multi-technician team jobs (e.g., commercial enterprise HVAC overhauls).
  - In-house tool or consumable e-commerce store (selling freon/parts directly to technicians).
  - B2B corporate billing accounts and invoicing portals.
  - AI automated photo diagnosis of broken machinery.
  - Crypto or web3 payment integrations.
  - In-app social feed or forum.

---

## 3. Strict Anti-Scope (Out-of-Scope Forever)

These features are fundamentally antithetical to SERVIO's product model and must never be built:

1. **Open-Ended Unregulated Bidding / Classified Ads:**
   - SERVIO is NOT Craigslist or OLX. Customers cannot post vague "I need someone to fix stuff, name your price" listings that trigger bidding wars. All services must be structured catalog SKUs or fixed-fee diagnostic inspections.
2. **Offline Direct Cash Settlement Without Platform Tracking:**
   - No feature that allows bypassing platform accounting or commission tracking.
3. **Peer-to-Peer Unvetted Gig Labor:**
   - Providers MUST be KYC-verified before appearing on the dispatch radar.
4. **General Social Networking Features:**
   - No social friending, public wall posts, or direct messaging outside active bookings.

---

## 4. Implementation Status vs. Boundaries (2026-11-15)

Where the working prototype currently differs from the MVP scope above. These are known gaps, not new scope; details in `TODO.md` → Known gaps.

- **Sign-in:** email codes only (Gmail SMTP). Phone OTP is not implemented.
- **Provider vetting:** self-service "Become a Servio Pro" grants `APPROVED` without document review, which conflicts with Anti-Scope rule 3 until real KYC review exists.
- **Payments:** escrow, add-on holds, tips and payouts are simulated by a mock provider over a real ledger; no Card/Digital Wallet charge happens.
- **Dispatch:** nearest qualified online Pros with no radius cutoff (ADR-035); runs only while a Pro app is open.
- **Calls:** carrier calls with real numbers between active participants (ADR-031), not masked calls.
- **Admin operations:** no web console; only staff support-report API endpoints.
- **Added beyond the original list (owner-approved):** fixed-SKU Bulletin reservations (ADR-032) and platform-funded loyalty coupons (ADR-038). Neither introduces bidding or price negotiation.
