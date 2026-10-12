"""The notes_report Function: a Python reader of SQLDatabase notes-db (funcd ADR-0233). Its model is SQLModel code,
compiled with the SQLite dialect and sent through context.sql; it binds the database but is not its owner, so its
write is refused."""

from typing import Any, TypedDict, cast

from funcd_shim import CloudEvent, FunctionContext
from sqlalchemy.dialects import sqlite
from sqlalchemy.sql import ClauseElement
from sqlalchemy.sql.compiler import SQLCompiler
from sqlmodel import Field, SQLModel, col, insert, select


class Note(SQLModel, table=True):
    __tablename__ = "notes"
    id: int | None = Field(default=None, primary_key=True)
    title: str
    done: int = 0


class FuncInput(TypedDict, total=False):
    op: str


class FuncOutput(TypedDict, total=False):
    titles: list[str]
    count: int
    error: str


def _compiled(stmt: ClauseElement) -> tuple[str, list[Any]]:
    c = cast(SQLCompiler, stmt.compile(dialect=sqlite.dialect()))
    return str(c), [c.params[name] for name in c.positiontup or []]


def handle(context: FunctionContext, event: CloudEvent[FuncInput]) -> FuncOutput:
    data = event.get("data") or {}
    if data.get("op") == "write":
        text, params = _compiled(insert(Note).values(title="from notes_report"))
        try:
            context.sql.execute("app", text, params)
        except RuntimeError as err:
            return {"error": str(err)}
        return {}
    text, params = _compiled(select(Note).where(Note.done == 0).order_by(col(Note.id)))
    res = context.sql.query_values("app", text, params)
    notes = [Note.model_validate(dict(zip(res["columns"], row, strict=True))) for row in res["values"]]
    return {"titles": [n.title for n in notes], "count": len(notes)}
