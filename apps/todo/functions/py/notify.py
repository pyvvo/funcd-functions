"""The change-feed consumer of the todo App from version 1.2.0: Sensor todo-notify calls it once per row inserted into
table todos of SQLDatabase todo-db (EventSource todo-changes, funcd ADR-0235), and it records the todo in table added
of KVStore todo-feed under its slug, so a repeated delivery writes the same record."""

import json
from typing import Any, TypedDict

from funcd_shim import CloudEvent, FunctionContext


class FuncInput(TypedDict, total=False):
    op: str
    table: str
    rowId: int
    before: dict[str, Any]
    after: dict[str, Any]
    index: int
    commitTimestamp: int
    truncated: bool


class FuncOutput(TypedDict):
    slug: str


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a change event carries its change")
    slug = (data.get("after") or {}).get("slug")
    if not isinstance(slug, str) or slug == "":
        context.log("notify", "no slug", data.get("rowId"))
        return {"slug": ""}
    record = {"title": data["after"].get("title"), "index": data.get("index"), "by": "todo-notify"}
    context.kv.put("added", slug, json.dumps(record))
    context.log("notify", slug, data.get("index"))
    return {"slug": slug}
