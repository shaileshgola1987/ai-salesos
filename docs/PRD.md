# AI SALES CRM + WHATSAPP + SFA — Product Requirements Document (PRD)

Version 2.0 | August 19, 2026

## 1. Product Overview

**Product Name:** AI SalesOS
**Category:** AI-powered Sales CRM + WhatsApp Business + Sales Force Automation
**Target Market:** Indian MSMEs, SMEs, distributors, manufacturers, wholesalers, dealers and field-sales organizations.

**Product Vision:** Build a simple, affordable, mobile-first sales platform that helps Indian businesses capture every lead, respond faster, manage WhatsApp conversations, assign leads to salespeople, automate follow-ups, track field sales activities, generate quotations, predict lead conversion potential, provide AI assistance, and monitor the entire sales pipeline from one dashboard.

**Core Positioning:** "Turn WhatsApp conversations into organized sales." Competes on: Simplicity + WhatsApp + AI + Indian sales workflows + affordability — not on enterprise functionality.

## 2. Problem Statement

Many Indian MSMEs manage sales using fragmented tools: WhatsApp, Excel, phone calls, email, paper notebooks, IndiaMART, Justdial, website forms, Meta Lead Ads, Google Ads, manual quotations, and personal mobile phones.

| Issue | Impact |
|---|---|
| Leads are lost | No centralized tracking |
| Forgotten follow-ups | Missed sales opportunities |
| Invisible salesperson activity | Managers cannot monitor |
| Scattered conversations | Incomplete customer context |
| Hard to identify hot leads | Cannot prioritize sales efforts |
| Manual reporting | Time-consuming, error-prone |
| Difficult field monitoring | No real-time visibility |
| Incomplete customer history | Poor personalization |
| Slow lead response | Lost to competitors |
| Repetitive admin work | Salespeople inefficient |

**Solution:** Centralize all sales activities into one AI-powered platform.

## 3. Target Customers

**Primary Profile:** Indian MSMEs with 2–50 salespeople, 100–10,000 leads/month, WhatsApp-based sales, field sales teams, B2B sales, dealer/distributor networks.

**Recommended Initial Vertical:** Industrial Manufacturers / Suppliers / Distributors — industrial machinery, electrical products, hardware, safety equipment, packaging, auto components, building materials, textile machinery, industrial chemicals, tools, pumps, valves, pipes & fittings. Clear lead → quotation → negotiation → order workflows.

## 4. MVP Core Modules

1. **Organization** — Company registration, profile, GSTIN, subscription management
2. **User Management** — Admin, Owner, Sales Manager, Sales Executive, Field Sales Executive roles
3. **Lead Management** — Lead capture, scoring, status tracking, assignment, follow-ups
4. **Pipeline Management** — Visual Kanban pipeline with configurable stages
5. **WhatsApp CRM** — Shared inbox, conversation history, templates, two-way messaging
6. **AI Lead Scoring** — Automated 0-100 scoring with hot/warm/cold categorization
7. **Customer Management** — 360° customer view with timeline and interaction history
8. **Sales Force Automation** — Field visits, GPS check-in, activity tracking, visit notes
9. **Quotation Management** — Create, send, track, share quotations via WhatsApp/Email
10. **Task & Follow-ups** — Automated reminders, multi-channel notifications
11. **AI Sales Assistant** — Lead summaries, reply suggestions, next-action recommendations
12. **Dashboard & Reports** — Owner dashboard, salesperson performance, pipeline analytics

## 5. Mobile & Offline Capabilities

**Mobile Strategy:** Progressive Web App (PWA) as primary MVP delivery; responsive design; native apps (iOS/Android) in Phase 2 for premium features (payments, advanced camera).

**Offline-First Architecture (critical for India, patchy 4G/5G in rural areas):**
- Store leads, contacts, quotations locally using IndexedDB/SQLite
- Allow creating leads, logging visits, adding notes without internet
- Sync data when connectivity returns
- Cache WhatsApp messages locally
- Offline forms with auto-save
- Bulk upload when online

**Recommended Tech:** React Native or Flutter for mobile; PWA for web.

## 6. Advanced Analytics & Custom Reporting

**Pre-built Dashboards:** Sales, Manager, Field Sales, CFO, AI Analytics.

**Custom Reports:** Drag-and-drop report builder, save/schedule as PDFs, email weekly/monthly, export to Excel/CSV, drill-down capability.

## 7. Collaboration Features

Internal notes, @mentions, threaded comments, activity feed, email notifications. Prevents information silos, creates transparency.

## 8. Win/Loss Analysis

Capture reason for winning/losing, competitor name, customer feedback, salesperson notes. Reports on why we win vs lose.

## 9. SMS & Email Integration

SMS reminders (Exotel/AWS SNS), Gmail/Outlook email sync to lead record, email notifications when WhatsApp unread >2h, shared support email inbox auto-creates/links leads.

## 10. Customer Health Score

0–100 score based on: days since last contact, interactions this month, order value trend, payment timeliness, support tickets, renewal status. Green/Yellow/Red indicator.

## 11. Territory Management

Assign by geography, salesperson, product category, or industry. Prevents duplicate follow-ups, ensures fair distribution.

## 12. Document Management

Upload brochures/spec sheets/quotations/contracts; share via WhatsApp/Email; versioning; S3 storage; search.

## 13. Payment Tracking & Invoicing

Auto-generate GST invoice from quotation, payment status via Razorpay, payment links via WhatsApp, partial payments, automated overdue reminders. Integrates Razorpay, Stripe, Tally.

## 14. Warranty & AMC Management

Track warranty dates/terms, AMC contracts, renewal reminders (90/30/7 days), support tickets, auto-generated renewal quotations.

## 15. Performance Goals & Sales Targets

Manager-set monthly targets, real-time progress tracking, red/green alerts, auto commission calculation, permission-based leaderboard.

## 16. Referral Tracking

Source tracking for customer referrals, referral chain, reward program, top-referrer reports.

## 17. AI Customization & Tuning

Custom lead scoring weights, configurable AI tone (formal/casual/Hindi/regional), RAG tuning on company catalog/pricing/FAQs, A/B testing of AI messages, feedback loop for AI learning.

## 18. Compliance & Data Governance

GSTIN validation, configurable data retention, audit logs, export control, GDPR/India compliance (right to be forgotten, portability, consent), mandatory 2FA for admins.

## 19. Bulk Operations

Bulk lead import (CSV, dedup), bulk assignment, bulk messaging (WhatsApp rate-limit aware), bulk status update, scheduled bulk actions.

## 20. Customer Feedback & NPS

Post-order NPS survey via WhatsApp, feedback forms, NPS trend tracking, detractor alerts, salesperson response-rate tracking.

## 21. Updated MVP Definition

- **Core:** Organization, User Management, Lead Management, Pipeline, WhatsApp CRM, AI Lead Scoring
- **Critical Additions:** Mobile-first (PWA), Offline capability, Customer Health Score
- **Important:** Quotations, Tasks, Dashboard, Salesperson Performance, AI Assistant
- **Nice-to-have Phase 1:** SMS integration, Email sync, Territory management, Document storage
- **Phase 2:** Win/Loss analysis, Advanced Analytics, Performance targets, Referral tracking, Bulk operations
- **Phase 2+:** NPS/Feedback, Warranty management, AMC, Payment integration, Advanced compliance

## 22. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js + React + TypeScript | PWA for web; React Native/Flutter for mobile later |
| Offline Data | IndexedDB (web) + SQLite (mobile) | Enable offline-first operations |
| Backend | NestJS + Express | WebSocket for real-time notifications |
| Database | PostgreSQL | Multi-tenancy with tenant_id on all tables |
| Cache | Redis | Session management, real-time data |
| Queue | BullMQ | Async processing: emails, bulk operations, AI tasks |
| Storage | S3 / Digital Ocean Spaces | Documents, quotation PDFs, customer photos |
| Authentication | JWT + OTP + Google OAuth | Optional 2FA for admins |
| AI | OpenAI / Gemini / Local LLaMA | Provider abstraction for flexibility |
| SMS | Exotel / AWS SNS / Twilio | For SMS reminders, notifications |
| Email | SendGrid / AWS SES | Transactional emails, report delivery |
| Payments | Razorpay / Stripe | Payment links, invoice generation |
| Analytics | PostHog / Mixpanel | Product usage metrics, feature adoption |
| Monitoring | Sentry / DataDog | Error tracking, performance monitoring |

## 23. Pricing Strategy

| Plan | Price/Month | Users | Leads/Month | Features |
|---|---|---|---|---|
| Free Trial | ₹0 | 3 | 1,000 | 14-day trial, no credit card |
| Starter | ₹999 | 3 | 1,000 | Basic CRM, follow-ups, dashboard |
| Business | ₹2,499 | 10 | Unlimited | WhatsApp, AI, automation, quotations |
| Professional | ₹4,999 | 25 | Unlimited | Advanced AI, SFA, reports, teams |
| Enterprise | Custom | Unlimited | Unlimited | Everything + dedicated support, integrations |

Additional revenue: WhatsApp messaging (pass-through + margin), AI credits, implementation (₹10K–50K), integrations (₹15K–1L+), enterprise support.

## 24. MVP Development Roadmap

| Sprint | Duration | Focus |
|---|---|---|
| 1 | Weeks 1–2 | Architecture, Auth, Multi-tenancy, Organization setup |
| 2 | Weeks 3–4 | Lead Management, Contacts, Companies, Basic Pipeline |
| 3 | Weeks 5–6 | Tasks, Follow-ups, Dashboard, Salesperson Performance |
| 4 | Weeks 7–9 | WhatsApp integration, Inbox, Send/receive messages, Templates |
| 5 | Weeks 10–11 | Quotations, Products, PDF generation, WhatsApp sharing |
| 6 | Weeks 12–14 | AI Lead Scoring, Summary, Follow-up assistant, Reply suggestions |
| 7 | Weeks 15–16 | Field SFA, Visits, GPS check-in, Offline capability |
| 8 | Weeks 17–20 | Mobile optimization, Security hardening, Monitoring, Production prep |

## 25. MVP Success Metrics (90 Days)

**Product:** 10 paying companies, 100+ active users, 10,000+ leads managed, 50,000+ WhatsApp messages processed, 500+ quotations generated, 18%+ lead-to-customer conversion.

**Business:** MRR ₹25,000 (10 customers × ₹2,500 avg), 80%+ retention, NPS 35+, avg order value ₹50K+ per customer.

**90-Day Goal:** 10 paying MSME customers using AI SalesOS as their primary sales operating system. "This is not perfection; this is traction."

## 26. Competitive Positioning

| Competitor | Strength | Your Opportunity |
|---|---|---|
| Salesforce | Enterprise features | Too complex for small business |
| Zoho CRM | Broad suite | Vertical specialization for India |
| Freshsales | Strong CRM | Deeper field workflow focus |
| HubSpot | Global platform | India-specific workflows, affordability |
| Justdial/IndiaMART | Lead aggregators | Sales operating system, AI, follow-up |
| WhatsApp Business | Great messaging | Complete sales system, not just messaging |

**Differentiation:** WhatsApp-first + AI-first + field-sales-first + India-first + affordable.

## 27. Core Product Principles

- **Turn WhatsApp into a CRM:** Every conversation = a lead, customer, deal. Automatic linkage.
- **AI is the salesperson's assistant:** Not replacing; augmenting. Suggestions, not decisions.
- **Mobile-first, not mobile-second:** India = mobile economy. Full feature parity on mobile.
- **Offline-first where possible:** Connectivity isn't guaranteed. Local-first, sync later.
- **Every feature must pass the test:** Does this help close more business or understand sales better? If no, cut it.
- **India-specific, not generic:** GST, WhatsApp, field sales, affordability. Built for Indian MSMEs.
- **Simplicity > Completeness:** One great problem solved > ten problems half-solved.

## 28. The Path Forward

- **Phase 0 (Weeks 1–20):** Build → MVP. Get to 10 paying customers. Do not attempt to build a Salesforce competitor.
- **Phase 1 (Months 6–12):** Sell → Product/Market Fit. Grow 10 → 50 customers. Measure NPS. Aim for 80%+ retention.
- **Phase 2 (Year 2):** Scale → 200+ Customers. Win/loss analysis, advanced analytics, native apps, more integrations (Tally, Justdial, IndiaMART).
- **Phase 3 (Year 3+):** Expand → AI MSME OS. Extend into ERP, inventory, accounting, payments.

**One Number Wins: 10 paying customers in 90 days.** Build it. Ship it. Sell it. Learn. Repeat.

---
Document: AI SalesOS Product Requirements Document (PRD) v2.0
Date: August 19, 2026
Status: Ready for Development | Audience: Product, Engineering, Go-to-Market
