output "pullzone_host" {
  value = "${var.name}.b-cdn.net"
}

output "frp_token" {
  value     = random_password.frp_token.result
  sensitive = true
}
