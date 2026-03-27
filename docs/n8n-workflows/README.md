# n8n CRM Workflow Setup Guide

## Overview

These 5 workflows automate the full Acestone CRM pipeline. Each workflow is triggered by a specific CRM stage change, sends the appropriate email to the customer, and calls back to the app to confirm.

## Architecture

```
Admin clicks action in CRM UI
       ↓
App fires webhook to n8n (event: crm.*)
       ↓
n8n workflow activates:
  1. Filters for its specific event
  2. Extracts lead data
  3. Sends email via SMTP/SES
  4. Calls back POST /api/n8n/callback to confirm
       ↓
Timeline updated with actor="n8n"
```

## Workflows

| # | File | Trigger Event | What It Does |
|---|------|--------------|-------------|
| 1 | `01-calendly-send-booking-link.json` | `crm.calendly_sent` | Emails customer a Calendly booking link with utm_content=leadId for tracking |
| 2 | `02-calendly-booking-received.json` | Calendly webhook (invitee.created) | Receives Calendly booking, forwards to app's `/api/webhooks/calendly`, notifies admin |
| 3 | `03-estimate-email.json` | `crm.estimate_sent` | Emails customer their detailed estimate with meeting notes |
| 4 | `04-contract-send.json` | `crm.contract_sent` | Emails contract summary (amount, deposit, scope) to customer + notifies admin |
| 5 | `05-job-complete-send-survey.json` | `crm.survey_requested` | Emails customer a link to `/survey/:leadId` for satisfaction feedback |

## Import Steps

1. Open your n8n instance (https://n8n.coreorangelabs.com)
2. Click **"Add workflow"** → **"Import from file"**
3. Import each JSON file in order
4. For each workflow:
   - Configure the **Email Send** node with your SMTP credentials (or swap for SES/SendGrid node)
   - Verify the callback URL points to your app (`https://app.coreorangelabs.com`)
   - If using webhook secrets, add `X-Webhook-Secret` header to HTTP Request nodes
5. **Activate** each workflow

## Calendly Setup (Workflow 2)

Workflow 2 receives Calendly's webhook when a customer books. To set this up:

1. Go to **Calendly → Integrations → Webhooks** (or use Calendly API)
2. Create a webhook subscription for event `invitee.created`
3. Point it to: `https://n8n.coreorangelabs.com/webhook/acestone-calendly-booked`
4. The Calendly link sent in Workflow 1 includes `?utm_content=LEAD_ID` — this lets the app match the booking back to the correct lead

If no leadId is found via UTM tracking, the app falls back to matching by email address.

## Survey Flow (Workflow 5 + App)

When the admin clicks "Send Survey" in the CRM:
1. n8n sends an email with a link to `https://app.coreorangelabs.com/survey/:leadId`
2. Customer opens the survey page (public, no auth required)
3. Customer rates 1-5 stars and optionally leaves feedback
4. `POST /api/survey/:leadId` stores the rating and advances CRM to `closed`
5. n8n webhook fires `crm.closed` for any final automation

## Contract Signing

Currently uses a simple email-based acceptance flow:
- Customer receives contract email and replies "I accept"
- Admin manually marks contract as signed in CRM

To upgrade to digital signatures (DocuSign, HelloSign, PandaDoc):
1. Replace the email body in Workflow 4 with a signing link
2. Configure the e-sign platform to webhook to: `https://app.coreorangelabs.com/api/webhooks/contract-signed`
3. The endpoint expects: `{ leadId, signerName, signedAt, documentUrl }`

## App API Endpoints Used

| Endpoint | Called By | Purpose |
|----------|----------|---------|
| `POST /api/n8n/callback` | All workflows | Update CRM status after automation |
| `POST /api/webhooks/calendly` | Workflow 2 (via Calendly) | Process booking and update to meeting_booked |
| `POST /api/webhooks/contract-signed` | E-sign platform | Mark contract as signed |
| `GET /api/survey/:leadId` | Survey page | Load survey info for customer |
| `POST /api/survey/:leadId` | Survey page | Submit rating and feedback |

## Environment Variables

Ensure these are set on the app server:

```
N8N_WEBHOOK_URL=https://n8n.coreorangelabs.com/webhook/acestone-crm
N8N_WEBHOOK_SECRET=your-shared-secret  # optional
```

## Email Configuration

All workflows use the `emailSend` node. Configure with:
- **SMTP credentials** in n8n (Settings → Credentials → SMTP)
- Or replace with **AWS SES** node if preferred
- From address: `admin@acestonellc.com` (must match SES verified identity if using SES)
