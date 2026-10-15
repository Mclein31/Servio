---
title: "SERVIO — Graph Index & Cross-Reference Table"
tags:
  - type/index
  - project/servio
aliases:
  - Graph Index
created: 2026-10-14
updated: 2026-10-14
---

# 🕸️ SERVIO — Graph Index & Cross-Reference Table

This index provides a complete inventory of every conceptual node in the SERVIO Obsidian Vault, showing inbound/outbound connection pathways and node classifications.

| Node | Category | Key Outbound Links | Primary Purpose |
| :--- | :--- | :--- | :--- |
| [[MOC_Servio]] | Index | All 15 Nodes | Central entry point and vault navigation |
| [[Problem_Statement]] | Vision | [[Solution_Overview]], [[Value_Propositions]], [[Market_Landscape_and_Competitors]] | Unpacks market inefficiencies & customer/provider pain points |
| [[Solution_Overview]] | Vision | [[Problem_Statement]], [[Project_Scope]], [[Screen_Inventory]], [[Order_Lifecycle_State_Machine]] | Explains the "Foodpanda for Services" product mechanics |
| [[Value_Propositions]] | Vision | [[Problem_Statement]], [[Business_and_Revenue_Model]] | Value drivers for Customers vs Service Technicians |
| [[Project_Scope]] | Scope | [[Guardrails_for_AI]], [[Feature_Roadmap]], [[Screen_Inventory]] | Strict boundary definition (MVP vs Post-MVP vs Anti-Scope) |
| [[Guardrails_for_AI]] | Scope | [[Project_Scope]], [[Domain_Model]], [[Order_Lifecycle_State_Machine]] | Critical guardrails to prevent AI coding hallucination |
| [[Feature_Roadmap]] | Scope | [[Project_Scope]], [[Business_and_Revenue_Model]] | Multi-phase growth roadmap |
| [[Screen_Inventory]] | UX | [[Customer_Journey_Map]], [[UI_Assets_and_Screen_Specs_for_Codex]], [[Screen_Specs_Customer]] | Comprehensive screen inventory across all roles |
| [[UI_Assets_and_Screen_Specs_for_Codex]] | UX | [[Screen_Inventory]], [[Customer_Journey_Map]] | Master visual screen mockup guide & Flutter widget specs for Codex |
| [[Customer_Journey_Map]] | UX | [[Screen_Inventory]], [[Screen_Specs_Customer]], [[Order_Lifecycle_State_Machine]] | Discovery to Completion step-by-step emotional & technical journey |
| [[Screen_Specs_Customer]] | UX | [[Screen_Inventory]], [[Order_Lifecycle_State_Machine]], [[Security_and_Trust_Model]] | Detailed layout, components, and states for Customer App |
| [[Screen_Specs_Provider]] | UX | [[Screen_Inventory]], [[Order_Lifecycle_State_Machine]], [[Security_and_Trust_Model]] | Detailed layout, components, and states for Servio Pro App |
| [[Screen_Specs_Admin]] | UX | [[Screen_Inventory]], [[Security_and_Trust_Model]], [[Business_and_Revenue_Model]] | Detailed layout for Dispatcher & Operations Web Console |
| [[Domain_Model]] | Design | [[Order_Lifecycle_State_Machine]], [[Security_and_Trust_Model]], [[Project_Scope]] | Data entities, attributes, relationships, and foreign keys |
| [[Order_Lifecycle_State_Machine]] | Design | [[Domain_Model]], [[Security_and_Trust_Model]], [[Screen_Inventory]] | Deterministic state machine governing bookings and escrow |
| [[Security_and_Trust_Model]] | Design | [[Order_Lifecycle_State_Machine]], [[Disintermediation_Defense]] | KYC, completion OTPs, escrow logic, masked communication |
| [[Market_Landscape_and_Competitors]] | Research | [[Problem_Statement]], [[Solution_Overview]], [[Business_and_Revenue_Model]] | Deep-dive into Urban Company, TaskRabbit, Grab, Foodpanda |
| [[Business_and_Revenue_Model]] | Research | [[Market_Landscape_and_Competitors]], [[Disintermediation_Defense]] | Unit economics, commission structure, cancellation fees |
| [[Disintermediation_Defense]] | Research | [[Security_and_Trust_Model]], [[Business_and_Revenue_Model]] | Strategies preventing off-platform leakage |

---

## 📌 Tag Taxonomy
- `#type/vision` — Product vision, mission, and problem framing
- `#type/scope` — Strict project boundaries and rules
- `#type/ux` — Screens, wireframe specifications, and user journeys
- `#type/architecture` — Domain entities, state machines, and security protocols
- `#type/research` — Industry comps, revenue models, and behavioral retention
