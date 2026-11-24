variable "name" {
  type        = string
  description = "Name of the Magic Containers app and of its pull zone, whose host is <name>.b-cdn.net."
}

variable "region" {
  type    = string
  default = "DE"
}

variable "image_registry" {
  type        = number
  description = "Id of the account's public Docker Hub registry in Magic Containers."
}

variable "frps_tag" {
  type    = string
  default = "v0.72.0"
}

variable "frps_digest" {
  type        = string
  description = "The linux/amd64 digest of frps_tag, the only platform Magic Containers runs."
}
