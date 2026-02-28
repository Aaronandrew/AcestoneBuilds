# Database Schema & Data Models

> Schema definitions, validation rules, and storage implementations for the Acestone Development system.

## Schema Source of Truth

All data models are defined in `shared/schema.ts` using **Drizzle ORM** table definitions and **Zod** validation schemas. This single file is shared between the client and server via the `@shared/*` path alias.

---

## Tables

### Leads Table

**Drizzle Definition:** `shared/schema.ts:6-24`

```sql
CREATE TABLE leads (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  job_type     TEXT NOT NULL,
  square_footage INTEGER NOT NULL,
  urgency      TEXT NOT NULL,
  message      TEXT,
  photos       JSONB DEFAULT '[]',
  quote        DECIMAL(10,2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'new',
  source       TEXT NOT NULL DEFAULT 'website',
  external_id  TEXT,
  budget       TEXT,
  zip_code     TEXT,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);
```

**Field Details:**

| Column           | TypeScript Type   | DB Type        | Nullable | Default           | Description                              |
|------------------|-------------------|----------------|----------|-------------------|------------------------------------------|
| `id`             | `string`          | `VARCHAR`      | No       | `gen_random_uuid()` | Primary key UUID                        |
| `fullName`       | `string`          | `TEXT`         | No       | —                 | Customer full name                       |
| `email`          | `string`          | `TEXT`         | No       | —                 | Customer email                           |
| `phone`          | `string`          | `TEXT`         | No       | —                 | Customer phone (min 10 chars)            |
| `jobType`        | `string` (enum)   | `TEXT`         | No       | —                 | `kitchen\|bathroom\|painting\|flooring\|roofing` |
| `squareFootage`  | `number`          | `INTEGER`      | No       | —                 | Project area (min 1)                     |
| `urgency`        | `string` (enum)   | `TEXT`         | No       | —                 | `normal` or `rush`                       |
| `message`        | `string \| null`  | `TEXT`         | Yes      | `null`            | Optional project description             |
| `photos`         | `string[]`        | `JSONB`        | No       | `[]`              | Array of photo URLs/paths                |
| `quote`          | `string`          | `DECIMAL(10,2)`| No       | —                 | Calculated quote amount as string        |
| `status`         | `string`          | `TEXT`         | No       | `"new"`           | `new\|contacted\|in-progress\|completed` |
| `source`         | `string` (enum)   | `TEXT`         | No       | `"website"`       | `website\|angi\|homeadvisor\|manual`     |
| `externalId`     | `string \| null`  | `TEXT`         | Yes      | `null`            | Platform-specific lead ID                |
| `budget`         | `string \| null`  | `TEXT`         | Yes      | `null`            | Customer's stated budget range           |
| `zipCode`        | `string \| null`  | `TEXT`         | Yes      | `null`            | Service area zip code                    |
| `createdAt`      | `Date \| null`    | `TIMESTAMP`    | Yes      | `NOW()`           | Record creation time                     |
| `updatedAt`      | `Date \| null`    | `TIMESTAMP`    | Yes      | `NOW()`           | Last modification time                   |

### Users Table

**Drizzle Definition:** `shared/schema.ts:48-52`

```sql
CREATE TABLE users (
  id       VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

| Column     | TypeScript Type | DB Type   | Nullable | Description           |
|------------|-----------------|-----------|----------|-----------------------|
| `id`       | `string`        | `VARCHAR` | No       | Primary key UUID      |
| `username` | `string`        | `TEXT`    | No       | Unique username       |
| `password` | `string`        | `TEXT`    | No       | Password (plaintext!) |

---

## Zod Validation Schemas

### `insertLeadSchema`

Derived from Drizzle table with Zod extensions (`shared/schema.ts:26-43`):

```typescript
insertLeadSchema = createInsertSchema(leads)
  .omit({ id, createdAt, updatedAt })
  .extend({
    fullName:      z.string().min(1),
    email:         z.string().email(),
    phone:         z.string().min(10),
    jobType:       z.enum(["kitchen", "bathroom", "painting", "flooring", "roofing"]),
    squareFootage: z.number().min(1),
    urgency:       z.enum(["normal", "rush"]),
    message:       z.string().optional(),
    photos:        z.array(z.string()).optional(),
    source:        z.enum(["website", "angi", "homeadvisor", "manual"]).default("website"),
    externalId:    z.string().optional(),
    budget:        z.string().optional(),
    zipCode:       z.string().optional(),
  });
```

### `insertUserSchema`

```typescript
insertUserSchema = createInsertSchema(users).pick({ username, password });
```

---

## TypeScript Types

Exported from `shared/schema.ts`:

```typescript
type InsertLead = z.infer<typeof insertLeadSchema>;  // Input type (no id, no timestamps)
type Lead       = typeof leads.$inferSelect;           // Full row type (all columns)
type InsertUser = z.infer<typeof insertUserSchema>;    // { username, password }
type User       = typeof users.$inferSelect;           // { id, username, password }
```

---

## Storage Implementations

### IStorage Interface

Defined in `server/storage.ts:4-20`:

```typescript
interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  getLeadStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    inProgress: number;
    totalRevenue: number;
  }>;
}
```

### MemStorage (Development)

- **Location:** `server/storage.ts:22-117`
- Uses `Map<string, T>` for both leads and users
- UUIDs generated via `crypto.randomUUID()`
- Default admin user seeded in constructor: `admin` / `admin123`
- Leads sorted by `createdAt` descending on retrieval
- Stats calculated in-memory with array operations
- **Data is lost on server restart**

### AWSStorage (Production)

- **Location:** `server/aws-storage.ts`
- Uses DynamoDB via `@aws-sdk/lib-dynamodb`
- Tables: configurable via `DYNAMODB_LEADS_TABLE` and `DYNAMODB_USERS_TABLE`
- S3 integration for file uploads via `@aws-sdk/client-s3`
- SES integration for emails via `@aws-sdk/client-ses`
- Auto-initializes tables on first use (`initializeTables()`)

> **Note:** The AWSStorage class in `aws-storage.ts` currently only implements an `uploadFile()` method. The full `IStorage` interface methods (createLead, getLeads, etc.) for DynamoDB are expected to be implemented but are not present in the current codebase — the storage abstraction in `getStorage()` assumes they exist.

---

## Drizzle Configuration

**File:** `drizzle.config.ts`

```typescript
{
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL }
}
```

- Configured for **PostgreSQL** dialect
- Requires `DATABASE_URL` environment variable for migration generation
- Migrations output to `./migrations/` directory

> **Note:** Drizzle is configured for PostgreSQL but the runtime storage uses either in-memory maps or DynamoDB. The Drizzle config appears to be a remnant from an earlier architecture or intended for future PostgreSQL support.

---

## Lead Status Lifecycle

```
new → contacted → in-progress → completed
```

| Status        | Description                                    |
|---------------|------------------------------------------------|
| `new`         | Lead just created, not yet reviewed            |
| `contacted`   | Admin has reached out to the customer           |
| `in-progress` | Project work has begun                         |
| `completed`   | Project finished (quote added to revenue stats)|

---

## Data Flow: Lead Creation

```
1. Client submits form → POST /api/leads with InsertLead body
2. Zod validates against insertLeadSchema
3. getStorage() returns MemStorage or AWSStorage
4. storage.createLead() assigns: id, status="new", createdAt, updatedAt
5. Full Lead object returned to client
6. TanStack Query caches under key ["/api/leads"]
```
