# Acestone Development — Project Blueprints

> Comprehensive technical documentation for the Acestone Development LLC Professional Contractor Management System.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Architecture Overview](./01-ARCHITECTURE-OVERVIEW.md) | High-level system design, directory structure, monorepo layout, request lifecycle, and key design decisions |
| 02 | [Backend Connection](./02-BACKEND-CONNECTION.md) | Environment variables, storage layer selection, frontend API client, webhook connections, auth flow, and network topology |
| 03 | [Security Concerns](./03-SECURITY-CONCERNS.md) | Full security audit with prioritized issues: plaintext passwords, missing auth middleware, unauthenticated webhooks, CSRF, rate limiting, and more |
| 04 | [API Reference](./04-API-REFERENCE.md) | Complete HTTP endpoint documentation with request/response formats, status codes, and quote calculation details |
| 05 | [Database Schema](./05-DATABASE-SCHEMA.md) | Drizzle ORM table definitions, Zod validation schemas, TypeScript types, IStorage interface, and storage implementations |
| 06 | [Frontend Architecture](./06-FRONTEND-ARCHITECTURE.md) | React component hierarchy, routing, state management, form handling, pricing engine, UI library, and styling patterns |
| 07 | [AWS Infrastructure](./07-AWS-INFRASTRUCTURE.md) | DynamoDB, SES, S3, and Amplify configuration, IAM policies, SDK setup, credential management, and cost estimates |
| 08 | [Integrations](./08-INTEGRATIONS.md) | Angi and HomeAdvisor webhook integration, data transformation pipelines, category mappings, test endpoints, and adding new platforms |
| 09 | [Deployment](./09-DEPLOYMENT.md) | Build pipeline, environment configs, Amplify/Replit deployment, server configuration, monitoring, and pre-deployment checklist |

## Quick Reference

- **Tech Stack:** React 18 + TypeScript + Vite + Express + Tailwind CSS + shadcn/ui + AWS (DynamoDB, SES, S3, Amplify)
- **Dev Start:** `npm install && npm run dev` → http://localhost:5000
- **Admin Access:** `/admin` with password `admin123`
- **Branch:** `release-1.0.0`
- **Repository:** https://github.com/Aaronandrew/AcestoneBuilds.git
