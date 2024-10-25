variable "nildb_allow_cidrs" {
  description = "Allowed CIDRs for the nil-db service"
  default = ["0.0.0.0/0"]
  type = list(string)
}

variable "nildb_cpu" {
  description = "CPU allocation for the nil-db service task"
  default = 256
  type = number
}

variable "nildb_desired_count" {
  description = "Desired count for the nil-db service task"
  default = 1
  type = number
}

variable "nildb_image" {
  description = "Container image for the nil-db service task"
  default = "592920173613.dkr.ecr.eu-west-1.amazonaws.com/datablocks-api"
  type = string
}

variable "nildb_image_tag" {
  description = "Tag of the container image for the nil-db service task"
  default = "0.1.0-rc.0"
  type = string
}

variable "nildb_mem" {
  description = "Memory allocation for the nil-db service task"
  default = 512
  type = number
}
