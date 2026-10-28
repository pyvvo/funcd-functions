"""The fetch Function of experiment 0015: it imports each locked dependency, so a bundle that lost one fails to load."""

from typing import Any, TypedDict

import cryptography
import jinja2
import requests
import urllib3
from funcd_shim import CloudEvent, FunctionContext


class FuncOutput(TypedDict):
    versions: dict[str, str]


def handle(context: FunctionContext, event: CloudEvent[Any]) -> FuncOutput:
    return {"versions": {m.__name__: m.__version__ for m in (cryptography, jinja2, requests, urllib3)}}
