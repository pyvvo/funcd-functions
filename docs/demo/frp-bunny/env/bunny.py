#!/usr/bin/env python3
"""Bunny's API for the frp-bunny demo's setup and teardown, with the key from the file that DEMO_BUNNY_KEY_FILE names,
which it never prints.

bunny.py zones             print the Id and the Name of each pull zone, one a line
bunny.py delete-zone <id>  delete the pull zone with that Id
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

API = "https://api.bunny.net"


def call(method: str, path: str) -> bytes:
    key = Path(os.environ["DEMO_BUNNY_KEY_FILE"]).read_text().strip()
    headers = {"AccessKey": key, "Accept": "application/json"}
    with urllib.request.urlopen(
        urllib.request.Request(API + path, method=method, headers=headers), timeout=30
    ) as answer:
        return answer.read()


def zones() -> list:
    found, page = [], 1
    while True:
        answer = json.loads(call("GET", f"/pullzone?page={page}&perPage=1000"))
        if not isinstance(answer, dict):
            return found + answer
        found += answer["Items"]
        if not answer.get("HasMoreItems"):
            return found
        page += 1


if sys.argv[1:] == ["zones"]:
    for zone in zones():
        print(zone["Id"], zone["Name"])
elif len(sys.argv) == 3 and sys.argv[1] == "delete-zone":
    call("DELETE", f"/pullzone/{int(sys.argv[2])}")
else:
    sys.exit(__doc__)
