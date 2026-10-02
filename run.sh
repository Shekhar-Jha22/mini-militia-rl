#!/usr/bin/env bash
# One-command launcher: installs deps (Python venv + npm), then starts backend (:5000) and frontend (:5173).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
BACKEND_PORT=5000
FRONTEND_PORT=5173
SYS_PY="${PYTHON:-python3}"

say() { printf '\n▶  %s\n' "$*"; }
die() { printf '\n✗  %s\n' "$*" >&2; exit 1; }
port_busy() {
    if command -v lsof >/dev/null 2>&1; then lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
    else (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; fi
}

printf '\n╔══════════════════════════════════════════╗\n║     Mini-Militia RL  —  Launcher         ║\n╚══════════════════════════════════════════╝\n'

# ── 0. Prerequisites ──────────────────────────
command -v "$SYS_PY" >/dev/null || die "python3 not found (need Python 3.10+)."
"$SYS_PY" -c 'import sys; sys.exit(sys.version_info < (3, 10))' || die "Python 3.10+ required."
command -v node >/dev/null && command -v npm >/dev/null || die "Node.js 18+ and npm are required."
for p in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    port_busy "$p" && die "Port $p is already in use. Stop whatever is using it and re-run."
done

# ── 1. Python deps (isolated venv) ────────────
say "Installing Python dependencies (first run downloads PyTorch, so it can take a few minutes)..."
[ -d .venv ] || "$SYS_PY" -m venv .venv
PY="$ROOT/.venv/bin/python"
"$PY" -m pip install --quiet -r requirements.txt
echo "   ✓ Python deps installed"

# ── 2. Node deps ──────────────────────────────
say "Installing frontend dependencies..."
(cd frontend && npm install --no-audit --no-fund --silent)
echo "   ✓ npm deps installed"

# ── 3. Trained weights (shipped in the repo) ──
say "Checking trained model weights..."
for m in map1 map2; do
    ls models/$m/final_v1.zip models/$m/v1_best.zip models/$m/best.zip >/dev/null 2>&1 \
        || die "No trained weights found in models/$m/. They ship with the repo — re-clone or restore the models/ folder."
done
echo "   ✓ Weights found"

# ── 4. Start services ─────────────────────────
mkdir -p logs
PIDS=()
cleanup() {
    trap - EXIT INT TERM
    printf '\nStopping services...\n'
    [ ${#PIDS[@]} -gt 0 ] && kill "${PIDS[@]}" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for_port() {  # port, pid, name
    for _ in $(seq 1 120); do
        port_busy "$1" && return 0
        kill -0 "$2" 2>/dev/null || die "$3 crashed on startup. See logs/$(echo "$3" | tr 'A-Z' 'a-z').log"
        sleep 1
    done
    die "$3 did not start within 120s. See logs/."
}

say "Starting backend on :$BACKEND_PORT ..."
"$PY" server.py > logs/backend.log 2>&1 &
PIDS+=($!)
wait_for_port "$BACKEND_PORT" "${PIDS[0]}" Backend

say "Starting frontend on :$FRONTEND_PORT ..."
(cd frontend && exec ./node_modules/.bin/vite --port "$FRONTEND_PORT" --strictPort > ../logs/frontend.log 2>&1) &
PIDS+=($!)
wait_for_port "$FRONTEND_PORT" "${PIDS[1]}" Frontend

URL="http://localhost:$FRONTEND_PORT"
printf '\n╔══════════════════════════════════════════╗\n║  ✓  All services started                 ║\n║  Open →  %-31s ║\n║  API  →  http://localhost:%-14s ║\n║  Press Ctrl+C to stop                    ║\n╚══════════════════════════════════════════╝\n' "$URL" "$BACKEND_PORT"
{ command -v open >/dev/null && open "$URL"; } || { command -v xdg-open >/dev/null && xdg-open "$URL"; } || true

# Stay in the foreground; exit if either service dies.
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 2; done
die "A service exited unexpectedly. Check logs/backend.log and logs/frontend.log."
