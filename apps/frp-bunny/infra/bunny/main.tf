terraform {
  required_providers {
    bunnynet = {
      source  = "bunnyway/bunnynet"
      version = "0.20.2"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
  }
}

resource "random_password" "frp_token" {
  length  = 32
  special = false
}

# frps takes frpc's control connection and the visitors' HTTP on one port, behind a CDN endpoint; Magic Containers
# splits arguments on commas.
resource "bunnynet_compute_container_app" "frps" {
  version          = 2
  name             = var.name
  regions_required = [var.region]
  regions_allowed  = [var.region]
  autoscaling_min  = 1
  autoscaling_max  = 1

  container {
    name            = "frps"
    image_registry  = var.image_registry
    image_namespace = "fatedier"
    image_name      = "frps"
    image_tag       = var.frps_tag
    image_digest    = var.frps_digest
    arguments       = join(", ", ["--bind-port=7000", "--vhost-http-port=7000", "--token=${random_password.frp_token.result}"])

    endpoint {
      name = "web"
      type = "CDN"

      cdn {
        origin_ssl = false
      }

      port {
        container = 7000
      }
    }
  }
}

# The pull zone in front of the CDN endpoint: frpc dials it over wss, and visitors reach the app's host through it.
resource "bunnynet_pullzone" "frps" {
  name = var.name

  origin {
    type                  = "ComputeContainer"
    container_app_id      = bunnynet_compute_container_app.frps.id
    container_endpoint_id = bunnynet_compute_container_app.frps.container[0].endpoint[0].id
    forward_host_header   = true
  }

  cache_enabled      = false
  websockets_enabled = true

  routing {
    tier = "Standard"
  }
}
