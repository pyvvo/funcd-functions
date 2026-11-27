#!/usr/bin/env python3
"""The frp-bunny demo's site api: GET <path> answers what funcd's API answers at <path>, read with FUNCD_TOKEN, since
a wait of the demo engine sends no token. It listens on 127.0.0.1, at the port its argument names."""

import http.server
import os
import sys
import urllib.error
import urllib.request

UPSTREAM = os.environ["FUNCD_SERVER"]
TOKEN = os.environ["FUNCD_TOKEN"]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        request = urllib.request.Request(
            UPSTREAM + self.path, headers={"Authorization": "Bearer " + TOKEN}
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as answer:
                status, body = answer.status, answer.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read()
        except OSError as error:
            status, body = 502, str(error).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass


http.server.ThreadingHTTPServer(
    ("127.0.0.1", int(sys.argv[1])), Handler
).serve_forever()
