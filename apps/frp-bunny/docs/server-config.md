# What frp-bunny needs of funcd

The funcd features that the App builds on, and why its server's config file sets each key that the
[README](../README.md#prerequisites) lists.

## The funcd features

funcd v0.49.0 or later has each of them:

- Jobs and their approval
  ([ADR-0347](https://github.com/pyvvo/funcd/blob/main/docs/adr/0347-a-job-runs-its-handler-once-per-jobrun-in-a-worker-of-its-own.md)
  to [ADR-0351](https://github.com/pyvvo/funcd/blob/main/docs/adr/0351-a-jobs-worker-reaches-the-platform-as-the-job-its-own-principal.md)).
- Add-on runtimes and engineless kinds
  ([ADR-0344](https://github.com/pyvvo/funcd/blob/main/docs/adr/0344-an-add-on-ships-runtimes-and-its-kind-runs-on-one-of-them.md),
  [ADR-0345](https://github.com/pyvvo/funcd/blob/main/docs/adr/0345-a-function-reconciles-an-engineless-kind-and-a-deletion-waits-for-its-destroy.md)).
- The edge behind a tunnel
  ([ADR-0352](https://github.com/pyvvo/funcd/blob/main/docs/adr/0352-an-egresspolicy-names-an-add-on-object-whose-engine-it-lets-out.md)
  to [ADR-0354](https://github.com/pyvvo/funcd/blob/main/docs/adr/0354-the-edge-takes-the-client-address-from-a-proxy-it-trusts.md)).
- Stacks in Apps
  ([ADR-0357](https://github.com/pyvvo/funcd/blob/main/docs/adr/0357-an-app-never-waits-for-its-stacks-and-a-part-waits-for-their-outputs.md)).

## The config keys

- `server.network.egress`: an add-on's engine leaves its fence only through the egress gateway, under an
  EgressPolicy that names its object (funcd ADR-0352). The edge then listens on the bridge address too, which workers
  reach directly (ADR-0353). `values.edgeAddress` is that bridge address, `10.63.0.1` by default.
- `server.dataPlaneAddr` with a fixed port, which `values.edgePort` names, `8081` by default: port 0 changes at each
  start (ADR-0353 Decision 1).
- `server.trustedProxies`: the edge takes the visitor's address from `X-Real-IP`, which Bunny's pull zone sets to the
  visitor and frps passes on, not from the engine's own address. `X-Forwarded-For` would not do: frps appends Bunny's
  edge address to it, which no `cidrs` entry names (ADR-0354 Decisions 1 and 2).
- `server.network.internalAllow` with the S3 gateway on the bridge address, `s3gateway.listenAddr`'s port there, so
  that the stack's Job reaches its state directly: with egress on, nothing else passes the gateway unnamed.
- `s3gateway.enabled` for the stack's state, and `addons.registries` for the add-ons' images.
