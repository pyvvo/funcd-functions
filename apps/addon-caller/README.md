# addon-caller

A Function that calls an add-on object's engine through funcd (funcd ADR-0338). funcd's `addon-rauthy-signin` lane
pushes it and applies it beside the add-on object `echo`, a traefik/whoami engine that answers the headers it gets.

| Path | What |
|---|---|
| `caller/addon-caller.mjs` | The function: it calls `echo` through `ctx.addon.fetch` and through the add-on proxy at `FUNCD_ADDON_ECHO_URL` with `FUNCD_ADDON_ECHO_TOKEN`, each with an `X-Lane` header, asks for `/private`, which the object's Addon keeps private, and dials the engine's own address, which the input names |
| `caller/addon-caller.contract.yaml` | Its contract: any JSON in and out |
| `fixtures/addon-caller.yaml` | The Function, which binds `echo` as `echo`, from the image the lane pushes |

The answer holds each call's status and body, the private path's status, and `refused` when the dial fails.
