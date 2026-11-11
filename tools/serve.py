#!/usr/bin/env python3
"""Kleiner statischer Webserver für das Spiel (nur lokal erreichbar).

Aufruf:  python3 tools/serve.py [--port 8317] [--open] [--verbose]

ES-Module lassen sich im Browser nicht direkt per Doppelklick (file://) laden,
deshalb liefert dieses Skript den Projektordner über http://127.0.0.1 aus.
"""
import argparse
import http.server
import os
import socket
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".html": "text/html; charset=utf-8",
    }
    verbose = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Während der Entwicklung nie veraltete Module aus dem Cache laden.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if Handler.verbose:
            super().log_message(fmt, *args)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--port", type=int, default=8317)
    parser.add_argument("--open", action="store_true", help="Spiel im Standardbrowser öffnen")
    parser.add_argument("--verbose", action="store_true", help="jede Anfrage protokollieren")
    parser.add_argument("--strict-port", action="store_true", help="nicht auf den nächsten freien Port ausweichen")
    args = parser.parse_args()
    Handler.verbose = args.verbose

    server = None
    port = args.port
    for candidate in range(args.port, args.port + (1 if args.strict_port else 20)):
        try:
            server = Server(("127.0.0.1", candidate), Handler)
            port = candidate
            break
        except OSError:
            continue
    if server is None:
        print(f"Kein freier Port ab {args.port} gefunden.", file=sys.stderr)
        return 1

    url = f"http://127.0.0.1:{port}/"
    print(f"Spiel läuft unter {url}  (Beenden mit Strg+C)", flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
