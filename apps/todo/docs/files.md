# The todo App's files

What each file of the App holds, beside the [template versions](versions.md).

## Values

| File | What it does |
|---|---|
| `values/e2e.yaml` | the registry of the lane, an OCI layout under `/mnt/funcd-deps` |
| `values/reinstall.yaml` | installs over the stores that a deleted install kept, through `ref`; a `ref` cannot add a table or a prefix, so the kept stores must come from the same template version |
| `values/greeting.yaml` | changes the greeting, which rolls the API to a new revision |
| `values/shared.yaml` | adds the requirement on `todo-shared` |
| `values/backup.yaml` | adds the App's backup schedule (`resources/backup.yaml`), every minute to the S3 server of the lane's disaster-recovery block |
| `values/restored-store.yaml` | points the App at the restored copy `todo-store-r` (value `store`, which binds the store through `ref`, so only with `values/reinstall.yaml`) |
| `values/short-backup-ttl.yaml` | keeps its Backups 2 minutes (value `backupTTL`) |
| `values/lake.yaml` | adds the Lake `todo-lake` and its bucket `todo-lakehouse` (`resources/lake.yaml`), so the App's backups copy a lake |
| `values/sql.yaml` | adds `todo-db` and `todo-stats` (`resources/sql.yaml`) and binds the migrate hook to `todo-db` (`resources/hooks-migrate-sql.yaml` in place of `resources/hooks-migrate.yaml`) |

With `values/sql.yaml`, the hook applies the migrations that drizzle-kit generated from
`functions/ts/src/db/schema-<version>.ts` into `functions/ts/drizzle/<version>`: 1.0.0 creates `todos`, 1.1.0 adds
`note`. Generate a version with `DRIZZLE_VERSION=<version> npx drizzle-kit generate`, starting from a copy of the
previous version's folder.

## Grants, the Secret and the fixtures

- `grants.yaml`: the RolesAssignments that let the migrate hook write table `todos` and database `todo-db`, and the
  intake write `todo-db` from 1.2.0. An App declares no IAM kind, so they are applied beside the App.
- `secret.yaml`: a test fixture, Secret `todo-api-keys` with the lane's test-only token.
- `fixtures/`: what the lane applies to test one scenario each: a Policy that forbids the planner to read its table,
  and an App whose Workflow step binds a store that its Workflow does not declare, which apply refuses.
- `funcdconfig.yaml`: the daemon config of the lane, with short supervision, liveness, blob poll and log flush times.

## Functions and the page

- `functions/ts`, `functions/py`: the function sources, each `src/<name>/main.ts` or `src/<name>/main.py`, with its
  `<name>.contract.yaml` (funcd ADR-0247). The TypeScript bundles (`<name>.mjs`, beside their contract files) are
  committed; rebuild them with `npm ci && npm run build`. The Python functions are listed in `pyproject.toml`'s
  `[tool.funcd-bundle.functions]`; `uv run funcd-bundle` builds each into `dist/<name>/`. Check them with
  `uv run mypy` and `uv run ruff check`.
- `functions/py-lake`: `lake_sql`, the source of `todo-lake-sql`, in a uv project of its own: funcd-bundle vendors a
  project's whole dependency closure into each of its functions, and only this one needs DuckDB. Its bundle also
  holds DuckDB's `quack` and `httpfs` extensions, so `uv run funcd-bundle` needs Docker.
- `web/`: the static site, pushed with `funcdctl push --site`.

## The disaster-recovery fixtures

`dr/` holds the test fixtures of the lane's disaster-recovery block (funcd FEAT-0009). None of them is a secret: they
exist only in the lane.

- `funcdconfig.yaml` is the lane's config with a platform backup and a KV backup to an S3 server in the VM, sealed to
  the two age recipients of `recipients.txt`, and static credentials from `admin.token` and `developer.token`.
- `identity.txt` is the operator's identity, which opens the backups; the recovery key's identity is not kept.
- `backup.credentials`, `restore.credentials` and `versitygw.env` hold the S3 server's test key.
- `probe-configmap.yaml` is the object whose version the lane writes back after the restore.
- `workload-secrets.yaml` holds the S3 key and the identity of the App's own backups. `restore-copy.yaml`,
  `restore-not-empty.yaml` and `restore-in-place.yaml` restore a Backup whose name the lane fills in.
- `funcdconfig-blob-s3.yaml` puts the blob store itself on the S3 server.
- `lake-fixtures.yaml` holds the lake's Quack token and engine settings. `restore-lake.yaml` and `lake-copy.yaml`
  restore it into a new bucket and serve the copy, and `funcdconfig-lake.yaml` turns on the S3 gateway and the lake
  proxy that the engine needs.
- `lake-sql-of-app.yaml` is Function `todo-lake-sql`, which runs one SQL statement on the App's Lake over Quack and
  returns the rows, as `lake-reader` of funcd-python's `examples/lake-quack` does, or writes a plain object under the
  Bucket's prefix `docs`. funcd's lane reads and writes the lake's rows through it, and applies it beside the App: as
  a part of the App, its image would have to be in the lock of every lane that deploys the App.
- The lane's lake cases (funcd ADR-0312) fill in templates, whose `fill-` names are valid names, so that each file
  decodes as it stands: `schedule-of-bucket.yaml`, `backup-by-hand.yaml`, `bucket-of-prefix.yaml`,
  `bucket-with-lake.yaml`, `lake-on-prefix.yaml`, `lake-sql.yaml`, `restore-bucket-in-place.yaml`,
  `restore-bucket-as.yaml`, `restore-lake-in-place.yaml` and `restore-lake-as-location.yaml`.
- `restore-lake-then-bucket-in-place.yaml` and `restore-bucket-then-lake-in-place.yaml` restore the Lake and its
  Bucket in place, in each order, `restore-lake-on-bucket-in-place.yaml` is refused, and `lake-long-insert.json` is a
  long INSERT.
- `database-copy.yaml` is the empty database `todo-db-r` with the grants of its writers, which
  `restore-database.yaml` fills with `todo-db` of 1.2.0 once it is Ready. `restore-database-in-place.yaml` restores
  `todo-db` in place.
- `dead-letter-sensor.yaml` fails on every upload, so the lane has a dead letter to back up and restore.
