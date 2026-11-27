# The parts of frp-bunny

What each object of the App is, and the files that declare it.

## Parts

| Part | What it is |
|---|---|
| `<app>-stack`, an InfraStack | the Bunny module `infra/bunny`: frps on Magic Containers and the pull zone in front of it, with `deletion: delete`; it binds its Job as `stack`, for the Function that funcd creates from the add-on's image (funcd ADR-0358) |
| `<app>-stack`, a Job | the module on the add-on's OpenTofu runtime; its state lives in the Bucket `<app>-state`, and it writes the sensitive output `FRP_TOKEN` into the Secret `<app>-outputs` |
| `<app>-hello`, a Function | answers HTTP at `/api` on the host `values.host`, naming the Host it got |
| `<app>-web`, a Site | the page `web/` at `/` on the host `values.host`, open to anyone, which shows the answer of `/api`; it serves from the prefix `web` of the Bucket `<app>-web`, which the App declares with `deletion: delete`, so each install materializes the page again |
| `<app>-tunnel`, a Tunnel | frpc, with frps at `<name>.b-cdn.net:443` over wss, `FRP_TOKEN` from `<app>-outputs`, the public host `<name>.b-cdn.net`, and the edge at `values.edgeAddress` and `values.edgePort` with the Host rewritten to `values.host` |

## Files

```text
apps/frp-bunny/
├── README.md
├── app/
│   ├── app.yaml
│   └── resources/
│       ├── stack.yaml
│       ├── tunnel.yaml
│       └── web.yaml
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
├── values/
│   ├── bunny.yaml
│   └── lane.yaml
└── web/
    ├── index.html
    ├── package-lock.json
    ├── package.json
    ├── src/
    │   ├── main.ts
    │   └── style.css
    ├── tsconfig.json
    └── vite.config.ts
```
