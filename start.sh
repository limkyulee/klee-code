#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Klee Code Build & Start ==="

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
java -jar build/libs/*.jar &
BACKEND_PID=$!
echo "Backend running (PID: $BACKEND_PID)"

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
echo "Extension VSIX: $(ls "$ROOT_DIR/extension/klee-code/"*.vsix 2>/dev/null || echo 'run: vsce package')"
echo ""
echo "To stop backend: kill $BACKEND_PID"
echo "To stop MongoDB: docker compose -f $ROOT_DIR/docker-compose.yml down"
