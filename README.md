# AI SalesOS

AI-powered Sales CRM + WhatsApp Business + Sales Force Automation for Indian MSMEs, SMEs,
distributors, manufacturers, wholesalers, dealers and field-sales organizations.

> "Turn WhatsApp conversations into organized sales."

Built per the [AI SalesOS PRD v2.0](docs/PRD.md) (Aug 19, 2026). Competes on **Simplicity +
WhatsApp + AI + Indian sales workflows + affordability** — not enterprise functionality.

## Monorepo layout

```
ai-salesos/
├── apps/
│   ├── web/            Next.js + TypeScript + Tailwind (PWA, mobile-first, offline-first)
│   └── api/             NestJS + TypeScript (multi-tenant REST API + WebSocket)
├── packages/
│   └── shared/           Shared TypeScript types/enums/DTOs used by web + api
├── docs/                 PRD and supporting docs
└── docker-compose.yml    Local Postgres + Redis
```

## Tech stack (per PRD §22)

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Frontend       | Next.js + React + TypeScript (PWA)  |
| Offline data   | IndexedDB (web) — SQLite planned for React Native/Flutter mobile |
| Backend        | NestJS + Express, WebSocket for real-time |
| Database       | PostgreSQL, multi-tenant via `organization_id` on all tables |
| Cache          | Redis |
| Queue          | BullMQ (async: emails, bulk ops, AI tasks) |
| Storage        | S3 / DigitalOcean Spaces |
| Auth           | JWT + OTP + Google OAuth, optional 2FA for admins |
| AI             | Provider-abstracted (OpenAI / Gemini / local LLaMA) |
| SMS            | Exotel / AWS SNS / Twilio |
| Email          | SendGrid / AWS SES |
| Payments       | Razorpay / Stripe |

## Getting started

### Prerequisites
- Node.js 20+
- Docker Desktop (for Postgres + Redis)

### 1. Start infrastructure
```bash
docker compose up -d
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Copy the example env files and fill in secrets:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Run database migrations
```bash
npm run prisma:migrate -w apps/api
```

### 5. Start dev servers
```bash
npm run dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

## Roadmap (PRD §24 — 20-week MVP)

| Sprint | Weeks | Focus |
|--------|-------|-------|
| 1 | 1–2   | Architecture, Auth, Multi-tenancy, Organization setup, User management ✅ |
| 2 | 3–4   | Lead Management, Contacts, Companies, Basic Pipeline ✅ |
| 3 | 5–6   | Tasks, Follow-ups, Dashboard, Salesperson Performance ✅ |
| 4 | 7–9   | WhatsApp integration, Inbox, Send/receive messages, Templates ✅ *(stub provider — see below)* |
| 5 | 10–11 | Quotations, Products, PDF generation, WhatsApp sharing |
| 6 | 12–14 | AI Lead Scoring, Summary, Follow-up assistant, Reply suggestions |
| 7 | 15–16 | Field SFA, Visits, GPS check-in, Offline capability |
| 8 | 17–20 | Mobile optimization, Security hardening, Monitoring, Production prep |

**90-day goal:** 10 paying MSME customers using AI SalesOS as their primary sales operating system.

## Connecting a real WhatsApp Business number

By default the API sends WhatsApp messages through a **stub provider** that just logs the message —
this is what powers the Inbox in local dev without any account setup, and includes a "Simulate reply"
button in the UI for testing two-way conversations. To go live with real WhatsApp:

1. Set up a [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) app and
   get its `phone_number_id` and a permanent access token.
2. In `apps/api/.env`, set `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN=<token>`, and
   `WHATSAPP_VERIFY_TOKEN=<any string you choose>`.
3. Point the app's webhook URL at `https://<your-domain>/api/whatsapp/webhook`, using the same
   verify token from step 2 during Meta's verification handshake.
4. In-app, as an Owner/Admin: `PATCH /api/organizations/me` with `{ "whatsappPhoneNumberId": "<id>" }`
   (a settings UI for this is a follow-up) — this is how the webhook routes inbound messages to the
   right organization when multiple orgs are connected.

## Core product principles (PRD §27)

- Turn WhatsApp into a CRM — every conversation is a lead/customer/deal, automatically linked.
- AI is the salesperson's assistant — suggestions, not decisions.
- Mobile-first, not mobile-second.
- Offline-first where possible — local-first, sync later.
- India-specific, not generic (GST, WhatsApp, field sales, affordability).
- Simplicity > completeness.
