"""The intake of the todo App's uploads from version 1.2.0: Sensor todo-upload-intake calls it once per object that
lands under uploads/<todo>/<file> in Bucket todo-files, and it records the object in table uploads of SQLDatabase
todo-db under the todo whose slug is <todo> (funcd ADR-0233). A repeated event updates the same row."""

from typing import TypedDict

from funcd_shim import CloudEvent, FunctionContext

PREFIX = "uploads/"
RECORD = (
    "INSERT INTO uploads (todo_id, name, size, object_version, recorded_by) SELECT id, ?, ?, ?, ? FROM todos "
    "WHERE slug = ? ON CONFLICT (todo_id, name) DO UPDATE SET size = excluded.size, "
    "object_version = excluded.object_version, recorded_by = excluded.recorded_by"
)


class FuncInput(TypedDict):
    bucket: str
    key: str
    size: int
    version: str
    time: str


class FuncOutput(TypedDict):
    key: str


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a blob event carries the object it fired for")
    key = data["key"].removeprefix(PREFIX)
    todo, _, name = key.partition("/")
    if not todo or not name:
        raise ValueError(f"an upload lands under {PREFIX}<todo>/<file>, not {data['key']}")
    result = context.sql.execute("app", RECORD, [name, data["size"], data["version"], "todo-intake", todo])
    if result["rowsAffected"] == 0:
        raise ValueError(f"upload {data['key']} names no todo of todo-db")
    context.log("intake", data["key"], data["size"])
    return {"key": key}
