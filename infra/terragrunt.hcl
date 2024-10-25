locals {
  deployment_name = "nil-db"
  region = "eu-west-1"
  env_name = get_env("ENV_NAME", "sandbox")

  aws_root_account = {
    aws_account_id = "592920173613"
    state_bucket = "tfstate-nilogy-devops"
  }

  envs = {
    sandbox = {
      aws_account_id = "767397865113"
      state_bucket = "nillion-sandbox-tfstate"
    }
    trying-branch = local.aws_root_account
    staging-branch = local.aws_root_account
    master-branch = local.aws_root_account
  }
}

iam_role = "arn:aws:iam::${local.envs[local.env_name].aws_account_id}:role/Terraform"

remote_state {
  backend = "s3"

  config = {
    bucket                = local.envs[local.env_name].state_bucket
    disable_bucket_update = true
    key                   = "intra-infra/${local.deployment_name}/${local.env_name}/${path_relative_to_include()}/terraform.tfstate"
    region                = local.region
  }

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
  provider "aws" {
    region = var.aws_region

    default_tags {
      tags = {
        Environment = var.env_name
        Deployment  = var.deployment_name
        ManagedBy  = "terragrunt"
      }
    }
  }

  provider "secrets" {}
  EOF
}

generate "versions" {
  path      = "versions_override.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
  terraform {
    required_providers {
      aws = {
        version = "5.53.0"
      }
      secrets = {
        source  = "terraform.local/Sedicii/secrets"
        version = "0.2.0"
      }
    }
  }
  EOF
}

terraform {
  source = "."

  extra_arguments "vars" {
    commands = get_terraform_commands_that_need_vars()

    required_var_files = [
      "${get_parent_terragrunt_dir()}/envs/${local.env_name}.tfvars"
    ]
  }
}

inputs = {
  env_name = local.env_name
  deployment_name = local.deployment_name
  name_prefix = "${local.deployment_name}-${local.env_name}"
  aws_region = local.region
  s3_tfstate_bucket = local.envs[local.env_name].state_bucket
  s3_tfstate_region = local.region
  repo_root = get_parent_terragrunt_dir()
}
