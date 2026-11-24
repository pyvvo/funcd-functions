# A stand-in for infra/bunny that creates nothing outside OpenTofu's state: the same variables and outputs, its token
# from random_password, so the App runs with no Bunny account and no spend, against a local frps.
terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
  }
}

variable "name" {
  type = string
}

variable "region" {
  type    = string
  default = "DE"
}

variable "image_registry" {
  type = number
}

variable "frps_tag" {
  type    = string
  default = "v0.72.0"
}

variable "frps_digest" {
  type = string
}

resource "random_password" "frp_token" {
  length  = 32
  special = false
}

output "pullzone_host" {
  value = "${var.name}.b-cdn.net"
}

output "FRP_TOKEN" {
  value     = random_password.frp_token.result
  sensitive = true
}
