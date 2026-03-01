# DynamoDB Integration Troubleshooting Guide

## Problem: Leads Not Writing to DynamoDB

### Symptoms
- Form submissions appeared to work (success toast, API returned 200)
- Leads were visible in the admin dashboard
- But no data appeared in the `acestone-leads` DynamoDB table
- API calls via curl returned data, but DynamoDB scan showed empty table

### Root Cause
The server was using **MemStorage** (in-memory) instead of **AWSStorage** because:
1. The `.env` file was not being loaded by the server
2. Without `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `process.env`, the `getStorage()` function defaulted to MemStorage

### Solution Implementation

#### 1. Install and Configure dotenv
```bash
npm install dotenv
```

Add to the top of `server/index.ts`:
```typescript
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
// ... rest of imports
```

#### 2. Update .env Configuration
Ensure your `.env` file contains:
```dotenv
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1

# DynamoDB Table Names
DYNAMODB_LEADS_TABLE=acestone-leads
DYNAMODB_USERS_TABLE=acestone-users

# SES Configuration
SES_FROM_EMAIL=no-reply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

#### 3. Restart the Server
The server must be restarted after adding dotenv to load environment variables:
```bash
PORT=8080 npm run dev
```

#### 4. Verify Storage Mode
Add debug endpoint to `server/routes.ts`:
```typescript
// Debug endpoint to check storage mode
app.get("/api/debug/storage", async (req, res) => {
  const storage = await getStorage();
  const isAWS = storage.constructor.name === 'AWSStorage';
  res.json({
    storage: isAWS ? 'AWS' : 'MemStorage',
    hasAwsCreds: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    region: process.env.AWS_REGION,
    leadsTable: process.env.DYNAMODB_LEADS_TABLE,
    usersTable: process.env.DYNAMODB_USERS_TABLE,
    sesFromEmail: process.env.SES_FROM_EMAIL,
    adminEmail: process.env.ADMIN_EMAIL,
  });
});
```

Test with:
```bash
curl http://localhost:8080/api/debug/storage
```

### How the Storage Selection Works

In `server/storage.ts`, the `getStorage()` function determines storage mode:

```typescript
export async function getStorage() {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    if (!awsStorage) {
      const { AWSStorage } = await import('./aws-storage');
      awsStorage = new AWSStorage();
      await awsStorage.initializeTables();
    }
    return awsStorage;
  }
  return storage; // MemStorage
}
```

- **If AWS credentials exist**: Uses AWSStorage → DynamoDB
- **If no AWS credentials**: Uses MemStorage → In-memory only

### Verification Steps

1. **Check Server Logs**: Look for `[AWS]` vs `[MemStorage]` messages
2. **Test API**: Submit a lead and check response
3. **Verify DynamoDB**: 
   ```bash
   aws dynamodb scan --table-name acestone-leads --region us-east-1
   ```
4. **Check Storage Mode**: Use the debug endpoint

### Common Issues

#### Issue: Server Still Uses MemStorage After dotenv
**Cause**: Server wasn't restarted after adding dotenv
**Fix**: Restart the server with `PORT=8080 npm run dev`

#### Issue: AWS Credentials Not Loading
**Cause**: `.env` file not in project root or malformed
**Fix**: Ensure `.env` exists in project root with correct format

#### Issue: DynamoDB Permissions
**Cause**: IAM user lacks DynamoDB permissions
**Fix**: Ensure IAM policy includes:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:Scan",
    "dynamodb:UpdateItem",
    "dynamodb:Query"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/acestone-leads",
    "arn:aws:dynamodb:*:*:table/acestone-users"
  ]
}
```

### Prevention

1. **Always restart server** after modifying `.env` or adding dotenv
2. **Add debug logging** to storage selection for easier troubleshooting
3. **Test both storage modes** during development
4. **Document environment requirements** clearly in project README

### Related Files

- `server/index.ts` - dotenv configuration
- `server/storage.ts` - storage selection logic
- `server/aws-storage.ts` - DynamoDB implementation
- `server/routes.ts` - API endpoints and debug tools
- `.env.example` - environment variable template

### Testing Checklist

- [ ] dotenv installed and imported
- [ ] `.env` file exists with AWS credentials
- [ ] Server restarted after changes
- [ ] Debug endpoint shows "storage": "AWS"
- [ ] Lead submission appears in DynamoDB
- [ ] Admin dashboard shows new leads
- [ ] No console errors related to AWS SDK
