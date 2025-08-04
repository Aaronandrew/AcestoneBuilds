# Angi & HomeAdvisor Integration Guide

This guide explains how to connect your Acestone Development LLC contractor app with Angi (formerly Angie's List) and HomeAdvisor to automatically receive and process customer leads.

## Overview

Your app now supports automatic lead integration from:
- **Angi** (formerly Angie's List)
- **HomeAdvisor**
- Direct website submissions
- Manual lead entry

## Webhook Endpoints

### Angi Integration
**Endpoint:** `POST /api/webhooks/angi`
**URL:** `https://your-app-domain.replit.app/api/webhooks/angi`

### HomeAdvisor Integration  
**Endpoint:** `POST /api/webhooks/homeadvisor`
**URL:** `https://your-app-domain.replit.app/api/webhooks/homeadvisor`

## Setup Instructions

### 1. Angi Setup
1. Log into your Angi Pro contractor account
2. Go to Settings > Lead Management > Webhooks
3. Add the webhook URL: `https://your-app-domain.replit.app/api/webhooks/angi`
4. Select these events to send:
   - New Lead Received
   - Lead Updated
   - Customer Response

### 2. HomeAdvisor Setup
1. Log into your HomeAdvisor Pro account
2. Navigate to Account Settings > API & Integrations
3. Add webhook endpoint: `https://your-app-domain.replit.app/api/webhooks/homeadvisor`
4. Enable notifications for:
   - New Service Requests
   - Lead Updates
   - Customer Messages

## Expected Data Formats

### Angi Webhook Format
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
    "photos": ["photo1.jpg", "photo2.jpg"]
  }
}
```

### HomeAdvisor Webhook Format
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

## Job Type Mapping

### Angi Categories → Internal Types
- `kitchen-remodeling` → `kitchen`
- `bathroom-remodeling` → `bathroom`
- `interior-painting` → `painting`
- `exterior-painting` → `painting`
- `flooring-installation` → `flooring`
- `hardwood-flooring` → `flooring`
- `tile-flooring` → `flooring`
- `roofing-repair` → `roofing`
- `roof-replacement` → `roofing`

### HomeAdvisor Categories → Internal Types
- `kitchen-renovation` → `kitchen`
- `bathroom-renovation` → `bathroom`
- `painting-services` → `painting`
- `flooring-services` → `flooring`
- `roofing-services` → `roofing`

## Automatic Processing

When a lead is received via webhook:

1. **Data Transformation:** External platform data is mapped to our internal format
2. **Quote Calculation:** Automatic pricing based on job type and square footage
3. **Lead Storage:** All lead information is saved to the database
4. **Status Assignment:** New leads start with "new" status
5. **Admin Notification:** Leads appear immediately in the admin dashboard

## Testing Webhooks

You can test webhook integration by sending POST requests to:

```bash
# Test Angi webhook
curl -X POST https://your-app-domain.replit.app/api/webhooks/angi \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "test_angi_123",
    "customer": {
      "firstName": "Test",
      "lastName": "Customer",
      "email": "test@example.com", 
      "phone": "(555) 123-4567",
      "zipCode": "12345"
    },
    "project": {
      "category": "kitchen-remodeling",
      "description": "Test kitchen project",
      "squareFootage": "300",
      "urgency": "normal",
      "budget": "$20,000"
    }
  }'

# Test HomeAdvisor webhook  
curl -X POST https://your-app-domain.replit.app/api/webhooks/homeadvisor \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_ha_456",
    "homeowner": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phoneNumber": "(555) 987-6543",
      "zipCode": "54321"
    },
    "request": {
      "serviceCategory": "bathroom-renovation", 
      "details": "Test bathroom project",
      "projectSize": "150",
      "timeframe": "rush",
      "budgetRange": "$15,000"
    }
  }'
```

## Lead Source Tracking

In the admin dashboard, leads are clearly marked with their source:
- 🌐 **Website** - Direct form submissions
- 🟢 **Angi** - Leads from Angi platform
- 🟠 **HomeAdvisor** - Leads from HomeAdvisor
- 🟣 **Manual** - Manually entered leads

## Benefits

✅ **Automatic Lead Collection** - No manual data entry needed
✅ **Instant Quote Calculation** - Pricing calculated immediately
✅ **Unified Dashboard** - All leads in one place regardless of source
✅ **Source Tracking** - Know which platforms generate the most leads
✅ **Professional Response** - Consistent quote format across all platforms

## Troubleshooting

### Common Issues
1. **Webhook not receiving data:** Check that URLs are correctly configured in platform settings
2. **Invalid job types:** Verify job categories match expected formats
3. **Missing customer info:** Ensure required fields (name, email, phone) are provided

### Debug Mode
Check server logs for webhook processing details. All webhook requests are logged with their payload and processing results.

## Next Steps

1. Set up webhook URLs in your Angi and HomeAdvisor accounts
2. Test with the provided curl commands
3. Monitor the admin dashboard for incoming leads
4. Customize quote calculation rates if needed
5. Set up email notifications for new leads (coming soon)

For questions or technical support, check the admin dashboard or contact your development team.