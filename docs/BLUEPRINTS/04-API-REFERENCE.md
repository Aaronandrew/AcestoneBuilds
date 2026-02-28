# API Reference

> Complete reference for all HTTP endpoints exposed by the Acestone Development backend.

## Base URL

- **Development:** `http://localhost:5000`
- **Production:** Your deployed domain (e.g., AWS Amplify URL)

All endpoints are prefixed with `/api`.

---

## Lead Management

### Create Lead

```
POST /api/leads
Content-Type: application/json
```

**Request Body** (validated by `insertLeadSchema`):

| Field           | Type     | Required | Description                                      |
|-----------------|----------|----------|--------------------------------------------------|
| `fullName`      | string   | Yes      | Customer full name (min 1 char)                  |
| `email`         | string   | Yes      | Valid email address                              |
| `phone`         | string   | Yes      | Phone number (min 10 chars)                      |
| `jobType`       | enum     | Yes      | `kitchen`, `bathroom`, `painting`, `flooring`, `roofing` |
| `squareFootage` | number   | Yes      | Project size in sqft (min 1)                     |
| `urgency`       | enum     | Yes      | `normal` or `rush`                               |
| `quote`         | string   | Yes      | Calculated quote as decimal string               |
| `message`       | string   | No       | Project description                              |
| `photos`        | string[] | No       | Array of photo URLs/paths                        |
| `source`        | enum     | No       | `website` (default), `angi`, `homeadvisor`, `manual` |
| `externalId`    | string   | No       | ID from external platform                        |
| `budget`        | string   | No       | Customer's stated budget range                   |
| `zipCode`       | string   | No       | Service area zip code                            |

**Success Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "fullName": "John Smith",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "jobType": "kitchen",
  "squareFootage": 300,
  "urgency": "normal",
  "quote": "45000.00",
  "status": "new",
  "source": "website",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "message": null,
  "photos": [],
  "externalId": null,
  "budget": null,
  "zipCode": null
}
```

**Error Responses:**
- `400` — Zod validation error: `{ error: "Validation error", details: [...] }`
- `500` — Server error: `{ error: "Failed to create lead" }`

---

### Get All Leads

```
GET /api/leads
```

**Success Response:** `200 OK` — Array of `Lead` objects, sorted by `createdAt` descending (newest first).

```json
[
  { "id": "...", "fullName": "...", ... },
  { "id": "...", "fullName": "...", ... }
]
```

**Error Response:** `500` — `{ error: "Failed to fetch leads" }`

---

### Get Lead Statistics

```
GET /api/leads/stats
```

**Success Response:** `200 OK`
```json
{
  "totalLeads": 42,
  "newLeads": 7,
  "inProgress": 5,
  "totalRevenue": 125000.00
}
```

| Field          | Description                                             |
|----------------|---------------------------------------------------------|
| `totalLeads`   | Total count of all leads                                |
| `newLeads`     | Leads created in the last 7 days                        |
| `inProgress`   | Leads with status `in-progress`                         |
| `totalRevenue` | Sum of `quote` values for leads with status `completed` |

**Error Response:** `500` — `{ error: "Failed to fetch stats" }`

---

### Update Lead Status

```
PATCH /api/leads/:id/status
Content-Type: application/json
```

**URL Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | string | Lead UUID         |

**Request Body:**

| Field    | Type | Required | Values                                          |
|----------|------|----------|-------------------------------------------------|
| `status` | enum | Yes      | `new`, `contacted`, `in-progress`, `completed`  |

**Success Response:** `200 OK` — Updated `Lead` object.

**Error Responses:**
- `400` — `{ error: "Invalid status" }`
- `404` — `{ error: "Lead not found" }`
- `500` — `{ error: "Failed to update lead status" }`

---

## Authentication

### Admin Login

```
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**

| Field      | Type   | Required |
|------------|--------|----------|
| `username` | string | Yes      |
| `password` | string | Yes      |

**Success Response:** `200 OK`
```json
{
  "message": "Authentication successful",
  "user": {
    "id": "uuid-string",
    "username": "admin"
  }
}
```

**Error Responses:**
- `401` — `{ error: "Invalid credentials" }`
- `500` — `{ error: "Authentication failed" }`

**Default Credentials:** `admin` / `admin123`

> **Warning:** No session or token is issued. Auth state is client-side only. See `03-SECURITY-CONCERNS.md`.

---

## Webhook Endpoints

### Angi Webhook

```
POST /api/webhooks/angi
Content-Type: application/json
```

**Expected Payload:**
```json
{
  "leadId": "angi_12345",
  "customer": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "(555) 123-4567",
    "zipCode": "12345"
  },
  "project": {
    "category": "kitchen-remodeling",
    "description": "Need kitchen renovation",
    "squareFootage": "200",
    "urgency": "normal",
    "budget": "$15,000-$25,000",
    "photos": ["photo1.jpg"]
  }
}
```

**Category Mapping:**

| Angi Category            | Internal Type |
|--------------------------|---------------|
| `kitchen-remodeling`     | `kitchen`     |
| `bathroom-remodeling`    | `bathroom`    |
| `interior-painting`      | `painting`    |
| `exterior-painting`      | `painting`    |
| `flooring-installation`  | `flooring`    |
| `hardwood-flooring`      | `flooring`    |
| `tile-flooring`          | `flooring`    |
| `roofing-repair`         | `roofing`     |
| `roof-replacement`       | `roofing`     |
| *(unrecognized)*         | `kitchen`     |

**Success Response:** `200 OK` — `{ success: true, leadId: "uuid" }`

---

### HomeAdvisor Webhook

```
POST /api/webhooks/homeadvisor
Content-Type: application/json
```

**Expected Payload:**
```json
{
  "requestId": "ha_67890",
  "homeowner": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phoneNumber": "(555) 987-6543",
    "zipCode": "54321"
  },
  "request": {
    "serviceCategory": "bathroom-renovation",
    "details": "Bathroom remodel needed",
    "projectSize": "150",
    "timeframe": "normal",
    "budgetRange": "$10,000-$20,000",
    "attachments": ["bathroom1.jpg"]
  }
}
```

**Category Mapping:**

| HomeAdvisor Category      | Internal Type |
|---------------------------|---------------|
| `kitchen-renovation`      | `kitchen`     |
| `bathroom-renovation`     | `bathroom`    |
| `painting-services`       | `painting`    |
| `flooring-services`       | `flooring`    |
| `roofing-services`        | `roofing`     |
| *(unrecognized)*          | `kitchen`     |

**Urgency Mapping:** `timeframe === 'ASAP'` → `rush`, otherwise → `normal`

**Success Response:** `200 OK` — `{ success: true, leadId: "uuid" }`

---

## Test Endpoints

> These endpoints exist for development testing and should be disabled in production.

### Test Angi Lead

```
POST /api/test/angi-lead
```

Creates a sample Angi lead (John Smith, kitchen remodel, 300 sqft, normal urgency).

**Response:** `200 OK` — `{ success: true, message: "Test Angi lead created", lead: {...} }`

---

### Test HomeAdvisor Lead

```
POST /api/test/homeadvisor-lead
```

Creates a sample HomeAdvisor lead (Sarah Johnson, bathroom remodel, 120 sqft, rush urgency).

**Response:** `200 OK` — `{ success: true, message: "Test HomeAdvisor lead created", lead: {...} }`

---

## Quote Calculation

Quotes are calculated using the pricing engine in `client/src/lib/pricing.ts`:

```
Quote = PRICING_RATES[jobType] × squareFootage × (1 + rushMarkup)
```

| Job Type  | Rate per sqft | Rush (+15%)     |
|-----------|---------------|-----------------|
| Kitchen   | $200.00       | $230.00         |
| Bathroom  | $150.00       | $172.50         |
| Painting  | $2.50         | $2.875          |
| Flooring  | $5.00         | $5.75           |
| Roofing   | $9.00         | $10.35          |

Results are rounded to 2 decimal places.

---

## Error Response Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "details": [...]  // Only present for Zod validation errors
}
```

HTTP status codes used:
- `200` — Success
- `400` — Bad request / validation error
- `401` — Unauthorized
- `404` — Resource not found
- `500` — Internal server error
