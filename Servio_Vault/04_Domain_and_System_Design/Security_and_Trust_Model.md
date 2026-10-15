---
title: "SERVIO — Security, Trust & Safety Model"
tags:
  - type/architecture
  - security/trust
aliases:
  - Security and Trust Model
  - Safety Protocols
created: 2026-10-14
updated: 2026-10-14
---

# 🛡️ Security, Trust & Safety Model

In an in-home services marketplace, trust is not an aesthetic feature—it is the existential product. Consumers are admitting unfamiliar individuals into their private residences, while technicians are entering private properties where their personal safety and financial compensation must be defended.

---

## 1. Multi-Tier Provider KYC & Vetting

No technician can access the dispatch radar or view customer addresses without completing mandatory 3-stage vetting:

```
[ Stage 1: Identity & Background ] ---> [ Stage 2: Trade Competency ] ---> [ Stage 3: Operational Trial ]
  - Government Photo ID (NBI/Police)     - Vocational Certifications         - First 5 jobs monitored with
  - Selfie facial match verification     - Safety toolkit audit                100% customer follow-up call
```

1. **Stage 1: Identity & Criminal Background Check:**
   - National Government ID / Driver's License verification.
   - Police / Criminal record clearance check.
   - Real-time selfie liveness verification matching the submitted ID photo.

2. **Stage 2: Trade Competency & Tooling Audit:**
   - Vocational certification validation (e.g. TESDA National Certificate in RAC Servicing / Electrical Installation).
   - Minimum tooling checklist verification (e.g. manifold gauge, vacuum pump, multimeter, insulated gloves, canvas wash bag).

3. **Stage 3: The Probationary "Greenhorn" Tier:**
   - Newly verified technicians start in a probationary status for their first 5 bookings.
   - Platform operations calls the customer immediately after job completion to inspect service quality.

---

## 2. In-App Escrow & Financial Security

- **Zero Direct Cash Exposure for Labor:**
  - Labor costs are pre-authorized on customer credit/debit card, Apple/Google Pay, or authenticated digital wallets upon booking.
  - Funds are locked in a segregated merchant escrow account.
  - Technicians cannot be shortchanged or haggled upon completion.
  - Customers cannot have money stolen for unfinished work.

- **Completion OTP Handshake:**
  - The customer is in absolute sovereign control of the payment release. The technician cannot unilaterally trigger funds disbursement.

---

## 3. Contact Masking & Privacy Shield

- **Number Masking (Twilio / Agora Proxy):**
  - Raw personal phone numbers of customers and technicians are never revealed in the chat or call interfaces.
  - Calls and SMS bridge through temporary platform virtual numbers that expire 2 hours after order completion.
- **Progressive Location Disclosure:**
  - When an order is broadcast on the radar, technicians only see general district/neighborhood (e.g. *"Salcedo Village, Makati (2.1 km away)"*).
  - Exact building, floor, unit number, and gate codes are only revealed *after* the technician formally accepts the order.

---

## 4. The 30-Day Platform Workmanship Warranty Pool

- Every completed booking is covered by the **Servio Guarantee**.
- 2% of the platform commission is routed into an internal warranty indemnity reserve.
- If a repaired appliance fails or leaks within 30 days of service:
  1. The customer files a warranty claim via `CUST-16`.
  2. SERVIO dispatches a senior master technician for a free re-inspection and re-repair.
  3. If the original technician is proven negligent, the repair cost is deducted from the original technician's future payouts.

---

## 🔗 Related Notes
- [[Order_Lifecycle_State_Machine]] — How escrow ties into order states.
- [[Domain_Model]] — Storage of KYC and transaction records.
- [[Disintermediation_Defense]] — Why trust features stop off-platform leakage.
- [[MOC_Servio]] — Back to Master Map of Content.
