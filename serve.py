"""Local server for testing Dino Dig on a phone over Wi-Fi.

Same as `python -m http.server`, but tells the browser not to cache,
so every reload on the phone picks up the latest version.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "game")


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=ROOT)
print(f"Serving {ROOT} on http://0.0.0.0:{PORT}", flush=True)
ThreadingHTTPServer(("0.0.0.0", PORT), handler).serve_forever()
