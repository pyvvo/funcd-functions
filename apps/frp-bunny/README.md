# frp-bunny

An App that gives a funcd namespace's host a public HTTPS name with no inbound port. frps runs on Bunny Magic
Containers behind a pull zone, and frpc runs in funcd as a Tunnel add-on engine that dials it over wss. Its path is
funcd's experiment 0027, path C.

## Parts

- `infra/bunny`: the OpenTofu module that creates frps and its pull zone. Its outputs are the pull zone's host and
  the frp token, from `random_password`, which is sensitive.
- The stack applies the module through an InfraStack object and its Job, on the add-on's OpenTofu runtime, and keeps
  the token in a Secret that the stack's Job owns.
- The Tunnel object (pyvvo/funcd-addons `tunnel`) reads that Secret and the pull zone's host.
- An EgressPolicy names the Tunnel, so its engine may dial the pull zone.

## Status

Draft, 2026-11-24: the module only. The App's manifests follow once the InfraStack and Tunnel add-ons are released.
Applying the module creates paid Bunny resources, about $0.47 a month for path C; nothing here applies it.
