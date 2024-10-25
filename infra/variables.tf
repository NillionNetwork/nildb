variable "aws_region" {
  description = "Region in which resources are deployed"
  type        = string
}

variable "deployment_name" {
  description = "Name of deployment"
  type        = string
}

variable "env_name" {
  description = "Name of environment"
  type        = string
}

variable "name_prefix" {
  description = "Prefix prepended to resource names"
  type        = string
}

variable "repo_root" {
  description = "Path to root of devops repo"
  type        = string
}

variable "s3_tfstate_bucket" {
  default     = "tfstate-nilogy-devops"
  description = "S3 bucket in which Terraform state is stored"
  type        = string
}

variable "s3_tfstate_region" {
  default     = "eu-west-1"
  description = "Region of S3 bucket in which Terraform state is stored"
  type        = string
}

variable "secrets_recovery_window_in_days" {
  default     = 30
  description = "Number of days that AWS Secrets Manager waits before it can delete the secret"
  type        = number
}

variable "secrets_master_password" {
  description = "Secret to decrypt secrets"
  type        = string
}

variable "zone_name" {
  default     = "nilogy.xyz"
  description = "Name of zone where DNS records and certificates are created"
  type        = string
}
