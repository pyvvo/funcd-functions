#!/usr/bin/env python3
"""Bunny's API for the frp-bunny demo's setup and teardown, with the key from the file that DEMO_BUNNY_KEY_FILE names,
which it never prints. It lists the Magic Containers apps: Bunny's list of pull zones leaves out the zones in front of
a Magic Container, the stack's own zone included.

bunny.py apps   print the name of each Magic Containers app, one a line
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


if sys.argv[1:] == ["apps"]:
    for app in json.loads(call("GET", "/mc/apps")).get("items", []):
        print(app["name"])
else:
    sys.exit(__doc__)
