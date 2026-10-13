# todo — the to-do App

The to-do App of funcd's App design ([FEAT-0010](https://github.com/pyvvo/funcd/blob/main/docs/feat/0010-feat-apps.md)),
as an App template. funcd's `app-todo` Lima lane deploys it on containerd (`just lima-example app-todo`).

## Parts

| Part | Kind | What it does |
|---|---|---|
| `todo-api` | Function (TypeScript) and Route `/api` | adds, lists and reads todos; `attach` uploads a file of a todo, and `get` lists the uploads the intake recorded. Adding, attaching and `hang` need the token of Secret `todo-api-keys`; `hang` blocks the API's event loop, for funcd's liveness check. From 1.2.0 the todos and their uploads are rows of `todo-db`, queried with Drizzle: `done` marks a todo done, `list` can keep only the done or the open todos and counts both, `get` reads a todo with its uploads in one join, and `list` names the todos the change feed reported |
| `todo-planner` | Function (Python) | returns the plan that Workflow `todo-plan` stored for a tick; a call can wait for the plan, and a wait past the planner's 2 s `timeout` is stopped. The timeout also bounds the call that wakes the planner |
| `todo-plan` | Workflow | `collect` (TypeScript) reads the todos' attachments, `rank` (Python) orders them into its own KV store `todo-plans` |
| `todo-plan-timer`, `todo-plan-schedule` | EventSource, Sensor | a cron timer in a time zone that starts `todo-plan` |
| `todo-uploads`, `todo-upload-intake` | EventSource, Sensor | an object under `uploads/` in `todo-files` fires event `uploaded`, which the Sensor hands to `todo-intake` |
| `todo-intake` | Function (Python) | records each upload in table `uploads` of `todo-store`; from 1.2.0 (`intake_sql.py`) in table `uploads` of `todo-db`, under its todo |
| `todo-web` | Site | a static page that lists the todos through `/api` |
| `todo-store`, `todo-files` | KVStore, Bucket | the todos, the upload records, and the attachments and uploads; `deletion: retain` |
| `todo-cache`, `todo-tmp` | KVStore, Bucket | the release record and a copy of each todo; `deletion: delete` |
| `todo-settings` | ConfigMap | `TODO_GREETING`, from value `greeting` |
| `todo-api-keys` | Secret, declared | `TODO_API_TOKEN`; the installer creates the Secret |
| `todo-migrate` | Function (TypeScript), preApply hook | records each call; in 1.1.0 it also rewrites every todo to schema 2; in 1.2.0 it migrates `todo-db` and copies the todos and upload records of KV into it, each only when absent, and keeps the KV records, so a rollback to 1.1.0 still runs, without the todos added since |
| `todo-warm` | Function (Python), postApply hook | records the release that became current |
| `todo-db`, `todo-stats` | SQLDatabase, Function (Python) | with value `sql` (1.0.0 and 1.1.0): the database the migrate hook keeps with Drizzle's migrations (table `_migrations`), which no other function writes, and a SQLModel reader that counts its todos and migrations. From 1.2.0 `todo-db` holds the todos and their uploads: the API owns it, `deletion: retain` keeps it as it keeps `todo-store`, and value `database` binds another database through `ref` instead |
| `todo-changes`, `todo-notify`, `todo-feed` | EventSource (sql), Sensor and Function (Python), KVStore | from 1.2.0: a row inserted into table `todos` of `todo-db` fires event `added` (funcd ADR-0235), and `todo-notify` records the todo in table `added` of `todo-feed`, under its slug |

With `values/shared.yaml` the App also requires App `todo-shared` ([`apps/todo-shared`](../todo-shared)) at `^1.0.0`:
its rollout waits until `todo-shared` is Ready at a matching version.

## Files

- `app/`: the template of version 1.0.0 (`app.yaml` and `resources/`). It commits no `app.lock`: an install locks the
  images against its own registry.
- `app-1.1.0.yaml`: the `app.yaml` of version 1.1.0. With `app/resources` it is the 1.1.0 template: a new API image,
  whose todos add `done`, and a new migrate hook that rewrites the todos of 1.0.0 before that API replaces it.
- `values/e2e.yaml`: the registry of the lane, an OCI layout under `/mnt/funcd-deps`. `values/reinstall.yaml` installs
  over the stores that a deleted install kept, through `ref`; a `ref` cannot add a table or a prefix, so the kept stores
  must come from the same template version. `values/greeting.yaml` changes the greeting, which rolls the API to a new
  revision; `values/shared.yaml` adds the requirement on `todo-shared`; `values/backup.yaml` adds the App's backup schedule
  (`resources/backup.yaml`), every minute to the S3 server of the lane's disaster-recovery block. `values/restored-store.yaml`
  points the App at the restored copy `todo-store-r` (value `store`, which binds the store through `ref`, so only
  with `values/reinstall.yaml`), and `values/short-backup-ttl.yaml` keeps its
  Backups 2 minutes (value `backupTTL`). `values/catalog.yaml` adds the DuckLake catalog `todo-lake`
  and its bucket `todo-lakehouse` (`resources/catalog.yaml`), so the App's backups copy a catalog. `values/sql.yaml`
  adds `todo-db` and `todo-stats` (`resources/sql.yaml`) and binds the migrate hook to `todo-db`
  (`resources/hooks-migrate-sql.yaml` in place of `resources/hooks-migrate.yaml`). The hook then applies the migrations
  drizzle-kit generated from `functions/ts/src/db/schema-<version>.ts` into `functions/ts/drizzle/<version>`: 1.0.0
  creates `todos`, 1.1.0 adds `note`. Generate a version with `DRIZZLE_VERSION=<version> npx drizzle-kit generate`,
  starting from a copy of the previous version's folder.
- `app-1.2.0.yaml`: the `app.yaml` of version 1.2.0, where `todo-db` holds the todos and their uploads. With
  `app/resources` it is the 1.2.0 template: its `when` map leaves out the KV parts of the API, the intake and the migrate
  hook (`api.yaml`, `intake.yaml`, `hooks-migrate*.yaml`, `sql.yaml`) and takes the `*-1.2.yaml` files in their place;
  1.0.0 and 1.1.0 leave the `*-1.2.yaml` files out. Its migrations are `functions/ts/drizzle/1.2.0`: 1.2.0 adds `slug`
  and table `uploads`. `values/restored-database.yaml` points 1.2.0 at the restored copy `todo-db-r` (value
  `database`).
- `grants.yaml`: the RolesAssignments that let the migrate hook write table `todos` and database `todo-db`, and the
  intake write `todo-db` from 1.2.0. An App declares no IAM kind, so they are applied beside the App.
- `secret.yaml`: a test fixture, Secret `todo-api-keys` with the lane's test-only token.
- `fixtures/`: what the lane applies to test one scenario each: a Policy that forbids the planner to read its table,
  and an App whose Workflow step binds a store its Workflow does not declare, which apply refuses.
- `functions/ts`, `functions/py`: the function sources with their `funcdctl.yaml` contracts. The TypeScript bundles
  (`*.mjs`) are committed; rebuild them with `npm ci && npm run build`. Each Python function is one file; check them
  with `uv run mypy` and `uv run ruff check`.
- `web/`: the static site, pushed with `funcdctl push --site`.
- `funcdconfig.yaml`: the daemon config of the lane, with short supervision, liveness, blob poll and log flush times.
- `dr/`: the test fixtures of the lane's disaster-recovery block (funcd FEAT-0009). `funcdconfig.yaml` is the lane's
  config with a platform backup and a KV backup to an S3 server in the VM, sealed to the two age recipients of
  `recipients.txt`, and static credentials from `admin.token` and `developer.token`. `identity.txt` is the operator's
  identity, which opens the backups; the recovery key's identity is not kept. `backup.credentials`,
  `restore.credentials` and `versitygw.env` hold the S3 server's test key. `probe-configmap.yaml` is the object whose
  version the lane writes back after the restore. `workload-secrets.yaml` holds the S3 key and the identity of the
  App's own backups; `restore-copy.yaml`, `restore-not-empty.yaml` and `restore-in-place.yaml` restore a Backup whose
  name the lane fills in. `funcdconfig-blob-s3.yaml` puts the blob store itself on the S3 server. `catalog-fixtures.yaml` holds the catalog's Quack token and
  engine settings, `restore-catalog.yaml` and `catalog-copy.yaml` restore it into a new bucket and serve the copy, and
  `funcdconfig-catalog.yaml` turns on the S3 gateway and the catalog proxy the engine needs.
  `restore-database.yaml` and `restore-database-in-place.yaml` restore `todo-db` of 1.2.0 under a new name, with the grants
  of its writers, and in place. `dead-letter-sensor.yaml` fails on every upload, so the lane has a dead letter to back up and restore. None of these is a
  secret: they exist only in the lane.

## Install

```bash
funcdctl push functions/ts/api-1.0.0.mjs <registry>/todo-api:1.0.0   # and so on for each image in app/app.yaml
funcdctl push --site web <registry>/todo-web:1.0.0
funcdctl app lock app -f values/<install>.yaml
funcdctl push --template app <registry>/todo:1.0.0
funcdctl apply -f grants.yaml                                        # and create Secret todo-api-keys
funcdctl app deploy <registry>/todo:1.0.0 -f values/<install>.yaml
```
