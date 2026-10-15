---
title: "SERVIO — Business & Revenue Model"
tags:
  - type/research
  - business/revenue
aliases:
  - Business Model
  - Revenue Architecture
  - Unit Economics
created: 2026-10-14
updated: 2026-10-14
---

# 💰 Business & Revenue Model

SERVIO generates revenue through transparent, transaction-based take rates and platform trust fees. Unlike lead-generation models (e.g. Thumbtack, Angi) that charge upfront fees for unverified inquiries, SERVIO only monetizes on successfully executed, OTP-verified transactions.

---

## 1. Primary Revenue Streams

```
+-------------------------------------------------------------+
|                  CUSTOMER GROSS ORDER VALUE                 |
|             (e.g., $35.00 Base + $2.50 Trust Fee)           |
+------------------------------+------------------------------+
                               |
                +--------------+--------------+
                |                             |
                v                             v
+-------------------------------+ +---------------------------+
|    SERVICE PRO NET PAYOUT     | |    SERVIO GROSS REVENUE   |
|         85% ($29.75)          | |  15% Comm. + $2.50 Fee    |
| (Direct to Pro In-App Wallet) | |       = $7.75 Total       |
+-------------------------------+ +-------------+-------------+
                                                |
                               +----------------+----------------+
                               |                                 |
                               v                                 v
                +----------------------------+     +----------------------------+
                | Payment & Map Costs (~$1.5)|     | 30-Day Warranty Pool (2%)  |
                +----------------------------+     +----------------------------+
                               |                                 |
                               +----------------+----------------+
                                                |
                                                v
                               +-------------------------------+
                               |       SERVIO NET MARGIN       |
                               |         ~$5.50 / Job          |
                               +-------------------------------+
```

### 1. Platform Take-Rate Commission (15%)
- A 15% service fee is automatically deducted from the base service price and any authorized add-ons upon completion OTP entry.
- The remaining 85% is instantly deposited into the technician's wallet.

### 2. Customer Trust & 30-Day Warranty Fee ($2.00 - $3.00 Fixed)
- Billed directly to the customer at checkout on every booking.
- Funds the platform's customer support, identity vetting infrastructure, and the 30-Day Workmanship Re-Visit Guarantee.

### 3. Diagnostic & Inspection Callout Fee
- If an issue cannot be pre-categorized and requires an in-person physical inspection, the customer pays a fixed $15 - $20 diagnostic fee.
- If the customer approves the repair quote, 50% of the diagnostic fee is credited toward the repair service. If they decline further work, the technician receives 80% of the callout fee for their travel and time.

### 4. Cancellation & Trip Compensation Fees
- Cancellation > 5 mins after a technician has set status to `EN_ROUTE`: $10 fee billed to customer ($8 credited to technician for travel compensation, $2 retained by platform).

---

## 2. Representative Unit Economics (Sample AC Cleaning Order)

| Line Item | Amount ($) | Percentage / Flow |
| :--- | :--- | :--- |
| **Base Service Price (AC Cleaning - 1 Unit)** | **$35.00** | Paid by Customer |
| **Trust & Warranty Fee** | **$2.50** | Paid by Customer |
| **Gross Merchandise Value (GMV)** | **$37.50** | Total Customer Out-of-Pocket |
| *(-) Provider Earnings (85% of Base)* | *($29.75)* | Unlocked to Provider Wallet via OTP |
| **Gross Platform Revenue** | **$7.75** | Platform Intake ($5.25 + $2.50) |
| *(-) Payment Gateway Processing (2.9% + $0.30)* | *($1.39)* | Stripe / Digital Wallet interchange |
| *(-) Map & SMS Costs (Google Maps API + Twilio OTP)*| *($0.35)* | Infrastructure COGS |
| *(-) Warranty Reserve Allocation (2% of GMV)* | *($0.75)* | Re-visit insurance reserve |
| **Net Contribution Margin per Booking** | **+$5.26** | **~68% Margin on Platform Revenue** |

---

## 3. Customer Lifetime Value (LTV) Dynamics

- **High Repetition Rate:** Air conditioning units in tropical climates require cleaning every 3 to 4 months (3-4 bookings/year per household).
- **Cross-Trade Expansion:** A customer who experiences a seamless AC cleaning on SERVIO has an 8-fold higher likelihood of booking emergency plumbing or electrical work on the platform rather than searching Google or Facebook.
- **Projected Annual Value:**
  - 3 AC Cleanings/yr ($112.50) + 1 Emergency Plumbing Visit ($45.00) = **$157.50 GMV/year per retained household**.
  - Annual Platform Contribution Margin = **~$25.00 net per household/year**.

---

## 🔗 Related Notes
- [[Market_Landscape_and_Competitors]] — Competitive market context.
- [[Disintermediation_Defense]] — Protecting take-rate sustainability.
- [[Value_Propositions]] — Why both sides accept these economics.
- [[MOC_Servio]] — Back to Master Map of Content.
