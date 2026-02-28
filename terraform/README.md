# Terraform — AWS Infrastructure

> Provisions all AWS resources for the Acestone Development system.

## Resources Created

| Resource                | Service   | Description                              |
|-------------------------|-----------|------------------------------------------|
| `acestone-leads`        | DynamoDB  | Leads table with status/date GSI         |
| `acestone-users`        | DynamoDB  | Users table with username GSI            |
| `acestone-uploads`      | S3        | Photo uploads bucket (encrypted, private)|
| SES email identity      | SES       | Verified sender for automated emails     |
| `acestone-app-role`     | IAM       | App role with scoped DynamoDB/S3/SES     |
| `acestone-development`  | Amplify   | Hosting + CI/CD from GitHub              |

## Quick Start

```bash
# 1. Copy the secrets template
cp terraform.tfvars.example terraform.tfvars

# 2. Edit terraform.tfvars with your actual AWS credentials

# 3. Initialize Terraform
terraform init

# 4. Preview what will be created
terraform plan

# 5. Apply the infrastructure
terraform apply
```

## File Structure

```
terraform/
├── main.tf                  # All resource definitions
├── variables.tf             # Variable declarations with defaults
├── outputs.tf               # Output values after apply
├── terraform.tfvars         # YOUR SECRETS (gitignored)
├── terraform.tfvars.example # Safe template (committed)
└── README.md                # This file
```

## Security

- `terraform.tfvars` is **gitignored** — never committed
- AWS credentials are marked `sensitive` in variables
- S3 bucket is **private** with public access blocked
- IAM policy is **least-privilege** scoped to specific resources
- SES sending is restricted to the verified sender address

## After `terraform apply`

Terraform will output:
- DynamoDB table names and ARNs
- S3 bucket name and ARN
- IAM role ARN
- Amplify app URL

## Destroying Resources

```bash
terraform destroy
```
