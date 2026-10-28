"""The heavy Function of experiment 0015: it imports DuckDB and pyarrow, the native wheels that make its bundle large."""

from typing import Any, TypedDict

import duckdb
import pyarrow
from funcd_shim import CloudEvent, FunctionContext


class FuncOutput(TypedDict):
    versions: dict[str, str]


def handle(context: FunctionContext, event: CloudEvent[Any]) -> FuncOutput:
    return {"versions": {"duckdb": duckdb.__version__, "pyarrow": pyarrow.__version__}}
