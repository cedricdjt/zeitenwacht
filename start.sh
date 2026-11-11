#!/usr/bin/env bash
# Startet das Spiel: kleiner lokaler Webserver plus Browserfenster.
# Aufruf: ./start.sh            (Port 8317; ist er belegt, wird der nächste freie genommen)
#         ./start.sh --port 9000
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 wurde nicht gefunden. Bitte Python 3 installieren oder einen beliebigen anderen Webserver auf diesen Ordner zeigen lassen." >&2
  exit 1
fi
exec python3 tools/serve.py --open "$@"
