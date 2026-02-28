# AWS Infrastructure

> Complete documentation of AWS cloud services, configuration, provisioning, and cost structure for the Acestone Development system.

## Services Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Account                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  DynamoDB    │  │     SES     │  │        S3           │ │
│  │             │  │             │  │                     │ │
│  │ acestone-   │  │ Verified    │  │ acestone-default-   │ │
│  │ leads       │  │ sender      │  │ bucket              │ │
│  │ acestone-   │  │ email       │  │                     │ │
│  │ users       │  │             │  │ Customer photos     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   AWS Amplify                           ││
│  │  Hosting + CI/CD + Auth (Cognito) + Data (AppSync)     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────┐                                           │
│  │    IAM      │ ← acestone-app user with scoped policy    │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. DynamoDB

### Purpose
NoSQL database for storing leads and admin users. Pay-per-request billing with automatic scaling.

### Tables

| Table Name          | Partition Key | Env Override             |
|---------------------|---------------|--------------------------|
| `acestone-leads`    | `id` (String) | `DYNAMODB_LEADS_TABLE`   |
| `acestone-users`    | `id` (String) | `DYNAMODB_USERS_TABLE`   |

### Configuration

**Source:** `server/aws-storage.ts:51-52`
```typescript
this.leadsTable = process.env.DYNAMODB_LEADS_TABLE || "leads";
this.usersTable = process.env.DYNAMODB_USERS_TABLE || "users";
```

### SDK Client Setup

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const clientConfig = hasLocalCreds
  ? { region, credentials: { accessKeyId, secretAccessKey } }
  : { region };  // In Amplify, IAM role provides creds

this.dbClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));
```

### Required IAM Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DescribeTable",
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Resource": ["arn:aws:dynamodb:*:*:table/acestone-*"]
}
```

### Auto-Initialization

On first startup with AWS credentials, `AWSStorage.initializeTables()` creates tables if they don't exist and seeds the default admin user.

### Cost Estimate

- ~$1-5/month for a typical contractor business
- 1,000 leads ≈ $0.25 (pay-per-request)
- No fixed costs, scales to zero

---

## 2. SES (Simple Email Service)

### Purpose
Sends automated emails on lead creation:
1. **Customer email** — Quote confirmation with project details
2. **Admin email** — New lead notification with source attribution

### Configuration

**Source:** `server/aws-storage.ts:54`
```typescript
this.fromEmail = process.env.SES_FROM_EMAIL || "no-reply@acestonedev.com";
```

### SDK Client Setup

```typescript
import { SESClient } from "@aws-sdk/client-ses";
this.sesClient = new SESClient(clientConfig);
```

### Required IAM Permissions

```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "*"
}
```

### Setup Requirements

1. **Verify sender email** in SES Console → Verified Identities
2. If in SES **sandbox mode**, recipient emails must also be verified
3. Request **production access** to send to any recipient

### Email Templates

| Email               | Subject Pattern                                | Recipient     |
|---------------------|------------------------------------------------|---------------|
| Customer Quote      | `Your Acestone Development Quote - $X,XXX`     | Customer      |
| Admin Notification  | `New [SOURCE] Lead - Customer Name - $X,XXX`   | Admin email   |

### Cost Estimate

- $0.10 per 1,000 emails
- 100 quote emails/month ≈ $0.01

---

## 3. S3 (Simple Storage Service)

### Purpose
Secure storage for customer-uploaded project photos.

### Configuration

**Source:** `server/aws-storage.ts:53`
```typescript
this.bucketName = process.env.S3_BUCKET_NAME || "acestone-default-bucket";
```

### SDK Client Setup

```typescript
import { S3Client } from "@aws-sdk/client-s3";
this.s3Client = new S3Client(clientConfig);
```

### Implemented Operations

```typescript
async uploadFile(key: string, body: Buffer | Uint8Array | Blob | string) {
  const command = new PutObjectCommand({ Bucket, Key: key, Body: body });
  return this.s3Client.send(command);
}
```

> **Note:** The presigned URL package (`@aws-sdk/s3-request-presigner`) is installed but not yet used. Photo upload from the frontend is not wired up.

### Required IAM Permissions

```json
{
  "Effect": "Allow",
  "Action": ["s3:CreateBucket", "s3:HeadBucket", "s3:PutObject", "s3:GetObject"],
  "Resource": [
    "arn:aws:s3:::acestone-*",
    "arn:aws:s3:::acestone-*/*"
  ]
}
```

### Cost Estimate

- $0.023/GB/month storage
- 10GB photos ≈ $0.23/month

---

## 4. AWS Amplify

### Purpose
Hosting, CI/CD pipeline, and optional backend services (Auth, Data).

### Configuration Files

| File                              | Purpose                                    |
|-----------------------------------|--------------------------------------------|
| `amplify/backend.ts`             | Defines backend resources (auth + data)    |
| `amplify/auth/resource.ts`       | Cognito auth with email login              |
| `amplify/data/resource.ts`       | AppSync data model (placeholder Todo)      |
| `amplify/cli.json`               | Amplify CLI configuration                  |
| `amplify/team-provider-info.json`| Environment-specific team settings         |

### Auth Configuration

```typescript
// amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: true },
});
```

Uses **Amazon Cognito** with email-based authentication. This is separate from the custom `/api/auth/login` endpoint currently used by the admin dashboard.

### Data Model

```typescript
// amplify/data/resource.ts
const schema = a.schema({
  Todo: a.model({ content: a.string() })
       .authorization((allow) => [allow.guest()]),
});
```

This is a **placeholder** from the Amplify Gen 2 starter template. The actual application data goes through the Express API → DynamoDB path, not through Amplify Data/AppSync.

### Backend Definition

```typescript
// amplify/backend.ts
defineBackend({ auth, data });
```

---

## Credential Management

### Local Development

Set environment variables in your shell or a `.env` file:

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="wJal..."
export AWS_REGION="us-east-1"
export SES_FROM_EMAIL="admin@acestonedev.com"
```

### Production (Amplify)

When deployed to AWS Amplify:
- **IAM role** provides credentials automatically (no access keys needed)
- The `AWSStorage` constructor detects this: `{ region }` config without explicit credentials
- Environment variables for table names, bucket, and email should be set in Amplify Console → Environment Variables

### IAM User Setup

1. Create IAM user: `acestone-app`
2. Attach the combined policy covering DynamoDB, SES, and S3 permissions
3. Generate access keys for local development
4. Store keys securely — never commit to source control

---

## Full IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": ["arn:aws:dynamodb:*:*:table/acestone-*"]
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:CreateBucket", "s3:HeadBucket", "s3:PutObject", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::acestone-*", "arn:aws:s3:::acestone-*/*"]
    }
  ]
}
```

---

## Cost Summary

| Service   | Typical Monthly Cost | Scaling Factor          |
|-----------|----------------------|-------------------------|
| DynamoDB  | $1–5                 | Per read/write request  |
| SES       | $1–10                | Per 1,000 emails sent   |
| S3        | $1–20                | Per GB stored           |
| Amplify   | $0–15                | Per build minute + GB   |
| **Total** | **$3–50/month**      | Scales with usage       |

All services are pay-per-use with no minimum commitment.
