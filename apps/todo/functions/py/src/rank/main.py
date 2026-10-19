"""The rank step of Workflow todo-plan: it orders the titles that the TypeScript collect step read, stores the plan
under the run's tick in table plans, where the planner reads it, and returns its size."""

import json
from typing import TypedDict

from funcd_shim import CloudEvent, FunctionContext


class FuncInput(TypedDict):
    tick: str
    titles: list[str]
    collected_by: str


class FuncOutput(TypedDict):
    tick: str
    count: int
    ranked_by: str


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a step call carries the output of collect")
    plan = sorted(data["titles"])
    record = {"tick": data["tick"], "plan": plan, "collected_by": data["collected_by"], "ranked_by": "rank"}
    context.kv.put("plans", data["tick"], json.dumps(record))
    context.log("rank", data["tick"], len(plan))
    return {"tick": data["tick"], "count": len(plan), "ranked_by": "rank"}
