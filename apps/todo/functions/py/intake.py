"""The intake of the todo App's uploads: Sensor todo-upload-intake calls it once per object that lands under uploads/
in Bucket todo-files (EventSource todo-uploads), and it records the object in table uploads under <todo>/<file>, where
the API lists the uploads of a todo."""

import json
from typing import TypedDict

from funcd_shim import CloudEvent, FunctionContext

PREFIX = "uploads/"


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
    record = {"key": data["key"], "size": data["size"], "version": data["version"], "by": "todo-intake"}
    context.kv.put("uploads", key, json.dumps(record))
    context.log("intake", data["key"], data["size"])
    return {"key": key}
