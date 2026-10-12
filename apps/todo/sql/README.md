# The SQL functions of the todo App

funcd's `sql` lane deploys these on real containerd (funcd ADR-0232, ADR-0233):

| File | What |
|---|---|
| `notes-db.yaml` | SQLDatabase `notes-db`, one rqlite engine, owned by `notes` |
| `notes.yaml` | `notes`, TypeScript (`functions/ts/src/notes.ts`): its Drizzle schema runs through `context.sql`, and it is the only writer |
| `notes-report.yaml` | `notes-report`, Python (`functions/py/notes_report.py`): SQLModel models compiled with the SQLite dialect; it reads and cannot write |
| `funcdconfig.yaml` | The lane's daemon config: containerd, file storage |
