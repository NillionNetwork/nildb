locals {
  nildb_port = 8080

  tasks = [{
    name          = "nil-db"
    desired_count = var.nildb_desired_count
    cpu           = var.nildb_cpu
    memory        = var.nildb_mem

    containers = [
      {
        name   = "nil-db"
        image  = "${var.nildb_image}:${var.nildb_image_tag}"
        cpu    = var.nildb_cpu
        memory = var.nildb_mem
        environment = [
          { name = "APP_ENV", value = "prod" },
          { name = "APP_PORT", value = local.nildb_port },
          { name = "APP_LOG_LEVEL", value = "debug" },
        ]
	secrets = [
	  { name = "APP_DB_URI", value = data.secrets_var_file_decrypt.secrets.values["nildb_db_uri"]},
	  { name = "APP_JWT_SECRET", value = data.secrets_var_file_decrypt.secrets.values["nildb_jwt_secret"]},
	]
	port_mappings = [{
	  container_port = local.nildb_port
	}]
      }
    ]

    ingress = [
      {
        allow_cidrs           = var.nildb_allow_cidrs
        container_name        = "nil-db"
        container_port        = local.nildb_port
        health_check_interval = 30
        health_check_path     = "/health"
        health_check_timeout  = 5
        id                    = "nil-db"
        internal              = false
      }
    ]
  }]
}
