# frp-bunny

An App that gives a funcd host a public HTTPS name with no inbound port. frps runs on Bunny Magic Containers behind a
pull zone, `<name>.b-cdn.net`, and frpc runs in funcd as a Tunnel engine (pyvvo/funcd-addons `tunnel`) that dials it
over wss, then hands each request to funcd's edge with the host of the App's hello Function. Its path is funcd's
experiment 0027, path C. The InfraStack add-on (pyvvo/funcd-addons `infrastack`) applies the Bunny side through an
OpenTofu run that a person approves, and destroys it the same way when the App goes.

```text
apps/frp-bunny/
├── README.md
├── app/
│   ├── app.yaml
│   └── resources/
│       ├── stack.yaml
│       └── tunnel.yaml
├── egress.yaml
├── hello/
│   ├── hello.contract.yaml
│   └── hello.mjs
├── infra/
│   ├── bunny/
│   │   ├── bunny.contract.yaml
│   │   ├── main.tf
│   │   ├── outputs.tf
│   │   └── variables.tf
│   └── fake/
│       ├── fake.contract.yaml
│       └── main.tf
├── secrets.yaml
└── values/
    ├── bunny.yaml
    └── lane.yaml
```

## Parts

| Part | What it is |
|---|---|
| `<app>-stack`, an InfraStack | the Bunny module `infra/bunny`: frps on Magic Containers and the pull zone in front of it, with `deletion: delete` |
| `<app>-stack`, a Job | the module on the add-on's OpenTofu runtime; its state lives in the Bucket `<app>-state`, and it writes the sensitive output `FRP_TOKEN` into the Secret `<app>-outputs` |
| `<app>-reconciler`, a Function | the InfraStack Function, which starts the stack's runs through its binding of the Job |
| `<app>-hello`, a Function | answers HTTP on the host `values.host` |
| `<app>-tunnel`, a Tunnel | frpc, with frps at `<name>.b-cdn.net:443` over wss, `FRP_TOKEN` from `<app>-outputs`, the public host `<name>.b-cdn.net`, and the edge at `values.edge` with the Host rewritten to `values.host` |

`infra/fake` has the module's variables and outputs and creates only its token, so the App runs with no Bunny account
against a local frps: funcd's `addon-frp-bunny` lane runs it that way, with `values/lane.yaml`.

## Before you start

- A funcd on containerd with `s3gateway.enabled: true` (the stack's state), `addons.registries` listing `ghcr.io`
  (the add-ons' images), and `server.dataPlaneAddr` on an address the Tunnel's engine reaches, such as
  `0.0.0.0:8081`: `values.edge` is the bridge address and that port, `10.63.0.1:8081` by default.
- The InfraStack and Tunnel Addons, which an admin registers from a pyvvo/funcd-addons release:

  ```sh
  curl -fsSL https://github.com/pyvvo/funcd-addons/releases/download/<version>/infrastack.yaml | funcdctl apply -f -
  curl -fsSL https://github.com/pyvvo/funcd-addons/releases/download/<version>/tunnel.yaml | funcdctl apply -f -
  ```

- A registry for the App's images, and a pyvvo/funcd-addons checkout for the InfraStack Function.
- A Bunny account: its API key, and the Id of its public Docker Hub registry in Magic Containers, which
  `values/bunny.yaml` takes as `imageRegistry`. Applying the module creates paid Bunny resources, about $0.47 a month.

## Deploy

1. Set `registry`, `name` and `imageRegistry` in `values/bunny.yaml`, and `<name>` in `egress.yaml`.
2. Write the Secrets: put the API key in base64 in `secrets.yaml`, then apply it. The App is named `frp-bunny`, so its
   outputs Secret is `frp-bunny-outputs`, which the Job `frp-bunny-stack` owns.

   ```sh
   funcdctl apply -f secrets.yaml
   ```

3. Push the images and the template:

   ```sh
   funcdctl push infra/bunny <registry>/frp-bunny-module:0.1.0 --entry main.tf
   funcdctl push hello/hello.mjs <registry>/frp-bunny-hello:0.1.0
   funcdctl push <funcd-addons>/infrastack/reconciler/infrastack-reconciler.mjs <registry>/infrastack-reconciler:0.1.0
   funcdctl app lock app -f values/bunny.yaml
   funcdctl push --template app <registry>/frp-bunny:0.1.0
   ```

4. Let the stack's Job reach Bunny's API and the Tunnel dial the pull zone, then deploy:

   ```sh
   funcdctl apply -f egress.yaml
   funcdctl app deploy <registry>/frp-bunny:0.1.0 -f values/bunny.yaml --name frp-bunny --no-wait
   ```

5. Approve the stack's run. Its preview is OpenTofu's plan, three resources to add: the token, frps' container app
   and its pull zone. The stack's status names the run:

   ```sh
   funcdctl get infrastack frp-bunny-stack -o json
   funcdctl job describe <run>
   funcdctl job approve <run>
   ```

   The run applies the plan. The stack turns Ready, `frp-bunny-outputs` gets `FRP_TOKEN`, and the Tunnel's engine
   restarts with it and logs in to frps.

6. Call the public name. Magic Containers may take a minute to start frps:

   ```sh
   curl https://<name>.b-cdn.net/
   ```

   It answers `hello from frp-bunny, …`.

## Destroy

1. Delete the App. Its stack stays, deleting, and its other parts wait for it:

   ```sh
   funcdctl app delete frp-bunny --no-wait
   ```

2. Approve the destroy run, `frp-bunny-stack-d<generation>-<uid>`, which the stack's status names; its preview
   destroys the three. The stack goes once the run succeeded, then the App's other parts.
3. Magic Containers adds a pull zone of its own for the container's CDN endpoint, named `mc-<id>`, which the module
   does not manage: delete it in Bunny's dashboard.
4. The Bucket `frp-bunny-state` keeps the emptied state. Delete it, the Secrets and the EgressPolicies when nothing
   else uses them.
