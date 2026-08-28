#!/usr/bin/env bash
# Start the Profills LinkedIn picker and print chat-safe JSON.
# Usage: start-server.sh [--dados-dir <path>] [--open]
#
# Session lives at <DADOS>/.picker/current/.
# --dados-dir is the pasta de dados. Default: <git toplevel>/linkedin-data when
# that folder exists, else ~/Profills LinkedIn.
#
# Options:
#   --dados-dir <path>    Pasta DADOS. Session: <path>/.picker/current.
#   --host <bind-host>    Host/interface to bind (default: 127.0.0.1).
#   --url-host <host>     Hostname shown in returned URL JSON.
#   --idle-timeout-minutes <n>  Shut down after n minutes idle (default 240).
#   --open                Open a local tab (also when already running). Adds
#                         "opened": true|false to the JSON.
#   --foreground          Run in the current terminal (JSON is printed first).
#   --background          Force background mode.
#
# Output: one JSON line {status, url, port[, opened]}. The URL never carries
# the session key; the key only travels inside the tab --open launches.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
DADOS_DIR=""
FOREGROUND="false"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""
IDLE_TIMEOUT_MINUTES=""
OPEN="false"
need_value() {
  if [[ $# -lt 2 || -z "$2" || "$2" == --* ]]; then
    echo "{\"error\": \"$1 precisa de um valor\"}"
    exit 1
  fi
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dados-dir|--project-dir)
      need_value "$@"
      DADOS_DIR="$2"
      shift 2
      ;;
    --host)
      need_value "$@"
      BIND_HOST="$2"
      shift 2
      ;;
    --url-host)
      need_value "$@"
      URL_HOST="$2"
      shift 2
      ;;
    --idle-timeout-minutes)
      need_value "$@"
      IDLE_TIMEOUT_MINUTES="$2"
      shift 2
      ;;
    --open)
      OPEN="true"
      shift
      ;;
    --foreground|--no-daemon)
      FOREGROUND="true"
      shift
      ;;
    --background|--daemon)
      FORCE_BACKGROUND="true"
      shift
      ;;
    *)
      echo "{\"error\": \"Argumento desconhecido: $1\"}"
      exit 1
      ;;
  esac
done

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

if [[ -n "$IDLE_TIMEOUT_MINUTES" ]]; then
  if ! [[ "$IDLE_TIMEOUT_MINUTES" =~ ^[0-9]+$ ]] || [[ "$IDLE_TIMEOUT_MINUTES" -lt 1 ]]; then
    echo '{"error": "--idle-timeout-minutes precisa ser um inteiro positivo"}'
    exit 1
  fi
  export BRAINSTORM_IDLE_TIMEOUT_MS=$(( IDLE_TIMEOUT_MINUTES * 60 * 1000 ))
fi

is_windows_like_shell() {
  case "${OSTYPE:-}" in
    msys*|cygwin*|mingw*) return 0 ;;
  esac
  if [[ -n "${MSYSTEM:-}" ]]; then
    return 0
  fi
  local uname_s
  uname_s="$(uname -s 2>/dev/null || true)"
  case "$uname_s" in
    MSYS*|MINGW*|CYGWIN*) return 0 ;;
  esac
  return 1
}

# Some environments reap detached/background processes. Auto-foreground when detected.
if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  FOREGROUND="true"
fi

# Windows/Git Bash reaps nohup background processes. Auto-foreground when detected.
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  if is_windows_like_shell; then
    FOREGROUND="true"
  fi
fi

# Session files (server.log, server-info, .last-token) embed the session key —
# keep everything this script and the server create owner-only.
umask 077

# Default pasta DADOS follows the CLAUDE.md invariant: a git repo that already
# has linkedin-data/ uses it; anything else (plugin install included) uses the
# user's folder. Resolved from the caller's cwd, not from where the plugin lives.
if [[ -z "$DADOS_DIR" ]]; then
  TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$TOPLEVEL" && -d "$TOPLEVEL/linkedin-data" ]]; then
    DADOS_DIR="$TOPLEVEL/linkedin-data"
  else
    DADOS_DIR="${HOME}/Profills LinkedIn"
  fi
fi

# One live picker per pasta de dados. Ready occupancy is reused; stale occupancy is replaced.
SESSION_DIR="${DADOS_DIR}/.picker/current"
export BRAINSTORM_PORT_FILE="${DADOS_DIR}/.picker/.last-port"
export BRAINSTORM_TOKEN_FILE="${DADOS_DIR}/.picker/.last-token"

STATE_DIR="${SESSION_DIR}/state"
CONTENT_DIR="${SESSION_DIR}/content"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"
SERVER_ID_FILE="${STATE_DIR}/server-instance-id"
LIFECYCLE_LIB="${SCRIPT_DIR}/lifecycle-lib.cjs"

# Prints the chat JSON, opening the browser first when asked. The key stays in
# the token file and in the tab; stdout only says whether a launcher ran.
finish() {
  local status="$1"
  local opened="skip"
  if [[ "$OPEN" == "true" && "$BIND_HOST" != "127.0.0.1" && "$BIND_HOST" != "localhost" ]]; then
    opened="false"
  elif [[ "$OPEN" == "true" ]]; then
    if node "$LIFECYCLE_LIB" open "$STATE_DIR" "$BRAINSTORM_TOKEN_FILE" "$URL_HOST"; then
      opened="true"
    else
      opened="false"
    fi
  fi
  node "$LIFECYCLE_LIB" print "$status" "$STATE_DIR" "$URL_HOST" "$opened"
}

if node "$LIFECYCLE_LIB" ready "$STATE_DIR"; then
  finish already_running
  exit 0
fi

OCCUPANCY="started"
if [[ -d "$STATE_DIR" ]]; then
  if ! "$SCRIPT_DIR/stop-server.sh" "$SESSION_DIR" >/dev/null; then
    echo '{"error":"não consegui substituir o picker que estava no ar"}'
    exit 1
  fi
  OCCUPANCY="replaced"
fi

mkdir -p "$CONTENT_DIR" "$STATE_DIR"
rm -f "${STATE_DIR}/server-stopped" "$LOG_FILE"
# A new server must not inherit a choice: the events file is append-only and a
# click from the previous run would read as today's. The screen in content/
# stays, so a restart after a crash or idle timeout shows the same options.
rm -f "${STATE_DIR}/events"

SERVER_ID=""
if [[ -r /dev/urandom ]]; then
  SERVER_ID="$(od -An -N24 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n' || true)"
fi
if ! [[ "$SERVER_ID" =~ ^[A-Za-z0-9_-]{32,64}$ ]]; then
  SERVER_ID="$(printf '%08x%08x%08x%08x' "$$" "$(date +%s)" "${RANDOM:-0}" "${RANDOM:-0}")"
fi
printf '%s\n' "$SERVER_ID" > "$SERVER_ID_FILE"
chmod 600 "$SERVER_ID_FILE" 2>/dev/null || true

cd "$SCRIPT_DIR" || exit 1

# Owner PID: the process that outlives this script (its grandparent). When it
# dies the server shuts itself down (see server.cjs lifecycle check).
OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi

# Windows/MSYS2: Node.js cannot see POSIX PIDs from the MSYS2 namespace.
# Passing a PID node cannot verify causes server to log owner-pid-invalid
# and self-terminate at the 60-second lifecycle check. Clear it so the
# watchdog is disabled and the idle timeout becomes the only shutdown trigger.
if is_windows_like_shell; then
  OWNER_PID=""
fi

# Shown inside a JSON string: the inner quotes around DADOS_DIR are escaped.
RECOVERY="$SCRIPT_DIR/start-server.sh --dados-dir \\\"$DADOS_DIR\\\" --host $BIND_HOST --url-host $URL_HOST --foreground"

if [[ "$FOREGROUND" == "true" ]]; then
  env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs "--brainstorm-server-id=$SERVER_ID" > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
else
  # nohup to survive shell exit; disown to remove from job table
  nohup env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs "--brainstorm-server-id=$SERVER_ID" > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null
fi
echo "$SERVER_PID" > "$PID_FILE"

# Ready means identity-matched live process and HTTP accept, not a log line.
READY="false"
for _ in {1..50}; do
  if node "$LIFECYCLE_LIB" ready "$STATE_DIR"; then
    READY="true"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    "$SCRIPT_DIR/stop-server.sh" "$SESSION_DIR" >/dev/null || true
    echo "{\"error\": \"O picker subiu e foi encerrado. Tente num terminal que fique aberto: $RECOVERY\"}"
    exit 1
  fi
  sleep 0.1
done

if [[ "$READY" != "true" ]]; then
  "$SCRIPT_DIR/stop-server.sh" "$SESSION_DIR" >/dev/null || true
  echo '{"error": "O picker não respondeu em 5 segundos"}'
  exit 1
fi

# Same JSON in both modes. Foreground then holds the terminal until the server
# exits, so callers in that mode read the first line and keep the call running.
finish "$OCCUPANCY"
if [[ "$FOREGROUND" == "true" ]]; then
  wait "$SERVER_PID"
  exit $?
fi
exit 0
