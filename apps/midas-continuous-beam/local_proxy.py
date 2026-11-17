"""
local_proxy.py: a small local relay so browser-based HTML apps can call the
MIDAS Civil NX API even if the MIDAS server blocks direct browser (CORS) calls.

    python local_proxy.py            # listens on http://127.0.0.1:8765

In the HTML app, turn on "Use local proxy". The app then sends
    http://127.0.0.1:8765/?target=<full MIDAS URL>
and this script forwards the request (method, body, MAPI-Key header) to MIDAS
and returns the response with CORS headers added.

Standard library only. It only forwards to *.midasit.com, so it can't be used
as a general-purpose open proxy. It listens on 127.0.0.1 (this PC) only.
"""
import http.server
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

HOST, PORT = "127.0.0.1", 8765
ALLOWED_SUFFIX = ".midasit.com"


class Relay(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, MAPI-Key")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _forward(self):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        target = (qs.get("target") or [""])[0]
        host = urllib.parse.urlparse(target).hostname or ""
        if not target.startswith("https://") or not host.endswith(ALLOWED_SUFFIX):
            return self._reply(400, json.dumps({"error": "target must be https://*.midasit.com"}).encode())

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {"Content-Type": "application/json"}
        if self.headers.get("MAPI-Key"):
            headers["MAPI-Key"] = self.headers["MAPI-Key"]

        req = urllib.request.Request(target, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                self._reply(r.status, r.read())
        except urllib.error.HTTPError as e:
            self._reply(e.code, e.read())
        except Exception as e:  # network error, timeout, etc.
            self._reply(502, json.dumps({"error": str(e)}).encode())

    def _reply(self, status, payload):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PUT = do_DELETE = _forward

    def log_message(self, fmt, *args):
        sys.stderr.write("[midas-proxy] " + (fmt % args) + "\n")


if __name__ == "__main__":
    print(f"MIDAS relay on http://{HOST}:{PORT}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer((HOST, PORT), Relay).serve_forever()
