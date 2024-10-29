module "services" {
  # TODO: drop `ref` once merged
  source = "git::git@github.com:NillionNetwork/devops.git//terraform_modules/ecs_service?ref=feat/990-ecs_service_module"

  deployment_name                 = var.deployment_name
  env_name                        = var.env_name
  name_prefix                     = var.name_prefix
  secrets_recovery_window_in_days = var.secrets_recovery_window_in_days
  zone_name                       = var.zone_name
  tasks                           = local.tasks
  capacity_provider_name          = data.terraform_remote_state.cluster.outputs.capacity_provider_name
  ecs_cluster_id                  = data.terraform_remote_state.cluster.outputs.cluster_id
  ecs_cluster_name                = data.terraform_remote_state.cluster.outputs.cluster_name
  ecs_cluster_log_group_name      = data.terraform_remote_state.cluster.outputs.cluster_log_group_name
  ecs_cluster_vpc_id              = data.terraform_remote_state.cluster.outputs.cluster_vpc_id
  public_subnet_ids               = data.terraform_remote_state.baseline.outputs.public_subnet_ids
  service_lb_apex_domain          = data.terraform_remote_state.cluster.outputs.cluster_lb_certificate_domain
  service_lb_certificate_arn      = data.terraform_remote_state.cluster.outputs.cluster_lb_certificate_arn

  ecs_cluster_compute_security_group_id = data.terraform_remote_state.cluster.outputs.compute_security_group_id
}

module "github_oidc" {
  # TODO: drop `ref` once merged
  source = "git::git@github.com:NillionNetwork/devops.git//terraform_modules/aws_github_oidc_access?ref=feat/1018-github_aws_oidc"

  prefix = var.name_prefix
  iam_role_name = "nil-db"
  iam_assumable_role_arns = [data.aws_iam_role.terraform.arn]
  repositories = ["NillionNetwork/nil-db"]
}
