# Architecture Overview

> Acestone Development LLC — Professional Contractor Management System

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Home Page    │  │  Admin Page  │  │  Not Found (404)      │ │
│  │  (Quote Form) │  │  (Dashboard) │  │                       │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘ │
│         │                 │                                     │
│  ┌──────┴─────────────────┴──────────────────────────────────┐  │
│  │  TanStack Query  ─  API Request Layer (fetch)             │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │  HTTP (JSON)
┌──────────────────────────────┼──────────────────────────────────┐
│                        SERVER (Node.js)                         │
│  Express + TypeScript                                           │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Routes: /api/leads, /api/auth, /api/webhooks/*,           │ │
│  │          /api/test/*, /api/leads/stats                     │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────┴───────────────────────────────────┐ │
│  │  Storage Abstraction Layer (IStorage interface)             │ │
│  │  ┌─────────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │  MemStorage     │  │  AWSStorage                      │ │ │
│  │  │  (in-memory)    │  │  (DynamoDB + S3 + SES)           │ │ │
│  │  └─────────────────┘  └──────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                    AWS Cloud Services                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ DynamoDB  │  │   SES    │  │    S3    │  │   Amplify     │  │
│  │ (Data)    │  │ (Email)  │  │ (Photos) │  │  (Hosting)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Directory Structure

```
AcestoneBuilds/
├── client/                     # Frontend application
│   ├── .env                    # Client-side environment variables
│   ├── index.html              # HTML entry point
│   └── src/
│       ├── App.tsx             # Root component (routing, layout)
│       ├── main.tsx            # React DOM mount
│       ├── index.css           # Global styles (Tailwind)
│       ├── assets/             # Static images (ace.jpg, house.jpeg, ladder.jpeg)
│       ├── components/
│       │   ├── customer-form.tsx    # Quote intake form
│       │   ├── admin-dashboard.tsx  # Admin lead management UI
│       │   ├── quote-display.tsx    # Live quote preview card
│       │   └── ui/                  # shadcn/ui primitives (~47 components)
│       ├── hooks/
│       │   ├── use-mobile.tsx       # Responsive breakpoint hook
│       │   └── use-toast.ts         # Toast notification hook
│       ├── lib/
│       │   ├── pricing.ts          # Quote calculation logic & constants
│       │   ├── queryClient.ts      # TanStack Query config & apiRequest helper
│       │   └── utils.ts            # Tailwind cn() merge helper
│       └── pages/
│           ├── home.tsx            # Public quote page
│           ├── admin.tsx           # Admin login + dashboard gate
│           └── not-found.tsx       # 404 page
│
├── server/                     # Backend application
│   ├── index.ts                # Express app bootstrap & middleware
│   ├── routes.ts               # All API route handlers (active)
│   ├── routes-old.ts           # Legacy routes (deprecated reference)
│   ├── storage.ts              # IStorage interface + MemStorage + getStorage()
│   ├── aws-storage.ts          # AWSStorage class (DynamoDB, S3, SES clients)
│   └── vite.ts                 # Dev server (Vite middleware) & production static serve
│
├── shared/                     # Shared between client & server
│   └── schema.ts               # Drizzle ORM table defs + Zod validation schemas
│
├── amplify/                    # AWS Amplify Gen 2 configuration
│   ├── backend.ts              # Amplify backend definition (auth + data)
│   ├── auth/resource.ts        # Cognito auth config (email login)
│   ├── data/resource.ts        # Amplify data model (Todo placeholder)
│   ├── cli.json                # Amplify CLI settings
│   └── team-provider-info.json # Environment/team config
│
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript compiler options
├── vite.config.ts              # Vite build config + path aliases
├── drizzle.config.ts           # Drizzle Kit config (PostgreSQL migrations)
├── tailwind.config.ts          # Tailwind theme customization
├── postcss.config.js           # PostCSS plugins
├── components.json             # shadcn/ui component config
├── AWS_SETUP_GUIDE.md          # AWS service setup documentation
├── INTEGRATION_GUIDE.md        # Angi/HomeAdvisor webhook guide
└── README.md                   # Project readme
```

## Monorepo Layout

The project is a **monorepo** with three logical modules sharing a single `package.json`:

| Module   | Path       | Purpose                                 |
|----------|------------|-----------------------------------------|
| Client   | `client/`  | React SPA served by Vite                |
| Server   | `server/`  | Express API serving JSON + static files |
| Shared   | `shared/`  | Zod schemas & TypeScript types          |

TypeScript path aliases bridge them:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

## Request Lifecycle

1. **Browser** sends HTTP request to Express server
2. **Express middleware** logs API requests with timing
3. **Route handler** validates input with Zod schemas from `shared/schema.ts`
4. **Storage layer** (`getStorage()`) auto-selects MemStorage or AWSStorage based on env vars
5. **Response** returns JSON to client
6. **TanStack Query** caches response; UI updates reactively

## Development vs Production

| Aspect        | Development                         | Production                              |
|---------------|-------------------------------------|-----------------------------------------|
| Frontend      | Vite HMR middleware on Express      | Pre-built static files from `dist/public` |
| Storage       | In-memory `MemStorage`              | AWS `AWSStorage` (DynamoDB)             |
| Email         | Not sent                            | AWS SES automated emails                |
| Photos        | Not stored                          | AWS S3 bucket                           |
| Port          | `PORT` env or `5000`                | `PORT` env or `5000`                    |
| Server        | `tsx server/index.ts` (live reload) | `node dist/server/index.js`             |

## Build Pipeline

```bash
# Development
npm run dev          # Runs server + client concurrently
npm run dev:server   # tsx server/index.ts
npm run dev:client   # vite

# Production Build
npm run build        # build:client (vite build) + build:server (esbuild bundle)
npm start            # node dist/server/index.js
```

## Key Design Decisions

1. **Storage abstraction** — `IStorage` interface allows swapping between in-memory and AWS without changing route logic
2. **Shared schema** — Single source of truth for data types used by both client and server via `@shared/schema`
3. **Server-side rendering proxy** — In dev, Express serves Vite's HMR middleware; in prod, serves static build output
4. **Unified port** — Both API and client are served from the same port (no CORS needed for same-origin)
5. **Webhook-first integrations** — External platforms (Angi, HomeAdvisor) push data via POST webhooks that auto-calculate quotes
