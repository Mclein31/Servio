---
title: "SERVIO — Master Screen Inventory & UI Catalog"
tags:
  - type/ux
  - screens/inventory
aliases:
  - Screen Inventory
  - Screen List
created: 2026-10-14
updated: 2026-10-14
---

# 📱 Master Screen Inventory & UI Catalog

This catalog outlines all application screens, anchored by the **5 primary designed mobile tabs** and their approved visual mockups stored in `assets/ui/`.

---

## 1. Primary Bottom-Navigation Tabs (Designed & Approved)

> **Design Asset Path:** `assets/ui/` or `vault/03_User_Experience_and_Screens/assets/`  
> Refer to [[UI_Assets_and_Screen_Specs_for_Codex]] for pixel-level widget blueprints and color tokens.

| Tab ID | Tab Name | Route / Path | Visual Asset Mockup | Key Components on Screen |
| :--- | :--- | :--- | :--- | :--- |
| **TAB-01** | **Home** | `/home` | `assets/ui/01_screen_home.png` | Search bar + filter, "Stronger Together" hero promo card, Community Directory categories, Bulletin live requests snippet, Top Helpers Nearby horizontal avatars, Active Request Tracking snippet with 4-stage stepper. |
| **TAB-02** | **Directory** | `/directory` | `assets/ui/02_screen_directory.png` | Search bar, Category filter chips (Tutoring, Repairs, Errands, Beauty & Care, Tech Help), 2-column Helper Cards with photo, online status, star rating, distance, skill badge, and orange `[Available]` button. |
| **TAB-03** | **Bulletin** | `/bulletin` | `assets/ui/03_screen_bulletin.png` | Search bar, status filter tabs (`All`, `Open`, `! Urgent`, `Nearby`), "Help Your Neighbors" map card with pin cluster CTA `[View on Map ->]`, vertical feed of community request cards with status tags and timestamps. |
| **TAB-04** | **Tracking** | `/tracking` | `assets/ui/05_screen_tracking.png` | Featured Active Request card with helper details, live interactive route map with dynamic ETA bubble, 5-stage milestone stepper (`Posted` -> `Accepted` -> `On the Way` -> `Arrived` -> `Done`), in-app chat banner with `[Message]` button, and "Other Requests" list. |
| **TAB-05** | **Profile** | `/profile` | `assets/ui/04_screen_profile.png` | User hero card with online badge & Edit chip, 4-metric summary row (Requests Posted, Jobs Completed, Rating, Reviews), "My Services" skill cards with hourly pricing (`$XX/hr`), and account settings menu list. |

---

## 2. Secondary Customer & Modal Screens

| Screen ID | Screen Name | Route / Path | Trigger / Parent | Key Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Auth / Phone Login | `/auth/login` | App launch | Passwordless phone number OTP login |
| **SEC-02** | Auth / OTP Verification | `/auth/verify-otp` | `/auth/login` | 6-digit SMS verification code entry |
| **SEC-03** | Helper Profile Detail | `/helper/:id` | `Directory` -> Helper Card | View helper's full bio, certifications, review list, portfolio photos, and book button |
| **SEC-04** | Post Bulletin Request | `/bulletin/new` | `Bulletin` -> Floating `+` | Form to post new service request (Category, title, description, location, urgency flag, photos) |
| **SEC-05** | Request Detail Modal | `/request/:id` | `Bulletin` -> Request Card | Full request description, map pin, cancel request or accept helper proposal |
| **SEC-06** | Service Checkout & Escrow | `/checkout` | Helper Profile or SKU | Itemized bill breakdown, escrow payment authorization, slide to confirm |
| **SEC-07** | In-App Order Chat & Call | `/order/:id/chat` | `Tracking` -> `[Message]` | Order-scoped real-time messaging, photo upload, masked voice call |
| **SEC-08** | In-App Add-on Approval | `/order/:id/addon-modal`| Technician Quote Event | Review photo of damaged part & extra cost diff, "Approve" / "Decline" |
| **SEC-09** | Completion OTP Display | `/order/:id/completion`| Job Finishing Event | Displays 4-digit code to release escrow to helper |
| **SEC-10** | Rating & Review Sheet | `/order/:id/review` | Post-Completion | 5-star rating, review tags, written feedback, and tip |

---

## 3. Servio Pro (Technician Execution) Screens

| Screen ID | Screen Name | Route / Path | Key Purpose |
| :--- | :--- | :--- | :--- |
| **PRO-01** | Pro Onboarding & KYC | `/pro/onboarding` | Upload government ID and trade certification |
| **PRO-02** | Dispatch Radar Alert | `/pro/radar-alert` | 60-second animated job acceptance popup with audio chime |
| **PRO-03** | Active Job Execution Stepper | `/pro/order/:id/execute`| Status advance buttons (`En Route`, `Arrived`, `Start`, `Request OTP`) |
| **PRO-04** | Add-on Quotation Creator | `/pro/order/:id/add-quote`| Capture photo of damaged part and submit price quote |
| **PRO-05** | Validate Completion OTP | `/pro/order/:id/verify-otp`| Enter customer's 4-digit code to unlock escrow |
| **PRO-06** | Digital Wallet & Payouts | `/pro/wallet` | Check balance and withdraw earnings to bank/e-wallet |

---

## 4. Admin & Dispatch Console Screens (Web)

| Screen ID | Screen Name | Route / Path | Key Purpose |
| :--- | :--- | :--- | :--- |
| **ADM-01** | Live Dispatch Map | `/admin/live-ops` | Real-time map of all active orders, helpers, and alerts |
| **ADM-02** | Provider KYC Approvals | `/admin/kyc` | Review and verify technician ID and certification documents |
| **ADM-03** | Catalog & Pricing Manager | `/admin/catalog` | Master service items, base pricing, and category management |
| **ADM-04** | Disputes & Escrow Monitor | `/admin/disputes` | Audit chat/photo logs and manually trigger escrow release or refund |

---

## 🔗 Related Notes
- [[UI_Assets_and_Screen_Specs_for_Codex]] — Pixel-level guide with screen mockups.
- [[Customer_Journey_Map]] — User journey across these screens.
- [[Order_Lifecycle_State_Machine]] — How order states sync with the Tracking screen.
- [[MOC_Servio]] — Back to Master Map of Content.
