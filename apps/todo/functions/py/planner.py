"""The todo planner: it returns the plan that the rank step of Workflow todo-plan stored for a run's tick."""

from typing import Required, TypedDict

from funcd_shim import CloudEvent, FunctionContext


class FuncInput(TypedDict):
    tick: str


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
    plan = context.kv.get_json("plans", data["tick"])
    if not isinstance(plan, dict):
        return {"found": False}
    return {
        "found": True,
        "tick": str(plan["tick"]),
        "plan": [str(title) for title in plan["plan"]],
        "collected_by": str(plan["collected_by"]),
        "ranked_by": str(plan["ranked_by"]),
    }
