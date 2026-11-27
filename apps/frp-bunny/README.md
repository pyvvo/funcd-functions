# frp-bunny

An App that gives a funcd host a public HTTPS name with no inbound port. frps runs on Bunny Magic Containers behind a
pull zone, `<name>.b-cdn.net`, and frpc runs in funcd as a Tunnel engine (pyvvo/funcd-addons `tunnel`) that dials it
over wss. frpc hands each request to funcd's edge with the App's host, where the App's Site serves a page at `/` and
its hello Function answers at `/api`. Its path is funcd's experiment 0027, path C. The InfraStack add-on
(pyvvo/funcd-addons `infrastack`) applies the Bunny side through an OpenTofu run that a person approves, and destroys
it the same way when the App goes.

It needs funcd v0.49.0 or later, with the [features](docs/server-config.md#the-funcd-features) that it builds on, and
pyvvo/funcd-addons v0.8.0 or later. [Deploy](#deploy) runs it on Bunny.

## Parts

The App's [parts](docs/parts.md) are the stack `<app>-stack`, an InfraStack with its Job; the Function `<app>-hello`;
the Site `<app>-web`; and the Tunnel `<app>-tunnel`.

## Prerequisites

- A funcd on Linux with containerd and these keys in its config file, each for a
  [reason](docs/server-config.md#the-config-keys):

  ```yaml
  runtime:
    mode: containerd
  server:
    dataPlaneAddr: 0.0.0.0:8081
    network:
      egress: true
      egressGatewayPort: 15080
      dnsForwarderPort: 15053
      dnsResolver: 1.1.1.1:53
      internalAllow:
        - 10.63.0.1:9000
    trustedProxies:
      - addonKinds:
          - Tunnel
        header: X-Real-IP
  s3gateway:
    enabled: true
    listenAddr: 0.0.0.0:9000
  addons:
    registries:
      - ghcr.io
  ```

- The InfraStack and Tunnel Addons, which an admin registers from a pyvvo/funcd-addons release:

  ```sh
  curl -fsSL https://github.com/pyvvo/funcd-addons/releases/download/v0.5.1/infrastack.yaml | funcdctl apply -f -
  curl -fsSL https://github.com/pyvvo/funcd-addons/releases/download/v0.5.1/tunnel.yaml | funcdctl apply -f -
  ```

- A registry for the App's images, Node.js with npm to build the page, and a pyvvo/funcd-addons checkout for the
  InfraStack Function.
- A Bunny account: its API key, and the Id of its public Docker Hub registry in Magic Containers, which
  `values/bunny.yaml` takes as `imageRegistry`. Applying the module creates paid Bunny resources, about $0.47 a month.

## Deploy

1. Set `registry`, `name` and `imageRegistry` in `values/bunny.yaml`, and put that name in place of
   `frp-bunny-example` in `egress.yaml`.
2. Write the Secrets: put the API key in base64 in `secrets.yaml`, then apply it. The App is named `frp-bunny`, so
   its outputs Secret is `frp-bunny-outputs`, which the Job `frp-bunny-stack` owns.

   ```sh
   funcdctl apply -f secrets.yaml
   ```

3. Push the images and the template. The module goes through the InfraStack add-on's plugin, `funcdctl-infra` from
   the same release, on PATH. The plugin locks the module's providers for linux/amd64 and linux/arm64, writes the lock
   file into the folder, and pushes the module with its providers and a contract that it writes from the module's
   variables and outputs. The page is a Vite project: its build writes it into `web/dist`, which
   `funcdctl push --site` packs.

   ```sh
   funcdctl infra push infra/bunny <registry>/frp-bunny-module:0.1.0
   funcdctl push hello/hello.mjs <registry>/frp-bunny-hello:0.1.0
   (cd web && npm ci && npm run build)
   funcdctl push --site web/dist <registry>/frp-bunny-web:0.1.0
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

   The run applies the plan. The stack turns Ready, `frp-bunny-outputs` gets `pullzone_host` and `FRP_TOKEN`, and the
   Tunnel's engine restarts with the token and logs in to frps. `funcdctl infra outputs frp-bunny-stack` shows the
   outputs, `FRP_TOKEN` as `(sensitive)`.

6. Open `https://<name>.b-cdn.net/` in a browser; Magic Containers may take a minute to start frps. The page fetches
   `/api` and shows the hello Function's answer, `hello from frp-bunny, through hello.frp.test`: the Host that
   reached funcd is the one that the Tunnel rewrote. The Function also answers on its own:

   ```sh
   curl https://<name>.b-cdn.net/api
   ```

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

## Lanes

`infra/fake` has the module's variables and outputs and creates only its token, so the App runs with no Bunny account
against a local frps. pyvvo/funcd-addons' `addon-frp-bunny` lane runs it that way, with `values/lane.yaml`.
`infra/bunny/bunny.contract.yaml` is the contract that `funcdctl infra push` writes, so pushing the folder by hand,
`funcdctl push infra/bunny <ref> --entry main.tf`, also works, and the lanes push `infra/fake` that way.
