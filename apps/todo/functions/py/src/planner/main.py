"""The todo planner: it returns the plan that the rank step of Workflow todo-plan stored for a run's tick. A call can
ask it to wait for a plan that is not stored yet. A wait longer than the planner's spec.timeout runs past the call's
deadline: funcd answers 504, and the shim stops the call with DeadlineExceeded (funcd ADR-0226), which the planner
logs before it lets the exception end the call."""

import time
from typing import NotRequired, Required, TypedDict

from funcd_shim import CloudEvent, DeadlineExceeded, FunctionContext

POLL_SECONDS = 0.1


class FuncInput(TypedDict):
    tick: str
    wait: NotRequired[float]


class FuncOutput(TypedDict, total=False):
    found: Required[bool]
    tick: str
    plan: list[str]
    collected_by: str
    ranked_by: str


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a call names the tick of a plan")
    tick = data["tick"]
    until = time.monotonic() + data.get("wait", 0)
    try:
        plan = context.kv.get_json("plans", tick)
        while not isinstance(plan, dict) and time.monotonic() < until:
            time.sleep(POLL_SECONDS)
            plan = context.kv.get_json("plans", tick)
    except DeadlineExceeded:
        context.log("DeadlineExceeded while the planner waited for the plan of", tick)
        raise
    if not isinstance(plan, dict):
        return {"found": False}
    return {
        "found": True,
        "tick": str(plan["tick"]),
        "plan": [str(title) for title in plan["plan"]],
        "collected_by": str(plan["collected_by"]),
        "ranked_by": str(plan["ranked_by"]),
    }
