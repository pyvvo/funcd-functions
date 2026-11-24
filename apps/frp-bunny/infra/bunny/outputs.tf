output "pullzone_host" {
  value = "${var.name}.b-cdn.net"
}

output "FRP_TOKEN" {
  value     = random_password.frp_token.result
  sensitive = true
}
