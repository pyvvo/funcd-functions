"""The post-apply hook of the todo App (funcd ADR-0214): once a revision is current, it records the release under key
last of table warm, where the API reports it."""

import json
from typing import TypedDict

from funcd_shim import CloudEvent, FunctionContext

# The input of a hook call. "from" is a Python keyword, so the TypedDict takes the functional form.
HookInput = TypedDict(
    "HookInput",
    {"event": str, "app": str, "from": str, "to": str, "fromVersion": str, "toVersion": str},
    total=False,
)


class FuncOutput(TypedDict):
    revision: str


def handle(context: FunctionContext, event: CloudEvent[HookInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a hook call carries its input")
    record = {"by": "todo-warm", "event": data["event"], "revision": data["to"], "version": data.get("toVersion", "")}
    context.kv.put("warm", "last", json.dumps(record))
    context.log("warm", data["event"], data["to"])
    return {"revision": data["to"]}
