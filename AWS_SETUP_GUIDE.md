# AWS Backend Setup Guide

Your contractor app now uses AWS services for production-ready scalability and reliability. This guide explains the architecture and setup process.

## AWS Services Used

### 1. DynamoDB (Database)
- **Purpose**: Stores leads, user data, and application state
- **Tables Created**: 
  - `acestone-leads`: Customer leads and quotes
  - `acestone-users`: Admin users and authentication
- **Billing**: Pay-per-request (no fixed costs)
- **Benefits**: Auto-scaling, high availability, managed backups

### 2. SES (Simple Email Service) 
- **Purpose**: Sends automatic quote emails to customers and admin notifications
- **Features**: High deliverability, bounce/complaint handling, detailed analytics
- **Cost**: $0.10 per 1,000 emails sent
- **Requirements**: Verified sending email address

### 3. S3 (Simple Storage Service)
- **Purpose**: Stores uploaded customer photos securely
- **Bucket**: `acestone-uploads` (configurable)
- **Features**: Signed URLs for secure access, lifecycle policies
- **Cost**: $0.023 per GB stored per month

## Current Configuration

The app automatically detects AWS credentials and switches between:
- **Development**: In-memory storage (when no AWS credentials)
- **Production**: AWS services (when credentials are provided)

## Email Automation

When a new lead is created, the system automatically:

1. **Customer Email**: Professional quote confirmation
   - Subject: "Your Acestone Development Quote - $X,XXX"
   - Includes project details and estimated cost
   - Professional company signature

2. **Admin Email**: New lead notification
   - Subject: "New [SOURCE] Lead - Customer Name - $X,XXX"
   - Complete lead details including source (Website, Angi, HomeAdvisor)
   - External platform IDs for reference

## AWS Permissions Required

Your AWS IAM user needs these permissions:

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
      "Resource": [
        "arn:aws:dynamodb:*:*:table/acestone-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:HeadBucket",
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::acestone-*",
        "arn:aws:s3:::acestone-*/*"
      ]
    }
  ]
}
```

## Setup Steps

### 1. AWS Account Setup
1. Create AWS account at aws.amazon.com
2. Navigate to IAM in AWS Console
3. Create new user: "acestone-app"
4. Attach permissions policy (above)
5. Generate access keys

### 2. SES Email Verification
1. Go to SES in AWS Console
2. Navigate to "Verified Identities"
3. Click "Create Identity" → "Email Address"
4. Enter your business email (e.g., admin@acestonedev.com)
5. Check email and click verification link
6. Wait for "Verified" status

### 3. Replit Secrets Configuration
The following environment variables are already configured in Replit Secrets:
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: AWS region (e.g., us-east-1)
- `SES_FROM_EMAIL`: Verified email for sending (e.g., admin@acestonedev.com)

### 4. Optional Customization
You can override default names using these environment variables:
- `DYNAMODB_LEADS_TABLE`: Custom leads table name
- `DYNAMODB_USERS_TABLE`: Custom users table name  
- `S3_BUCKET_NAME`: Custom S3 bucket name

## Automatic Initialization

When the app starts with AWS credentials, it automatically:
1. ✅ Creates DynamoDB tables if they don't exist
2. ✅ Creates S3 bucket if it doesn't exist  
3. ✅ Creates default admin user (admin/admin123)
4. ✅ Logs initialization status

## Cost Estimation

For a typical contractor business:

**DynamoDB**: ~$1-5/month
- 1,000 leads = ~$0.25
- Read/write operations are minimal

**SES**: ~$1-10/month  
- 100 quote emails = $0.01
- Includes delivery analytics

**S3**: ~$1-20/month
- Depends on photo storage
- 10GB of photos = ~$0.23

**Total**: ~$3-35/month (scales with usage)

## Benefits vs. In-Memory Storage

| Feature | In-Memory | AWS |
|---------|-----------|-----|
| Data Persistence | ❌ Lost on restart | ✅ Permanent |
| Scalability | ❌ Single server | ✅ Auto-scaling |
| Email Automation | ❌ Manual only | ✅ Fully automated |
| Photo Storage | ❌ Not supported | ✅ Secure & scalable |
| Backup/Recovery | ❌ None | ✅ Automatic |
| Multi-region | ❌ No | ✅ Available |
| Cost | ✅ Free | 💰 Pay-per-use |

## Monitoring & Management

### AWS Console Access
- **DynamoDB**: View/edit leads and users directly
- **SES**: Monitor email delivery rates and bounces  
- **S3**: Browse uploaded customer photos
- **CloudWatch**: View usage metrics and logs

### Application Logs
The app logs AWS operations for debugging:
- Table creation status
- Email sending results  
- S3 upload confirmations
- Error details with stack traces

## Production Deployment

When ready for production:
1. ✅ AWS infrastructure is already configured
2. ✅ Email automation is working
3. ✅ Data persistence is enabled
4. ✅ Webhook endpoints are ready for Angi/HomeAdvisor

Your contractor app is now enterprise-ready with professional email automation and scalable cloud infrastructure!

## Support

For issues:
1. Check application logs in Replit
2. Verify AWS credentials in Secrets
3. Confirm SES email verification status
4. Review IAM permissions in AWS Console