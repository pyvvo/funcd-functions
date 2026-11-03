"""The lake_sql Function of the todo App's value lake: it runs one SQL statement on Lake todo-lake over Quack and
returns the rows, which is how funcd's app-todo lane reads and writes the lake's rows. A Quack client is a local DuckDB
with the quack extension (funcd ADR-0086); both travel in the bundle (funcd ADR-0089), and the Lake binding injects the
lake's endpoint and token (funcd ADR-0091). A call with put writes a plain object under prefix docs of the Lake's Bucket
instead, which the lane backs up and restores beside the Lake."""

import os
from typing import TypedDict

import duckdb
from funcd_shim import CloudEvent, FunctionContext


class PutInput(TypedDict):
    key: str
    content: str


class FuncInput(TypedDict, total=False):
    sql: str
    put: PutInput


class FuncOutput(TypedDict):
    rows: list[list[object]]


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data")
    if data is None:
        raise ValueError("a call carries the SQL to run or the object to put")
    if "put" in data:
        context.blob.put("docs", data["put"]["key"], data["put"]["content"].encode())
        return {"rows": []}
    con = duckdb.connect()
    con.execute("SET autoinstall_known_extensions=false")
    con.execute("SET autoload_known_extensions=false")
    con.execute(f"SET extension_directories=['{os.environ['FUNCD_BUNDLE_DIR']}/duckdb-ext']")
    con.execute("LOAD quack")
    rows = con.execute(
        "SELECT * FROM quack_query(?, ?, token := ?, disable_ssl := true)",
        ["quack://" + os.environ["FUNCD_LAKE_LAKE_URL"], data["sql"], os.environ["FUNCD_LAKE_LAKE_TOKEN"]],
    ).fetchall()
    return {"rows": [list(row) for row in rows]}
