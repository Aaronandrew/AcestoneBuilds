# SES Email Setup & Troubleshooting Guide

## Overview

When a lead submits a quote request via the "Get My Free Estimate" form, the application sends two emails via AWS SES:

1. **Admin notification** to `admin@acestonellc.com` — full lead details
2. **Customer confirmation** to the submitter's email — quote summary

---

## Architecture

```
Customer submits form
       ↓
POST /api/leads  (server/routes.ts)
       ↓
storage.createLead()  →  DynamoDB acestone-leads
       ↓
sendLeadEmails(lead)
    ├── sendEmail(ADMIN_EMAIL, ...)   →  admin@acestonellc.com
    └── sendEmail(lead.email, ...)   →  customer's email
```

**Key environment variables:**

| Variable | Value | Purpose |
|---|---|---|
| `SES_FROM_EMAIL` | `admin@acestonellc.com` | Must match a verified SES identity |
| `ADMIN_EMAIL` | `admin@acestonellc.com` | Receives lead notifications |

---

## Initial Setup

### 1. Verify the Email Identity in AWS SES

SES requires the sender email to be a verified identity. This is managed via Terraform:

```bash
cd terraform
terraform apply
```

Terraform provisions:
- `aws_ses_email_identity.sender` — the FROM address
- `aws_ses_email_identity.admin` — the admin notification address

Both map to `admin@acestonellc.com`.

After `terraform apply`, AWS sends a verification email to `admin@acestonellc.com`. **You must click the verification link** before SES will allow sending.

### 2. Configure .env

```dotenv
SES_FROM_EMAIL=admin@acestonellc.com
ADMIN_EMAIL=admin@acestonellc.com
```

> **Critical**: `SES_FROM_EMAIL` must exactly match the verified SES identity. Any mismatch causes `Email address is not verified` errors.

### 3. Check Verification Status

```bash
aws ses list-identities --region us-east-1
aws ses get-identity-verification-attributes \
  --identities "admin@acestonellc.com" \
  --region us-east-1
```

Expected output when verified:
```json
{
  "VerificationAttributes": {
    "admin@acestonellc.com": {
      "VerificationStatus": "Success"
    }
  }
}
```

### 4. Test SES Directly

```bash
aws ses send-email \
  --region us-east-1 \
  --from "admin@acestonellc.com" \
  --destination "ToAddresses=admin@acestonellc.com" \
  --message "Subject={Data='Test'},Body={Text={Data='SES works!'}}"
```

A successful response returns a `MessageId`. If this works but the app doesn't send emails, the issue is in the application configuration (see troubleshooting below).

---

## Root Cause of Original Bug

### Symptom
SES emails were not being sent from the frontend form submissions. The server logs showed:
```
[SES] Failed to send email to admin@acestonellc.com:
Email address is not verified. The following identities failed the check:
admin@acestonellc.com, no-reply@acestonedev.com
```

### Root Cause 1: Wrong SES_FROM_EMAIL
The `.env` file still had `SES_FROM_EMAIL=no-reply@acestonedev.com` — an unverified identity. SES rejects any email where the FROM address isn't verified, even if the recipient is verified.

**Fix:** Update `.env`:
```dotenv
# Before (broken)
SES_FROM_EMAIL=no-reply@acestonedev.com

# After (fixed)
SES_FROM_EMAIL=admin@acestonellc.com
```

### Root Cause 2: Module-level constant cached stale value
In `server/routes.ts`, `SES_FROM_EMAIL` was captured as a module-level constant:

```typescript
// WRONG — captured once at startup, before dotenv loaded
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
```

If the server had been started before dotenv was configured, `SES_FROM_EMAIL` was `undefined` and cached forever, even after `.env` was corrected.

**Fix:** Read it dynamically inside the function at send time:

```typescript
// CORRECT — reads current value every time
async function sendEmail(to, subject, textBody, htmlBody) {
  const client = getSesClient();
  const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL; // read here, not at top-level
  if (!client || !SES_FROM_EMAIL) return;
  // ...
}
```

### Root Cause 3: dotenv not loaded
The server (`tsx server/index.ts`) doesn't auto-load `.env` files. Without dotenv, all `process.env.*` AWS variables are undefined and the app falls back to MemStorage with no SES.

**Fix:** Add `import "dotenv/config"` as the **first line** of `server/index.ts`:

```typescript
import "dotenv/config"; // must be first
import express from "express";
// ...
```

---

## SES Sandbox Limitations

By default, AWS SES accounts are in **sandbox mode**:
- Max **200 emails/day**
- Max **1 email/second**
- **Both sender AND recipient** must be verified identities

This means customer confirmation emails won't reach unverified customer emails while in sandbox mode.

### Request Production Access

To send to any email address:
1. Go to **AWS Console → SES → Account Dashboard**
2. Click **"Request production access"**
3. Fill out the use case form
4. Approval typically takes 24–48 hours

Until production access is granted, only emails to verified identities will be delivered.

---

## Verification Checklist

- [ ] `SES_FROM_EMAIL` in `.env` matches a verified SES identity
- [ ] `ADMIN_EMAIL` in `.env` is set to `admin@acestonellc.com`
- [ ] Terraform has been applied (`terraform apply`)
- [ ] Verification email was received and link was clicked
- [ ] Server was restarted after `.env` changes
- [ ] `import "dotenv/config"` is first line of `server/index.ts`
- [ ] SES sandbox: customer email is also verified (or production access granted)

---

## Related Files

- `server/index.ts` — dotenv configuration
- `server/routes.ts` — `sendLeadEmails()` and `sendEmail()` functions
- `terraform/main.tf` — `aws_ses_email_identity` resources
- `terraform/variables.tf` — `ses_from_email` and `admin_email` variables
- `.env` — `SES_FROM_EMAIL` and `ADMIN_EMAIL` values
