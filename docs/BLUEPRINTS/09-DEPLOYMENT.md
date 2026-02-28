# Deployment Guide

> How to build, deploy, and operate the Acestone Development system across different environments.

## Build Pipeline

### Scripts (`package.json`)

| Script            | Command                                                    | Purpose                          |
|-------------------|------------------------------------------------------------|----------------------------------|
| `dev`             | `concurrently "npm run dev:server" "npm run dev:client"`   | Run both in parallel             |
| `dev:client`      | `vite`                                                     | Vite dev server with HMR         |
| `dev:server`      | `tsx server/index.ts`                                      | Express server with live reload  |
| `build:client`    | `vite build`                                               | Output to `dist/public/`         |
| `build:server`    | `esbuild server/index.ts --platform=node --bundle --format=esm --outfile=dist/server/index.js` | Bundle server to single file |
| `build`           | `npm run build:client && npm run build:server`             | Full production build            |
| `start`           | `node dist/server/index.js`                                | Run production server            |

### Build Output

```
dist/
├── public/          # Vite-built client assets (HTML, JS, CSS, images)
│   ├── index.html
│   └── assets/
└── server/
    └── index.js     # esbuild-bundled server (single ESM file)
```

---

## Environment Configurations

### Local Development (No AWS)

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Access
# http://localhost:5000       → Quote form
# http://localhost:5000/admin → Admin (password: admin123)
```

- Uses `MemStorage` (in-memory, data lost on restart)
- No AWS services needed
- Vite HMR for instant frontend updates
- Express auto-reloads via `tsx`

### Local Development (With AWS)

```bash
# 1. Set AWS credentials
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="wJal..."
export AWS_REGION="us-east-1"
export SES_FROM_EMAIL="verified@email.com"

# 2. Optional: customize resource names
export DYNAMODB_LEADS_TABLE="acestone-leads"
export DYNAMODB_USERS_TABLE="acestone-users"
export S3_BUCKET_NAME="acestone-uploads"

# 3. Start
npm run dev
```

- Uses `AWSStorage` (DynamoDB, S3, SES)
- Tables and buckets auto-created on first run
- Emails sent via SES (verify sender first)

### Production Build

```bash
# Build both client and server
npm run build

# Start production server
npm start
# or
PORT=3000 node dist/server/index.js
```

- Client served as static files from `dist/public/`
- Server is a single bundled ESM file
- No Vite middleware in production

---

## AWS Amplify Deployment

### Prerequisites

1. AWS account with Amplify access
2. GitHub repository connected
3. AWS credentials configured

### Amplify Setup

The project includes Amplify Gen 2 configuration in `amplify/`:

```typescript
// amplify/backend.ts
defineBackend({ auth, data });
```

### Amplify Console Deployment

1. Go to **AWS Amplify Console**
2. Click **New App → Host web app**
3. Connect your GitHub repository
4. Select branch: `release-1.0.0`
5. Amplify auto-detects build settings from the framework

### Build Settings (amplify.yml)

If Amplify doesn't auto-detect, configure:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist/public
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### Environment Variables in Amplify

Set these in **Amplify Console → App Settings → Environment Variables**:

| Variable                  | Required | Description                    |
|---------------------------|----------|--------------------------------|
| `AWS_REGION`              | Yes      | e.g., `us-east-1`             |
| `SES_FROM_EMAIL`          | Yes      | Verified SES sender email      |
| `DYNAMODB_LEADS_TABLE`    | No       | Override table name             |
| `DYNAMODB_USERS_TABLE`    | No       | Override table name             |
| `S3_BUCKET_NAME`          | No       | Override bucket name            |
| `PORT`                    | No       | Server port (default: 5000)    |

> **Note:** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are **not needed** in Amplify — the Amplify execution role provides credentials via IAM.

---

## Replit Deployment

The project was originally built on Replit and includes Replit-specific files:

| File         | Purpose                              |
|--------------|--------------------------------------|
| `.replit`    | Replit run/build configuration       |
| `replit.md`  | Replit project documentation         |

### Replit Secrets

Set via Replit's Secrets panel:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `SES_FROM_EMAIL`

---

## Server Configuration

### Port Binding

```typescript
// server/index.ts:63-70
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({ port, host: "0.0.0.0", reusePort: true });
```

- Binds to `0.0.0.0` (all interfaces)
- Default port: `5000`
- Override via `PORT` environment variable

### Dev vs Production Mode

```typescript
// server/index.ts:53-57
if (app.get("env") === "development") {
  await setupVite(app, server);  // Vite HMR middleware
} else {
  serveStatic(app);              // Static file serving from dist/public
}
```

Set `NODE_ENV=production` for production builds.

### Static File Serving (Production)

```typescript
// server/vite.ts:70-85
serveStatic(app) {
  // Serves from dist/server/../public (relative to bundled server)
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html")); // SPA fallback
  });
}
```

---

## Health Checks

Currently, there is **no dedicated health check endpoint**. For production deployments behind a load balancer, consider adding:

```typescript
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

---

## Monitoring

### Application Logs

The Express middleware logs all `/api/*` requests:

```
10:30:15 AM [express] POST /api/leads 200 in 45ms :: {"id":"uuid"...}
```

- Timestamp + method + path + status + duration
- Response body (truncated to 80 chars)

### AWS CloudWatch

When using AWS services:
- **DynamoDB:** Table metrics (read/write capacity, throttles)
- **SES:** Delivery rates, bounces, complaints
- **S3:** Storage metrics, request counts
- **Amplify:** Build logs, deployment status

---

## Pre-Deployment Checklist

- [ ] Change default admin password (`admin123`)
- [ ] Verify SES sender email is verified
- [ ] Set all required environment variables
- [ ] Run `npm run build` successfully
- [ ] Test all API endpoints
- [ ] Disable test endpoints in production (or gate behind auth)
- [ ] Configure HTTPS/TLS termination
- [ ] Set up monitoring and alerts
- [ ] Review security concerns in `03-SECURITY-CONCERNS.md`
- [ ] Test webhook endpoints with sample payloads
- [ ] Verify DynamoDB tables are created correctly
- [ ] Test email delivery in production

---

## Rollback Strategy

### Amplify
- Amplify maintains previous deployments — rollback via Console
- Each git commit triggers a new build; revert the commit to rollback

### Manual Deployment
- Keep previous `dist/` build artifacts
- Swap symlink or restart with previous build
- Database rollback: DynamoDB point-in-time recovery (if enabled)

---

## Scaling Considerations

| Component   | Scaling Approach                                |
|-------------|-------------------------------------------------|
| Express     | Horizontal scaling behind ALB / ECS             |
| DynamoDB    | Auto-scales with on-demand billing              |
| SES         | Regional sending limits (request production)    |
| S3          | Unlimited storage, auto-scales                  |
| Amplify     | Managed scaling via CloudFront CDN              |
