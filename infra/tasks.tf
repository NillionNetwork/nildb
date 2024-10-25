locals {
  tasks = [{
    name          = "nildb-test"
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
          { name = "APP_PORT", value = "8080" },
        ]
	port_mappings = [{
	  container_port = 8080
	}]
      }
    ]

    ingress = [
      {
        allow_cidrs           = var.nildb_allow_cidrs
        container_name        = "nil-db"
        container_port        = 8080
        health_check_interval = 30
        health_check_path     = "/health"
        health_check_timeout  = 5
        id                    = "nil-db"
        internal              = false
      }
    ]
  }]
}
