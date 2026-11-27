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

# Magic Containers adds a pull zone of its own for the CDN endpoint, mc-<id>, which no resource here declares and no
# destroy removes. The zone above serves the app without it, so the stack deletes it by its Id when it destroys the
# app, or when a new app gives the endpoint a new zone. The stack's runtime has Python and no shell; the key comes
# from the run's environment and stays out of the state.
locals {
  endpoint_zone = bunnynet_compute_container_app.frps.container[0].endpoint[0].cdn[0].pullzone_id
}

resource "terraform_data" "endpoint_zone" {
  input            = local.endpoint_zone
  triggers_replace = local.endpoint_zone

  provisioner "local-exec" {
    when        = destroy
    interpreter = ["/usr/local/bin/python3.14", "-c"]
    command     = <<-PY
      import os, urllib.error, urllib.request
      zone = urllib.request.Request("https://api.bunny.net/pullzone/${self.input}", method="DELETE",
                                    headers={"AccessKey": os.environ["BUNNYNET_API_KEY"]})
      try:
          urllib.request.urlopen(zone, timeout=30)
      except urllib.error.HTTPError as e:
          if e.code != 404:
              raise
    PY
  }
}
