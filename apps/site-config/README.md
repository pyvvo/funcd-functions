# site-config

One frontend build, deployed to several environments, each with its own configuration (funcd ADR-0239). funcd's
`app-todo` lane deploys it into namespaces `staging` and `prod`.

The Site sets `runtimeConfig`, so funcd serves a generated `config.json` beside the bundle: the keys of
`runtimeConfig.values` and of the ConfigMap it names, as one JSON object of strings. The app fetches it before it
starts. The bundle never changes between environments; only the values file does.

| Path | What |
|---|---|
| `web/` | The prebuilt app: `index.html` and `app.js`, which fetches `config.json` and shows `API_URL` and `NEW_DASHBOARD` |
| `app/app.yaml` | The template: the `web` image and the values schema (`host`, `api.url`, `newDashboard`) |
| `app/resources/site.yaml` | The Site, with `runtimeConfig.values.API_URL` from `values.api.url` and the flags ConfigMap |
| `app/resources/flags.yaml` | The App's ConfigMap `<app>-flags`, with `NEW_DASHBOARD` from `values.newDashboard` |
| `values/staging.yaml`, `values/prod.yaml` | One host and one API address per environment |
| `values/new-dashboard.yaml` | Turns the flag on |
| `values/e2e.yaml` | The lane's registry |
| `sites/preview.yaml` | The same build as a standalone Site at the path `/preview`, which the lane deploys beside the App |

## One build at any path

The Site sets `ingress.baseHref: true`, so funcd serves its index with the Site's mount as `<base href>`: `/` on
a host, `/preview/` at the path `/preview`. The app uses relative URLs only (`app.js`, `config.json`), so the same build
runs at any path, deep links such as `/preview/vehicles/42` included. With a bundler, build with relative URLs (Vite
`base: './'`) and read the base from the document:

```js
const config = await (await fetch(new URL('config.json', document.baseURI))).json();
const basename = new URL(document.baseURI).pathname; // the router's basename
```

An Angular app reads `<base href>` already.

## Deploy

Deploy one environment:

```bash
funcdctl app deploy <registry>/site-config:1.0.0 --name site-config -n staging -f values/staging.yaml
```

`config.json` is public, like every file of the Site: never put a secret in it.
