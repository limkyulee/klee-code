#!/bin/bash
set -e
set -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
EXTENSION_BUILD_LOG="$LOG_DIR/extension-build.log"
EXTENSION_DIR="$ROOT_DIR/extension"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

required_node_version() {
  cat "$EXTENSION_DIR/.node-version" 2>/dev/null || echo "22.12.0"
}

node_version_satisfies() {
  local node_binary="$1"
  local required_version="$2"

  "$node_binary" -e '
    const required = process.argv[1].split(".").map(Number);
    const current = process.versions.node.split(".").map(Number);
    const ok = current[0] > required[0]
      || (current[0] === required[0] && current[1] > required[1])
      || (current[0] === required[0] && current[1] === required[1] && current[2] >= required[2]);

    process.exit(ok ? 0 : 1);
  ' "$required_version"
}

setup_node_from_version_file() {
  local required_version
  required_version="$(required_node_version)"

  if ! command -v fnm >/dev/null 2>&1; then
    return
  fi

  echo "Configuring Node from $EXTENSION_DIR/.node-version with fnm..."
  local fnm_env
  if ! fnm_env="$(fnm env --shell bash 2>/dev/null)"; then
    echo "fnm is installed, but fnm env failed. Continuing with current PATH."
    return
  fi

  eval "$fnm_env"

  local current_dir
  current_dir="$PWD"
  cd "$EXTENSION_DIR"
  if fnm use --silent-if-unchanged "$required_version"; then
    echo "Using Node $(node -v) via fnm."
  else
    echo "fnm could not use Node $required_version. Continuing with current PATH."
  fi
  cd "$current_dir"
}

log_extension() {
  echo "$*" | tee -a "$EXTENSION_BUILD_LOG"
}

extension_command() {
  log_extension "$ $*"

  set +e
  "$@" 2>&1 | tee -a "$EXTENSION_BUILD_LOG"
  local status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -ne 0 ]; then
    log_extension "Extension build failed while running: $*"
    echo "Extension build failed. See log: $EXTENSION_BUILD_LOG"
    exit "$status"
  fi
}

print_extension_node_diagnostics() {
  local npm_script_node_path=""
  log_extension "Node diagnostics:"
  log_extension "  node version: $(node -v)"
  log_extension "  npm version: $(npm -v)"
  log_extension "  node path: $(command -v node)"
  log_extension "  npm path: $(command -v npm)"

  npm_script_node_path="$(npm run env --silent 2>/dev/null | sed -n 's/^npm_node_execpath=//p' | tail -n 1 || true)"
  if [ -n "$npm_script_node_path" ]; then
    log_extension "  npm script node path: $npm_script_node_path"
    log_extension "  npm script node version: $("$npm_script_node_path" -v)"
  else
    log_extension "  npm script node path: unavailable"
  fi
}

require_node_version() {
  local required_version
  local npm_script_node_path
  required_version="$(required_node_version)"

  if ! node_version_satisfies "$(command -v node)" "$required_version"; then
    echo "Node $required_version or newer is required for the VSCode extension."
    echo "Current node: $(node -v) ($(command -v node))"
    echo "Use fnm, nvm, or PATH so the extension build runs with Node $required_version or newer."
    exit 1
  fi

  npm_script_node_path="$(npm run env --silent 2>/dev/null | sed -n 's/^npm_node_execpath=//p' | tail -n 1 || true)"
  if [ -n "$npm_script_node_path" ] && ! node_version_satisfies "$npm_script_node_path" "$required_version"; then
    echo "Node $required_version or newer is required for npm scripts."
    echo "npm script node: $("$npm_script_node_path" -v) ($npm_script_node_path)"
    echo "Current node: $(node -v) ($(command -v node))"
    echo "Use fnm, nvm, or PATH so npm scripts run with Node $required_version or newer."
    echo "Extension build log: $EXTENSION_BUILD_LOG"
    exit 1
  fi
}

prepare_extension_build_log() {
  : > "$EXTENSION_BUILD_LOG"
  log_extension "=== Klee Code Extension Build ==="
  log_extension "Working directory: $EXTENSION_DIR"
  log_extension "Required Node: $(required_node_version)+"
}

print_log_help() {
  echo "Logs:"
  echo "  Backend log: $BACKEND_LOG"
  echo "  Extension build log: $EXTENSION_BUILD_LOG"
  echo "  Full start log: ./start.sh 2>&1 | tee $LOG_DIR/start.log"
  echo ""
  echo "To inspect extension build errors directly:"
  echo "  cd $EXTENSION_DIR"
  echo "  npm run package"
}

preflight_extension_node() {
  local current_dir
  current_dir="$PWD"
  cd "$EXTENSION_DIR"
  prepare_extension_build_log
  print_extension_node_diagnostics
  require_node_version
  cd "$current_dir"
}

echo "=== Klee Code Build & Start ==="
mkdir -p "$LOG_DIR"

require_command docker
require_command java
require_command curl
setup_node_from_version_file
require_command node
require_command npm
preflight_extension_node

# 1. MongoDB (Docker Compose)
echo ""
echo "[1/3] Starting MongoDB..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d mongodb
echo "MongoDB started."

# 2. Backend (Spring Boot)
echo ""
echo "[2/3] Building backend..."
cd "$ROOT_DIR/backend"
./gradlew bootJar -q
echo "Backend build complete."

echo "Starting backend server..."
BACKEND_JAR="$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' -print -quit)"
if [ -z "$BACKEND_JAR" ]; then
  echo "Executable backend jar not found in backend/build/libs"
  exit 1
fi

export KLEE_LLM_BASE_URL="${KLEE_LLM_BASE_URL:-http://localhost:11434}"
echo "Using Ollama base URL: $KLEE_LLM_BASE_URL"

nohup java -jar "$BACKEND_JAR" > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
echo "Backend running (PID: $BACKEND_PID)"

echo "Waiting for backend on http://localhost:8080..."
for i in {1..30}; do
  HTTP_STATUS="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/chat || true)"
  if [ "$HTTP_STATUS" != "000" ]; then
    echo "Backend is responding (HTTP $HTTP_STATUS)."
    break
  fi

  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend stopped during startup. See log: $BACKEND_LOG"
    exit 1
  fi

  if [ "$i" -eq 30 ]; then
    echo "Backend did not respond within 30 seconds. See log: $BACKEND_LOG"
    exit 1
  fi

  sleep 1
done

# 3. VSCode Extension
echo ""
echo "[3/3] Building VSCode extension..."
cd "$EXTENSION_DIR"
if [ -f package-lock.json ]; then
  extension_command npm ci --silent
else
  extension_command npm install --silent
fi
extension_command npm run package
echo "Extension build complete."

echo ""
echo "=== Done ==="
echo "Backend PID: $BACKEND_PID"
echo "Backend log: $BACKEND_LOG"
echo "Extension build log: $EXTENSION_BUILD_LOG"
echo "Extension build output: $EXTENSION_DIR/dist"
echo ""
print_log_help
echo ""
echo "To open the assistant UI:"
echo "  code $EXTENSION_DIR"
echo "  Then press F5 in VSCode and open the Klee Code icon in the new window."
echo ""
echo "To stop backend: lsof -n -i4TCP:8080 | kill -9 {PID}"
echo "To stop local Compose services: docker compose -f $ROOT_DIR/docker-compose.yml down"
