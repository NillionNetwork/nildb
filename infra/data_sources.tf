data "aws_caller_identity" "current" {}

data "aws_iam_role" "terraform" {
  name = "Terraform"
}

data "secrets_var_file_decrypt" "secrets" {
  password = var.secrets_master_password
  var_file = file("${var.repo_root}/secrets/${var.env_name}.tfvars")
}

data "terraform_remote_state" "baseline" {
  backend = "s3"
  config = {
    bucket = var.s3_tfstate_bucket
    key    = "intra-infra/app-cluster/${var.env_name}/baseline/terraform.tfstate"
    region = var.s3_tfstate_region
  }

  defaults = {
    bastion_sg         = ""
    key_name           = ""
    private_subnet_ids = []
    public_subnet_ids  = []
    vpc_id             = ""
  }
}

data "terraform_remote_state" "cluster" {
  backend = "s3"
  config = {
    bucket = var.s3_tfstate_bucket
    key    = "intra-infra/app-cluster/${var.env_name}/main/terraform.tfstate"
    region = var.s3_tfstate_region
  }

  defaults = {
    capacity_provider_name        = ""
    cluster_id                    = ""
    cluster_lb_certificate_arn    = ""
    cluster_lb_certificate_domain = ""
    cluster_log_group_name        = ""
    cluster_name                  = ""
    cluster_vpc_id                = ""
    compute_security_group_id     = ""
  }
}

