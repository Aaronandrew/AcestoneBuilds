# ============================================================
# Acestone Development — AWS Infrastructure (Terraform)
# ============================================================
# Provisions: DynamoDB tables, S3 bucket, SES identity,
#             IAM role/policy, and Amplify hosting.
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key

  default_tags {
    tags = {
      Project     = "AcestoneDevelopment"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================================
# DynamoDB — Leads Table
# ============================================================
resource "aws_dynamodb_table" "leads" {
  name         = var.dynamodb_leads_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "status-createdAt-index"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = var.dynamodb_leads_table
  }
}

# ============================================================
# DynamoDB — Users Table
# ============================================================
resource "aws_dynamodb_table" "users" {
  name         = var.dynamodb_users_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  tags = {
    Name = var.dynamodb_users_table
  }
}

# ============================================================
# S3 — Photo Uploads Bucket
# ============================================================
resource "aws_s3_bucket" "uploads" {
  bucket        = var.s3_bucket_name
  force_destroy = false

  tags = {
    Name = var.s3_bucket_name
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# ============================================================
# SES — Email Identity
# ============================================================
resource "aws_ses_email_identity" "sender" {
  email = var.ses_from_email
}

# ============================================================
# IAM — Application Role & Policy
# ============================================================
resource "aws_iam_role" "app_role" {
  name = "acestone-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "amplify.amazonaws.com",
            "lambda.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = {
    Name = "acestone-app-role"
  }
}

resource "aws_iam_role_policy" "app_policy" {
  name = "acestone-app-policy"
  role = aws_iam_role.app_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.leads.arn,
          "${aws_dynamodb_table.leads.arn}/index/*",
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/index/*"
        ]
      },
      {
        Sid    = "SESAccess"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.ses_from_email
          }
        }
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      }
    ]
  })
}

# ============================================================
# Amplify — Hosting & CI/CD
# ============================================================
# NOTE: Amplify resources commented out due to GitHub webhook permission issues.
# Set up Amplify manually via AWS Console for smoother OAuth flow.
#
# resource "aws_amplify_app" "acestone" {
#   name       = "acestone-development"
#   repository = "https://github.com/Aaronandrew/AcestoneBuilds.git"
#   oauth_token = var.github_oauth_token
#
#   build_spec = <<-EOT
#     version: 1
#     frontend:
#       phases:
#         preBuild:
#           commands:
#             - npm ci
#         build:
#           commands:
#             - npm run build
#       artifacts:
#         baseDirectory: dist/public
#         files:
#           - '**/*'
#       cache:
#         paths:
#           - node_modules/**/*
#     backend:
#       phases:
#         build:
#           commands:
#             - npm run build:server
#       artifacts:
#         baseDirectory: dist/server
#         files:
#           - '**/*'
#   EOT
#
#   environment_variables = {
#     APP_REGION             = var.aws_region
#     DYNAMODB_LEADS_TABLE   = var.dynamodb_leads_table
#     DYNAMODB_USERS_TABLE   = var.dynamodb_users_table
#     S3_BUCKET_NAME         = var.s3_bucket_name
#     SES_FROM_EMAIL         = var.ses_from_email
#     NODE_ENV               = "production"
#   }
#
#   iam_service_role_arn = aws_iam_role.app_role.arn
#
#   tags = {
#     Name = "acestone-development"
#   }
# }
#
# resource "aws_amplify_branch" "release" {
#   app_id      = aws_amplify_app.acestone.id
#   branch_name = var.deploy_branch
#
#   environment_variables = {
#     ENVIRONMENT = var.environment
#   }
#
#   tags = {
#     Name = "release-branch"
#   }
# }
