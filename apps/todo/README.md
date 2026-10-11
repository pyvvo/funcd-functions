# todo — the to-do App

The to-do App of funcd's App design ([FEAT-0010](https://github.com/pyvvo/funcd/blob/main/docs/feat/0010-feat-apps.md)),
as an App template. funcd's `app-todo` Lima lane deploys it on containerd (`just lima-example app-todo`).

## Parts

| Part | Kind | What it does |
|---|---|---|
| `todo-api` | Function (TypeScript) and Route `/api` | adds, lists and reads todos; adding one needs the token of Secret `todo-api-keys` |
| `todo-planner` | Function (Python) | returns the plan that Workflow `todo-plan` stored for a tick |
| `todo-plan` | Workflow | `collect` (TypeScript) reads the todos' attachments, `rank` (Python) orders them into its own KV store `todo-plans` |
| `todo-plan-timer`, `todo-plan-schedule` | EventSource, Sensor | a cron timer in a time zone that starts `todo-plan` |
| `todo-web` | Site | a static page that lists the todos through `/api` |
| `todo-store`, `todo-files` | KVStore, Bucket | the todos and their attachments; `deletion: retain` |
| `todo-cache`, `todo-tmp` | KVStore, Bucket | the release record and the uploads; `deletion: delete` |
| `todo-settings` | ConfigMap | `TODO_GREETING` |
| `todo-api-keys` | Secret, declared | `TODO_API_TOKEN`; the installer creates the Secret |
| `todo-migrate` | Function (TypeScript), preApply hook | records each call; in 1.1.0 it also rewrites every todo to schema 2 |
| `todo-warm` | Function (Python), postApply hook | records the release that became current |

## Files

- `app/`: the template of version 1.0.0 (`app.yaml` and `resources/`). It commits no `app.lock`: an install locks the
  images against its own registry.
- `app-1.1.0.yaml`: the `app.yaml` of version 1.1.0. With `app/resources` it is the 1.1.0 template: a new API image,
  whose todos add `done`, and a new migrate hook that rewrites the todos of 1.0.0 before that API replaces it.
- `values/e2e.yaml`: the registry of the lane, an OCI layout under `/mnt/funcd-deps`. `values/reinstall.yaml` installs
  over the stores that a deleted install kept, through `ref`.
- `grants.yaml`: the RolesAssignment that lets the migrate hook write table `todos`, which the API owns. An App
  declares no IAM kind, so it is applied beside the App.
- `functions/ts`, `functions/py`: the function sources with their `funcdctl.yaml` contracts. The TypeScript bundles
  (`*.mjs`) are committed; rebuild them with `npm ci && npm run build`. Each Python function is one file; check them
  with `uv run mypy` and `uv run ruff check`.
- `web/`: the static site, pushed with `funcdctl push --site`.
- `funcdconfig.yaml`: the daemon config of the lane.

## Install

```bash
funcdctl push functions/ts/api-1.0.0.mjs <registry>/todo-api:1.0.0   # and so on for each image in app/app.yaml
funcdctl push --site web <registry>/todo-web:1.0.0
funcdctl app lock app -f values/<install>.yaml
funcdctl push --template app <registry>/todo:1.0.0
funcdctl apply -f grants.yaml                                        # and create Secret todo-api-keys
funcdctl app deploy <registry>/todo:1.0.0 -f values/<install>.yaml
```
