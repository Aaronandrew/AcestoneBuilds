# ============================================================
# Acestone Development — Terraform Variables
# ============================================================

# --- AWS Credentials (loaded from terraform.tfvars, never committed) ---

variable "aws_access_key_id" {
  description = "AWS IAM access key ID"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS IAM secret access key"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID (12-digit)"
  type        = string
}

# --- Environment ---

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

# --- DynamoDB ---

variable "dynamodb_leads_table" {
  description = "Name of the DynamoDB leads table"
  type        = string
  default     = "acestone-leads"
}

variable "dynamodb_users_table" {
  description = "Name of the DynamoDB users table"
  type        = string
  default     = "acestone-users"
}

# --- S3 ---

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for photo uploads"
  type        = string
  default     = "acestone-uploads"
}

variable "cors_allowed_origins" {
  description = "Allowed origins for S3 CORS (your app domains)"
  type        = list(string)
  default     = ["*"]
}

# --- SES ---

variable "ses_from_email" {
  description = "Verified SES sender email address"
  type        = string
  default     = "no-reply@acestonedev.com"
}

# --- Amplify / GitHub ---

variable "github_repository" {
  description = "GitHub repository URL for Amplify CI/CD"
  type        = string
  default     = "https://github.com/Aaronandrew/AcestoneBuilds"
}

variable "deploy_branch" {
  description = "Git branch for Amplify deployment"
  type        = string
  default     = "release-1.0.0"
}
