# Platform Integrations

> How the Acestone Development system connects with Angi, HomeAdvisor, and other external platforms for multi-channel lead ingestion.

## Integration Architecture

```
┌──────────┐     ┌──────────────┐     ┌────────────────────────────┐
│   Angi   │────▶│ POST         │────▶│ mapAngiJobType()           │
│ Platform │     │ /api/webhooks│     │ Transform → InsertLead     │
└──────────┘     │ /angi        │     │ calculateQuote()           │
                 └──────────────┘     │ storage.createLead()       │
                                      └────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌────────────────────────────┐
│HomeAdvisor────▶│ POST         │────▶│ mapHomeAdvisorJobType()    │
│ Platform │     │ /api/webhooks│     │ Transform → InsertLead     │
└──────────┘     │ /homeadvisor │     │ calculateQuote()           │
                 └──────────────┘     │ storage.createLead()       │
                                      └────────────────────────────┘

┌──────────┐     ┌──────────────┐     ┌────────────────────────────┐
│ Website  │────▶│ POST         │────▶│ Zod validation             │
│  Form    │     │ /api/leads   │     │ storage.createLead()       │
└──────────┘     └──────────────┘     └────────────────────────────┘
```

## Lead Sources

| Source       | Entry Point                    | Data Transform | Auto-Quote |
|--------------|--------------------------------|----------------|------------|
| Website      | `POST /api/leads`              | None (native)  | Client-side|
| Angi         | `POST /api/webhooks/angi`      | `mapAngiJobType()` | Server-side|
| HomeAdvisor  | `POST /api/webhooks/homeadvisor`| `mapHomeAdvisorJobType()` | Server-side|
| Manual       | `POST /api/leads` (source=manual)| None          | Client-side|

---

## Angi Integration

### Webhook Endpoint

```
POST /api/webhooks/angi
Content-Type: application/json
```

### Setup on Angi Platform

1. Log into Angi Pro contractor account
2. Navigate to **Settings → Lead Management → Webhooks**
3. Add webhook URL: `https://<your-domain>/api/webhooks/angi`
4. Enable events: New Lead Received, Lead Updated, Customer Response

### Data Transformation

**Angi payload → Internal Lead format:**

| Angi Field                    | Internal Field     | Transform                        |
|-------------------------------|--------------------|----------------------------------|
| `customer.firstName + lastName`| `fullName`        | String concatenation + trim      |
| `customer.email`              | `email`            | Direct mapping                   |
| `customer.phone`              | `phone`            | Direct mapping                   |
| `project.category`            | `jobType`          | `mapAngiJobType()` lookup        |
| `project.squareFootage`       | `squareFootage`    | `parseInt()`, default: 500       |
| `project.urgency`             | `urgency`          | `'ASAP'` → `rush`, else `normal` |
| `project.description`         | `message`          | Direct mapping                   |
| `project.photos`              | `photos`           | Direct mapping (array)           |
| `leadId`                      | `externalId`       | Direct mapping                   |
| `project.budget`              | `budget`           | Direct mapping                   |
| `customer.zipCode`            | `zipCode`          | Direct mapping                   |
| *(auto)*                      | `source`           | `"angi"`                         |
| *(calculated)*                | `quote`            | `calculateQuote()` result        |

### Category Mapping (`mapAngiJobType`)

```typescript
// server/routes.ts:8-22
{
  'kitchen-remodeling':    'kitchen',
  'bathroom-remodeling':   'bathroom',
  'interior-painting':     'painting',
  'exterior-painting':     'painting',
  'flooring-installation': 'flooring',
  'hardwood-flooring':     'flooring',
  'tile-flooring':         'flooring',
  'roofing-repair':        'roofing',
  'roof-replacement':      'roofing',
}
// Unrecognized categories default to 'kitchen'
```

---

## HomeAdvisor Integration

### Webhook Endpoint

```
POST /api/webhooks/homeadvisor
Content-Type: application/json
```

### Setup on HomeAdvisor Platform

1. Log into HomeAdvisor Pro account
2. Navigate to **Account Settings → API & Integrations**
3. Add webhook endpoint: `https://<your-domain>/api/webhooks/homeadvisor`
4. Enable: New Service Requests, Lead Updates, Customer Messages

### Data Transformation

**HomeAdvisor payload → Internal Lead format:**

| HomeAdvisor Field             | Internal Field     | Transform                        |
|-------------------------------|--------------------|----------------------------------|
| `homeowner.name`              | `fullName`         | Direct mapping                   |
| `homeowner.email`             | `email`            | Direct mapping                   |
| `homeowner.phoneNumber`       | `phone`            | Direct mapping                   |
| `request.serviceCategory`     | `jobType`          | `mapHomeAdvisorJobType()` lookup |
| `request.projectSize`         | `squareFootage`    | `parseInt()`, default: 500       |
| `request.timeframe`           | `urgency`          | `'ASAP'` → `rush`, else `normal` |
| `request.details`             | `message`          | Direct mapping                   |
| `request.attachments`         | `photos`           | Direct mapping (array)           |
| `requestId`                   | `externalId`       | Direct mapping                   |
| `request.budgetRange`         | `budget`           | Direct mapping                   |
| `homeowner.zipCode`           | `zipCode`          | Direct mapping                   |
| *(auto)*                      | `source`           | `"homeadvisor"`                  |
| *(calculated)*                | `quote`            | `calculateQuote()` result        |

### Category Mapping (`mapHomeAdvisorJobType`)

```typescript
// server/routes.ts:24-34
{
  'kitchen-renovation':   'kitchen',
  'bathroom-renovation':  'bathroom',
  'painting-services':    'painting',
  'flooring-services':    'flooring',
  'roofing-services':     'roofing',
}
// Unrecognized categories default to 'kitchen'
```

---

## Webhook Processing Pipeline

Both webhook endpoints follow the same pipeline:

```
1. Receive POST request body
2. Extract customer & project data
3. Map external job category → internal jobType enum
4. Parse squareFootage (default 500 if invalid)
5. Determine urgency ('ASAP' → rush, else normal)
6. Import pricing module from client/src/lib/pricing.ts
7. Calculate quote: rate × sqft × (1 + rush markup)
8. Construct InsertLead object with source tag
9. storage.createLead() → persist to MemStorage or DynamoDB
10. Return { success: true, leadId: "uuid" }
```

**Error handling:** Errors are caught, logged to console, and return `500` with a generic error message.

---

## Test Endpoints

For development and integration testing:

### Test Angi Lead
```
POST /api/test/angi-lead
```
Creates a lead with sample data:
- **Name:** John Smith
- **Job:** Kitchen remodel, 300 sqft, normal urgency
- **Budget:** $25,000-$35,000
- **Source:** Angi

### Test HomeAdvisor Lead
```
POST /api/test/homeadvisor-lead
```
Creates a lead with sample data:
- **Name:** Sarah Johnson
- **Job:** Bathroom remodel, 120 sqft, rush urgency
- **Budget:** $15,000-$20,000
- **Source:** HomeAdvisor

### Testing from Admin Dashboard

The dashboard includes two buttons:
- **"Test Angi Lead"** → Calls `POST /api/test/angi-lead`
- **"Test HA Lead"** → Calls `POST /api/test/homeadvisor-lead`

Both trigger cache invalidation to refresh the leads table and stats immediately.

---

## Dashboard Source Tracking

Leads in the admin dashboard display color-coded source badges:

| Source      | Badge Color | CSS Classes                          |
|-------------|-------------|--------------------------------------|
| Website     | Blue        | `bg-blue-100 text-blue-800`         |
| Angi        | Green       | `bg-green-100 text-green-800`       |
| HomeAdvisor | Orange      | `bg-orange-100 text-orange-800`     |
| Manual      | Purple      | `bg-purple-100 text-purple-800`     |

External platform IDs are displayed below the source badge when present:
```
ID: test_angi_1705312200000
```

---

## Known Limitations

1. **No webhook authentication** — Endpoints accept requests from any source without signature verification
2. **No retry/dedup** — If a webhook fires twice, duplicate leads are created (no `externalId` uniqueness check)
3. **Hardcoded defaults** — Unrecognized job categories default to `kitchen`; missing sqft defaults to `500`
4. **Server imports client code** — Webhook routes dynamically import `client/src/lib/pricing.ts` which couples server to client module
5. **No webhook logging/storage** — Raw webhook payloads are not stored for audit or debugging
6. **Photo URLs not validated** — Photo arrays from webhooks are stored as-is without verification

---

## Adding New Integrations

To add a new platform (e.g., Thumbtack, Yelp):

1. **Add mapping function** in `server/routes.ts`:
   ```typescript
   function mapNewPlatformJobType(category: string): string { ... }
   ```

2. **Add webhook endpoint**:
   ```typescript
   app.post("/api/webhooks/newplatform", async (req, res) => { ... });
   ```

3. **Update source enum** in `shared/schema.ts`:
   ```typescript
   source: z.enum(["website", "angi", "homeadvisor", "manual", "newplatform"])
   ```

4. **Add source badge color** in `client/src/components/admin-dashboard.tsx`

5. **Add test endpoint** (optional) for development testing
