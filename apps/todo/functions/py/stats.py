"""The stats Function of the todo App's value sql (funcd ADR-0236): a SQLModel reader of SQLDatabase todo-db that
reports its todos and the migrations the migrate hook recorded in table _migrations."""

from typing import Any, TypedDict, cast

from funcd_shim import CloudEvent, FunctionContext
from sqlalchemy import func, table
from sqlalchemy.dialects import sqlite
from sqlalchemy.sql import ClauseElement
from sqlalchemy.sql.compiler import SQLCompiler
from sqlmodel import Field, SQLModel, select


class Todo(SQLModel, table=True):
    __tablename__ = "todos"
    id: int | None = Field(default=None, primary_key=True)
    title: str
    done: int = 0


class FuncOutput(TypedDict):
    todos: int
    migrations: int


def _count(context: FunctionContext, stmt: ClauseElement) -> int:
    c = cast(SQLCompiler, stmt.compile(dialect=sqlite.dialect()))
    res = context.sql.query_values("app", str(c), [c.params[name] for name in c.positiontup or []])
    return int(res["values"][0][0])


def handle(context: FunctionContext, event: CloudEvent[Any]) -> FuncOutput:
    return {
        "todos": _count(context, select(func.count()).select_from(Todo)),
        "migrations": _count(context, select(func.count()).select_from(table("_migrations"))),
    }
