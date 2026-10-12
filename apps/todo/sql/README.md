# The SQL functions of the todo App

funcd's `sql` lane deploys these on real containerd (funcd ADR-0232 to ADR-0235):

| File | What |
|---|---|
| `notes-db.yaml` | SQLDatabase `notes-db`, one rqlite engine, owned by `notes` |
| `notes.yaml` | `notes`, TypeScript (`functions/ts/src/notes.ts`): its Drizzle schema runs through `context.sql`, and it is the only writer |
| `notes-report.yaml` | `notes-report`, Python (`functions/py/notes_report.py`): SQLModel models compiled with the SQLite dialect; it reads and cannot write |
| `funcdconfig.yaml` | The lane's daemon config: containerd, file storage, static credentials; the engines post their changes to the bridge address funcd derives (funcd ADR-0238) |
| `backup.yaml` | BackupSchedule `notes-backup` of `notes-db`, to the lane's S3 server, with the todo App's test Secrets of `../dr` |
| `backup-b1.yaml` | Backup `notes-b1` of that schedule, created by hand |
| `notes-db-restored.yaml` | The empty SQLDatabase `notes-db-restored` |
| `restore-copy.yaml` | The Restore of `notes-db` into it (`BACKUP` is the lane's) |
| `notes-restored.yaml` | `notes` again, bound to `notes-db-restored` once it is restored |
| `restore-in-place.yaml` | The in-place Restore of `notes-db` |
| `changes.yaml` | EventSource `notes-changes` on `notes-db`'s notes table, and the Sensor that copies each new note into `notes-db-restored` |
