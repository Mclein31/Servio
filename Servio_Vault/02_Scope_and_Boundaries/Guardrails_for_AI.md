---
title: "SERVIO — Guardrails & Safety Constraints for AI Agents"
tags:
  - type/scope
  - ai/guardrails
  - architecture/safety
aliases:
  - Guardrails for AI
  - AI Safety Constraints
created: 2026-10-14
updated: 2026-10-14
---

# 🛡️ Guardrails & Safety Constraints for AI Agents

> **MANDATORY INSTRUCTION FOR ALL AI CODING AGENTS:**  
> When assisting in the development, modification, or architecture of SERVIO, you MUST adhere strictly to the rules and boundaries outlined in this document. Any deviation will cause architectural corruption and scope creep.

---

## 1. Architectural Guardrails

### ❌ Rule 1: NEVER Bypass the Standardized SKU Pattern
- **Violation:** Generating UI screens or backend schemas where users write open-ended text requests (e.g. "Fix my plumbing, quote me a price") and freelancers bid against each other.
- **Required Behavior:** Every service MUST be tied to a `ServiceItem` record with a defined base price, inclusions, exclusions, and structured unit count. For undefined faults, force selection of the standardized `Diagnostic & Inspection Visit` SKU.

### ❌ Rule 2: NEVER Bypass Platform Escrow & Completion OTP
- **Violation:** Creating payment flows that immediately credit a provider upon order creation, or marking jobs `COMPLETED` without validating the 4-digit customer-generated OTP.
- **Required Behavior:** Escrow holds funds at booking. Payouts are ONLY unlocked when the technician submits the matching `completion_otp` provided by the customer.

### ❌ Rule 3: NEVER Allow Unverified Providers into the Dispatch Radar
- **Violation:** Allowing newly registered providers to toggle `is_online = true` and receive dispatch broadcasts without `verification_status == 'APPROVED'`.
- **Required Behavior:** Enforce strict middleware guards: `can_accept_jobs = is_verified && is_active && has_passed_kyc`.

### ❌ Rule 4: NEVER Expose Raw Contact Information Pre-Completion
- **Violation:** Exposing the customer's raw personal phone number or home address publicly on the marketplace before a technician has officially accepted the order.
- **Required Behavior:** Phone numbers must be masked via proxy or in-app VoIP. Addresses only reveal general neighborhood until acceptance, whereupon full address and gate notes are revealed to the assigned technician only.

---

## 2. Technical Stack Guardrails

1. **Client Framework:** Develop purely with the **Ionic-Angular framework (`@ionic/angular`)** using **HTML** and **SCSS**, packaged via **Capacitor**. Do NOT use Flutter, React Native, or Vue.
2. **Component Architecture:** Use modern Angular patterns (Standalone components or feature modules) with dedicated `.html` templates and scoped `.scss` stylesheets.
3. **Database Schema Integrity:** Always include foreign keys, audit timestamps (`created_at`, `updated_at`), and status enums. Never store financial amounts as floating-point numbers; always store currency in smallest integer units (e.g. cents) or `NUMERIC(12, 2)`.

---

## 3. Scope Verification Checklist for AI Agents

Before submitting any code, prompt, or architectural diagram, execute this mental self-check:

- [ ] Does this proposed change introduce open-ended bidding or classifieds? *(If YES: Stop and reject)*
- [ ] Does this allow cash bypass outside platform logging? *(If YES: Stop and reject)*
- [ ] Does this introduce unnecessary crypto, AI bot diagnostic gimmicks, or social feeds? *(If YES: Stop and reject)*
- [ ] Does the order lifecycle adhere to [[Order_Lifecycle_State_Machine]]? *(If NO: Correct it)*
- [ ] Are the UI components matched to [[Screen_Inventory]]? *(If NO: Correct it)*

---

## 🔗 Related Notes
- [[Project_Scope]] — Full feature matrix.
- [[Order_Lifecycle_State_Machine]] — Non-negotiable state transitions.
- [[Domain_Model]] — Entity definitions.
- [[Screen_Inventory]] — Authorized screens.
- [[MOC_Servio]] — Back to Master Map of Content.
