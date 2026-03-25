# AI Agent Training Guide — Acestone Development

> **Purpose:** Get any AI agent productive on this codebase in minutes. Read this first, then dive into the blueprints for details.

---

## What Is This Project?

**Acestone Development LLC** is a home improvement contractor business. This application is their **lead management and CRM system** — it handles everything from a customer requesting a quote online to tracking the job through completion.

There are two user-facing surfaces:

1. **Public Quote Form** (`/`) — Customers fill out project details, upload photos, and get an instant price estimate.
2. **Admin Dashboard** (`/admin`) — The business owner manages leads, tracks pipeline stages, and monitors revenue.

Leads also flow in from **Angi** and **HomeAdvisor** via webhook integrations, and an **n8n** automation platform handles workflow triggers (emails, CRM stage changes, etc.).

---

## Tech Stack At a Glance

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite | Single-page app |
| **UI** | Tailwind CSS + shadcn/ui (Radix) | 47+ pre-built components in `client/src/components/ui/` |
| **Routing** | wouter | Lightweight, 3 routes total |
| **State** | TanStack Query + React Hook Form | Server state cached, forms validated with Zod |
| **Backend** | Express.js + TypeScript | Serves both API and static files on one port |
| **Database** | DynamoDB (prod) / In-memory (dev) | Swappable via `IStorage` interface |
| **File Storage** | AWS S3 | Customer photo uploads |
| **Email** | AWS SES | Quote confirmations + admin notifications |
| **Automation** | n8n (external) | Webhook-driven workflow orchestration |
| **IaC** | Terraform | DynamoDB tables, S3 bucket, SES identities, IAM |
| **Hosting** | AWS Amplify / Replit | CI/CD from GitHub |

---

## Project Structure — The Mental Model

```
AcestoneBuilds/
├── client/src/          # React frontend (what the browser runs)
│   ├── components/      # customer-form, admin-dashboard, crm-pipeline, crm-lead-detail, quote-display
│   ├── pages/           # home.tsx, admin.tsx, not-found.tsx
│   ├── lib/             # pricing.ts (quote engine), queryClient.ts, utils.ts
│   └── hooks/           # use-toast.ts, use-mobile.tsx
│
├── server/              # Express backend (what Node.js runs)
│   ├── index.ts         # Entry point — middleware, dotenv, port binding
│   ├── routes.ts        # ALL API endpoints (~700 lines — the core of the backend)
│   ├── storage.ts       # IStorage interface + MemStorage + getStorage() selector
│   ├── aws-storage.ts   # AWSStorage class (DynamoDB, S3, SES clients)
│   └── vite.ts          # Dev: Vite HMR middleware / Prod: static file serving
│
├── shared/
│   └── schema.ts        # THE source of truth — Drizzle tables, Zod schemas, TS types, CRM stage definitions
│
├── terraform/           # AWS infrastructure definitions
├── amplify/             # AWS Amplify Gen 2 config (partially used)
└── docs/blueprints/     # 9 detailed architecture documents + troubleshooting guides
```

**Key principle:** The `shared/schema.ts` file is imported by BOTH client and server. If you change a data model, you change it there. Everything else derives from it.

---

## The Three Most Important Files

1. **`shared/schema.ts`** — All data types, validation rules, CRM stage definitions, and database table shapes. Start here to understand what data flows through the system.

2. **`server/routes.ts`** — Every API endpoint, webhook handler, email sender, and n8n integration. This is the backend logic hub.

3. **`client/src/components/customer-form.tsx`** — The public-facing quote form. Handles file uploads, live pricing, phone formatting, and form submission.

---

## How Data Flows Through the System

### Customer Submits a Quote

```
Browser (customer-form.tsx)
  │
  ├─ Photos? ──→ POST /api/upload ──→ S3 bucket ──→ returns URL
  │
  └─ Form data ──→ POST /api/leads
                      │
                      ├─ Zod validates against insertLeadSchema
                      ├─ getStorage() picks MemStorage or AWSStorage
                      ├─ storage.createLead() ──→ DynamoDB (or memory)
                      ├─ sendLeadEmails()
                      │     ├─ SES → customer gets quote confirmation
                      │     └─ SES → admin gets lead notification
                      ├─ fireN8nWebhook() ──→ n8n automation
                      └─ Returns Lead object to browser
```

### Angi/HomeAdvisor Webhook

```
External Platform
  │
  └─ POST /api/webhooks/angi  (or /homeadvisor)
        │
        ├─ Map external category → internal jobType (e.g., "kitchen-remodeling" → "kitchen")
        ├─ Parse squareFootage (default 500 if missing)
        ├─ Calculate quote server-side using pricing.ts
        ├─ storage.createLead() with source="angi"
        └─ Return { success: true, leadId }
```

### Admin Updates a Lead (CRM Pipeline)

```
Admin Dashboard (crm-pipeline.tsx)
  │
  └─ PATCH /api/leads/:id/crm
        │
        ├─ Updates crmData JSON blob on the lead
        ├─ Adds timeline event (who, what, when)
        ├─ fireN8nWebhook() → triggers automation (e.g., send contract email)
        └─ Returns updated Lead
```

---

## The Storage Abstraction — Critical to Understand

The app has a **pluggable storage layer**. The `getStorage()` function in `server/storage.ts` decides at runtime:

```
AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY present?
  ├─ YES → AWSStorage (DynamoDB + S3 + SES) — production
  └─ NO  → MemStorage (in-memory Maps) — development, data lost on restart
```

Both implement the `IStorage` interface. When writing new features, always code against `IStorage`, never directly against DynamoDB or Map.

---

## CRM Pipeline — The Business Workflow

Leads move through 11 stages, defined in `shared/schema.ts`:

```
new_lead → calendly_sent → meeting_booked → meeting_completed →
estimate_sent → contract_sent → contract_signed →
job_in_progress → job_completed → pending_survey → closed
```

Each stage has:
- A **label** (human-readable name)
- A **color** (Tailwind classes for badges)
- **Associated data** (e.g., `meetingDate`, `contractAmount`, `assignedWorker`)

The CRM data is stored as a **JSONB blob** (`crmData`) on the lead record — not as separate columns. The `CrmData` interface in `shared/schema.ts` defines its shape. It includes a `timeline` array of `CrmTimelineEvent` objects that form an audit trail.

---

## Pricing Engine

Located in `client/src/lib/pricing.ts`. Also imported by the server for webhook quote calculations.

```
Quote = PRICING_RATES[jobType] × squareFootage × (1 + rushMarkup)
```

| Job Type | Rate/sqft | Rush (+15%) |
|----------|-----------|-------------|
| Kitchen | $200.00 | $230.00 |
| Bathroom | $150.00 | $172.50 |
| Painting | $2.50 | $2.875 |
| Flooring | $5.00 | $5.75 |
| Roofing | $9.00 | $10.35 |

---

## API Endpoints — Quick Reference

| Method | Path | Purpose | Auth? |
|--------|------|---------|-------|
| `POST` | `/api/leads` | Create new lead from website form | No |
| `GET` | `/api/leads` | List all leads | No* |
| `GET` | `/api/leads/stats` | Dashboard statistics | No* |
| `GET` | `/api/leads/:id` | Single lead details | No* |
| `PATCH` | `/api/leads/:id/status` | Update lead status | No* |
| `PATCH` | `/api/leads/:id/crm` | Update CRM pipeline data | No* |
| `POST` | `/api/upload` | Upload photo to S3 | No* |
| `GET` | `/api/photos/leads/:key` | Get presigned S3 URL | No* |
| `POST` | `/api/auth/login` | Admin login | N/A |
| `POST` | `/api/webhooks/angi` | Angi lead ingestion | No* |
| `POST` | `/api/webhooks/homeadvisor` | HomeAdvisor lead ingestion | No* |
| `POST` | `/api/n8n/callback` | n8n workflow callback | No* |
| `POST` | `/api/test/angi-lead` | Create test Angi lead | No* |
| `POST` | `/api/test/homeadvisor-lead` | Create test HA lead | No* |

> *\* = No server-side auth enforcement. Auth state is client-side only via React useState. This is a known security gap (see Security section).*

---

## Environment Variables

### Required for AWS (production)

| Variable | Example | Purpose |
|----------|---------|---------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` | IAM credentials |
| `AWS_REGION` | `us-east-1` | AWS region |
| `SES_FROM_EMAIL` | `admin@acestonellc.com` | Must match verified SES identity |
| `ADMIN_EMAIL` | `admin@acestonellc.com` | Receives lead notifications |

### Optional overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `DYNAMODB_LEADS_TABLE` | `leads` | DynamoDB leads table |
| `DYNAMODB_USERS_TABLE` | `users` | DynamoDB users table |
| `S3_BUCKET_NAME` | `acestone-default-bucket` | S3 upload bucket |
| `N8N_WEBHOOK_URL` | *(none)* | n8n automation endpoint |
| `N8N_WEBHOOK_SECRET` | *(none)* | n8n auth secret |
| `PORT` | `5000` | Server port |

### Critical gotcha

`dotenv` must be imported as the **first line** of `server/index.ts`. Without it, `.env` variables don't load, the app silently falls back to MemStorage, and you'll lose data on restart with no error.

---

## Running Locally

```bash
# No AWS needed — uses in-memory storage
npm install
npm run dev
# → http://localhost:5000       (quote form)
# → http://localhost:5000/admin (password: admin123)

# With AWS — uses DynamoDB, S3, SES
# Set env vars in .env first
npm run dev

# Production build
npm run build && npm start
```

---

## Known Security Issues (Do Not Ignore)

These are documented in `docs/blueprints/03-SECURITY-CONCERNS.md` with full remediation steps:

| Priority | Issue |
|----------|-------|
| **P0** | Passwords stored and compared as plaintext |
| **P0** | No server-side auth on API routes — all lead data is publicly accessible |
| **P0** | Webhook endpoints accept requests from any source (no signature verification) |
| **P1** | No rate limiting on any endpoint |
| **P1** | Hardcoded admin credentials (`admin` / `admin123`) in source code |
| **P1** | No CSRF protection |
| **P2** | Missing security headers (no helmet) |
| **P2** | Test endpoints active in production |

**If you are tasked with security work**, the dependencies `passport`, `passport-local`, and `express-session` are already installed but not wired up. `bcrypt` is not yet installed.

---

## Patterns to Follow When Writing Code

### Adding a new API endpoint

1. Add the route in `server/routes.ts`
2. If it needs new data, update the schema in `shared/schema.ts` first
3. Add the method to `IStorage` interface in `server/storage.ts`
4. Implement in both `MemStorage` and `AWSStorage`
5. Use `getStorage()` in the route handler — never instantiate storage directly

### Adding a new frontend page

1. Create the page component in `client/src/pages/`
2. Add the route in `client/src/App.tsx` using wouter's `<Route>`
3. Use `useQuery` with the URL as the query key for data fetching
4. Use shadcn/ui components from `client/src/components/ui/`

### Adding a new lead source (e.g., Thumbtack)

1. Add a mapping function `mapThumbstackJobType()` in `server/routes.ts`
2. Add webhook endpoint `POST /api/webhooks/thumbtack`
3. Update the source enum in `shared/schema.ts` Zod schema
4. Add badge color in the admin dashboard component

### Modifying the CRM pipeline

1. CRM stages are defined in `shared/schema.ts` → `CRM_STAGES`
2. Stage labels and colors are in `CRM_STAGE_LABELS` and `CRM_STAGE_COLORS`
3. Stage-specific data fields are in the `CrmData` interface
4. The pipeline UI is in `client/src/components/crm-pipeline.tsx`
5. Lead detail/edit view is in `client/src/components/crm-lead-detail.tsx`

---

## Gotchas and Lessons Learned

These are real issues that were debugged and documented:

### 1. DynamoDB writes silently failing

**Symptom:** API returns 200, leads show in dashboard, but DynamoDB table is empty.
**Cause:** `.env` not loaded → `getStorage()` returns MemStorage.
**Fix:** Ensure `import "dotenv/config"` is the first import in `server/index.ts`.
**Full doc:** `docs/blueprints/dynamodb-troubleshooting.md`

### 2. SES emails not sending

**Symptom:** `Email address is not verified` errors in logs.
**Cause:** `SES_FROM_EMAIL` in `.env` didn't match the verified SES identity, OR module-level constant cached a stale `undefined` value.
**Fix:** Read `process.env.SES_FROM_EMAIL` inside the send function, not at module level. Ensure the value matches the verified identity exactly.
**Full doc:** `docs/blueprints/ses-email-setup.md`

### 3. Form state lost on validation error

**Symptom:** Select dropdowns reset when form validation fails.
**Cause:** Using `defaultValue` instead of `value` on controlled Select components.
**Fix:** Changed to `value={field.value}` for React Hook Form integration.
**Full doc:** `docs/blueprints/form-improvements.md`

### 4. Server imports client code

The server dynamically imports `client/src/lib/pricing.ts` for webhook quote calculations. This couples the server build to the client module. Be aware of this cross-boundary import.

### 5. Drizzle config is a remnant

`drizzle.config.ts` is configured for PostgreSQL, but the runtime uses either in-memory Maps or DynamoDB. The Drizzle table definitions in `shared/schema.ts` are used for **type generation and Zod schema derivation only**, not for actual PostgreSQL queries.

---

## Terraform Infrastructure

Located in `terraform/`. Provisions:

- **DynamoDB tables:** `acestone-leads` (GSI on status/createdAt), `acestone-users` — pay-per-request
- **S3 bucket:** `acestone-uploads` — versioned, AES256 encrypted, lifecycle to STANDARD_IA after 90 days
- **SES identities:** sender and admin email verification
- **IAM role:** `acestone-app-role` with scoped DynamoDB + S3 + SES permissions

Run with: `cd terraform && terraform init && terraform apply`

---

## n8n Integration

The app fires webhooks to an external n8n instance on key events:

- **Lead created** — new quote submission
- **Status changed** — lead status updates
- **CRM stage changed** — pipeline progression

The n8n webhook URL and secret are configured via `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` env vars. n8n can call back to `POST /api/n8n/callback` to update lead data.

---

## Blueprint Documents Reference

For deep-dives, the `docs/blueprints/` directory has authoritative documentation:

| Document | When to Read It |
|----------|----------------|
| `01-ARCHITECTURE-OVERVIEW.md` | Understanding the full system design |
| `02-BACKEND-CONNECTION.md` | Debugging connectivity, env vars, storage selection |
| `03-SECURITY-CONCERNS.md` | Before any security-related work |
| `04-API-REFERENCE.md` | Building new endpoints or frontend API calls |
| `05-DATABASE-SCHEMA.md` | Modifying data models or storage layer |
| `06-FRONTEND-ARCHITECTURE.md` | Building new UI components or pages |
| `07-AWS-INFRASTRUCTURE.md` | AWS service config, IAM policies, cost estimates |
| `08-INTEGRATIONS.md` | Adding new lead sources or webhook integrations |
| `09-DEPLOYMENT.md` | Build pipeline, deployment targets, pre-deploy checklist |
| `dynamodb-troubleshooting.md` | DynamoDB writes not working |
| `ses-email-setup.md` | Email delivery issues |
| `form-improvements.md` | Form UX and S3 upload implementation |

---

## Git Info

- **Repository:** `https://github.com/Aaronandrew/AcestoneBuilds.git`
- **Main branch:** `main`
- **Current release branch:** `release-2.0.0`
- **Estimated AWS cost:** $3–50/month depending on usage

---

*Last updated: 2026-03-20*
