# Quick Start Guide

This guide covers how to run Acestone Development locally and deploy it to AWS.

> **Architecture note:** The Express server embeds Vite middleware in development mode.
> Both the frontend and API are served from the **same port** — there is no separate Vite dev server.

---

## 1. Local Development

### Prerequisites

- **Node.js** 18+
- **npm**
- **concurrently** (installed as a dev dependency)
- AWS credentials are **optional** — without them the app uses in-memory storage

### Install Dependencies

```bash
cd AcestoneBuilds
npm install
```

### Choose a Storage Mode

| Mode | When to use | What you need |
|------|-------------|---------------|
| **In-Memory** | Quick testing, no AWS account | Nothing — just run the server |
| **AWS (DynamoDB)** | Test real AWS resources locally | `.env` file with AWS credentials |

#### Option A — In-Memory (default)

No `.env` file required. Data resets on every server restart.

```bash
PORT=8080 npm run dev
```

#### Option B — AWS Resources

```bash
cp .env.example .env
```

Edit `.env` with your real credentials:

```dotenv
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Resource Names (must match what Terraform created)
DYNAMODB_LEADS_TABLE=acestone-leads
DYNAMODB_USERS_TABLE=acestone-users
S3_BUCKET_NAME=acestone-uploads
SES_FROM_EMAIL=no-reply@acestonedev.com

# Server
PORT=8080
```

Then start the server:

```bash
npm run dev
```

### Access the Application

> **Important:** macOS ControlCenter occupies port 5000. Always set `PORT=8080` (or another free port).

| What | URL |
|------|-----|
| **Home / Quote Form** | http://localhost:8080 |
| **Admin Dashboard** | http://localhost:8080/admin |
| **API (leads)** | http://localhost:8080/api/leads |
| **API (stats)** | http://localhost:8080/api/leads/stats |

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server + client together (requires `concurrently`) |
| `npm run dev:server` | Start Express server only |
| `npm run dev:client` | Start Vite client only (won't have API access) |
| `npm run build` | Build both client and server for production |
| `npm start` | Run production build |

---

## 2. Admin Dashboard

### Default Credentials

| Field | Value |
|-------|-------|
| **Username** | `admin` (hardcoded in the login form) |
| **Password** | `admin123` |

The admin login form only asks for a password — the username `admin` is sent automatically.

### How It Works by Storage Mode

| Storage Mode | How admin user is created |
|---|---|
| **In-Memory** | Auto-created on server start (`MemStorage` constructor) |
| **AWS (DynamoDB)** | Auto-seeded into the `acestone-users` DynamoDB table on first startup |

When using AWS storage, you'll see this in the server logs:
```
[AWS] Seeding default admin user...
[AWS] Default admin user created (admin / admin123)
```

On subsequent restarts:
```
[AWS] Admin user already exists
```

### Admin on AWS Amplify (Production)

The same credentials work on the live Amplify deployment. The admin user is seeded
into DynamoDB on the first request that initializes the storage layer.

> **Security note:** Change the admin password in production. The plaintext password
> storage is a known security concern documented in `docs/BLUEPRINTS/03-SECURITY-CONCERNS.md`.

---

## 3. Test API Endpoints

### Local Testing

```bash
# Health check — get all leads
curl http://localhost:8080/api/leads

# Get lead statistics
curl http://localhost:8080/api/leads/stats

# Create a lead
curl -X POST http://localhost:8080/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phone": "5550001234",
    "jobType": "roofing",
    "squareFootage": 1500,
    "urgency": "normal",
    "quote": "4500.00"
  }'

# Update lead status (replace LEAD_ID with actual ID from create response)
curl -X PATCH http://localhost:8080/api/leads/LEAD_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'

# Admin login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Test Angi webhook
curl -X POST http://localhost:8080/api/webhooks/angi/test

# Test HomeAdvisor webhook
curl -X POST http://localhost:8080/api/webhooks/homeadvisor/test
```

### Live AWS Testing

Replace `localhost:8080` with your Amplify domain:

```bash
curl https://YOUR_AMPLIFY_DOMAIN.amplifyapp.com/api/leads
```

---

## 4. Testing AWS Resources Locally

You can test all AWS resources (DynamoDB, S3, SES) from your local machine using
the credentials in your `.env` file. The server connects to the **real AWS resources**
deployed by Terraform.

### Verify AWS Credentials

```bash
# Check that your credentials are valid
aws sts get-caller-identity

# Expected output:
# {
#   "UserId": "...",
#   "Account": "350195739208",
#   "Arn": "arn:aws:iam::350195739208:user/..."
# }
```

### Test DynamoDB (Leads & Users Tables)

```bash
# List tables — should include acestone-leads and acestone-users
aws dynamodb list-tables --region us-east-1

# Scan leads table (shows all items)
aws dynamodb scan --table-name acestone-leads --region us-east-1

# Scan users table (shows admin user after first server start)
aws dynamodb scan --table-name acestone-users --region us-east-1

# Describe table structure
aws dynamodb describe-table --table-name acestone-leads --region us-east-1
```

### Test S3 (Upload Bucket)

```bash
# List bucket contents
aws s3 ls s3://acestone-uploads/

# Upload a test file
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://acestone-uploads/test/test.txt

# Verify upload
aws s3 ls s3://acestone-uploads/test/

# Clean up test file
aws s3 rm s3://acestone-uploads/test/test.txt
```

### Test SES (Email)

```bash
# Check email identity verification status
aws ses get-identity-verification-attributes \
  --identities no-reply@acestonedev.com \
  --region us-east-1

# Send a test email (only works if SES identity is verified)
aws ses send-email \
  --from no-reply@acestonedev.com \
  --destination "ToAddresses=your-email@example.com" \
  --message "Subject={Data=Test},Body={Text={Data=Test email from Acestone}}" \
  --region us-east-1
```

### End-to-End Local Test with AWS

1. Start the server with AWS credentials:
   ```bash
   PORT=8080 npm run dev
   ```
2. Watch the logs — you should see `[AWS] Seeding default admin user...` or `[AWS] Admin user already exists`
3. Create a lead via the form at http://localhost:8080
4. Verify the lead was saved to DynamoDB:
   ```bash
   aws dynamodb scan --table-name acestone-leads --region us-east-1
   ```
5. Log into the admin dashboard at http://localhost:8080/admin with password `admin123`
6. Verify the admin user exists in DynamoDB:
   ```bash
   aws dynamodb scan --table-name acestone-users --region us-east-1
   ```

---

## 5. AWS Deployment

### Deploy Infrastructure with Terraform

```bash
cd terraform
terraform init
terraform plan      # Preview changes
terraform apply     # Deploy resources
```

**Resources created by Terraform:**

| Resource | Name |
|----------|------|
| DynamoDB Table | `acestone-leads` |
| DynamoDB Table | `acestone-users` |
| S3 Bucket | `acestone-uploads` |
| SES Identity | `no-reply@acestonedev.com` |
| IAM Role | `acestone-app-role` |

### Deploy App with AWS Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **"New app"** → **"Host web app"**
3. Connect to GitHub → select `Aaronandrew/AcestoneBuilds`
4. Choose branch: `release-1.0.0` or `main`
5. Set **Service role**: `acestone-app-role`
6. Add **Environment variables**:

| Variable | Value |
|----------|-------|
| `APP_REGION` | `us-east-1` |
| `DYNAMODB_LEADS_TABLE` | `acestone-leads` |
| `DYNAMODB_USERS_TABLE` | `acestone-users` |
| `S3_BUCKET_NAME` | `acestone-uploads` |
| `SES_FROM_EMAIL` | `no-reply@acestonedev.com` |
| `NODE_ENV` | `production` |

7. Click **"Save and deploy"**

### Verify Live Deployment

```bash
# Replace with your actual Amplify URL
AMPLIFY_URL=https://release100.YOUR_APP_ID.amplifyapp.com

curl $AMPLIFY_URL/api/leads
curl $AMPLIFY_URL/api/leads/stats
```

---

## 6. Troubleshooting

### Port 5000 in use (macOS)

macOS ControlCenter uses port 5000. Always use a different port:
```bash
PORT=8080 npm run dev
```

### Missing script: "dev"

Install the `concurrently` dependency:
```bash
npm install concurrently --save-dev
```

### Terraform provider timeout

If you see `timeout while waiting for plugin to start`, you may have an x86 Terraform binary on an Apple Silicon Mac:
```bash
# Check architecture
uname -m              # Should be arm64
terraform version     # Should show darwin_arm64

# Fix: install native arm64 Terraform via tfenv
brew install tfenv
tfenv install latest
tfenv use latest
```

### Terraform provider cache error

```bash
cd terraform
rm -rf .terraform
terraform init
```

### AWS credential issues

```bash
aws sts get-caller-identity
env | grep AWS
```

### SES emails not sending

SES identity must be verified. Check the AWS Console under SES → Verified identities.
In sandbox mode, both sender and recipient must be verified.

---

## 7. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port (use `8080` on macOS) |
| `AWS_ACCESS_KEY_ID` | For AWS mode | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | For AWS mode | — | AWS secret key |
| `AWS_REGION` | For AWS mode | `us-east-1` | AWS region |
| `DYNAMODB_LEADS_TABLE` | For AWS mode | `acestone-leads` | Leads DynamoDB table |
| `DYNAMODB_USERS_TABLE` | For AWS mode | `acestone-users` | Users DynamoDB table |
| `S3_BUCKET_NAME` | For AWS mode | `acestone-uploads` | S3 bucket for uploads |
| `SES_FROM_EMAIL` | For AWS mode | `no-reply@acestonedev.com` | SES sender email |
| `NODE_ENV` | No | `development` | `development` or `production` |

---

## 8. Additional Resources

- [Architecture Overview](./BLUEPRINTS/01-ARCHITECTURE-OVERVIEW.md)
- [Security Concerns](./BLUEPRINTS/03-SECURITY-CONCERNS.md)
- [API Reference](./BLUEPRINTS/04-API-REFERENCE.md)
- [AWS Infrastructure](./BLUEPRINTS/07-AWS-INFRASTRUCTURE.md)
- [Deployment Guide](./BLUEPRINTS/09-DEPLOYMENT.md)
- [Terraform README](../terraform/README.md)
