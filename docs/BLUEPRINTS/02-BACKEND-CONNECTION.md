# Backend Connection Guide

> Everything required to connect the frontend, external services, and local development to the Acestone backend.

## Server Entry Point

The backend starts in `server/index.ts`:

```typescript
// Express app on PORT env var (default 5000), bound to 0.0.0.0
const port = parseInt(process.env.PORT || '5000', 10);
```

Both the API and frontend are served from the **same origin and port** — no CORS configuration is needed for the client-to-server connection.

## Environment Variables

### Required for AWS (Production)

| Variable                  | Description                          | Example                        |
|---------------------------|--------------------------------------|--------------------------------|
| `AWS_ACCESS_KEY_ID`       | IAM user access key                  | `AKIA...`                      |
| `AWS_SECRET_ACCESS_KEY`   | IAM user secret key                  | `wJal...`                      |
| `AWS_REGION`              | AWS region                           | `us-east-1`                    |
| `SES_FROM_EMAIL`          | Verified SES sender email            | `admin@acestonedev.com`        |
| `PORT`                    | Server port                          | `5000`                         |

### Optional Overrides

| Variable                  | Default                    | Purpose                        |
|---------------------------|----------------------------|--------------------------------|
| `DYNAMODB_LEADS_TABLE`    | `leads`                    | DynamoDB leads table name      |
| `DYNAMODB_USERS_TABLE`    | `users`                    | DynamoDB users table name      |
| `S3_BUCKET_NAME`          | `acestone-default-bucket`  | S3 photo upload bucket         |
| `DATABASE_URL`            | *(none)*                   | PostgreSQL URL for Drizzle migrations (not used at runtime by default) |

### Client-Side

| Variable       | File            | Purpose                         |
|----------------|-----------------|----------------------------------|
| `VITE_API_URL` | `client/.env`   | API gateway URL (placeholder)    |

> **Note:** The client currently uses relative URLs (e.g., `/api/leads`) via `apiRequest()` in `client/src/lib/queryClient.ts`, so `VITE_API_URL` is not actively consumed. It exists as a placeholder for future API gateway separation.

## Storage Layer Selection

The storage backend is auto-selected at runtime in `server/storage.ts`:

```
getStorage()
  ├── AWS creds present? → AWSStorage (DynamoDB + S3 + SES)
  └── No AWS creds?      → MemStorage (in-memory, data lost on restart)
```

**Detection logic** (`server/storage.ts:123-133`):
```typescript
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // → AWSStorage (singleton, initialized once)
} else {
  // → MemStorage (default)
}
```

## Connecting from the Frontend

### API Request Helper

All frontend API calls go through `client/src/lib/queryClient.ts`:

```typescript
// General purpose request function
apiRequest(method: string, url: string, data?: unknown): Promise<Response>

// TanStack Query default fetcher
getQueryFn({ on401: "throw" | "returnNull" }): QueryFunction
```

- Uses `fetch()` with `credentials: "include"`
- Sends `Content-Type: application/json` when body is present
- Throws on non-2xx responses with status code and body text

### TanStack Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,      // Data never auto-refetches
      retry: false,              // No automatic retries
    },
  },
});
```

Key behaviors:
- **No auto-refetch** — data stays cached until manually invalidated
- **No retry** — failed requests surface errors immediately
- **Query keys are URL paths** — e.g., `["/api/leads"]` doubles as the fetch URL

### Cache Invalidation Pattern

After mutations, the client manually invalidates relevant queries:

```typescript
queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
```

## Connecting External Services (Webhooks)

### Angi Integration

```
POST /api/webhooks/angi
Content-Type: application/json
```

The server expects Angi's payload format and maps it internally:
- `customer.firstName` + `customer.lastName` → `fullName`
- `project.category` → mapped via `mapAngiJobType()` to internal enum
- `project.urgency === 'ASAP'` → `rush`, else `normal`

### HomeAdvisor Integration

```
POST /api/webhooks/homeadvisor
Content-Type: application/json
```

Similarly mapped:
- `homeowner.name` → `fullName`
- `request.serviceCategory` → mapped via `mapHomeAdvisorJobType()`
- `request.timeframe === 'ASAP'` → `rush`, else `normal`

Both webhooks:
1. Transform external data to internal `InsertLead` format
2. Auto-calculate quote using `client/src/lib/pricing.ts`
3. Store via `storage.createLead()`
4. Return `{ success: true, leadId: string }`

## Authentication Flow

```
POST /api/auth/login
Body: { username: string, password: string }
```

- **No session/JWT tokens** — auth state is managed client-side in React state (`useState`)
- Server compares plaintext password against stored user record
- On success: returns `{ message, user: { id, username } }`
- On failure: returns `401 { error: "Invalid credentials" }`
- **Default admin**: `admin` / `admin123` (created at server startup)

## Local Development Setup

```bash
# 1. Clone and install
git clone https://github.com/Aaronandrew/AcestoneBuilds.git
cd AcestoneBuilds
npm install

# 2. Run in development mode (in-memory storage, no AWS needed)
npm run dev

# 3. Access
# → http://localhost:5000       (Quote form)
# → http://localhost:5000/admin (Admin dashboard, password: admin123)
```

## Connecting to AWS (Production)

```bash
# Set environment variables before starting
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"
export SES_FROM_EMAIL="verified@email.com"

# Start server — will auto-detect AWS creds and use AWSStorage
npm run dev
# or
npm run build && npm start
```

On first start with AWS credentials, the server automatically:
1. Creates DynamoDB tables if missing
2. Creates S3 bucket if missing
3. Seeds the default admin user

## Network Topology

```
                    ┌──────────────┐
                    │   Browser    │
                    └──────┬───────┘
                           │ HTTP :5000
                    ┌──────┴───────┐
                    │   Express    │ ← Single origin serves API + static files
                    │   Server     │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐     ┌──────────┐
    │ DynamoDB  │    │   SES    │     │    S3    │
    │ us-east-1 │    │ us-east-1│     │ us-east-1│
    └──────────┘    └──────────┘     └──────────┘

External Webhooks:
    Angi ──POST──→ /api/webhooks/angi
    HomeAdvisor ──POST──→ /api/webhooks/homeadvisor
```
