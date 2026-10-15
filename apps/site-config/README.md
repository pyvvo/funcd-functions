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

## Fetching config.json

Fetch it from the base path the bundle is built for, never relative to the page: on a deep link such as `/vehicles/42`,
`config.json` would resolve to `/vehicles/config.json`, which the SPA fallback answers with the index. This app has no
bundler and is built for `/`: `index.html` loads `/app.js`, which resolves `config.json` against its own URL. With a
bundler, use its base:

```js
// Vite
const config = await (await fetch(`${import.meta.env.BASE_URL}config.json`)).json();
// an app that sets <base href>, such as Angular
const config = await (await fetch(new URL('config.json', document.baseURI))).json();
```

## Deploy

Deploy one environment:

```bash
funcdctl app deploy <registry>/site-config:1.0.0 --name site-config -n staging -f values/staging.yaml
```

`config.json` is public, like every file of the Site: never put a secret in it.
