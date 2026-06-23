#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
EXTENSION_DIR="$ROOT_DIR/extension"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_node_version() {
  local required_version
  required_version="$(cat "$EXTENSION_DIR/.node-version" 2>/dev/null || echo "22.12.0")"

  node -e '
    const required = process.argv[1].split(".").map(Number);
    const current = process.versions.node.split(".").map(Number);
    const ok = current[0] > required[0]
      || (current[0] === required[0] && current[1] > required[1])
      || (current[0] === required[0] && current[1] === required[1] && current[2] >= required[2]);

    if (!ok) {
      console.error(`Node ${required.join(".")} or newer is required. Current: ${process.versions.node}`);
      process.exit(1);
    }
  ' "$required_version"
}

echo "=== Klee Code Build & Start ==="
mkdir -p "$LOG_DIR"

require_command docker
require_command java
require_command curl
require_command node
require_command npm
require_node_version

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
  npm ci --silent
else
  npm install --silent
fi
npm run package
echo "Extension build complete."

echo ""
echo "=== Done ==="
echo "Backend PID: $BACKEND_PID"
echo "Backend log: $BACKEND_LOG"
echo "Extension build output: $EXTENSION_DIR/dist"
echo ""
echo "To open the assistant UI:"
echo "  code $EXTENSION_DIR"
echo "  Then press F5 in VSCode and open the Klee Code icon in the new window."
echo ""
echo "To stop backend: lsof -n -i4TCP:8080 | kill -9 {PID}"
echo "To stop local Compose services: docker compose -f $ROOT_DIR/docker-compose.yml down"
