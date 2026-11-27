# todo — the to-do App

The to-do App of funcd's App design ([FEAT-0010](https://github.com/pyvvo/funcd/blob/main/docs/feat/0010-feat-apps.md)),
as an App template. funcd's `app-todo` Lima lane deploys it on containerd (`just lima-example app-todo`), and
[Deploy](#deploy) installs it. [Versions 1.1.0 and 1.2.0](docs/versions.md) change some of its parts.

## Parts

| Part | Kind | What it does |
|---|---|---|
| `todo-api` | Function (TypeScript) and Route `/api` | adds, lists and reads todos; `attach` uploads a file of a todo, and `get` lists the uploads the intake recorded. Adding, attaching and `hang` need the token of Secret `todo-api-keys`; `hang` blocks the API's event loop, for funcd's liveness check |
| `todo-planner` | Function (Python) | returns the plan that Workflow `todo-plan` stored for a tick; a call can wait for the plan, and a wait past the planner's 2 s `timeout` is stopped. The timeout also bounds the call that wakes the planner |
| `todo-plan` | Workflow | `collect` (TypeScript) reads the todos' attachments, `rank` (Python) orders them into KV store `todo-plans`, which the App declares with step Function `todo-plan-rank` as the owner of its table (a part declares no store of its own, funcd ADR-0248); `deletion: delete` |
| `todo-plan-timer`, `todo-plan-schedule` | EventSource, Sensor | a cron timer in a time zone that starts `todo-plan` |
| `todo-uploads`, `todo-upload-intake` | EventSource, Sensor | an object under `uploads/` in `todo-files` fires event `uploaded`, which the Sensor hands to `todo-intake` |
| `todo-intake` | Function (Python) | records each upload in table `uploads` of `todo-store` |
| `todo-web` | Site | a static page that lists the todos through `/api`, served from prefix `web` of Bucket `todo-web`, which the App declares with `deletion: delete`: each install materializes the bundle again |
| `todo-store`, `todo-files` | KVStore, Bucket | the todos, the upload records, and the attachments and uploads; `deletion: retain` |
| `todo-cache`, `todo-tmp` | KVStore, Bucket | the release record and a copy of each todo; `deletion: delete` |
| `todo-settings` | ConfigMap | `TODO_GREETING`, from value `greeting` |
| `todo-api-keys` | Secret, declared | `TODO_API_TOKEN`; the installer creates the Secret |
| `todo-migrate` | Function (TypeScript), preApply hook | records each call |
| `todo-warm` | Function (Python), postApply hook | records the release that became current |
| `todo-db`, `todo-stats` | SQLDatabase, Function (Python) | with value `sql` (1.0.0 and 1.1.0): the database the migrate hook keeps with Drizzle's migrations (table `_migrations`), which no other function writes, and a SQLModel reader that counts its todos and migrations |
| `todo-changes`, `todo-notify`, `todo-feed` | EventSource (sql), Sensor and Function (Python), KVStore | from 1.2.0: a row inserted into table `todos` of `todo-db` fires event `added` (funcd ADR-0235), and `todo-notify` records the todo in table `added` of `todo-feed`, under its slug |
| `todo-lake`, `todo-lakehouse` | Lake and Bucket | with value `lake`: a Lake the App owns on prefix `lake` of a Bucket with `deletion: retain`, and prefix `docs` beside it for Function `todo-lake-sql` of `dr/lake-sql-of-app.yaml` |

With `values/shared.yaml` the App also requires App `todo-shared` ([`apps/todo-shared`](../todo-shared)) at
`^1.0.0`: its rollout waits until `todo-shared` is Ready at a matching version. The App's [files](docs/files.md) are
its values, its grants, its functions, its page and the lane's fixtures.

## Deploy

```bash
funcdctl push functions/ts/api-1.0.0.mjs <registry>/todo-api:1.0.0   # and so on for each image in app/app.yaml
funcdctl push --site web <registry>/todo-web:1.0.0
funcdctl app lock app -f values/<install>.yaml
funcdctl push --template app <registry>/todo:1.0.0
funcdctl apply -f grants.yaml                                        # and create Secret todo-api-keys
funcdctl app deploy <registry>/todo:1.0.0 -f values/<install>.yaml
```
