#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"

echo "=== Klee Code Build & Start ==="
mkdir -p "$LOG_DIR"

# 1. MongoDB (Docker Compose)
echo ""
echo "[1/3] Starting MongoDB..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d
echo "MongoDB started."

# 2. Backend (Spring Boot)
echo ""
echo "[2/3] Building backend..."
cd "$ROOT_DIR/backend"
./gradlew bootJar -q
echo "Backend build complete."

echo "Starting backend server..."
nohup java -jar build/libs/*.jar > "$BACKEND_LOG" 2>&1 &
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
cd "$ROOT_DIR/extension/klee-code"
npm install --silent
npm run package
echo "Extension build complete."

echo ""
echo "=== Done ==="
echo "Backend PID: $BACKEND_PID"
echo "Backend log: $BACKEND_LOG"
echo "Extension VSIX: $(ls "$ROOT_DIR/extension/klee-code/"*.vsix 2>/dev/null || echo 'run: vsce package')"
echo ""
echo "To open the assistant UI:"
echo "  code $ROOT_DIR/extension/klee-code"
echo "  Then press F5 in VSCode and open the Klee Code icon in the new window."
echo ""
echo "To stop backend: kill $BACKEND_PID"
echo "To stop MongoDB: docker compose -f $ROOT_DIR/docker-compose.yml down"
