# ============================================================
# Acestone Development — Terraform Outputs
# ============================================================

output "dynamodb_leads_table_name" {
  description = "Name of the DynamoDB leads table"
  value       = aws_dynamodb_table.leads.name
}

output "dynamodb_leads_table_arn" {
  description = "ARN of the DynamoDB leads table"
  value       = aws_dynamodb_table.leads.arn
}

output "dynamodb_users_table_name" {
  description = "Name of the DynamoDB users table"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_users_table_arn" {
  description = "ARN of the DynamoDB users table"
  value       = aws_dynamodb_table.users.arn
}

output "s3_bucket_name" {
  description = "Name of the S3 uploads bucket"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 uploads bucket"
  value       = aws_s3_bucket.uploads.arn
}

output "ses_sender_identity_arn" {
  description = "ARN of the SES sender email identity"
  value       = aws_ses_email_identity.sender.arn
}

output "ses_admin_identity_arn" {
  description = "ARN of the SES admin email identity"
  value       = aws_ses_email_identity.admin.arn
}

output "ses_sender_email" {
  description = "SES sender email address"
  value       = aws_ses_email_identity.sender.email
}

output "ses_admin_email" {
  description = "SES admin email address"
  value       = aws_ses_email_identity.admin.email
}

output "iam_role_arn" {
  description = "ARN of the application IAM role"
  value       = aws_iam_role.app_role.arn
}

# output "amplify_app_id" {
#   description = "Amplify application ID"
#   value       = aws_amplify_app.acestone.id
# }
#
# output "amplify_default_domain" {
#   description = "Amplify default domain URL"
#   value       = aws_amplify_app.acestone.default_domain
# }
#
# output "amplify_branch_url" {
#   description = "Amplify branch deployment URL"
#   value       = "https://${aws_amplify_branch.release.branch_name}.${aws_amplify_app.acestone.default_domain}"
# }
