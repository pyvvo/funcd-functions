# The todo App's versions

The App's template at each version, and what each version changes in its [parts](../README.md#parts).

## 1.0.0

`app/` is the template of version 1.0.0 (`app.yaml` and `resources/`). It commits no `app.lock`: an install locks the
images against its own registry.

## 1.1.0

`app-1.1.0.yaml` is the `app.yaml` of version 1.1.0. With `app/resources` it is the 1.1.0 template: a new API image,
whose todos add `done`, and a new migrate hook that rewrites the todos of 1.0.0 before that API replaces it. In
1.1.0, `todo-migrate` also rewrites every todo to schema 2.

## 1.2.0

`app-1.2.0.yaml` is the `app.yaml` of version 1.2.0, where `todo-db` holds the todos and their uploads. With
`app/resources` it is the 1.2.0 template: its `when` map leaves out the KV parts of the API, the intake and the
migrate hook (`api.yaml`, `intake.yaml`, `hooks-migrate*.yaml`, `sql.yaml`) and takes the `*-1.2.yaml` files in
their place. 1.0.0 and 1.1.0 leave the `*-1.2.yaml` files out. Its migrations are `functions/ts/drizzle/1.2.0`: 1.2.0
adds `slug` and table `uploads`. `values/restored-database.yaml` points 1.2.0 at the restored copy `todo-db-r` (value
`database`).

From 1.2.0:

- `todo-api`: the todos and their uploads are rows of `todo-db`, queried with Drizzle. `done` marks a todo done,
  `list` can keep only the done or the open todos and counts both, `get` reads a todo with its uploads in one join,
  and `list` names the todos that the change feed reported.
- `todo-intake` (`intake_sql.py`) records each upload in table `uploads` of `todo-db`, under its todo.
- `todo-migrate` migrates `todo-db` and copies the todos and upload records of KV into it, each only when absent. It
  keeps the KV records, so a rollback to 1.1.0 still runs, without the todos added since.
- `todo-db` holds the todos and their uploads: the API owns it, `deletion: retain` keeps it as it keeps
  `todo-store`, and value `database` binds another database through `ref` instead.
