#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    export "$line"
  done < .env.local
  set +a
  echo "[appable] loaded .env.local"
else
  echo "[appable] no .env.local found — running in mock mode"
fi

exec ./scripts/code.sh "$@"
